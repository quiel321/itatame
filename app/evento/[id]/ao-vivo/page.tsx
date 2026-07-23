/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Clock, Medal, Monitor, Radio, Search, Trophy, X, ChevronRight } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { obterTempoRegulamentar } from "@/app/lib/cronograma";

// --- TIPOS ---
type Evento = {
  nome: string | null;
  banner_url?: string | null;
};

type Pontuacao = {
  pontos: number;
  vantagens: number;
  punicoes: number;
  chamador_presente?: boolean;
  chamador_chamadas?: number;
  decisao_arbitro?: boolean;
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
  status_luta?: string | null; // em_espera, em_andamento, concluida
  vencedor?: string | null;
  vencedor_id?: number | null;
  metodo_vitoria?: string | null;
  finalizada_em?: string | null;
};

// --- CONFIGURAÇÕES ---
const TEMPO_EXIBICAO_VENCEDOR_MS = 3000;

// --- HELPERS GERAIS ---
const pontosVazios: Pontuacao = { pontos: 0, vantagens: 0, punicoes: 0 };
const fantasmas = ["BYE", "TBD", "A DEFINIR", "SEM OPONENTE", "SEM ADVERSARIO", "SEM ADVERSÁRIO"];

function limparNome(nome?: string | null) { return String(nome || "").trim(); }
function nomeNormalizado(nome?: string | null) { return limparNome(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(); }

function isFantasma(nome?: string | null) {
  const normalizado = nomeNormalizado(nome);
  if (!normalizado) return true;
  return fantasmas.some((fantasma) => {
    const item = fantasma.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    return normalizado === item || normalizado.includes(item);
  });
}

function isLutaReal(luta: LutaAoVivo) { return !isFantasma(luta.atleta_1) && !isFantasma(luta.atleta_2); }

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
  if (!valor) return "--:--";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "--:--";
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function nomeMetodo(metodo?: string | null) {
  if (!metodo) return "Resultado";
  const normalizado = metodo.replace(/_/g, " ").toLowerCase();
  if (normalizado === "wo") return "W.O.";
  if (normalizado === "pontos") return "Pontos";
  if (normalizado === "decisao arbitro") return "Decisão do árbitro";
  if (normalizado === "ausencia") return "Ausência";
  if (normalizado === "finalizacao" || normalizado === "finalização") return "Finalização";
  return normalizado.charAt(0).toUpperCase() + normalizado.slice(1);
}

function nomeMetodoLuta(luta: LutaAoVivo) {
  const p1 = parsePontos(luta.pontuacao_atleta_1);
  const p2 = parsePontos(luta.pontuacao_atleta_2);
  if (p1.decisao_arbitro || p2.decisao_arbitro) return "Decisão do árbitro";
  return nomeMetodo(luta.metodo_vitoria);
}

function subtituloLuta(luta: LutaAoVivo) {
  return [luta.fase, luta.categoria, luta.faixa].filter(Boolean).join(" • ");
}

function getAtletaPerfil(map: Record<number, AtletaPerfil>, id?: number | null) {
  if (!id) return null;
  return map[id] || null;
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

// =========================================================================================================
// --- INOVAÇÃO: WINNER OVERLAY SYSTEM (MODAL DE VITÓRIA) ---
// =========================================================================================================

function AtletaPlacarOverlay({ a, p, foto, isVencedor, equipe }: { a: string, p: Pontuacao, foto?: string | null, isVencedor: boolean, equipe?: string | null }) {
  return (
    <div className={`flex min-w-0 flex-col items-center rounded-2xl border-2 bg-black/50 p-3 sm:p-5 transition-all duration-500 ${isVencedor ? 'border-cyan-500 shadow-[0_0_40px_rgba(34,211,238,0.2)]' : 'border-white/5 opacity-60'}`}>
      <div className={`h-16 w-16 overflow-hidden rounded-full border-2 sm:h-24 sm:w-24 ${isVencedor ? 'border-cyan-400' : 'border-zinc-700'}`}>
        {foto ? <img src={foto} alt={a} className="w-full h-full object-cover" /> :
          <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-2xl font-black text-white sm:text-4xl">{a.charAt(0)}</div>
        }
      </div>
      <h3 className="mt-3 line-clamp-2 text-center text-sm font-black uppercase leading-tight tracking-tight text-white sm:text-2xl">{a}</h3>
      <span className="mt-1 block max-w-full truncate text-[8px] font-bold uppercase tracking-wider text-zinc-400 sm:text-xs">{equipe || "Sem Equipe"}</span>
      <div className="mt-3 grid w-full grid-cols-3 gap-1 text-center sm:mt-5 sm:gap-2">
        <div className="rounded-lg border border-white/5 bg-white/5 p-1.5 sm:p-3"><span className="block text-[7px] font-bold uppercase text-zinc-500 sm:text-[10px]">PTS</span><strong className={`block text-xl font-black tabular-nums sm:text-4xl ${isVencedor ? 'text-cyan-400' : 'text-white'}`}>{p.pontos}</strong></div>
        <div className="rounded-lg border border-white/5 bg-white/5 p-1.5 sm:p-3"><span className="block text-[7px] font-bold uppercase text-zinc-500 sm:text-[10px]">VANT.</span><strong className="block text-xl font-black tabular-nums text-white sm:text-4xl">{p.vantagens}</strong></div>
        <div className="rounded-lg border border-white/5 bg-white/5 p-1.5 sm:p-3"><span className="block text-[7px] font-bold uppercase text-zinc-500 sm:text-[10px]">PUN.</span><strong className="block text-xl font-black tabular-nums text-white sm:text-4xl">{p.punicoes}</strong></div>
      </div>
    </div>
  );
}

function WinnerOverlay({ luta, atletas, onClose }: { luta: LutaAoVivo, atletas: Record<number, AtletaPerfil>, onClose: () => void }) {
  const p1 = parsePontos(luta.pontuacao_atleta_1);
  const p2 = parsePontos(luta.pontuacao_atleta_2);
  const a1 = limparNome(luta.atleta_1) || "A DEFINIR";
  const a2 = limparNome(luta.atleta_2) || "A DEFINIR";
  const vencedorNome = limparNome(luta.vencedor);
  const isA1Vencedor = vencedorNome === a1;

  useEffect(() => {
    const timer = setTimeout(onClose, TEMPO_EXIBICAO_VENCEDOR_MS);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-y-auto bg-[#050505]/95 p-3 font-sans backdrop-blur-md animate-in fade-in duration-300 sm:p-6">
      <header className="mb-3 text-center sm:mb-6">
        <span className="mb-2 inline-flex items-center gap-2 rounded border border-cyan-500/30 bg-cyan-500/20 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-400 sm:text-xs">
          <Medal size={16} /> RESULTADO OFICIAL
        </span>
        <h1 className="text-2xl font-black uppercase tracking-tighter text-white sm:text-5xl">FIM DE COMBATE</h1>
        <p className="mt-1 line-clamp-2 text-[9px] font-bold uppercase text-zinc-400 sm:text-base">{luta.tatame} • {subtituloLuta(luta)}</p>
      </header>

      <div className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-5">
        <AtletaPlacarOverlay a={a1} p={p1} foto={getAtletaPerfil(atletas, luta.atleta_1_id)?.foto_url} equipe={luta.equipe_1} isVencedor={isA1Vencedor} />
        <div className="px-0.5 text-sm font-black italic text-zinc-700 sm:px-2 sm:text-3xl">VS</div>
        <AtletaPlacarOverlay a={a2} p={p2} foto={getAtletaPerfil(atletas, luta.atleta_2_id)?.foto_url} equipe={luta.equipe_2} isVencedor={!isA1Vencedor} />
      </div>

      <footer className="mt-3 text-center sm:mt-6">
        <span className="block text-[8px] font-bold uppercase tracking-widest text-zinc-500 sm:text-xs">MÉTODO DE VITÓRIA</span>
        <strong className="mt-1 block text-lg font-black uppercase text-white sm:text-3xl">{nomeMetodoLuta(luta)}</strong>
      </footer>
    </div>
  );
}

// =========================================================================================================
// --- COMPONENTES DA TV (MODO TELÃO) - DESIGN ESPORTIVO LIMPO ---
// =========================================================================================================

function LutaTvActiveCard({ luta, agora, atletas }: { luta: LutaAoVivo; agora: number; atletas: Record<number, AtletaPerfil> }) {
  const p1 = parsePontos(luta.pontuacao_atleta_1);
  const p2 = parsePontos(luta.pontuacao_atleta_2);
  const tempoLuta = calcularTempoAoVivo(luta, agora);
  const a1 = limparNome(luta.atleta_1) || "A DEFINIR";
  const a2 = limparNome(luta.atleta_2) || "A DEFINIR";

  const renderAtleta = (a: string, e: string | null | undefined, p: Pontuacao, isAzul: boolean, id?: number | null) => {
    const foto = getAtletaPerfil(atletas, id)?.foto_url;
    return (
      <div className={`relative p-5 rounded-2xl border flex items-center gap-6 shadow-sm ${isAzul ? 'bg-[#0f172a] border-blue-900/50' : 'bg-[#450a0a] border-red-900/50'}`}>
        <div className={`w-20 h-20 rounded-full overflow-hidden border-2 shrink-0 bg-black ${isAzul ? 'border-blue-500' : 'border-red-500'}`}>
          {foto ? <img src={foto} alt={a} className="w-full h-full object-cover" /> :
            <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white/50">{a.charAt(0)}</div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xl lg:text-3xl font-black uppercase text-white leading-tight mb-2 whitespace-normal break-words line-clamp-2">{a}</h4>
          <span className={`block text-xs lg:text-sm font-bold uppercase tracking-wider whitespace-normal break-words line-clamp-2 ${isAzul ? 'text-blue-300' : 'text-red-300'}`}>{e || "Sem Equipe"}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0 border-l border-white/10 pl-6">
          <div className="text-center"><span className="block text-[10px] text-zinc-500 font-bold uppercase">PUN</span><strong className="block text-xl font-black text-pink-500">{p.punicoes}</strong></div>
          <div className="text-center"><span className="block text-[10px] text-zinc-500 font-bold uppercase">VAN</span><strong className="block text-xl font-black text-yellow-500">{p.vantagens}</strong></div>
          <div className={`text-center px-6 py-2 rounded-xl ml-2 ${isAzul ? 'bg-blue-600' : 'bg-red-600'}`}>
            <span className="block text-[10px] text-white/70 font-black uppercase tracking-wider mb-1">PTS</span>
            <strong className="block text-5xl lg:text-6xl font-black text-white leading-none tabular-nums">{p.pontos}</strong>
          </div>
        </div>
      </div>
    );
  };

  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0e] p-4 shadow-2xl lg:p-5">
      <header className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center justify-center w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
            <h2 className="text-2xl lg:text-3xl font-black uppercase text-white tracking-tight">{luta.tatame || "Tatame"} {luta.id_visual ? `- Luta #${luta.id_visual}` : ""}</h2>
          </div>
          <p className="text-base lg:text-lg text-zinc-400 font-bold uppercase tracking-widest truncate">{subtituloLuta(luta)}</p>
        </div>
        <div className="bg-zinc-900 rounded-2xl px-6 py-3 text-center border border-white/10 shrink-0 min-w-[140px]">
          <span className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-1">TEMPO</span>
          <span className="block text-5xl lg:text-6xl font-black text-white tabular-nums leading-none">{formatarTempo(tempoLuta)}</span>
        </div>
      </header>
      <div className="space-y-4 flex-1 flex flex-col justify-center">
        {renderAtleta(a1, luta.equipe_1, p1, true, luta.atleta_1_id)}
        {renderAtleta(a2, luta.equipe_2, p2, false, luta.atleta_2_id)}
      </div>
    </article>
  );
}

function FilaTvLine({ luta, index, agora }: { luta: LutaAoVivo; index: number; agora: number }) {
  const isPrimeira = index === 0;
  return (
    <article className={`flex items-center gap-4 p-4 rounded-xl border min-w-[320px] max-w-[400px] shrink-0 ${isPrimeira ? 'bg-cyan-950/40 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'bg-[#0a0a0e] border-white/5'}`}>
      <div className={`w-12 h-12 rounded-lg shrink-0 flex items-center justify-center font-black text-xl ${isPrimeira ? 'bg-cyan-500 text-black' : 'bg-zinc-800 text-white'}`}>#{index + 1}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 leading-tight mb-1">
          <span className="text-sm font-black uppercase text-white truncate">{limparNome(luta.atleta_1) || "A DEFINIR"}</span>
          <span className="text-[10px] font-black text-zinc-600">VS</span>
          <span className="text-sm font-black uppercase text-white truncate">{limparNome(luta.atleta_2) || "A DEFINIR"}</span>
        </div>
        <span className="block text-[10px] font-bold uppercase text-zinc-400 truncate">{luta.tatame} • {subtituloLuta(luta)}</span>
      </div>
      <div className="text-right shrink-0 border-l border-white/5 pl-4">
        <strong className={`block text-lg font-black leading-none ${isPrimeira ? 'text-cyan-400' : 'text-white'}`}>{formatarHorario(luta.horario_estimado)}</strong>
        <span className="block text-[9px] font-bold uppercase text-zinc-500 mt-1">{textoPrevisao(luta.horario_estimado, agora)}</span>
      </div>
    </article>
  );
}

function ResultadoTvLine({ luta }: { luta: LutaAoVivo }) {
  const a1 = limparNome(luta.atleta_1);
  const vencedorNome = limparNome(luta.vencedor);
  const pVencedor = parsePontos(vencedorNome === a1 ? luta.pontuacao_atleta_1 : luta.pontuacao_atleta_2);
  const metodo = nomeMetodoLuta(luta);
  const siglaMetodo = metodo === "W.O." ? "WO" : metodo === "Pontos" ? "PTS" : metodo === "Finalização" ? "SUB" : "RES";

  return (
    <article className="border border-white/5 bg-[#0a0a0e] p-3 rounded-xl flex items-center gap-3 min-w-[260px] max-w-[280px] shrink-0">
      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
        <Medal size={20} className="text-emerald-500" />
      </div>
      <div className="flex-1 min-w-0">
        <strong className="block text-sm font-black uppercase text-white truncate">{vencedorNome || "A DEFINIR"}</strong>
        <span className="block text-[9px] font-bold text-zinc-500 truncate uppercase mt-0.5">{luta.tatame} • {subtituloLuta(luta)}</span>
      </div>
      <div className="text-center shrink-0 border-l border-white/10 pl-3">
        <strong className="block text-lg font-black text-white tabular-nums leading-none">{pVencedor.pontos}</strong>
        <span className="block text-[9px] font-black text-emerald-400 uppercase mt-0.5">{siglaMetodo}</span>
      </div>
    </article>
  );
}

function AvisoResultadoBorda({ luta }: { luta: LutaAoVivo }) {
  return (
    <aside className="fixed bottom-4 right-3 z-[80] max-w-[min(360px,calc(100vw-1.5rem))] animate-in slide-in-from-right-6 duration-500 rounded-2xl border border-emerald-500/35 bg-black/95 p-3 shadow-[0_0_35px_rgba(16,185,129,0.18)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-black"><Medal size={20} /></span>
        <div className="min-w-0">
          <span className="block text-[8px] font-black uppercase tracking-[0.18em] text-emerald-400">Luta concluída</span>
          <strong className="mt-0.5 block truncate text-sm font-black uppercase text-white">Vencida por {limparNome(luta.vencedor)}</strong>
          <span className="mt-0.5 block truncate text-[8px] font-bold uppercase text-zinc-500">{luta.tatame} · {nomeMetodoLuta(luta)}</span>
        </div>
      </div>
    </aside>
  );
}

// =========================================================================================================
// --- COMPONENTES MOBILE/PAINEL PADRÃO (MANTIDOS DA SUA LÓGICA ANTERIOR) ---
// =========================================================================================================

function LutaAoVivoCardMobile({ luta, agora, atletas }: { luta: LutaAoVivo; agora: number; atletas: Record<number, AtletaPerfil> }) {
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
    <article className="overflow-hidden rounded-xl md:rounded-2xl border border-red-500/30 bg-[#0a0a0e] shadow-lg">
      <div className="bg-zinc-900 border-b border-white/5 p-2.5 md:p-3 flex justify-between items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0"></span>
            <span className="text-[10px] md:text-xs font-black uppercase text-white truncate">
              {luta.tatame || "Tatame"} {luta.id_visual ? `- Luta ${luta.id_visual}` : ""}
            </span>
          </div>
          <span className="text-[8px] md:text-[9px] font-medium uppercase text-zinc-400 truncate block leading-tight">{subtituloLuta(luta)}</span>
        </div>
        <div className="bg-black/50 rounded px-2 md:px-3 py-1 text-center border border-white/5 ml-2 shrink-0">
          <span className="block text-lg md:text-xl font-black text-white tabular-nums leading-none">{formatarTempo(tempoLuta)}</span>
        </div>
      </div>
      <div className="p-2.5 md:p-3 space-y-2">
        <div className="flex items-stretch justify-between bg-blue-900/20 rounded-lg p-2 md:p-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black border border-blue-500/50 overflow-hidden shrink-0 flex items-center justify-center text-blue-400 font-black text-xs md:text-sm">
              {foto1 ? <img src={foto1} alt={a1} className="w-full h-full object-cover" /> : a1.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] md:text-sm font-black uppercase text-white truncate leading-tight">{a1}</span>
              <span className="block text-[8px] md:text-[9px] font-bold uppercase text-blue-300/70 truncate">{e1}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0 ml-2 border-l border-white/5 pl-2">
            <div className="text-center"><span className="block text-[7px] text-zinc-500 font-bold">PUN</span><span className="block text-xs md:text-sm font-bold text-pink-400">{p1.punicoes}</span></div>
            <div className="text-center"><span className="block text-[7px] text-zinc-500 font-bold">VAN</span><span className="block text-xs md:text-sm font-bold text-yellow-400">{p1.vantagens}</span></div>
            <div className="text-center bg-blue-600 px-2 py-1 md:px-3 md:py-1.5 rounded ml-1">
              <span className="block text-sm md:text-xl font-black text-white leading-none">{p1.pontos}</span>
            </div>
          </div>
        </div>
        <div className="flex items-stretch justify-between bg-red-900/20 rounded-lg p-2 md:p-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black border border-red-500/50 overflow-hidden shrink-0 flex items-center justify-center text-red-400 font-black text-xs md:text-sm">
              {foto2 ? <img src={foto2} alt={a2} className="w-full h-full object-cover" /> : a2.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] md:text-sm font-black uppercase text-white truncate leading-tight">{a2}</span>
              <span className="block text-[8px] md:text-[9px] font-bold uppercase text-red-300/70 truncate">{e2}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0 ml-2 border-l border-white/5 pl-2">
            <div className="text-center"><span className="block text-[7px] text-zinc-500 font-bold">PUN</span><span className="block text-xs md:text-sm font-bold text-pink-400">{p2.punicoes}</span></div>
            <div className="text-center"><span className="block text-[7px] text-zinc-500 font-bold">VAN</span><span className="block text-xs md:text-sm font-bold text-yellow-400">{p2.vantagens}</span></div>
            <div className="text-center bg-red-600 px-2 py-1 md:px-3 md:py-1.5 rounded ml-1">
              <span className="block text-sm md:text-xl font-black text-white leading-none">{p2.pontos}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function FilaLinhaMobile({ luta, index, agora }: { luta: LutaAoVivo; index: number; agora: number }) {
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

function ResultadoLinhaMobile({ luta }: { luta: LutaAoVivo }) {
  const p1 = parsePontos(luta.pontuacao_atleta_1);
  const p2 = parsePontos(luta.pontuacao_atleta_2);
  const a1 = limparNome(luta.atleta_1);
  const vencedorNome = limparNome(luta.vencedor) || "Aguardando";
  const perdedor = vencedorNome === a1 ? luta.atleta_2 : luta.atleta_1;
  const pVencedor = vencedorNome === a1 ? p1 : p2;
  const pPerdedor = vencedorNome === a1 ? p2 : p1;

  return (
    <article className="border border-white/5 bg-[#0a0a0e] rounded-xl overflow-hidden">
      <div className="bg-zinc-900 border-b border-white/5 p-2 px-3 flex justify-between items-center">
        <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-zinc-400 truncate">{luta.tatame} • {subtituloLuta(luta)}</span>
        <span className="text-[7px] font-black uppercase text-zinc-300 bg-white/10 px-1.5 py-0.5 rounded ml-2 shrink-0">{nomeMetodoLuta(luta)}</span>
      </div>
      <div className="p-2.5 px-3 space-y-1.5">
        <div className="flex justify-between items-center min-w-0">
          <span className="text-[11px] md:text-xs font-black uppercase text-emerald-400 truncate flex items-center gap-1.5">🥇 {vencedorNome}</span>
          <span className="text-xs md:text-sm font-black text-white shrink-0 ml-2 bg-white/10 px-2 py-0.5 rounded">{pVencedor.pontos} <span className="text-[8px] text-zinc-500">PTS</span></span>
        </div>
        <div className="flex justify-between items-center min-w-0 opacity-60">
          <span className="text-[9px] md:text-[10px] font-bold uppercase text-white truncate flex items-center gap-1.5">❌ {perdedor}</span>
          <span className="text-[10px] md:text-xs font-bold text-white shrink-0 ml-2 px-2">{pPerdedor.pontos} <span className="text-[7px] text-zinc-500">PTS</span></span>
        </div>
      </div>
    </article>
  );
}

// =========================================================================================================
// --- PÁGINA PRINCIPAL ---
// =========================================================================================================

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
  const [modoTv, setModoTv] = useState(false);

  // Controle de estado para exibir o Winner Overlay
  const prevLutasRef = useRef<LutaAoVivo[]>([]);
  const [vencedorRecente, setVencedorRecente] = useState<LutaAoVivo | null>(null);
  const [ultimoResultado, setUltimoResultado] = useState<LutaAoVivo | null>(null);
  const fecharVencedor = useCallback(() => setVencedorRecente(null), []);

  const alternarModoTv = async () => {
    const ativar = !modoTv;
    setModoTv(ativar);
    try {
      if (ativar && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      if (!ativar && document.fullscreenElement) await document.exitFullscreen();
    } catch { /* ignora erro de permissão do navegador */ }
  };

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

    // 🔥 LÓGICA DO WINNER OVERLAY (Detecta se uma luta acabou de finalizar)
    if (prevLutasRef.current.length > 0) {
      ordenadas.forEach(lutaAtual => {
        const lutaAnterior = prevLutasRef.current.find(l => l.id === lutaAtual.id);
        if (
          lutaAnterior &&
          lutaAnterior.status_luta !== "concluida" &&
          lutaAtual.status_luta === "concluida" &&
          !isFantasma(lutaAtual.vencedor)
        ) {
          // Só mostra o modal se não tiver outro sendo exibido
          if (!vencedorRecente) {
            setVencedorRecente(lutaAtual);
            setUltimoResultado(lutaAtual);
          }
        }
      });
    }
    prevLutasRef.current = ordenadas;

    setLutas(ordenadas);
    await carregarAtletas(ordenadas);
  }, [carregarAtletas, eventoId, vencedorRecente]);

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
    return () => { void supabase.removeChannel(subscription); };
  }, [eventoId, buscarLutas]);

  useEffect(() => {
    const interval = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Atalho de Teclado e Classes do Body
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 't') void alternarModoTv();
      if (e.key === 'Escape' && modoTv) void alternarModoTv();
    };
    window.addEventListener('keydown', handleKeyDown);

    document.body.classList.toggle('itatame-telao-ativo', modoTv);
    if (modoTv) document.body.style.backgroundColor = '#050505';
    else document.body.style.backgroundColor = '';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('itatame-telao-ativo');
      document.body.style.backgroundColor = '';
    };
  }, [modoTv, alternarModoTv]);

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
  const atletasNaBaia = useMemo(() => lutasFiltradas.flatMap((luta) => {
    if (luta.status_luta === "concluida" || luta.status_luta === "em_andamento") return [];
    const p1 = parsePontos(luta.pontuacao_atleta_1);
    const p2 = parsePontos(luta.pontuacao_atleta_2);
    return [
      p1.chamador_presente ? { chave: `${luta.id}-1`, nome: limparNome(luta.atleta_1), tatame: luta.tatame } : null,
      p2.chamador_presente ? { chave: `${luta.id}-2`, nome: limparNome(luta.atleta_2), tatame: luta.tatame } : null,
    ].filter((item): item is { chave: string; nome: string; tatame: string | null | undefined } => Boolean(item?.nome));
  }), [lutasFiltradas]);
  const filaLutas = useMemo(() => {
    const pendentes = lutasFiltradas.filter((luta) => luta.status_luta !== "concluida" && luta.status_luta !== "em_andamento");
    const acumuladoPorTatame = new Map<string, number>();
    const ativasPorTatame = new Map(lutasAtivas.map((luta) => [String(luta.tatame || ''), calcularTempoAoVivo(luta, agora)]));

    return pendentes.map((luta) => {
      const chaveTatame = String(luta.tatame || '');
      const acumulado = acumuladoPorTatame.get(chaveTatame) || 0;
      const atrasoAtual = (ativasPorTatame.get(chaveTatame) || 0) + acumulado;
      const horarioOriginal = luta.horario_estimado ? new Date(luta.horario_estimado).getTime() : 0;
      const horarioDinamico = Math.max(horarioOriginal || 0, agora + atrasoAtual * 1000);
      const duracao = obterTempoRegulamentar(luta.categoria || '', luta.faixa || '') * 60 + 120;
      acumuladoPorTatame.set(chaveTatame, acumulado + duracao);
      return { ...luta, horario_estimado: new Date(horarioDinamico).toISOString() };
    }).slice(0, modoTv ? 12 : 16);
  }, [agora, lutasAtivas, lutasFiltradas, modoTv]);
  const lutasFinalizadas = useMemo(() => {
    return lutasFiltradas
      .filter((luta) => luta.status_luta === "concluida" && !isFantasma(luta.vencedor))
      .sort((a, b) => {
        const dataA = a.finalizada_em ? new Date(a.finalizada_em).getTime() : 0;
        const dataB = b.finalizada_em ? new Date(b.finalizada_em).getTime() : 0;
        return dataB - dataA;
      })
      .slice(0, modoTv ? 12 : 12);
  }, [lutasFiltradas, modoTv]);

  const totalFinalizadas = lutas.filter((luta) => luta.status_luta === "concluida" && !isFantasma(luta.vencedor)).length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-xs font-black uppercase tracking-widest text-red-500">
        Conectando aos tatames...
      </div>
    );
  }

  // RENDERIZA O MODAL DE VITÓRIA SOBRE TUDO SE ESTIVER ATIVO
  if (vencedorRecente) {
    return <WinnerOverlay luta={vencedorRecente} atletas={atletas} onClose={fecharVencedor} />;
  }

  // =========================================================================================================
  // RENDER: MODO TV / TELÃO
  // =========================================================================================================
  if (modoTv) {
    return (
      <main className="grid h-screen w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[#050505] p-3 font-sans text-white select-none lg:p-5">
        <style dangerouslySetInnerHTML={{ __html: `body.itatame-telao-ativo > header, body.itatame-telao-ativo > nav { display: none !important; }` }} />

        {/* CABEÇALHO TV MINIMALISTA */}
        <header className="mb-3 flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-6">
            <span className="bg-red-600 text-white font-black text-sm px-4 py-2 rounded-lg uppercase tracking-widest flex items-center gap-2 shadow-[0_0_15px_rgba(220,38,38,0.5)]">
              <Radio size={18} className="animate-pulse" /> AO VIVO
            </span>
            <h1 className="text-4xl lg:text-5xl font-black uppercase text-white tracking-tighter truncate max-w-3xl">{evento?.nome || "Spartan Open Jiu-Jitsu"}</h1>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-4xl lg:text-5xl font-black text-zinc-500 tabular-nums leading-none">
              {new Date(agora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-600 mt-2">Horário Local</span>
          </div>
        </header>

        {atletasNaBaia.length > 0 && (
          <div className="mb-3 flex items-center gap-3 overflow-hidden rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-cyan-200">
            <span className="shrink-0 text-[10px] font-black uppercase tracking-widest">Na baia</span>
            <span className="min-w-0 truncate text-xs font-bold uppercase">{atletasNaBaia.map((item) => `${item.nome} · ${item.tatame || 'Tatame a definir'}`).join('  •  ')}</span>
          </div>
        )}

        {/* LUTAS ATIVAS (CENTRO DA TELA) */}
        <section className="flex min-h-0 flex-col justify-center overflow-hidden pb-3">
          {lutasAtivas.length === 0 ? (
            <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 bg-[#0a0a0e] p-6">
              <span className="text-2xl font-bold uppercase tracking-widest text-zinc-600 text-center">Aguardando início dos combates...</span>
            </div>
          ) : (
            <div className={`grid h-full min-h-0 gap-4 ${lutasAtivas.length === 1 ? 'grid-cols-1 max-w-5xl mx-auto w-full' : lutasAtivas.length === 2 ? 'grid-cols-2' : 'grid-cols-2 xl:grid-cols-3'}`}>
              {lutasAtivas.map((luta) => <LutaTvActiveCard key={luta.id} luta={luta} agora={agora} atletas={atletas} />)}
            </div>
          )}
        </section>

        {/* RODAPÉ DUPLO: FILA (ESQUERDA) E RESULTADOS (DIREITA) */}
        <footer className="border-t border-white/10 bg-black/80 pt-3 backdrop-blur-md">
          <div className="mx-auto grid max-w-[1920px] grid-cols-[minmax(0,1fr)_minmax(280px,40%)] items-end gap-5">
            {/* PRÓXIMAS CHAMADAS */}
            <div className="min-w-0">
              <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-black uppercase tracking-widest text-zinc-400"><Clock size={16} className="text-cyan-500" /> Próximas Chamadas na Fila</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 invisible-scrollbar">
                {filaLutas.length === 0 && <p className="text-sm text-zinc-600 font-bold uppercase">Nenhuma luta na fila.</p>}
                {filaLutas.map((l, index) => <FilaTvLine key={l.id} luta={l} index={index} agora={agora} />)}
              </div>
            </div>

            {/* RESULTADOS RECENTES (MINIMIZADO) */}
            <div className="min-w-0 border-l border-white/10 pl-5">
              <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-black uppercase tracking-widest text-zinc-400"><Medal size={16} className="text-emerald-500" /> Resultados Anteriores</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 invisible-scrollbar">
                {lutasFinalizadas.length === 0 && <p className="text-sm text-zinc-600 font-bold uppercase">Aguardando resultados oficiais.</p>}
                {lutasFinalizadas.map((l) => <ResultadoTvLine key={l.id} luta={l} />)}
              </div>
            </div>
          </div>
        </footer>
        <style dangerouslySetInnerHTML={{ __html: `.invisible-scrollbar::-webkit-scrollbar { display: none; } .invisible-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }` }} />
        {ultimoResultado && <AvisoResultadoBorda luta={ultimoResultado} />}
      </main>
    );
  }

  // =========================================================================================================
  // RENDER: MODO PADRÃO (MOBILE / WEB)
  // =========================================================================================================
  return (
    <main className="min-h-screen w-full bg-[#050505] pb-10 font-sans text-white overflow-x-hidden">
      {ultimoResultado && <AvisoResultadoBorda luta={ultimoResultado} />}
      
      {/* HEADER COMPACTO (Fixo no Topo) */}
      <header className="bg-[#0a0a0e] border-b border-white/5 px-3 py-3 md:px-6 md:py-4 sticky top-0 z-40 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="flex items-center gap-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white">
                <Radio size={10} className="animate-pulse" /> Ao Vivo
              </span>
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500 truncate">{evento?.nome || "Evento Oficial"}</span>
            </div>
            <h1 className="text-sm md:text-lg font-black uppercase text-white truncate">Transmissão Oficial</h1>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={alternarModoTv} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-white hover:bg-white/10 transition-colors">
              <Monitor size={14} /> <span className="hidden sm:inline">Modo Telão</span>
            </button>
            <Link href={`/evento/${eventoId}/publico`} className="shrink-0 bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-colors">
              <Trophy size={14} />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Ver Chaves</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto px-3 mt-4 md:mt-6 max-w-5xl">
        
        {/* 1. SEÇÃO AO VIVO */}
        <section className="mb-6">
          {lutasAtivas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/5 bg-[#0a0a0e] p-6 text-xs md:text-sm text-zinc-500 text-center uppercase tracking-widest font-bold">Nenhuma luta em andamento.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lutasAtivas.map((luta) => <LutaAoVivoCardMobile key={luta.id} luta={luta} agora={agora} atletas={atletas} />)}
            </div>
          )}
        </section>

        {atletasNaBaia.length > 0 && (
          <section className="mb-6 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
            <h2 className="mb-2 text-[9px] font-black uppercase tracking-widest text-cyan-300">Na baia · presença confirmada pelo chamador</h2>
            <div className="flex flex-wrap gap-2">
              {atletasNaBaia.map((item) => (
                <span key={item.chave} className="rounded-lg border border-cyan-500/20 bg-black/40 px-3 py-2 text-[9px] font-black uppercase text-white">{item.nome} · {item.tatame || 'Tatame a definir'}</span>
              ))}
            </div>
          </section>
        )}

        {/* 2. ESTATÍSTICAS RÁPIDAS */}
        <section className="mb-6 grid grid-cols-3 gap-2 md:gap-4">
          <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-2.5 md:p-4 text-center items-center">
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-red-400">Ao vivo</span>
            <strong className="mt-0.5 md:mt-1 block text-lg md:text-2xl font-black text-red-300">{lutasAtivas.length}</strong>
          </div>
          <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-2.5 md:p-4 text-center items-center">
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-cyan-400">Na fila</span>
            <strong className="mt-0.5 md:mt-1 block text-lg md:text-2xl font-black text-cyan-300">{filaLutas.length}</strong>
          </div>
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-2.5 md:p-4 text-center items-center">
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-emerald-400">Resultados</span>
            <strong className="mt-0.5 md:mt-1 block text-lg md:text-2xl font-black text-emerald-300">{totalFinalizadas}</strong>
          </div>
        </section>

        {/* 3. FILTROS */}
        <section className="mb-6 rounded-xl border border-white/5 bg-[#0a0a0e] p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-white/5 bg-black px-3 py-2.5 w-full">
              <Search size={14} className="text-zinc-600 shrink-0" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar atleta..." className="w-full min-w-0 bg-transparent text-xs text-white outline-none placeholder:text-zinc-700" />
            </label>
            <select value={tatameFiltro} onChange={(e) => setTatameFiltro(e.target.value)} className="rounded-lg border border-white/5 bg-black px-3 py-2.5 text-xs font-bold text-zinc-300 outline-none w-full appearance-none">
              <option value="todos">Todos os tatames</option>
              {tatames.map((tatame) => <option key={tatame} value={tatame}>{tatame}</option>)}
            </select>
          </div>
        </section>

        {/* 4. FILA E RESULTADOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs md:text-sm font-black uppercase tracking-widest text-white px-1"><Clock size={14} className="text-cyan-500" /> Próximas Chamadas</h2>
            {filaLutas.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-[#0a0a0e] p-6 text-xs text-zinc-600 text-center font-bold uppercase tracking-widest">Fila vazia.</div>
            ) : (
              <div className="grid gap-2">
                {filaLutas.map((luta, index) => <FilaLinhaMobile key={luta.id} luta={luta} index={index} agora={agora} />)}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs md:text-sm font-black uppercase tracking-widest text-white px-1"><Medal size={14} className="text-emerald-500" /> Resultados Recentes</h2>
            {lutasFinalizadas.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-[#0a0a0e] p-6 text-xs text-zinc-600 text-center font-bold uppercase tracking-widest">Nenhum resultado.</div>
            ) : (
              <div className="grid gap-2">
                {lutasFinalizadas.map((luta) => <Link key={luta.id} href={`/evento/${eventoId}/luta/${luta.id}`}><ResultadoLinhaMobile luta={luta} /></Link>)}
              </div>
            )}
          </section>
        </div>

      </div>
    </main>
  );
}
