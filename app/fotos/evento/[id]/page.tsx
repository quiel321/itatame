import type { Metadata } from "next";
import { metadataCompartilhamentoFotos } from "@/app/lib/fotos-og";
import EventoGaleriaCliente from "./EventoGaleriaCliente";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  const album = typeof busca.album === "string" ? busca.album : null;
  return metadataCompartilhamentoFotos({ tipo: "evento", eventoId: id, albumId: album });
}

export default function FotosEventoPage() {
  return <EventoGaleriaCliente />;
}
