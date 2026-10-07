import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { acessoAlbumPermitido } from "@/app/lib/fotos-acesso-album";
import { createR2PresignedDownloadUrl } from "@/app/lib/r2";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; fotoId: string }> };

export async function GET(request: Request, context: Params) {
  try {
    const { id, fotoId } = await context.params;
    const acesso = new URL(request.url).searchParams.get("acesso");
    const supabase = createSupabaseServerClient();
    const { data: album } = await supabase.from("foto_eventos")
      .select("id, status, acesso_por_link, acesso_token, permite_download_gratis")
      .eq("id", id).maybeSingle();
    if (!acessoAlbumPermitido(album, acesso) || !album?.permite_download_gratis) {
      return NextResponse.json({ error: "Download não disponível." }, { status: 404 });
    }
    const { data: foto } = await supabase.from("foto_arquivos")
      .select("id, nome_original, mime_type, r2_original_key, status")
      .eq("id", fotoId).eq("evento_id", id).maybeSingle();
    if (!foto || foto.status !== "publicada" || !foto.r2_original_key) {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }
    const nome = foto.nome_original || `retratt-${foto.id}.${foto.mime_type?.startsWith("video/") ? "mp4" : "jpg"}`;
    return NextResponse.redirect(createR2PresignedDownloadUrl(foto.r2_original_key, nome), {
      headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao baixar arquivo." }, { status: 500 });
  }
}
