import type { Metadata } from "next";
import { metadataCompartilhamentoFotos } from "@/app/lib/fotos-og";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { acessoAlbumPermitido } from "@/app/lib/fotos-acesso-album";
import type { FotoAlbum, FotoArquivo } from "@/app/lib/fotos";
import EventoGaleriaCliente, { type GaleriaInicial } from "./EventoGaleriaCliente";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  if (typeof busca.acesso === "string") return { robots: { index: false, follow: false } };
  const album = typeof busca.album === "string" ? busca.album : null;
  return metadataCompartilhamentoFotos({ tipo: "evento", eventoId: id, albumId: album });
}

export default async function FotosEventoPage({ params, searchParams }: Props) {
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  const acesso = typeof busca.acesso === "string" ? busca.acesso : null;
  let initialData: GaleriaInicial | undefined;
  try {
    const supabase = createSupabaseServerClient();
    const eventoResult = await supabase.from("foto_eventos").select("id, nome, slug, descricao, local, cidade, estado, data_evento, capa_url, status, vendas_ate, desconto_combo_qtd, desconto_combo_percentual, descontos_progressivos, em_breve, organizador_user_id, created_by, acesso_por_link, acesso_token, permite_download_gratis").eq("id", id).maybeSingle();
    const evento = eventoResult.data;
    if (!acessoAlbumPermitido(evento, acesso)) return <EventoGaleriaCliente />;
    const [albunsResult, fotosResult, totalResult, videosResult] = await Promise.all([
      supabase.from("foto_albuns").select("id, evento_id, fotografo_id, titulo, descricao, capa_url, status").eq("evento_id", id).eq("status", "publicado").order("ordem", { ascending: true }),
      supabase.from("foto_arquivos").select("id, evento_id, album_id, fotografo_id, titulo, mime_type, r2_original_key, r2_preview_key, r2_thumb_key, preview_url, thumb_url, preco_centavos, status, tags, fotografo_dados:fotografos!fotografo_id(nome, foto_url)").eq("evento_id", id).eq("status", "publicada").order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, 999),
      supabase.from("foto_arquivos").select("id", { count: "exact", head: true }).eq("evento_id", id).eq("status", "publicada"),
      supabase.from("foto_arquivos").select("id", { count: "exact", head: true }).eq("evento_id", id).eq("status", "publicada").like("mime_type", "video/%"),
    ]);
    if (eventoResult.error || albunsResult.error || fotosResult.error || totalResult.error || videosResult.error) {
      throw new Error("Consulta inicial da galeria incompleta.");
    }
    if (evento?.status === "publicado") {
      const { acesso_token: _token, ...eventoPublico } = evento;
      let autorNome = "Organizador";
      let autorSlug = "";
      let autorId = "";
      let autorTelefone = "";
      let tipoAutor = "organizador";
      if (evento.organizador_user_id) {
        const { data: org } = await supabase.from("foto_organizadores").select("nome, slug").eq("id", evento.organizador_user_id).maybeSingle();
        if (org) { autorNome = org.nome || autorNome; autorSlug = org.slug || ""; }
      } else if (evento.created_by) {
        const { data: fotografo } = await supabase.from("fotografos").select("id, nome, telefone").eq("user_id", evento.created_by).maybeSingle();
        if (fotografo) { autorNome = fotografo.nome || "Fotógrafo Parceiro"; autorId = fotografo.id; autorTelefone = fotografo.telefone || ""; tipoAutor = "fotografo"; }
      }
      initialData = {
        evento: { ...eventoPublico, autor_nome: autorNome, autor_slug: autorSlug, autor_id: autorId, autor_telefone: autorTelefone, tipo_autor: tipoAutor },
        albuns: (albunsResult.data || []) as FotoAlbum[],
        fotos: (fotosResult.data || []) as FotoArquivo[],
        totalMidias: totalResult.count,
        totalVideos: videosResult.count,
      };
    }
  } catch (error) {
    console.error("Falha ao carregar galeria no servidor:", error);
  }
  return <EventoGaleriaCliente initialData={initialData} acesso={initialData?.evento.acesso_por_link ? acesso : null} />;
}
