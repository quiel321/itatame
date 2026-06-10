"use client";

import { useParams } from "next/navigation";
import EventoForm from "../../../_components/EventoForm";

export default function EditarEventoPage() {
  const params = useParams();
  return <EventoForm modo="editar" eventoId={params.id as string} />;
}
