import type { Metadata } from "next";
import { carregarEventoFotos } from "./fotos-evento-servidor";
import { cache } from "react";
import { acessoAlbumPermitido } from './fotos-acesso-album';
import { versaoDaCapa } from './fotos-compartilhamento';
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { caminhoPortfolioOrganizador } from './fotos-portfolio-url';

export type AlvoOgFotos =
  | { tipo: "evento"; eventoId: string; albumId?: string | null; acesso?: string | null }
  | { tipo: "organizador"; slug: string };

export type DadosOgFotos = {
  titulo: string;
  descricao: string;
  capaUrl: string | null;
  caminho: string;
  acessoRestrito?: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{1,120}$/i;

function formatarData(data?: string | null) {
  if (!data) return "";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : "";
}

export const carregarDadosOgFotos = cache(async (alvo: AlvoOgFotos): Promise<DadosOgFotos | null> => {
  const supabase = createSupabaseServerClient();

  if (alvo.tipo === "organizador") {
    if (!SLUG.test(alvo.slug)) return null;
    const { data: org } = await supabase
      .from("foto_organizadores")
      .select("nome, localizacao, capa_url, avatar_url")
      .eq("slug", alvo.slug)
      .maybeSingle();
    if (!org) return null;
    return {
      titulo: org.nome || "Organizador",
      descricao: `Galerias oficiais de ${org.nome || "eventos"}${org.localizacao ? ` · ${org.localizacao}` : ""}. Encontre suas fotos por evento ou reconhecimento facial.`,
      capaUrl: org.avatar_url || org.capa_url || null,
      caminho: caminhoPortfolioOrganizador(alvo.slug),
    };
  }

  if (!UUID.test(alvo.eventoId)) return null;
  const { data: evento } = await carregarEventoFotos(alvo.eventoId);
  if (!evento || !acessoAlbumPermitido(evento, alvo.acesso)) return null;

  const album = alvo.albumId && UUID.test(alvo.albumId)
    ? (await supabase
        .from("foto_albuns")
        .select("id, titulo, capa_url")
        .eq("id", alvo.albumId)
        .eq("evento_id", evento.id)
        .eq("status", "publicado")
        .maybeSingle()).data
    : null;

  const parametros = new URLSearchParams();
  if (album) parametros.set('album', album.id);
  if (evento.acesso_por_link && alvo.acesso) parametros.set('acesso', alvo.acesso);
  const onde = [evento.local, evento.cidade, evento.estado].filter(Boolean).join(" - ");
  const detalhes = [formatarData(evento.data_evento), onde].filter(Boolean).join(" · ");
  return {
    titulo: album ? `${album.titulo} · ${evento.nome}` : evento.nome,
    descricao: `${detalhes ? `${detalhes}. ` : ""}Encontre suas fotos por reconhecimento facial e compre em alta resolução.`,
    capaUrl: album?.capa_url || evento.capa_url || null,
    caminho: `/evento/${evento.id}${parametros.size ? `?${parametros}` : ''}`,
    acessoRestrito: Boolean(evento.acesso_por_link),
  };
});

export function capaOgPermitida(url: string | null): url is string {
  if (!url) return false;
  try {
    const alvo = new URL(url);
    return alvo.protocol === "https:" && hostsDeCapaPermitidos().has(alvo.host);
  } catch {
    return false;
  }
}

function hostsDeCapaPermitidos() {
  const hosts = new Set<string>();
  for (const base of [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br", process.env.MIDIA_PUBLICA_BASE_URL || 'https://itatame.com.br', process.env.NEXT_PUBLIC_FOTOS_URL || 'https://retratt.com', process.env.R2_ITATAME_PUBLIC_BASE_URL, process.env.R2_RETRATT_PUBLIC_BASE_URL]) {
    try {
      if (base) hosts.add(new URL(base).host);
    } catch {
      /* variável de ambiente malformada */
    }
  }
  return hosts;
}

export function urlImagemOg(alvo: AlvoOgFotos, dados: DadosOgFotos | null) {
  if (!dados || !capaOgPermitida(dados.capaUrl)) return "/opengraph-image";
  const params = new URLSearchParams();
  if (alvo.tipo === "organizador") { params.set("organizador", alvo.slug); params.set('perfil', 'logo'); }
  else {
    params.set("evento", alvo.eventoId);
    if (alvo.albumId) params.set("album", alvo.albumId);
    if (dados.acessoRestrito && alvo.acesso) params.set("acesso", alvo.acesso);
  }
  params.set("v", versaoDaCapa(dados.capaUrl));
  return `/api/fotos/og?${params.toString()}`;
}

export async function metadataCompartilhamentoFotos(alvo: AlvoOgFotos): Promise<Metadata> {
  const dados = await carregarDadosOgFotos(alvo).catch(() => null);
  if (!dados) return {};
  const imagem = urlImagemOg(alvo, dados);
  return {
    title: dados.titulo,
    description: dados.descricao,
    ...(dados.acessoRestrito ? { robots: { index: false, follow: false } } : { alternates: { canonical: dados.caminho } }),
    openGraph: {
      title: dados.titulo,
      description: dados.descricao,
      url: dados.caminho,
      siteName: "Retratt",
      locale: "pt_BR",
      type: "website",
      images: [{ url: imagem, width: 1200, height: 630, alt: dados.titulo }],
    },
    twitter: {
      card: "summary_large_image",
      title: dados.titulo,
      description: dados.descricao,
      images: [imagem],
    },
  };
}
