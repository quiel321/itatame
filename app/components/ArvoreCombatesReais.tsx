'use client';

import type { ReactNode } from 'react';
import { combatesPrevistos, nomeOrigemPrevista, type LutaPrevista } from '@/app/lib/combates-previstos';
import { rotuloLuta } from '@/app/lib/lutas-rotulos';
import { situacaoAtletaLuta } from '@/app/lib/situacao-atleta-luta';

type Luta = LutaPrevista & {
  vencedor?: string | null; vencedor_id?: number | null;
  checkin_1?: string | null; checkin_2?: string | null;
  pontuacao_atleta_1?: Record<string, unknown> | null; pontuacao_atleta_2?: Record<string, unknown> | null;
};

/** Ramos compactos: somente combates, com os avanços ligados à próxima luta real. */
export default function ArvoreCombatesReais({ lutas, buscarFoto }: { lutas: Luta[]; buscarFoto: (id?: number | null) => string | null }) {
  const modelo = combatesPrevistos(lutas);
  if (!modelo?.final) return null;
  const final = modelo.final;
  const cartao = (luta: Luta) => <article data-combate-arvore={String(luta.id_visual)} className={`w-[200px] shrink-0 rounded-xl border p-3 ${luta === final ? 'border-red-500/40 bg-[#0c101b]' : 'border-white/20 bg-[#0b1220]'}`}>
    <p className="mb-3 text-center text-[10px] font-black uppercase tracking-widest text-cyan-300">{rotuloLuta(luta)}</p>
    {([1, 2] as const).map(lado => {
      const origem = modelo.origem(luta, lado);
      const nome = (lado === 1 ? luta.atleta_1 : luta.atleta_2);
      const definido = nome && !['BYE', 'TBD'].includes(nome.toUpperCase()) && !nome.toUpperCase().includes('SEM OPONENTE');
      const texto = definido ? nome : nomeOrigemPrevista(origem);
      const id = definido ? (lado === 1 ? luta.atleta_1_id : luta.atleta_2_id) : origem?.atleta?.id;
      const impedimento = definido ? situacaoAtletaLuta(luta, lado) : origem?.registro && origem.lado ? situacaoAtletaLuta(origem.registro, origem.lado) : '';
      const equipe = definido ? (lado === 1 ? luta.equipe_1 : luta.equipe_2) : origem?.atleta?.equipe;
      const venceu = definido && !impedimento && luta.vencedor?.trim().toUpperCase() === nome.trim().toUpperCase();
      const foto = buscarFoto(id);
      return <div key={lado} className={`mt-2 flex min-h-12 items-center gap-2 rounded-lg border px-2 py-2 ${venceu ? 'border-green-500/40 bg-green-500/10' : 'border-white/10 bg-black/30'}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-xs text-zinc-400">{foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : '●'}</div>
        <div className="min-w-0"><p className={`break-words text-[10px] font-bold uppercase leading-snug ${venceu ? 'text-green-300' : !definido && origem?.luta ? 'text-cyan-200' : 'text-white'}`}>{texto}</p>{equipe && <p className="truncate text-[9px] text-zinc-500">{equipe}</p>}{impedimento && <p className="text-[9px] text-red-300">{impedimento}</p>}</div>
      </div>;
    })}
  </article>;
  const ramo = (luta: Luta, reverso: boolean): ReactNode => {
    const filhos = ([1, 2] as const).flatMap(lado => {
      const origem = modelo.origem(luta, lado);
      return origem?.luta ? [origem.luta] : [];
    });
    return <div className={`flex items-center ${reverso ? 'flex-row-reverse' : ''}`}>
      {filhos.length > 0 && <><div className="flex flex-col justify-center gap-6">{filhos.map(filho => <div key={String(filho.id_visual)}>{ramo(filho, reverso)}</div>)}</div><div className="h-px w-6 shrink-0 bg-zinc-500" /></>}
      {cartao(luta)}
    </div>;
  };
  const esquerda = modelo.origem(final, 1)?.luta, direita = modelo.origem(final, 2)?.luta;
  return <section aria-label="Árvore dos combates previstos" className="hidden rounded-3xl border border-white/15 bg-[#050816] p-5 md:block">
    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">{modelo.lutas.length} combate(s) nesta chave</p>
    <p className="mt-1 text-xs text-zinc-400">Avanços sem adversário seguem direto para a próxima luta. Liberação sujeita ao check-in.</p>
    <div className="mt-4 text-center"><span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">Campeão</span><p className="mt-1 text-sm font-bold uppercase text-yellow-300">{final.vencedor || 'A definir'}</p></div>
    <div className="overflow-x-auto py-5"><div className="flex min-w-max items-center justify-center">
      {esquerda && <>{ramo(esquerda, false)}<div className="h-px w-6 shrink-0 bg-zinc-500" /></>}
      {cartao(final)}
      {direita && <><div className="h-px w-6 shrink-0 bg-zinc-500" />{ramo(direita, true)}</>}
    </div></div>
  </section>;
}
