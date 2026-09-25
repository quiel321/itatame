import { NextResponse } from "next/server";
import { createR2PresignedGetUrl } from "@/app/lib/r2";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { acessoPedidoValido, bearerToken } from "@/app/lib/fotos-convidado";

export const runtime = "nodejs";
type Params = { params: Promise<{ itemId: string }> };

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

export async function GET(request: Request, context: Params) {
  try {
    const token = bearerToken(request);
    const acesso = new URL(request.url).searchParams.get("acesso");
    if (!token && !acesso) return NextResponse.json({ error: "Login necessário." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    let usuarioId: string | null = null;
    if (token) {
      const { data: auth } = await supabase.auth.getUser(token);
      if (!auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
      usuarioId = auth.user.id;
    }

    const { itemId } = await context.params;
    const { data: item } = await supabase
      .from("foto_pedido_itens")
      .select("id, pedido_id, download_liberado, download_expires_at, foto_pedidos(comprador_user_id, status), foto_arquivos(r2_original_key, nome_original, mime_type)")
      .eq("id", itemId)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: "Download não encontrado." }, { status: 404 });

    const pedido = primeiraRelacao(item.foto_pedidos);
    const foto = primeiraRelacao(item.foto_arquivos);
    const expirado = item.download_expires_at && new Date(item.download_expires_at) < new Date();
    const dono = usuarioId
      ? pedido?.comprador_user_id === usuarioId
      : acessoPedidoValido(String(item.pedido_id), acesso);
    if (!dono || pedido?.status !== "pago" || !item.download_liberado || expirado || !foto?.r2_original_key) {
      return NextResponse.json({ error: "Download não autorizado ou expirado." }, { status: 403 });
    }

    const arquivo = await fetch(createR2PresignedGetUrl(foto.r2_original_key, 120), { cache: "no-store" });
    if (!arquivo.ok || !arquivo.body) return NextResponse.json({ error: "Arquivo indisponível." }, { status: 502 });

    await supabase.from("foto_downloads").insert({
      item_id: item.id,
      user_id: usuarioId || pedido?.comprador_user_id || null,
      user_agent: request.headers.get("user-agent"),
    });

    const ehVideo = String(foto.mime_type || "").startsWith("video/");
    const nome = String(foto.nome_original || `retratt-${ehVideo ? "video" : "foto"}-${item.id}.${ehVideo ? "mp4" : "jpg"}`).replace(/[\r\n"\\/]/g, "-");
    return new NextResponse(arquivo.body, {
      headers: {
        "Content-Type": foto.mime_type || arquivo.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao baixar arquivo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
