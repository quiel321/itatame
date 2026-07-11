import { NextResponse } from "next/server";
import { createR2PresignedGetUrl } from "@/app/lib/r2";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";
type Params = { params: Promise<{ itemId: string }> };

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

export async function GET(request: Request, context: Params) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser(token);
    if (!auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const { itemId } = await context.params;
    const { data: item } = await supabase
      .from("foto_pedido_itens")
      .select("id, download_liberado, download_expires_at, foto_pedidos(comprador_user_id, status), foto_arquivos(r2_original_key, nome_original, mime_type)")
      .eq("id", itemId)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: "Download não encontrado." }, { status: 404 });

    const pedido = primeiraRelacao(item.foto_pedidos);
    const foto = primeiraRelacao(item.foto_arquivos);
    const expirado = item.download_expires_at && new Date(item.download_expires_at) < new Date();
    if (pedido?.comprador_user_id !== auth.user.id || pedido?.status !== "pago" || !item.download_liberado || expirado || !foto?.r2_original_key) {
      return NextResponse.json({ error: "Download não autorizado ou expirado." }, { status: 403 });
    }

    const arquivo = await fetch(createR2PresignedGetUrl(foto.r2_original_key, 120), { cache: "no-store" });
    if (!arquivo.ok || !arquivo.body) return NextResponse.json({ error: "Arquivo indisponível." }, { status: 502 });

    await supabase.from("foto_downloads").insert({
      item_id: item.id,
      user_id: auth.user.id,
      user_agent: request.headers.get("user-agent"),
    });

    const nome = String(foto.nome_original || `itatame-foto-${item.id}.jpg`).replace(/[\r\n"\\/]/g, "-");
    return new NextResponse(arquivo.body, {
      headers: {
        "Content-Type": foto.mime_type || arquivo.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao baixar foto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

