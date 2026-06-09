/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, Clock, Medal, Radio, Search, Shield, Trophy, Users, ChevronRight } from "lucide-react";
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

type AtletaPerfil = {
  id: number;
  user_id: string | null;
  nome: string | null;
  foto_url: string | null;
  equipe: string | null;
  academia: string | null;
  faixa: string | null;
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
  atleta_1_id?: number | null;
  atleta_2_id?: number | null;
  equipe_1?: string | null;
  equipe_2?: string | null;
  pontuacao_atleta_1?: Pontuacao | string | null;
  pontuacao_atleta_2?: Pontuacao | string | null;
  duracao_segundos?: number | null;
  iniciada_em?: string | null;
  ordem_tatame?: number | null;
  horario_estimado?: string | null;
  status_luta?: string | null;
  vencedor?: string | null;
  vencedor_id?: number | null;
  metodo_vitoria?: string | null;
  finalizada_em?: string | null;
};

const pontosVazios: Pontuacao = { pontos: 0, vantagens: 0, punicoes: 0 };
const fantasmas = ["BYE", "TBD", "A DEFINIR", "SEM OPONENTE", "SEM ADVERSARIO", "SEM ADVERSÁRIO"];

function limparNome(nome?: string | null) {
  return String(nome || "").trim();
}

