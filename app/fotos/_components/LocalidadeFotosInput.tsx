"use client";

import { useEffect, useId, useState } from 'react';
import CidadeEstadoInput from '@/app/components/CidadeEstadoInput';
import { ESTADOS_BRASIL, filtrarEstados } from '@/app/lib/estados-brasil';
import type { Localidade } from '@/app/lib/localidades';
import { ChevronDown } from 'lucide-react';

function EstadoInput({ value, onChange, className }: { value: string; onChange: (uf: string) => void; className: string }) {
  const id = useId(), [aberto, setAberto] = useState(false), [busca, setBusca] = useState<{ uf: string; texto: string } | null>(null), [ativo, setAtivo] = useState(-1);
  const textoBusca = busca?.uf === value ? busca.texto : null;
  const selecionado = ESTADOS_BRASIL.find(e => e.sigla === value.toUpperCase());
  const estados = filtrarEstados(textoBusca || '');
  useEffect(() => { if (aberto && ativo >= 0) document.getElementById(`${id}-${ativo}`)?.scrollIntoView({ block: 'nearest' }); }, [aberto, ativo, id]);
  function escolher(indice: number) {
    const estado = estados[indice]; if (!estado) return;
    onChange(estado.sigla); setBusca(null); setAberto(false); setAtivo(-1);
  }
  return <div className="relative">
    <input aria-label="Estado (UF)" role="combobox" aria-autocomplete="list" aria-expanded={aberto} aria-controls={id} aria-activedescendant={aberto && ativo >= 0 && estados[ativo] ? `${id}-${ativo}` : undefined}
      value={textoBusca ?? (selecionado ? `${selecionado.nome} (${selecionado.sigla})` : value)} placeholder="Selecione ou pesquise o estado" autoComplete="off" className={`${className} pr-9`}
      onFocus={() => { setBusca({ uf: value, texto: '' }); setAberto(true); setAtivo(-1); }}
      onChange={e => { setBusca({ uf: '', texto: e.target.value }); onChange(''); setAberto(true); setAtivo(-1); }}
      onBlur={() => window.setTimeout(() => { setAberto(false); if (value) setBusca(null); }, 150)}
      onKeyDown={e => {
        if (e.key === 'Escape') { setAberto(false); setBusca(null); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAberto(true); setAtivo(n => Math.max(0, Math.min(estados.length - 1, n + (e.key === 'ArrowDown' ? 1 : -1)))); }
        if (e.key === 'Enter' && aberto && estados.length) { e.preventDefault(); escolher(ativo >= 0 ? ativo : 0); }
      }} />
    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-400"><ChevronDown size={15} /></span>
    {aberto && <div id={id} role="listbox" aria-label="Estados do Brasil" className="absolute inset-x-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900 shadow-xl">
      {estados.map((e, n) => <button type="button" id={`${id}-${n}`} key={e.sigla} role="option" aria-selected={ativo === n} onMouseDown={e => e.preventDefault()} onClick={() => escolher(n)} className={`flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs text-white hover:bg-white/10 ${ativo === n ? 'bg-white/10' : ''}`}><span>{e.nome}</span><span className="font-bold text-orange-300">{e.sigla}</span></button>)}
      {!estados.length && <p className="px-3 py-3 text-xs text-zinc-400">Nenhum estado encontrado. Pesquise pelo nome ou UF.</p>}
    </div>}
    {!aberto && !value && textoBusca && <p className="mt-1 text-[10px] text-amber-300">Selecione um estado da lista.</p>}
  </div>;
}

export default function LocalidadeFotosInput({ cidade, estado, onChange, className = 'h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-retratt' }: { cidade: string; estado: string; onChange: (l: Localidade) => void; className?: string }) {
  const label = 'mb-1 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500';
  return <>
    <div className="min-w-0"><label className={label}>Estado (UF)</label><EstadoInput value={estado} onChange={uf => onChange({ estado: uf, cidade: uf === estado ? cidade : '' })} className={className} /></div>
    <div className="min-w-0"><label className={label}>Cidade</label><CidadeEstadoInput key={estado} filtrarPorEstado cidade={cidade} estado={estado} onChange={onChange} className={className} /></div>
  </>;
}
