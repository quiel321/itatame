"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Evento = {
  nome: string | null;
  banner_url?: string | null;
};

type Pontuacao = {
  pontos: number;
  vantagens: number;
  punicoes: number;
};

type LutaAoVivo = {
  id: string | number;
  evento_id?: string | number;
  tatame?: string | null;
  fase?: string | null;
  id_visual?: string | number | null;
  categoria?: string | null;
  faixa?: string | null;
  atleta_1?: string | null;
  atleta_2?: string | null;
  pontuacao_atleta_1?: Pontuacao | string | null;
  pontuacao_atleta_2?: Pontuacao | string | null;
  duracao_segundos?: number | null;
  iniciada_em?: string | null;
  ordem_tatame?: number | null;
  horario_estimado?: string | null;
  status_luta?: string | null;
  vencedor?: string | null;
  metodo_vitoria?: string | null;
  finalizada_em?: string | null;
};

const pontosVazios: Pontuacao = { pontos: 0, vantagens: 0, punicoes: 0 };
const fantasmas = ["BYE", "TBD", "A DEFINIR", "SEM OPONENTE", "SEM ADVERSARIO", "SEM ADVERSÁRIO"];

function limparNome(nome?: string | null) {
  return (nome || "").trim();
}

function isFantasma(nome?: string | null) {
  const normalizado = limparNome(nome).toUpperCase();
  if (!normalizado) return true;
  return fantasmas.some((fantasma) => normalizado === fantasma || normalizado.includes(fantasma));
}

function isLutaReal(luta: LutaAoVivo) {
  return !isFantasma(luta.atleta_1) && !isFantasma(luta.atleta_2);
}

function parsePontos(pontuacao: LutaAoVivo["pontuacao_atleta_1"]): Pontuacao {
  if (!pontuacao) return pontosVazios;
  if (typeof pontuacao === "object") return { ...pontosVazios, ...pontuacao };

  try {
    const parsed = JSON.parse(pontuacao) as Partial<Pontuacao>;
    return { ...pontosVazios, ...parsed };
  } catch {
    return pontosVazios;
  }
}

