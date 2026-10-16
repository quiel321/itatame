import type { Metadata } from "next";
import { carregarAutorFotos,carregarEventoFotos } from "@/app/lib/fotos-evento-servidor";
import { resumirFotoGaleria } from '@/app/lib/fotos-galeria';
import { metadataCompartilhamentoFotos } from "@/app/lib/fotos-og";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { acessoAlbumPermitido } from "@/app/lib/fotos-acesso-album";
import type { FotoAlbum } from "@/app/lib/fotos";
import EventoGaleriaCliente, { type GaleriaInicial } from "./EventoGaleriaCliente";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  const acesso = typeof busca.acesso === "string" ? busca.acesso : null;
  const album = typeof busca.album === "string" ? busca.album : null;
  const metadata = await metadataCompartilhamentoFotos({ tipo: "evento", eventoId: id, albumId: album, acesso });
  return acesso ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}

export default async function FotosEventoPage({ params, searchParams }: Props) {
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  const acesso = typeof busca.acesso === "string" ? busca.acesso : null;
  let initialData: GaleriaInicial | undefined;
  try {
    const supabase = createSupabaseServerClient();
    const eventoResult = await carregarEventoFotos(id);
    const evento = eventoResult.data;
    if (!evento || !acessoAlbumPermitido(evento, acesso)) return <EventoGaleriaCliente />;
    const [albunsResult, fotosResult, totalResult, videosResult, autor] = await Promise.all([
      supabase.from("foto_albuns").select("id, evento_id, fotografo_id, titulo, descricao, capa_url, status").eq("evento_id", id).eq("status", "publicado").order("ordem", { ascending: true }),
      supabase.from("foto_arquivos").select("id, evento_id, album_id, fotografo_id, titulo, mime_type, r2_preview_key, r2_thumb_key, preco_centavos, status, tags, fotografo_dados:fotografos!fotografo_id(nome, foto_url)").eq("evento_id", id).eq("status", "publicada").order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, 999),
      supabase.from("foto_arquivos").select("id", { count: "exact", head: true }).eq("evento_id", id).eq("status", "publicada"),
      supabase.from("foto_arquivos").select("id", { count: "exact", head: true }).eq("evento_id", id).eq("status", "publicada").like("mime_type", "video/%"),
      carregarAutorFotos(evento),
    ]);
    if (eventoResult.error || albunsResult.error || fotosResult.error || totalResult.error || videosResult.error) {
      throw new Error("Consulta inicial da galeria incompleta.");
    }
    if (evento?.status === "publicado") {
      const { acesso_token: _token, ...eventoPublico } = evento;
      initialData = {
        evento: { ...eventoPublico, ...autor },
        albuns: (albunsResult.data || []) as FotoAlbum[],
        fotos: (fotosResult.data || []).map(resumirFotoGaleria),
        totalMidias: totalResult.count,
        totalVideos: videosResult.count,
      };
    }
  } catch (error) {
    console.error("Falha ao carregar galeria no servidor:", error);
  }
  return <EventoGaleriaCliente initialData={initialData} acesso={initialData?.evento.acesso_por_link ? acesso : null} />;
}
