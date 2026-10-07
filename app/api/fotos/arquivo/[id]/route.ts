import { NextResponse } from "next/server";
import { createR2PresignedGetUrl } from "@/app/lib/r2";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { acessoAlbumPermitido } from "@/app/lib/fotos-acesso-album";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const tipo = url.searchParams.get("tipo") || "preview";

    const supabase = createSupabaseServerClient();
    const { data: foto, error } = await supabase
      .from("foto_arquivos")
      .select("id, evento_id, status, mime_type, r2_original_key, r2_preview_key, r2_thumb_key, preview_url, thumb_url")
      .eq("id", id)
      .maybeSingle();

    if (error || !foto || foto.status !== "publicada") {
      return NextResponse.json({ error: "Foto nao encontrada." }, { status: 404 });
    }

    const { data: album } = await supabase.from("foto_eventos")
      .select("id, status, acesso_por_link, acesso_token")
      .eq("id", foto.evento_id).maybeSingle();
    if (!acessoAlbumPermitido(album, url.searchParams.get("acesso"))) {
      return NextResponse.json({ error: "Foto nao encontrada." }, { status: 404 });
    }

    const ehVideo = String(foto.mime_type || "").startsWith("video/");
    const key = tipo === "video-preview"
      ? foto.r2_thumb_key
      : tipo === "thumb"
        ? ehVideo ? foto.r2_preview_key || foto.r2_thumb_key : foto.r2_thumb_key || foto.r2_preview_key
        : foto.r2_preview_key || foto.r2_thumb_key;

    const urlPublica = tipo === "video-preview"
      ? foto.thumb_url
      : tipo === "thumb"
        ? ehVideo ? foto.preview_url || foto.thumb_url : foto.thumb_url || foto.preview_url
        : foto.preview_url || foto.thumb_url;

    if (urlPublica && /^https?:\/\//.test(urlPublica)) {
      const response = NextResponse.redirect(urlPublica);
      response.headers.set("Cache-Control", album?.acesso_por_link ? "private, no-store" : "public, max-age=300, s-maxage=300");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }

    if (!key) {
      return NextResponse.json({ error: "Preview ainda nao gerado." }, { status: 404 });
    }

    // O preview já é protegido por marca d'água. O navegador pode buscá-lo no R2
    // sem fazer a função da Vercel transmitir cada imagem ou vídeo inteiro.
    const response = NextResponse.redirect(createR2PresignedGetUrl(key, 3600), 307);
    response.headers.set("Cache-Control", album?.acesso_por_link ? "private, no-store" : "public, max-age=300, s-maxage=300");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao abrir preview." }, { status: 500 });
  }
}
