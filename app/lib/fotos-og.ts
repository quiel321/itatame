import type { Metadata } from "next";
import { cache } from "react";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export type AlvoOgFotos =
  | { tipo: "evento"; eventoId: string; albumId?: string | null }
  | { tipo: "organizador"; slug: string };

export type DadosOgFotos = {
  titulo: string;
  descricao: string;
  capaUrl: string | null;
  caminho: string;
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
      capaUrl: org.capa_url || org.avatar_url || null,
      caminho: `/organizador/${encodeURIComponent(alvo.slug)}`,
    };
  }

  if (!UUID.test(alvo.eventoId)) return null;
  const { data: evento } = await supabase
    .from("foto_eventos")
    .select("id, nome, local, cidade, estado, data_evento, capa_url, status")
    .eq("id", alvo.eventoId)
    .maybeSingle();
  if (!evento || evento.status !== "publicado") return null;

  const album = alvo.albumId && UUID.test(alvo.albumId)
    ? (await supabase
        .from("foto_albuns")
        .select("id, titulo, capa_url")
        .eq("id", alvo.albumId)
        .eq("evento_id", evento.id)
        .eq("status", "publicado")
        .maybeSingle()).data
    : null;

  const onde = [evento.local, evento.cidade, evento.estado].filter(Boolean).join(" - ");
  const detalhes = [formatarData(evento.data_evento), onde].filter(Boolean).join(" · ");
  return {
    titulo: album ? `${album.titulo} · ${evento.nome}` : evento.nome,
    descricao: `${detalhes ? `${detalhes}. ` : ""}Encontre suas fotos por reconhecimento facial e compre em alta resolução.`,
    capaUrl: album?.capa_url || evento.capa_url || null,
    caminho: `/evento/${evento.id}${album ? `?album=${album.id}` : ""}`,
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
  for (const base of [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br"]) {
    try {
      if (base) hosts.add(new URL(base).host);
    } catch {
      /* variável de ambiente malformada */
    }
  }
  return hosts;
}

function versaoDaCapa(url: string) {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) hash = (hash * 31 + url.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

export function urlImagemOg(alvo: AlvoOgFotos, dados: DadosOgFotos | null) {
  if (!dados || !capaOgPermitida(dados.capaUrl)) return "/opengraph-image";
  const params = new URLSearchParams();
  if (alvo.tipo === "organizador") params.set("organizador", alvo.slug);
  else {
    params.set("evento", alvo.eventoId);
    if (alvo.albumId) params.set("album", alvo.albumId);
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
    alternates: { canonical: dados.caminho },
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
