'use client';

import { useMemo, useState } from 'react';
import { placeholderSlotChaveDeTres } from '@/app/lib/chave-de-tres';
import { estruturaVisualChave, rotulosColunasArvore } from '@/app/lib/chave-visual';

export type LutaArvore = {
  id?: string | number;
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
  vencedor_id?: number | null;
  status_luta?: string | null;
  horario_estimado?: string | null;
  tatame?: string | null;
};

type AtletaSlot = {
  nome: string;
  equipe: string;
  numero?: string | null;
  foto: string | null;
  horario?: string | null;
  status?: string | null;
  tatame?: string | null;
  venceu?: boolean;
  placeholder?: boolean;
  onAvancar?: ((...args: unknown[]) => void) | undefined;
  luta_id?: string | number | null;
  id_banco?: string | number;
};

const ROW_PX = 70;

function formatarHorario(isoString?: string | null) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fantasma(nome?: string | null) {
  const limpo = String(nome || '').trim().toUpperCase();
  return !limpo || limpo === 'BYE' || limpo === 'TBD' || limpo.includes('SEM OPONENTE');
}

function achar(lutas: LutaArvore[], id: string) {
  if (!id) return undefined;
  return lutas.find(luta => String(luta.id_visual) === id);
}

function slot(
  luta: LutaArvore | undefined,
  lado: 1 | 2,
  buscarFoto: (id?: number | null) => string | null,
  onAvancar?: (...args: unknown[]) => void,
): AtletaSlot {
  if (!luta) return { nome: '', equipe: '', foto: null };
  const bruto = lado === 1 ? luta.atleta_1 : luta.atleta_2;
  const id = lado === 1 ? luta.atleta_1_id : luta.atleta_2_id;
  const real = !fantasma(bruto);
  const nome = real ? String(bruto) : (placeholderSlotChaveDeTres(luta, lado) || '');
  const venceu = real && Boolean(luta.vencedor) && String(luta.vencedor).trim().toUpperCase() === String(bruto).trim().toUpperCase();
  return {
    nome,
    equipe: real ? String((lado === 1 ? luta.equipe_1 : luta.equipe_2) || '') : (nome ? 'Aguardando resultado' : ''),
    numero: real ? (lado === 1 ? luta.numero_1 : luta.numero_2) : '',
    foto: real ? buscarFoto(id) : null,
    horario: luta.horario_estimado,
    status: luta.status_luta,
    tatame: luta.tatame,
    venceu,
    placeholder: !real && Boolean(nome),
    onAvancar,
    luta_id: luta.id_visual,
    id_banco: luta.id,
  };
}

function marcaDestaque(slotAtleta: AtletaSlot, destaque: string) {
  if (!destaque || !slotAtleta.nome) return false;
  return slotAtleta.nome.toUpperCase().includes(destaque.trim().toUpperCase());
}

