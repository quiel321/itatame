import { Metadata } from "next";
import { supabase } from "@/app/lib/supabase"; // Ajustado para o seu caminho correto

// 1. Esta função roda no servidor apenas para ler o banco e criar a capa do link
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { data: evento } = await supabase
    .from("eventos")
    .select("nome, descricao, banner_url")
    .eq("id", params.id)
    .single();

  if (!evento) {
    return {
      title: "Evento não encontrado | iTatame",
    };
  }

  return {
    title: `${evento.nome} | iTatame`,
    description: evento.descricao || `Garanta sua inscrição e acompanhe o ${evento.nome} ao vivo no iTatame!`,
    openGraph: {
      title: evento.nome,
      description: evento.descricao || `Acesse agora para ver chaves, cronogramas e o Pay-Per-View do evento.`,
      // Aqui está a magia: ele puxa o banner do evento, se não tiver, usa a logo do site!
      images: [evento.banner_url || '/capa-compartilhamento.jpg'], 
    },
  };
}

// 2. Este componente simplesmente "envelopa" a sua page.tsx sem alterar nada visualmente
export default function EventoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}