import Link from "next/link";
import { dataOperacional, formatarDataHoraEvento, type EventoComEtapas } from "@/app/lib/evento-etapas";

export default function AvisoChaves({ eventoId, evento, erro }: { eventoId: string; evento: EventoComEtapas | null; erro?: string }) {
  const data = dataOperacional(evento?.data_divulgacao_chaves, false, evento?.estado);
  const agendadas = data && new Date() < data;
  return <section className="mx-auto max-w-xl px-4 py-8 text-white">
    <Link href={`/evento/${eventoId}`} className="text-xs text-zinc-400 hover:text-white">← Voltar ao campeonato</Link>
    <h1 className="mt-5 text-xl font-semibold">{erro ? "Chaves indisponíveis" : "As chaves ainda não foram geradas"}</h1>
    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{erro || (agendadas
      ? `Disponíveis em ${formatarDataHoraEvento(evento?.data_divulgacao_chaves, false, evento?.estado)}, no horário local do campeonato.`
      : "A organização está preparando as chaves. Elas aparecerão aqui assim que forem geradas.")}</p>
    <button onClick={() => window.location.reload()} className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-xs">Atualizar</button>
  </section>;
}