function Atleta({
  nome,
  equipe,
  numero,
  foto,
  reverso = false,
  centralizado = false,
  campeao = false,
  horario,
  status,
  tatame,
  venceu = false,
  placeholder = false,
  destaque = false,
  onAvancar,
  luta_id,
  id_banco,
}: AtletaSlot & { reverso?: boolean; centralizado?: boolean; campeao?: boolean; destaque?: boolean }) {
  const podeClicar = Boolean(onAvancar && nome && !placeholder);
  const vazio = !nome && !placeholder;

  if (campeao) {
    return (
      <div
        onClick={() => podeClicar && onAvancar?.(id_banco, luta_id, nome, equipe)}
        className={`flex w-full flex-col items-center justify-center gap-1.5 py-1 ${podeClicar ? 'cursor-pointer hover:scale-105' : ''}`}
      >
        <div className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-[3px] border-yellow-500 bg-black shadow-[0_0_20px_rgba(234,179,8,0.45)] ${destaque ? 'ring-2 ring-yellow-300' : ''}`}>
          {foto && !placeholder ? <img src={foto} alt={nome} className="h-full w-full object-cover" /> : (
            <svg className="h-8 w-8 text-yellow-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
          )}
        </div>
        <span className="w-full truncate px-1 text-center text-sm font-black uppercase text-yellow-400">{nome || 'A definir'}</span>
        {equipe ? <span className="w-full truncate px-1 text-center text-[10px] font-bold uppercase text-yellow-600/80">{equipe}</span> : null}
      </div>
    );
  }

  return (
    <div
      onClick={() => podeClicar && onAvancar?.(id_banco, luta_id, nome, equipe)}
      className={`flex h-full min-h-[70px] items-center px-0.5 ${podeClicar ? 'z-20 cursor-pointer' : ''}`}
    >
      <div className={`flex w-full min-w-[148px] items-center gap-2 rounded-xl border px-2 py-1.5 shadow-sm ${
        venceu ? 'border-green-400/60 bg-green-500/15' :
        destaque ? 'border-yellow-400/70 bg-yellow-500/10' :
        placeholder ? 'border-dashed border-cyan-400/35 bg-cyan-500/5' :
        vazio ? 'border-white/5 bg-white/[0.02]' :
        'border-white/15 bg-[#0b1220]'
      } ${reverso ? 'flex-row-reverse' : ''} ${centralizado ? 'flex-col text-center' : ''} ${podeClicar ? 'hover:border-cyan-400/50' : ''}`}>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border ${
          venceu ? 'border-green-400' : placeholder ? 'border-cyan-500/40' : vazio ? 'border-white/10' : 'border-zinc-600'
        } bg-black`}>
          {foto && !placeholder ? <img src={foto} alt="" className="h-full w-full object-cover" /> : (
            <svg className={`h-4 w-4 ${placeholder ? 'text-cyan-500' : 'text-zinc-600'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
          )}
        </div>
        <div className={`min-w-0 flex-1 ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>
          <p className={`truncate text-[13px] font-black uppercase leading-tight ${
            venceu ? 'text-green-300' : placeholder ? 'text-cyan-200 italic' : vazio ? 'text-zinc-700' : 'text-white'
          }`}>
            {numero && !placeholder ? <span className="mr-1 text-[10px] text-zinc-500">{numero}</span> : null}
            {nome || (vazio ? '—' : '')}
          </p>
          <p className={`truncate text-[10px] font-bold uppercase ${placeholder ? 'text-cyan-700' : 'text-zinc-500'}`}>
            {equipe || (vazio ? '' : ' ')}
          </p>
          {!placeholder && horario && status !== 'concluida' && status !== 'em_andamento' && (
            <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-widest text-yellow-500">
              {formatarHorario(horario)}{tatame ? ` · ${tatame}` : ''}
            </p>
          )}
          {!placeholder && status === 'em_andamento' && (
            <p className="mt-0.5 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-red-400">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-red-500" /> Lutando
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Conector({ reverso = false }: { reverso?: boolean }) {
  return (
    <div className="relative h-full w-[18px] min-w-[18px]">
      <div className={`absolute top-[25%] bottom-[25%] w-1/2 border-y border-zinc-500 ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} />
      <div className={`absolute top-1/2 w-1/2 border-t border-zinc-500 ${reverso ? 'left-0' : 'right-0'}`} />
    </div>
  );
}

function LadoArvore({
  colunas,
  reverso,
  lutas,
  buscarFoto,
  destaque,
  onAvancar,
  rotulos,
}: {
  colunas: string[][];
  reverso?: boolean;
  lutas: LutaArvore[];
  buscarFoto: (id?: number | null) => string | null;
  destaque: string;
  onAvancar?: (...args: unknown[]) => void;
  rotulos: string[];
}) {
  const nRows = Math.max(2, (colunas[0]?.length || 1) * 2);
  const templateCols = reverso
    ? `repeat(${colunas.length}, 18px minmax(168px, 200px))`
    : `repeat(${colunas.length}, minmax(168px, 200px) 18px)`;

  return (
    <div className="flex min-w-0 flex-col">
      <div
        className={`mb-2 grid text-[10px] font-black uppercase tracking-widest text-zinc-500 ${reverso ? 'text-left' : 'text-right'}`}
        style={{ gridTemplateColumns: templateCols }}
      >
        {colunas.flatMap((_, indice) => {
          const rotulo = rotulos[indice] || '';
          return reverso
            ? [
                <span key={`c-${indice}`} />,
                <span key={`l-${indice}`} className="px-1">{rotulo}</span>,
              ]
            : [
                <span key={`l-${indice}`} className="px-1">{rotulo}</span>,
                <span key={`c-${indice}`} />,
              ];
        })}
      </div>
      <div
        className="grid items-stretch"
        style={{
          gridTemplateRows: `repeat(${nRows}, ${ROW_PX}px)`,
          gridTemplateColumns: templateCols,
        }}
      >
        {colunas.map((ids, rodada) => {
          const span = 2 ** rodada;
          const athleteCol = reverso ? (colunas.length - rodada) * 2 : rodada * 2 + 1;
          const connectorCol = reverso ? athleteCol - 1 : athleteCol + 1;
          return ids.flatMap((id, matchIndex) => {
            const luta = achar(lutas, id);
            const a = slot(luta, 1, buscarFoto, onAvancar);
            const b = slot(luta, 2, buscarFoto, onAvancar);
            const rowStart = matchIndex * span * 2 + 1;
            return [
              <div key={`${reverso ? 'd' : 'e'}-${rodada}-${matchIndex}-a`} style={{ gridColumn: athleteCol, gridRow: `${rowStart} / span ${span}` }}>
                <Atleta {...a} reverso={reverso} destaque={marcaDestaque(a, destaque)} />
              </div>,
              <div key={`${reverso ? 'd' : 'e'}-${rodada}-${matchIndex}-b`} style={{ gridColumn: athleteCol, gridRow: `${rowStart + span} / span ${span}` }}>
                <Atleta {...b} reverso={reverso} destaque={marcaDestaque(b, destaque)} />
              </div>,
              <div key={`${reverso ? 'd' : 'e'}-${rodada}-${matchIndex}-c`} style={{ gridColumn: connectorCol, gridRow: `${rowStart} / span ${span * 2}` }}>
                <Conector reverso={reverso} />
              </div>,
            ];
          });
        })}
      </div>
    </div>
  );
}

function CentroFinal({
  final,
  buscarFoto,
  destaque,
  onAvancar,
  rotulo,
}: {
  final?: LutaArvore;
  buscarFoto: (id?: number | null) => string | null;
  destaque: string;
  onAvancar?: (...args: unknown[]) => void;
  rotulo: string;
}) {
  const a = slot(final, 1, buscarFoto, onAvancar);
  const b = slot(final, 2, buscarFoto, onAvancar);
  return (
    <div className="relative mx-1 flex w-[180px] shrink-0 flex-col items-center justify-center md:w-[200px]">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500">{rotulo}</p>
      <div className="w-full rounded-2xl border border-red-500/30 bg-[#070b16] px-3 py-3 shadow-[0_0_18px_rgba(239,68,68,0.12)]">
        <p className="mb-2 text-center text-[10px] font-black uppercase tracking-widest text-red-500">Luta final</p>
        <Atleta {...a} centralizado destaque={marcaDestaque(a, destaque)} />
        <p className="py-1 text-center text-[9px] font-black uppercase tracking-widest text-zinc-600">vs</p>
        <Atleta {...b} centralizado destaque={marcaDestaque(b, destaque)} />
      </div>
    </div>
  );
}

export default function ArvoreChaveDesktop({
  lutas,
  abaAtual = 1,
  totalAbas = 1,
  buscarFoto,
  destaque = '',
  onAvancar,
}: {
  lutas: LutaArvore[];
  abaAtual?: number;
  totalAbas?: number;
  buscarFoto: (id?: number | null) => string | null;
  destaque?: string;
  onAvancar?: (...args: unknown[]) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const estrutura = useMemo(() => estruturaVisualChave(lutas, abaAtual), [lutas, abaAtual]);
  const rotulos = rotulosColunasArvore(estrutura.tamanho);
  const final = achar(lutas, estrutura.final) || lutas.find(luta => !luta.proxima_luta);
  const campeaoNome = final?.vencedor && !fantasma(final.vencedor) ? String(final.vencedor) : '';
  const campeao: AtletaSlot = {
    nome: campeaoNome,
    equipe: '',
    foto: buscarFoto(final?.vencedor_id),
    onAvancar,
    luta_id: final?.id_visual,
    id_banco: final?.id,
  };

  return (
    <div className="relative hidden w-full min-w-0 rounded-3xl border border-white/10 bg-[#050816] shadow-2xl md:block">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-400">Árvore da chave</p>
          {totalAbas > 1 && <p className="text-xs font-bold text-zinc-500">Painel {abaAtual}/{totalAbas}</p>}
        </div>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1">
          <button type="button" onClick={() => setZoom(z => Math.max(0.7, Number((z - 0.1).toFixed(1))))} className="h-8 w-8 rounded-full text-lg font-black text-zinc-300 hover:bg-white/10" aria-label="Diminuir zoom">−</button>
          <button type="button" onClick={() => setZoom(1)} className="min-w-[52px] rounded-full px-2 text-[11px] font-black text-white">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => setZoom(z => Math.min(1.4, Number((z + 0.1).toFixed(1))))} className="h-8 w-8 rounded-full text-lg font-black text-zinc-300 hover:bg-white/10" aria-label="Aumentar zoom">+</button>
        </div>
      </div>

      <div className="overflow-x-auto pb-6 pt-2 scrollbar-hide">
        <div className="flex min-w-max origin-top flex-col items-center px-4 py-4 md:min-w-full" style={{ transform: `scale(${zoom})` }}>
          <div className="mb-4 flex w-full max-w-sm flex-col items-center rounded-2xl border border-yellow-500/40 bg-gradient-to-b from-yellow-500/15 to-black/70 px-4 py-3 shadow-[0_0_24px_rgba(234,179,8,0.18)]">
            <span className="text-[11px] font-black uppercase tracking-widest text-yellow-400">Campeão</span>
            <Atleta {...campeao} centralizado campeao destaque={marcaDestaque(campeao, destaque)} />
          </div>
          <div className="flex items-center justify-center">
            {estrutura.esquerda.length > 0 && (
              <LadoArvore
                colunas={estrutura.esquerda}
                lutas={lutas}
                buscarFoto={buscarFoto}
                destaque={destaque}
                onAvancar={onAvancar}
                rotulos={rotulos.lados}
              />
            )}
            <CentroFinal
              final={final}
              buscarFoto={buscarFoto}
              destaque={destaque}
              onAvancar={onAvancar}
              rotulo={rotulos.centro}
            />
            {estrutura.direita.length > 0 && (
              <LadoArvore
                colunas={estrutura.direita}
                reverso
                lutas={lutas}
                buscarFoto={buscarFoto}
                destaque={destaque}
                onAvancar={onAvancar}
                rotulos={rotulos.lados}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
