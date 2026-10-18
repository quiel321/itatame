"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { chaveLocalidade, type Localidade } from "@/app/lib/localidades";
import { cidadesDoEstado, cidadeExataNoEstado } from '@/app/lib/estados-brasil';

let localidadesCache: Localidade[] | null = null;
let consultaLocalidades: Promise<Localidade[]> | null = null;

function carregarLocalidades() {
  if (localidadesCache) return Promise.resolve(localidadesCache);
  if (!consultaLocalidades) {
    consultaLocalidades = fetch("/api/localidades")
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error("Não foi possível carregar a lista de cidades.");
        const dados = await resposta.json() as Localidade[];
        if (!Array.isArray(dados) || dados.length < 5000 || dados.some((item) => !item.cidade || !item.estado)) throw new Error("Lista de cidades inválida.");
        localidadesCache = dados;
        return dados;
      })
      .finally(() => { consultaLocalidades = null; });
  }
  return consultaLocalidades;
}

type Props = {
  cidade: string;
  estado: string;
  onChange: (localidade: Localidade) => void;
  className?: string;
  accentClassName?: string;
  filtrarPorEstado?: boolean;
};

export default function CidadeEstadoInput({ cidade, estado, onChange, className, accentClassName = "text-orange-400", filtrarPorEstado = false }: Props) {
  const [localidades, setLocalidades] = useState<Localidade[]>(localidadesCache || []);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [ativo, setAtivo] = useState(-1);
  const listaId = useId();
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [editada, setEditada] = useState(false);
  const texto = filtrarPorEstado ? rascunho ?? cidade : cidade;
  useEffect(() => { if (filtrarPorEstado && aberto && ativo >= 0) document.getElementById(`${listaId}-${ativo}`)?.scrollIntoView({ block: 'nearest' }); }, [filtrarPorEstado, aberto, ativo, listaId]);

  useEffect(() => {
    let ativo = true;
    void carregarLocalidades().then((dados) => { if (ativo) setLocalidades(dados); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [tentativa]);

  const sugestoes = useMemo(() => {
    if (filtrarPorEstado) return cidadesDoEstado(localidades, estado, texto);
    const termo = chaveLocalidade(cidade, "").split("|")[0];
    if (termo.length < 1 || estado) return [];
    return localidades.filter((item) => chaveLocalidade(item.cidade, "").startsWith(termo)).slice(0, 8);
  }, [cidade, estado, localidades, texto, filtrarPorEstado]);

  function selecionar(item: Localidade) {
    onChange(item); setRascunho(null); setAberto(false); setAtivo(-1); setEditada(false);
  }

  return <div className="relative">
    <input
      value={texto}
      disabled={filtrarPorEstado && !estado}
      onChange={(event) => {
        const texto = event.target.value;
        if (filtrarPorEstado) { setRascunho(texto); setEditada(true); onChange(cidadeExataNoEstado(localidades, estado, texto) || { cidade: '', estado }); }
        else onChange({ cidade: texto, estado: '' });
        setAberto(true); setAtivo(-1);
      }}
      onFocus={() => { if (filtrarPorEstado) setRascunho(''); setAberto(true); }}
      onBlur={() => window.setTimeout(() => { setAberto(false); if (filtrarPorEstado) setRascunho(null); }, 150)}
      role="combobox"
      aria-label="Cidade"
      aria-autocomplete="list"
      aria-expanded={aberto && sugestoes.length > 0}
      aria-controls={listaId}
      aria-activedescendant={aberto && ativo >= 0 && sugestoes[ativo] ? `${listaId}-${ativo}` : undefined}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { setAberto(false); setAtivo(-1); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setAberto(true);
          setAtivo((atual) => Math.max(0, Math.min(sugestoes.length - 1, atual + (event.key === 'ArrowDown' ? 1 : -1))));
        }
        const indice = ativo >= 0 ? ativo : filtrarPorEstado && sugestoes.length === 1 ? 0 : -1;
        if (event.key === 'Enter' && aberto && sugestoes[indice]) {
          event.preventDefault(); selecionar(sugestoes[indice]);
        }
      }}
      autoComplete="off"
      placeholder={filtrarPorEstado ? estado ? 'Pesquise ou selecione a cidade' : 'Selecione o estado primeiro' : 'Digite a cidade e selecione'}
      className={`${className || "h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-retratt"} disabled:cursor-not-allowed disabled:opacity-50`}
    />
    {estado && !filtrarPorEstado && <span className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold ${accentClassName}`}>{estado}</span>}
    {aberto && sugestoes.length > 0 && <div id={listaId} role="listbox" aria-label="Cidades do IBGE" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900 shadow-xl">
      {sugestoes.map((item, indice) => <button id={`${listaId}-${indice}`} role="option" aria-selected={ativo === indice} key={`${item.cidade}|${item.estado}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selecionar(item)} className={`flex w-full justify-between px-3 py-2 text-left text-xs text-white hover:bg-white/10 ${filtrarPorEstado ? 'min-h-11 items-center gap-2' : ''} ${ativo === indice ? "bg-white/10" : ""}`}><span>{item.cidade}</span><span className={accentClassName}>{item.estado}</span></button>)}
    </div>}
    {erro && <p className="mt-1 text-[10px] text-amber-300">Não foi possível carregar as cidades. <button type="button" onClick={() => { setErro(false); setTentativa((valor) => valor + 1); }} className="underline">Tentar novamente</button></p>}
    {filtrarPorEstado && estado && aberto && !erro && !localidades.length && <p role="status" className="mt-1 text-[10px] text-zinc-400">Carregando cidades…</p>}
    {filtrarPorEstado && estado && aberto && localidades.length > 0 && !sugestoes.length && <p className="mt-1 text-[10px] text-amber-300">Nenhuma cidade encontrada neste estado.</p>}
    {filtrarPorEstado && editada && !cidade && !aberto && !erro && <p className="mt-1 text-[10px] text-amber-300">Selecione uma cidade da lista.</p>}
    {!estado && cidade.trim() && !erro && localidades.length > 0 && !aberto && <p className="mt-1 text-[10px] text-amber-300">Selecione uma cidade da lista.</p>}
  </div>;
}
