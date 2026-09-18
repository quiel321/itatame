'use client';

import { ehFaseChaveDeTres, lutasFormamChaveDeSeis, placeholderSlotChaveDeTres } from '@/app/lib/chave-de-tres';
import { rotuloLuta } from '@/app/lib/lutas-rotulos';

type LutaChave = {
  id: string | number;
  id_visual?: string | number | null;
  fase?: string | null;
  atleta_1?: string | null;
  atleta_2?: string | null;
  atleta_1_id?: number | null;
  atleta_2_id?: number | null;
  equipe_1?: string | null;
  equipe_2?: string | null;
  numero_1?: string | null;
  numero_2?: string | null;
  proxima_luta?: string | number | null;
  vencedor?: string | null;
  status_luta?: string | null;
};

function fantasma(nome?: string | null) {
  const limpo = String(nome || '').trim().toUpperCase();
  return !limpo || limpo === 'BYE' || limpo === 'TBD' || limpo.includes('SEM OPONENTE');
}

function Slot({
  luta,
  lado,
  foto,
}: {
  luta?: LutaChave;
  lado: 1 | 2;
  foto?: string | null;
}) {
  if (!luta) return null;
  const bruto = lado === 1 ? luta.atleta_1 : luta.atleta_2;
  const real = !fantasma(bruto);
  const nome = real ? String(bruto) : (placeholderSlotChaveDeTres(luta, lado) || 'A definir');
  const equipe = real ? (lado === 1 ? luta.equipe_1 : luta.equipe_2) : '';
  const numero = real ? (lado === 1 ? luta.numero_1 : luta.numero_2) : '';
  const venceu = real && luta.vencedor && String(luta.vencedor).trim().toUpperCase() === String(bruto).trim().toUpperCase();

  return (
    <div className={`flex items-center gap-2.5 rounded-lg border p-2 ${venceu ? 'border-green-500/40 bg-green-500/10' : real ? 'border-white/10 bg-black/40' : 'border-dashed border-cyan-500/25 bg-cyan-500/5'}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border ${real ? 'border-zinc-600 bg-zinc-800' : 'border-cyan-500/30 bg-black'}`}>
        {foto && real ? <img src={foto} alt={nome} className="h-full w-full object-cover" /> : (
          <span className={`text-[10px] font-black ${real ? 'text-zinc-400' : 'text-cyan-400'}`}>{real ? nome.charAt(0) : '?'}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs font-black uppercase ${venceu ? 'text-green-400' : real ? 'text-white' : 'text-cyan-200'}`}>
          {numero ? `${numero} ` : ''}{nome}
        </p>
        <p className="truncate text-[9px] font-bold uppercase text-zinc-500">{equipe || (real ? 'Sem equipe' : 'Aguardando resultado')}</p>
      </div>
    </div>
  );
}

function cardLuta(luta: LutaChave | undefined, titulo: string, dica: string, buscarFoto?: (id?: number | null) => string | null) {
  return (
    <article className="flex min-w-[220px] flex-1 flex-col overflow-hidden rounded-xl border border-[#57d8ff]/20 bg-[#0c1220]">
      <header className="flex items-center justify-between border-b border-[#57d8ff]/20 bg-[#57d8ff]/10 px-3 py-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-[#57d8ff]">{titulo}</span>
        {luta?.status_luta === 'em_andamento' && <span className="rounded bg-red-500 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">Lutando</span>}
        {luta?.vencedor && <span className="rounded border border-green-500/30 bg-green-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase text-green-400">Finalizada</span>}
      </header>
      <div className="flex flex-col gap-1.5 p-3">
        <Slot luta={luta} lado={1} foto={buscarFoto?.(luta?.atleta_1_id)} />
        <p className="text-center text-[8px] font-black uppercase tracking-widest text-zinc-600">vs</p>
        <Slot luta={luta} lado={2} foto={buscarFoto?.(luta?.atleta_2_id)} />
        <p className="mt-1 text-[9px] font-bold leading-relaxed text-zinc-500">{dica}</p>
      </div>
    </article>
  );
}

function acharLuta(lutas: LutaChave[], id: string) {
  return lutas.find(luta => String(luta.id_visual) === id && ehFaseChaveDeTres(luta.fase))
    || lutas.find(luta => String(luta.id_visual) === id);
}

export default function ChaveDeTresPainel({
  lutas,
  buscarFoto,
  ids,
  titulo,
  compacto = false,
}: {
  lutas: LutaChave[];
  buscarFoto?: (id?: number | null) => string | null;
  ids?: { luta1: string; luta2: string; final: string };
  titulo?: string;
  compacto?: boolean;
}) {
  const luta1 = acharLuta(lutas, ids?.luta1 || '1');
  const luta2 = acharLuta(lutas, ids?.luta2 || '2');
  const final = acharLuta(lutas, ids?.final || '999') || lutas.find(luta => luta.proxima_luta == null);

  return (
    <section className="w-full">
      {titulo && <h3 className="mb-3 text-[10px] font-black uppercase tracking-widest text-cyan-300">{titulo}</h3>}
      {!compacto && (
        <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-[11px] font-bold leading-relaxed text-cyan-100">
          Chave de 3: a luta 1 acontece primeiro. O vencedor vai à decisão; o perdedor enfrenta o atleta da baia. Quem ganhar a baia completa a final.
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row">
        {cardLuta(luta1, luta1 ? rotuloLuta(luta1) : 'Luta 1', 'Vencedor vai à decisão. Perdedor vai à baia.', buscarFoto)}
        {cardLuta(luta2, luta2 ? rotuloLuta(luta2) : 'Luta 2 · baia', 'Perdedor da luta 1 × terceiro atleta. Vencedor vai à decisão.', buscarFoto)}
        {cardLuta(final, final ? rotuloLuta(final) : 'Decisão', 'Vencedor da luta 1 × vencedor da baia.', buscarFoto)}
      </div>
    </section>
  );
}

export function ChaveDeSeisPainel({
  lutas,
  buscarFoto,
}: {
  lutas: LutaChave[];
  buscarFoto?: (id?: number | null) => string | null;
}) {
  const final = acharLuta(lutas, '999') || lutas.find(luta => luta.proxima_luta == null);
  return (
    <section className="w-full space-y-5">
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-[11px] font-bold leading-relaxed text-cyan-100">
        Seis atletas: uma chave de 3 em cada lado. Quem fica na baia espera o perdedor da primeira luta daquele lado. Os vencedores de cada lado fazem a final.
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChaveDeTresPainel
          lutas={lutas}
          buscarFoto={buscarFoto}
          ids={{ luta1: '1', luta2: '2', final: '101' }}
          titulo="Lado esquerdo"
          compacto
        />
        <ChaveDeTresPainel
          lutas={lutas}
          buscarFoto={buscarFoto}
          ids={{ luta1: '3', luta2: '4', final: '102' }}
          titulo="Lado direito"
          compacto
        />
      </div>
      {cardLuta(final, final ? rotuloLuta(final) : 'Final', 'Vencedor do lado esquerdo × vencedor do lado direito.', buscarFoto)}
    </section>
  );
}

export function ChaveTriangularPainel({
  lutas,
  buscarFoto,
}: {
  lutas: LutaChave[];
  buscarFoto?: (id?: number | null) => string | null;
}) {
  if (lutasFormamChaveDeSeis(lutas)) return <ChaveDeSeisPainel lutas={lutas} buscarFoto={buscarFoto} />;
  return <ChaveDeTresPainel lutas={lutas} buscarFoto={buscarFoto} />;
}
