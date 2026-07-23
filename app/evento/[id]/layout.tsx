import { Metadata } from "next";
import { supabase } from "@/app/lib/supabase";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br";

// 1. Esta função roda no servidor apenas para ler o banco e criar a capa do link
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  const { data: evento } = await supabase
    .from("eventos")
    .select("nome, descricao, banner_url, cidade, estado, data_evento")
    .eq("id", id)
    .single();

  if (!evento) {
    return {
      title: "Evento não encontrado | iTatame",
    };
  }

  const local = [evento.cidade, evento.estado].filter(Boolean).join(" - ");
  const data = evento.data_evento
    ? new Date(`${evento.data_evento}T12:00:00`).toLocaleDateString("pt-BR")
    : null;
  const contexto = [data, local].filter(Boolean).join(" em ");
  const descricao = evento.descricao
    ? `${evento.descricao}. Confira inscrições, checagem, chaves, lutas ao vivo e resultados no iTatame.`
    : `Confira inscrições, checagem, chaves, lutas ao vivo e resultados do ${evento.nome}${contexto ? ` — ${contexto}` : ""}.`;
  const canonical = `${baseUrl}/evento/${id}`;

  return {
    title: `${evento.nome} | Inscrições e Chaves | iTatame`,
    description: descricao,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url: canonical,
      siteName: "iTatame",
      title: `${evento.nome} | iTatame`,
      description: descricao,
      images: [evento.banner_url || `${baseUrl}/capa-compartilhamento.jpg`],
    },
    twitter: {
      card: "summary_large_image",
      title: `${evento.nome} | iTatame`,
      description: descricao,
      images: [evento.banner_url || `${baseUrl}/capa-compartilhamento.jpg`],
    },
  };
}

// 2. Este componente simplesmente "envelopa" a sua page.tsx sem alterar nada visualmente
export default function EventoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
