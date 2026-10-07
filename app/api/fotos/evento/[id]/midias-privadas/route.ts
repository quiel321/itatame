import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { acessoAlbumPermitido } from "@/app/lib/fotos-acesso-album";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const parametros = new URL(request.url).searchParams;
    const supabase = createSupabaseServerClient();
    const { data: album } = await supabase.from("foto_eventos")
      .select("id, nome, status, acesso_por_link, acesso_token, desconto_combo_qtd, desconto_combo_percentual, descontos_progressivos")
      .eq("id", id).maybeSingle();
    if (!album?.acesso_por_link || !acessoAlbumPermitido(album, parametros.get("acesso"))) {
      return NextResponse.json({ error: "Álbum indisponível." }, { status: 404 });
    }
    const fotoId = parametros.get("foto");
    const fotoIds = (parametros.get("fotos") || "").split(",").filter(Boolean).slice(0, 50);
    const offset = Math.min(100_000, Math.max(0, Number(parametros.get("offset") || 0) || 0));
    let consulta = supabase.from("foto_arquivos")
      .select("id, evento_id, album_id, fotografo_id, titulo, mime_type, r2_original_key, r2_preview_key, r2_thumb_key, preview_url, thumb_url, preco_centavos, status, tags, fotografo_dados:fotografos!fotografo_id(nome, foto_url)")
      .eq("evento_id", id).eq("status", "publicada");
    if (fotoId) consulta = consulta.eq("id", fotoId);
    else if (fotoIds.length) consulta = consulta.in("id", fotoIds);
    else consulta = consulta.order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 999);
    const { data, error } = await consulta;
    if (error) throw error;
    const { acesso_token: _token, ...evento } = album;
    return NextResponse.json({ evento, fotos: data || [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao carregar álbum." }, { status: 500 });
  }
}