function formatarTempo(segundos?: number | null) {
  const total = Math.max(0, segundos || 0);
  const min = Math.floor(total / 60).toString().padStart(2, "0");
  const sec = (total % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function calcularTempoAoVivo(luta: LutaAoVivo, agora: number) {
  if (luta.status_luta !== "em_andamento") return luta.duracao_segundos || 0;

  const inicio = luta.iniciada_em ? new Date(luta.iniciada_em).getTime() : 0;
  if (!inicio || Number.isNaN(inicio)) return luta.duracao_segundos || 0;

  const decorrido = Math.max(0, Math.floor((agora - inicio) / 1000));
  if (!luta.duracao_segundos) return decorrido;

  return Math.max(0, luta.duracao_segundos - decorrido);
}

function formatarHorario(valor?: string | null) {
  if (!valor) return "A definir";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "A definir";
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function nomeMetodo(metodo?: string | null) {
  if (!metodo) return "Resultado";
  const normalizado = metodo.replace(/_/g, " ").toLowerCase();
  if (normalizado === "wo") return "W.O.";
  if (normalizado === "pontos") return "Pontos";
  if (normalizado === "finalizacao" || normalizado === "finalização") return "Finalização";
  return normalizado;
}

function statusLabel(status?: string | null) {
  if (status === "em_andamento") return "Ao vivo";
  if (status === "chamada") return "Chamada";
  if (status === "concluida") return "Finalizada";
  return "Na fila";
}

function subtituloLuta(luta: LutaAoVivo) {
  return [luta.fase, luta.categoria, luta.faixa].filter(Boolean).join(" - ");
}

function placarTexto(p1: Pontuacao, p2: Pontuacao) {
  return `${p1.pontos} x ${p2.pontos}`;
}

function LutaAoVivoCard({ luta, agora }: { luta: LutaAoVivo; agora: number }) {
  const p1 = parsePontos(luta.pontuacao_atleta_1);
  const p2 = parsePontos(luta.pontuacao_atleta_2);
  const tempoLuta = calcularTempoAoVivo(luta, agora);

  return (
    <article className="rounded-xl border border-red-500/30 bg-[#0a0a0e] p-4 shadow-lg">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="mb-1 inline-flex rounded bg-red-500/15 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-red-300">
            {statusLabel(luta.status_luta)}
          </span>
          <h3 className="truncate text-base font-black uppercase text-white">
            {luta.tatame || "Tatame"} {luta.id_visual ? `- Luta ${luta.id_visual}` : ""}
          </h3>
          <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-widest text-cyan-300">{subtituloLuta(luta)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-right">
          <span className="block text-[8px] font-bold uppercase text-zinc-500">Tempo</span>
          <strong className="text-lg font-black text-white">{formatarTempo(tempoLuta)}</strong>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-white/5 bg-black/30 p-3">
        <strong className="truncate text-sm font-black uppercase text-blue-200">{luta.atleta_1}</strong>
        <div className="rounded-lg bg-white px-3 py-1 text-lg font-black text-black">{placarTexto(p1, p2)}</div>
        <strong className="truncate text-right text-sm font-black uppercase text-red-200">{luta.atleta_2}</strong>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        <span>Vantagens: <b className="text-yellow-300">{p1.vantagens}</b> x <b className="text-yellow-300">{p2.vantagens}</b></span>
        <span className="text-right">Punições: <b className="text-red-300">{p1.punicoes}</b> x <b className="text-red-300">{p2.punicoes}</b></span>
      </div>
    </article>
  );
}

function ResultadoLinha({ luta }: { luta: LutaAoVivo }) {
  const p1 = parsePontos(luta.pontuacao_atleta_1);
  const p2 = parsePontos(luta.pontuacao_atleta_2);
  const vencedor = limparNome(luta.vencedor) || "Aguardando confirmação";
  const perdedor = vencedor === limparNome(luta.atleta_1) ? luta.atleta_2 : luta.atleta_1;

  return (
    <article className="rounded-xl border border-green-500/20 bg-[#0a0a0e] p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded bg-green-500/15 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-green-300">Finalizada</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {luta.tatame || "Tatame"} {luta.id_visual ? `- Luta ${luta.id_visual}` : ""}
            </span>
          </div>
          <h3 className="truncate text-sm font-black uppercase text-green-300">Vencedor: {vencedor}</h3>
          {perdedor && <p className="truncate text-xs font-bold uppercase text-zinc-400">vs {perdedor}</p>}
          <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-widest text-cyan-400">{subtituloLuta(luta)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:justify-end">
          <span className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm font-black text-white">
            {placarTexto(p1, p2)}
          </span>
          <span className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-green-300">
            {nomeMetodo(luta.metodo_vitoria)}
          </span>
        </div>
      </div>
    </article>
  );
}

function FilaLinha({ luta, index }: { luta: LutaAoVivo; index: number }) {
  return (
    <article className="grid gap-3 rounded-xl border border-white/10 bg-[#0a0a0e] p-3 md:grid-cols-[56px_1fr_120px] md:items-center">
      <div className="text-xs font-black uppercase text-cyan-300">#{index + 1}</div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black uppercase text-white">
          {luta.atleta_1} x {luta.atleta_2}
        </p>
        <p className="truncate text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          {luta.tatame || "Tatame a definir"} - {subtituloLuta(luta) || statusLabel(luta.status_luta)}
        </p>
      </div>
      <div className="rounded-lg bg-black/35 px-3 py-2 text-left md:text-right">
        <span className="block text-[8px] font-bold uppercase tracking-widest text-zinc-500">Previsão</span>
        <strong className="text-xs font-black text-cyan-200">{formatarHorario(luta.horario_estimado)}</strong>
      </div>
    </article>
  );
}

export default function AoVivoPage() {
  const params = useParams();
  const eventoId = params.id as string;

  const [evento, setEvento] = useState<Evento | null>(null);
  const [lutasAtivas, setLutasAtivas] = useState<LutaAoVivo[]>([]);
  const [filaLutas, setFilaLutas] = useState<LutaAoVivo[]>([]);
  const [lutasFinalizadas, setLutasFinalizadas] = useState<LutaAoVivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [agora, setAgora] = useState(() => Date.now());

  const buscarLutas = useCallback(async () => {
    if (!eventoId) return;

    const { data } = await supabase
      .from("chaves")
      .select("id, evento_id, tatame, fase, id_visual, categoria, faixa, atleta_1, atleta_2, pontuacao_atleta_1, pontuacao_atleta_2, duracao_segundos, iniciada_em, ordem_tatame, horario_estimado, status_luta, vencedor, metodo_vitoria, finalizada_em")
      .eq("evento_id", eventoId)
      .order("ordem_tatame", { ascending: true });

    const lutasReais = ((data || []) as LutaAoVivo[]).filter(isLutaReal);
    const porOrdem = [...lutasReais].sort((a, b) => (a.ordem_tatame ?? 9999) - (b.ordem_tatame ?? 9999));
    const porFinalizacao = [...lutasReais].sort((a, b) => {
      const dataA = a.finalizada_em ? new Date(a.finalizada_em).getTime() : 0;
      const dataB = b.finalizada_em ? new Date(b.finalizada_em).getTime() : 0;
      return dataB - dataA;
    });

    setLutasAtivas(porOrdem.filter((luta) => luta.status_luta === "em_andamento"));
    setFilaLutas(
      porOrdem
        .filter((luta) => luta.status_luta !== "concluida" && luta.status_luta !== "em_andamento")
        .slice(0, 12)
    );
    setLutasFinalizadas(
      porFinalizacao
        .filter((luta) => luta.status_luta === "concluida" && !isFantasma(luta.vencedor))
        .slice(0, 10)
    );
  }, [eventoId]);

  useEffect(() => {
    async function carregarDados() {
      const { data: ev } = await supabase
        .from("eventos")
        .select("nome, banner_url")
        .eq("id", eventoId)
        .single();

      if (ev) setEvento(ev);
      await buscarLutas();
      setLoading(false);
    }

    if (eventoId) carregarDados();
  }, [eventoId, buscarLutas]);

  useEffect(() => {
    if (!eventoId) return;

    const subscription = supabase
      .channel(`live-scoring-${eventoId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chaves",
          filter: `evento_id=eq.${eventoId}`,
        },
        () => {
          buscarLutas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [eventoId, buscarLutas]);

  useEffect(() => {
    const interval = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const proximaLuta = useMemo(() => filaLutas[0], [filaLutas]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-xs font-black uppercase tracking-widest text-red-500">
        Conectando aos tatames...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] px-3 py-4 font-sans text-white md:px-8 md:py-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 border-b border-white/10 pb-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded bg-red-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-red-400">
                  Ao vivo
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {lutasAtivas.length} agora / {filaLutas.length} na fila
                </span>
              </div>
              <h1 className="truncate text-lg font-black uppercase tracking-tight md:text-2xl">
                {evento?.nome || "Campeonato"}
              </h1>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto] lg:min-w-[520px]">
              <div className="min-w-0 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                <span className="text-[8px] font-black uppercase tracking-widest text-cyan-300">Próxima luta</span>
                <p className="truncate text-sm font-black uppercase text-white">
                  {proximaLuta ? `${proximaLuta.atleta_1} x ${proximaLuta.atleta_2}` : "Fila aguardando chamada"}
                </p>
              </div>
              <Link
                href={`/evento/${eventoId}/publico`}
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-white/10"
              >
                Chaves
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Agora no tatame</h2>
            <span className="rounded bg-red-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-red-300">
              Tempo real
            </span>
          </div>

          {lutasAtivas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-[#0a0a0e] p-5 text-sm text-zinc-500">
              Nenhuma luta real acontecendo agora.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {lutasAtivas.map((luta) => (
                <LutaAoVivoCard key={luta.id} luta={luta} agora={agora} />
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <section>
            <h2 className="mb-2 text-sm font-black uppercase tracking-widest text-white">Fila de chamadas</h2>
            {filaLutas.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-[#0a0a0e] p-5 text-sm text-zinc-500">
                Nenhuma luta real aguardando chamada.
              </div>
            ) : (
              <div className="grid gap-2">
                {filaLutas.map((luta, index) => (
                  <FilaLinha key={luta.id} luta={luta} index={index} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-black uppercase tracking-widest text-white">Resultados recentes</h2>
            {lutasFinalizadas.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-[#0a0a0e] p-5 text-sm text-zinc-500">
                Nenhum resultado real finalizado ainda.
              </div>
            ) : (
              <div className="grid gap-2">
                {lutasFinalizadas.map((luta) => (
                  <ResultadoLinha key={luta.id} luta={luta} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
