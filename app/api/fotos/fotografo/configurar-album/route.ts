import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { bearerToken } from "@/app/lib/fotos-convidado";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });
    const supabase = createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser(token);
    if (!auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const body = await request.json();
    const albumId = String(body.albumId || "");
    if (!/^[0-9a-f-]{36}$/i.test(albumId) || typeof body.acessoPorLink !== "boolean" || typeof body.downloadGratuito !== "boolean") {
      return NextResponse.json({ error: "Configuração do álbum inválida." }, { status: 400 });
    }
    const { data: album } = await supabase.from("foto_eventos")
      .select("id, created_by, organizador_user_id, acesso_por_link, acesso_token")
      .eq("id", albumId).maybeSingle();
    if (!album || album.created_by !== auth.user.id || album.organizador_user_id) {
      return NextResponse.json({ error: "Álbum não encontrado para este fotógrafo." }, { status: 404 });
    }

    if (!body.downloadGratuito) {
      const { count, error: precoError } = await supabase.from("foto_arquivos")
        .select("id", { count: "exact", head: true })
        .eq("evento_id", albumId).eq("status", "publicada").eq("preco_centavos", 0);
      if (precoError) throw precoError;
      if (count) return NextResponse.json({ error: "Defina um preço para as mídias gratuitas antes de ativar a venda por foto." }, { status: 409 });
    }

    const { data, error } = await supabase.from("foto_eventos")
      .update({ acesso_por_link: body.acessoPorLink, permite_download_gratis: body.downloadGratuito, ...(body.acessoPorLink && !album.acesso_por_link ? { acesso_token: crypto.randomUUID() } : {}) })
      .eq("id", albumId).eq("created_by", auth.user.id)
      .select("id, acesso_por_link, permite_download_gratis, acesso_token").single();
    if (error || !data) throw error || new Error("Não foi possível salvar o álbum.");
    return NextResponse.json({ album: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao configurar álbum." }, { status: 500 });
  }
}
