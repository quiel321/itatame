import type { Metadata } from "next";
import { metadataCompartilhamentoFotos } from "@/app/lib/fotos-og";
import PerfilOrganizacaoCliente from "./PerfilOrganizacaoCliente";
import { carregarPortfolioOrganizador } from '@/app/lib/fotos-portfolio-servidor';
import { notFound } from 'next/navigation';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return metadataCompartilhamentoFotos({ tipo: "organizador", slug });
}

export default async function PerfilOrganizacaoPage({ params }: Props) {
  const { slug } = await params;
  const dados = await carregarPortfolioOrganizador(slug);
  if (!dados) notFound();
  return <PerfilOrganizacaoCliente dados={dados} />;
}
