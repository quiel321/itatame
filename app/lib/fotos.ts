export type FotoEvento = {
  id: string;
  nome: string;
  slug: string | null;
  local: string | null;
  cidade: string | null;
  estado: string | null;
  data_evento: string | null;
  capa_url: string | null;
  status: string | null;
  preco_padrao_centavos?: number | null;
  preco_video_centavos?: number | null;
  preco_bloqueado?: boolean;
  vendas_ate?: string | null;
  desconto_combo_qtd?: number | null;
  desconto_combo_percentual?: number | null;
};

export type FotoAlbum = {
  id: string;
  evento_id: string;
  fotografo_id: string | null;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  status: string | null;
  total_fotos?: number | null;
};

export type FotoArquivo = {
  id: string;
  evento_id: string;
  album_id: string | null;
  fotografo_id: string | null;
  titulo: string | null;
  r2_original_key: string;
  r2_preview_key: string | null;
  r2_thumb_key: string | null;
  preview_url: string | null;
  thumb_url: string | null;
  preco_centavos: number;
  status: string | null;
  mime_type?: string | null;
  tags?: string[] | null;
};

export function arquivoFotoEhVideo(arquivo?: Pick<FotoArquivo, "mime_type"> | null) {
  return Boolean(arquivo?.mime_type?.toLowerCase().startsWith("video/"));
}

export const FOTO_STATUS_EVENTO = {
  rascunho: "rascunho",
  publicado: "publicado",
  arquivado: "arquivado",
} as const;

export function formatarPrecoFotos(valorCentavos?: number | null) {
  const valor = Number(valorCentavos || 0) / 100;
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fotoStoragePath(eventoId: string, albumId: string, arquivoId: string, nomeArquivo: string) {
  const limpo = nomeArquivo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  return `eventos/${eventoId}/albuns/${albumId}/${arquivoId}-${limpo}`;
}
