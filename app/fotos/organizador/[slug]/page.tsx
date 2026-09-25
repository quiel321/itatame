import type { Metadata } from "next";
import { metadataCompartilhamentoFotos } from "@/app/lib/fotos-og";
import PerfilOrganizacaoCliente from "./PerfilOrganizacaoCliente";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return metadataCompartilhamentoFotos({ tipo: "organizador", slug });
}

export default function PerfilOrganizacaoPage() {
  return <PerfilOrganizacaoCliente />;
}