function nomeNormalizado(nome?: string | null) {
  return limparNome(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function isFantasma(nome?: string | null) {
  const normalizado = nomeNormalizado(nome);
  if (!normalizado) return true;
  return fantasmas.some((fantasma) => {
    const item = fantasma.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    return normalizado === item || normalizado.includes(item);
  });
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

function minutosAte(valor: string | null | undefined, agora: number) {
  if (!valor) return null;
  const data = new Date(valor).getTime();
  if (Number.isNaN(data)) return null;
  return Math.max(0, Math.ceil((data - agora) / 60000));
}

function textoPrevisao(valor: string | null | undefined, agora: number) {
  const minutos = minutosAte(valor, agora);
  if (minutos === null) return "Aguardando";
  if (minutos <= 0) return "Próxima";
  if (minutos === 1) return "1 min";
  return `${minutos} min`;
}

function nomeMetodo(metodo?: string | null) {
  if (!metodo) return "Resultado";
  const normalizado = metodo.replace(/_/g, " ").toLowerCase();
  if (normalizado === "wo") return "W.O.";
  if (normalizado === "pontos") return "Pontos";
  if (normalizado === "finalizacao" || normalizado === "finalização") return "Finalização";
  return normalizado.charAt(0).toUpperCase() + normalizado.slice(1);
}

function subtituloLuta(luta: LutaAoVivo) {
  return [luta.fase, luta.categoria, luta.faixa].filter(Boolean).join(" - ");
}

function getAtletaPerfil(map: Record<number, AtletaPerfil>, id?: number | null) {
  if (!id) return null;
  return map[id] || null;
}

// 🔥 PLACAR AO VIVO OTIMIZADO PARA MOBILE (EMPILHADO)
function LutaAoVivoCard({ luta, agora, atletas }: { luta: LutaAoVivo; agora: number; atletas: Record<number, AtletaPerfil> }) {
  const p1 = parsePontos(luta.pontuacao_atleta_1);
  const p2 = parsePontos(luta.pontuacao_atleta_2);
  const tempoLuta = calcularTempoAoVivo(luta, agora);
  
  const a1 = limparNome(luta.atleta_1) || "A DEFINIR";
  const e1 = luta.equipe_1 || "Sem Equipe";
  const a2 = limparNome(luta.atleta_2) || "A DEFINIR";
  const e2 = luta.equipe_2 || "Sem Equipe";

  const foto1 = getAtletaPerfil(atletas, luta.atleta_1_id)?.foto_url;
  const foto2 = getAtletaPerfil(atletas, luta.atleta_2_id)?.foto_url;

  return (
    <article className="overflow-hidden rounded-xl md:rounded-2xl border border-red-500/40 bg-[#0a0a0e] shadow-[0_0_20px_rgba(239,68,68,0.15)]">
      {/* CABEÇALHO DO TATAME E TEMPO */}
      <div className="bg-red-500/10 border-b border-red-500/20 p-2.5 md:p-4 flex justify-between items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0"></span>
            <span className="text-[10px] md:text-xs font-black uppercase text-red-400 truncate">
              {luta.tatame || "Tatame"} {luta.id_visual ? `- Luta ${luta.id_visual}` : ""}
            </span>
          </div>
          <span className="text-[8px] md:text-[10px] font-bold uppercase text-white/70 truncate block leading-tight">{subtituloLuta(luta)}</span>
        </div>
        <div className="bg-black/60 rounded px-2 md:px-3 py-1 text-center border border-red-500/20 ml-2 shrink-0">
          <span className="block text-[7px] md:text-[8px] font-black uppercase tracking-widest text-red-400">Tempo</span>
          <span className="block text-lg md:text-2xl font-black text-white tabular-nums leading-none">{formatarTempo(tempoLuta)}</span>
        </div>
      </div>

      {/* BLOCO DOS ATLETAS EMPILHADOS */}
      <div className="p-2.5 md:p-4 space-y-2 md:space-y-3">
        
        {/* ATLETA 1 (AZUL) */}
        <div className="flex items-stretch justify-between bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 md:p-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 md:w-12 md:h-12 rounded-full bg-black border-2 border-blue-500/30 overflow-hidden shrink-0 flex items-center justify-center text-blue-500 font-black">
              {foto1 ? <img src={foto1} alt={a1} className="w-full h-full object-cover" /> : a1.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs md:text-base font-black uppercase text-white truncate leading-tight">{a1}</span>
              <span className="block text-[8px] md:text-[10px] font-bold uppercase text-blue-200/70 truncate">{e1}</span>
            </div>
          </div>
          {/* PLACAR AZUL */}
          <div className="flex items-center gap-1.5 md:gap-3 shrink-0 ml-2 border-l border-blue-500/20 pl-2 md:pl-3">
            <div className="text-center"><span className="block text-[7px] md:text-[8px] text-blue-300/60 font-black">PUN</span><span className="block text-xs md:text-sm font-black text-pink-400">{p1.punicoes}</span></div>
            <div className="text-center"><span className="block text-[7px] md:text-[8px] text-blue-300/60 font-black">VAN</span><span className="block text-xs md:text-sm font-black text-yellow-400">{p1.vantagens}</span></div>
            <div className="text-center bg-blue-500/20 px-2.5 py-1 md:px-4 md:py-2 rounded-md border border-blue-500/30 ml-1">
              <span className="block text-[8px] md:text-[10px] text-blue-300 font-black leading-none mb-0.5">PTS</span>
              <span className="block text-xl md:text-3xl font-black text-blue-400 leading-none">{p1.pontos}</span>
            </div>
          </div>
        </div>

        {/* ATLETA 2 (VERMELHO) */}
        <div className="flex items-stretch justify-between bg-red-500/10 border border-red-500/20 rounded-lg p-2 md:p-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 md:w-12 md:h-12 rounded-full bg-black border-2 border-red-500/30 overflow-hidden shrink-0 flex items-center justify-center text-red-500 font-black">
              {foto2 ? <img src={foto2} alt={a2} className="w-full h-full object-cover" /> : a2.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs md:text-base font-black uppercase text-white truncate leading-tight">{a2}</span>
              <span className="block text-[8px] md:text-[10px] font-bold uppercase text-red-200/70 truncate">{e2}</span>
            </div>
          </div>
          {/* PLACAR VERMELHO */}
          <div className="flex items-center gap-1.5 md:gap-3 shrink-0 ml-2 border-l border-red-500/20 pl-2 md:pl-3">
            <div className="text-center"><span className="block text-[7px] md:text-[8px] text-red-300/60 font-black">PUN</span><span className="block text-xs md:text-sm font-black text-pink-400">{p2.punicoes}</span></div>
            <div className="text-center"><span className="block text-[7px] md:text-[8px] text-red-300/60 font-black">VAN</span><span className="block text-xs md:text-sm font-black text-yellow-400">{p2.vantagens}</span></div>
            <div className="text-center bg-red-500/20 px-2.5 py-1 md:px-4 md:py-2 rounded-md border border-red-500/30 ml-1">
              <span className="block text-[8px] md:text-[10px] text-red-300 font-black leading-none mb-0.5">PTS</span>
              <span className="block text-xl md:text-3xl font-black text-red-400 leading-none">{p2.pontos}</span>
            </div>
          </div>
        </div>

      </div>
    </article>
  );
}

// 🔥 FILA COMPACTADA
function FilaLinha({ luta, index, agora, atletas }: { luta: LutaAoVivo; index: number; agora: number; atletas: Record<number, AtletaPerfil> }) {
  const posicao = index + 1;
  const a1 = limparNome(luta.atleta_1) || "A DEFINIR";
  const a2 = limparNome(luta.atleta_2) || "A DEFINIR";

  return (
    <article className="border border-white/5 bg-[#0a0a0e] rounded-xl p-2.5 flex items-center gap-3">
      <div className="w-9 h-9 rounded bg-cyan-500/10 border border-cyan-500/20 flex flex-col items-center justify-center shrink-0">
        <span className="text-[8px] text-cyan-500/70 font-black leading-none mb-0.5">FILA</span>
        <span className="text-sm font-black text-cyan-400 leading-none">#{posicao}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap md:flex-nowrap items-center gap-x-1.5 gap-y-0.5 truncate leading-tight">
          <span className="text-[10px] md:text-xs font-black uppercase text-white truncate">{a1}</span>
          <span className="text-[8px] font-black text-zinc-600 shrink-0">VS</span>
          <span className="text-[10px] md:text-xs font-black uppercase text-white truncate">{a2}</span>
        </div>
        <span className="block text-[8px] md:text-[9px] font-bold uppercase text-zinc-500 truncate mt-1">
          {luta.tatame} • {subtituloLuta(luta)}
        </span>
      </div>
      <div className="text-right shrink-0 border-l border-white/5 pl-3">
        <span className="block text-[11px] font-black text-cyan-400">{formatarHorario(luta.horario_estimado)}</span>
        <span className="block text-[8px] font-bold uppercase text-zinc-500 mt-0.5">{textoPrevisao(luta.horario_estimado, agora)}</span>
      </div>
    </article>
  );
}

// 🔥 RESULTADOS COMPACTADOS
function ResultadoLinha({ luta }: { luta: LutaAoVivo }) {
  const p1 = parsePontos(luta.pontuacao_atleta_1);
  const p2 = parsePontos(luta.pontuacao_atleta_2);
  const vencedorNome = limparNome(luta.vencedor) || "Aguardando";
  const perdedor = vencedorNome === limparNome(luta.atleta_1) ? luta.atleta_2 : luta.atleta_1;
  const pVencedor = vencedorNome === limparNome(luta.atleta_1) ? p1 : p2;
  const pPerdedor = vencedorNome === limparNome(luta.atleta_1) ? p2 : p1;

  return (
    <article className="border border-emerald-500/20 bg-[#0a0a0e] rounded-xl overflow-hidden">
      <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-2 px-3 flex justify-between items-center">
        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-emerald-400 truncate">{luta.tatame} • {subtituloLuta(luta)}</span>
        <span className="text-[7px] font-black uppercase text-emerald-200 bg-emerald-500/20 px-1.5 py-0.5 rounded ml-2 shrink-0">{nomeMetodo(luta.metodo_vitoria)}</span>
      </div>
      <div className="p-2.5 px-3 space-y-1.5">
        <div className="flex justify-between items-center min-w-0">
          <span className="text-[11px] md:text-xs font-black uppercase text-white truncate flex items-center gap-1.5">🥇 {vencedorNome}</span>
          <span className="text-xs md:text-sm font-black text-white shrink-0 ml-2 bg-white/10 px-2 py-0.5 rounded">{pVencedor.pontos} <span className="text-[8px] text-zinc-400">PTS</span></span>
        </div>
        <div className="flex justify-between items-center min-w-0 opacity-60">
          <span className="text-[9px] md:text-[10px] font-bold uppercase text-white truncate flex items-center gap-1.5">❌ {perdedor}</span>
          <span className="text-[10px] md:text-xs font-bold text-white shrink-0 ml-2 px-2">{pPerdedor.pontos} <span className="text-[7px] text-zinc-400">PTS</span></span>
        </div>
      </div>
    </article>
  );
}

export default function AoVivoPage() {
  const params = useParams();
  const eventoId = params.id as string;

  const [evento, setEvento] = useState<Evento | null>(null);
  const [lutas, setLutas] = useState<LutaAoVivo[]>([]);
  const [atletas, setAtletas] = useState<Record<number, AtletaPerfil>>({});
  const [loading, setLoading] = useState(true);
  const [agora, setAgora] = useState(() => Date.now());
  const [busca, setBusca] = useState("");
  const [tatameFiltro, setTatameFiltro] = useState("todos");

  const carregarAtletas = useCallback(async (lutasBase: LutaAoVivo[]) => {
    const ids = Array.from(new Set(lutasBase.flatMap((luta) => [luta.atleta_1_id, luta.atleta_2_id, luta.vencedor_id]).filter((id): id is number => Boolean(id))));
    if (ids.length === 0) return;
    const { data } = await supabase.from("atletas").select("id, user_id, nome, foto_url, equipe, academia, faixa").in("id", ids);
    const mapa = Object.fromEntries(((data || []) as AtletaPerfil[]).map((atleta) => [atleta.id, atleta]));
    setAtletas(mapa);
  }, []);

  const buscarLutas = useCallback(async () => {
    if (!eventoId) return;
    const { data } = await supabase
      .from("chaves")
      .select("id, evento_id, tatame, fase, id_visual, categoria, faixa, atleta_1, atleta_2, atleta_1_id, atleta_2_id, equipe_1, equipe_2, pontuacao_atleta_1, pontuacao_atleta_2, duracao_segundos, iniciada_em, ordem_tatame, horario_estimado, status_luta, vencedor, vencedor_id, metodo_vitoria, finalizada_em")
      .eq("evento_id", eventoId)
      .order("ordem_tatame", { ascending: true })
      .order("ordem", { ascending: true });

    const lutasReais = ((data || []) as LutaAoVivo[]).filter(isLutaReal);
    const ordenadas = [...lutasReais].sort((a, b) => {
      const ordemA = a.ordem_tatame ?? 9999;
      const ordemB = b.ordem_tatame ?? 9999;
      if (ordemA !== ordemB) return ordemA - ordemB;
      return Number(a.id_visual || 0) - Number(b.id_visual || 0);
    });

    setLutas(ordenadas);
    await carregarAtletas(ordenadas);
  }, [carregarAtletas, eventoId]);

  useEffect(() => {
    async function carregarDados() {
      const { data: ev } = await supabase.from("eventos").select("nome, banner_url").eq("id", eventoId).single();
      if (ev) setEvento(ev);
      await buscarLutas();
      setLoading(false);
    }
    if (eventoId) void carregarDados();
  }, [eventoId, buscarLutas]);

  useEffect(() => {
    if (!eventoId) return;
    const subscription = supabase
      .channel(`live-scoring-${eventoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chaves", filter: `evento_id=eq.${eventoId}` }, () => { void buscarLutas(); })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [eventoId, buscarLutas]);

  useEffect(() => {
    const interval = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const tatames = useMemo(() => Array.from(new Set(lutas.map((luta) => luta.tatame || "Tatame a definir"))).sort(), [lutas]);

  const lutasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lutas.filter((luta) => {
      const matchTatame = tatameFiltro === "todos" || (luta.tatame || "Tatame a definir") === tatameFiltro;
      const texto = [luta.atleta_1, luta.atleta_2, luta.categoria, luta.faixa, luta.tatame].join(" ").toLowerCase();
      return matchTatame && (!termo || texto.includes(termo));
    });
  }, [busca, lutas, tatameFiltro]);

  const lutasAtivas = useMemo(() => lutasFiltradas.filter((luta) => luta.status_luta === "em_andamento"), [lutasFiltradas]);
  const filaLutas = useMemo(() => lutasFiltradas.filter((luta) => luta.status_luta !== "concluida" && luta.status_luta !== "em_andamento").slice(0, 16), [lutasFiltradas]);
  const lutasFinalizadas = useMemo(() => {
    return lutasFiltradas
      .filter((luta) => luta.status_luta === "concluida" && !isFantasma(luta.vencedor))
      .sort((a, b) => {
        const dataA = a.finalizada_em ? new Date(a.finalizada_em).getTime() : 0;
        const dataB = b.finalizada_em ? new Date(b.finalizada_em).getTime() : 0;
        return dataB - dataA;
      })
      .slice(0, 12);
  }, [lutasFiltradas]);
        const proximaLuta = filaLutas[0];
  const totalFinalizadas = lutas.filter((luta) => luta.status_luta === "concluida" && !isFantasma(luta.vencedor)).length;
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-xs font-black uppercase tracking-widest text-red-500">
        Conectando aos tatames...
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[#050505] pb-10 font-sans text-white selection:bg-red-500/30 overflow-x-hidden">
      
      {/* HEADER COMPACTO (Fixo no Topo) */}
      <header className="bg-[#0a0a0e] border-b border-white/10 px-3 py-3 md:px-6 md:py-4 sticky top-0 z-40 shadow-md">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="flex items-center gap-1.5 rounded bg-red-500 px-1.5 py-0.5 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                <Radio size={10} className="animate-pulse" /> Ao Vivo
              </span>
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500 truncate">{evento?.nome || "Evento"}</span>
            </div>
            <h1 className="text-sm md:text-lg font-black uppercase text-white truncate">Transmissão Oficial</h1>
          </div>
          <Link href={`/evento/${eventoId}/publico`} className="shrink-0 bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-colors">
            <Trophy size={14} />
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Ver Chaves</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-3 mt-4 md:mt-6">
        
        {/* 1. SEÇÃO AO VIVO (AGORA NO TATAME) - A MAIS IMPORTANTE */}
        <section className="mb-6">
          {lutasAtivas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-[#0a0a0e] p-6 text-xs md:text-sm text-zinc-500 text-center uppercase tracking-widest font-bold">Nenhuma transmissão a decorrer.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lutasAtivas.map((luta) => <LutaAoVivoCard key={luta.id} luta={luta} agora={agora} atletas={atletas} />)}
            </div>
          )}
        </section>

        {/* 2. ESTATÍSTICAS RÁPIDAS (3 COLUNAS NO MOBILE) */}
        <section className="mb-6 grid grid-cols-3 gap-2 md:gap-4">
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 md:p-4 text-center md:text-left flex flex-col md:block items-center">
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-red-300">Ao vivo</span>
            <strong className="mt-0.5 md:mt-1 block text-lg md:text-2xl font-black text-red-200">{lutasAtivas.length}</strong>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2.5 md:p-4 text-center md:text-left flex flex-col md:block items-center">
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-cyan-300">Na fila</span>
            <strong className="mt-0.5 md:mt-1 block text-lg md:text-2xl font-black text-cyan-200">{filaLutas.length}</strong>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 md:p-4 text-center md:text-left flex flex-col md:block items-center">
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-emerald-300">Resultados</span>
            <strong className="mt-0.5 md:mt-1 block text-lg md:text-2xl font-black text-emerald-200">{totalFinalizadas}</strong>
          </div>
        </section>

        {/* 3. FILTROS COMPACTOS */}
        <section className="mb-6 rounded-xl border border-white/10 bg-[#0a0a0e] p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black px-3 py-2.5 w-full">
              <Search size={14} className="text-zinc-600 shrink-0" />
              <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar atleta..." className="w-full min-w-0 bg-transparent text-xs text-white outline-none placeholder:text-zinc-700" />
            </label>
            <select value={tatameFiltro} onChange={(event) => setTatameFiltro(event.target.value)} className="rounded-lg border border-white/10 bg-black px-3 py-2.5 text-xs font-bold text-white outline-none w-full appearance-none">
              <option value="todos">Todos os tatames</option>
              {tatames.map((tatame) => <option key={tatame} value={tatame}>{tatame}</option>)}
            </select>
          </div>
        </section>

        {/* 4. FILA E RESULTADOS (LADO A LADO NO DESKTOP, EMPILHADO NO MOBILE) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs md:text-sm font-black uppercase tracking-widest text-white px-1"><Clock size={14} className="text-cyan-400" /> Próximas Chamadas</h2>
            {filaLutas.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-[#0a0a0e] p-6 text-xs text-zinc-500 text-center font-bold uppercase tracking-widest">Fila vazia.</div>
            ) : (
              <div className="grid gap-2">
                {filaLutas.map((luta, index) => <FilaLinha key={luta.id} luta={luta} index={index} agora={agora} atletas={atletas} />)}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs md:text-sm font-black uppercase tracking-widest text-white px-1"><Medal size={14} className="text-emerald-400" /> Resultados Recentes</h2>
            {lutasFinalizadas.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-[#0a0a0e] p-6 text-xs text-zinc-500 text-center font-bold uppercase tracking-widest">Nenhum resultado.</div>
            ) : (
              <div className="grid gap-2">
                {lutasFinalizadas.map((luta) => <ResultadoLinha key={luta.id} luta={luta} />)}
              </div>
            )}
          </section>
        </div>

      </div>
    </main>
  );
}