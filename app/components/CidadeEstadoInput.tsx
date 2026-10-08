"use client";

import { useEffect, useMemo, useState } from "react";
import { chaveLocalidade, type Localidade } from "@/app/lib/localidades";

let localidadesCache: Localidade[] | null = null;
let consultaLocalidades: Promise<Localidade[]> | null = null;

function carregarLocalidades() {
  if (localidadesCache) return Promise.resolve(localidadesCache);
  if (!consultaLocalidades) {
    consultaLocalidades = fetch("/api/localidades")
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error("Não foi possível carregar a lista de cidades.");
        const dados = await resposta.json() as Localidade[];
        if (!Array.isArray(dados)) throw new Error("Lista de cidades inválida.");
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
};

export default function CidadeEstadoInput({ cidade, estado, onChange, className, accentClassName = "text-orange-400" }: Props) {
  const [localidades, setLocalidades] = useState<Localidade[]>(localidadesCache || []);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    void carregarLocalidades().then((dados) => { if (ativo) setLocalidades(dados); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, []);

  const sugestoes = useMemo(() => {
    const termo = chaveLocalidade(cidade, "").split("|")[0];
    if (termo.length < 2 || estado) return [];
    return localidades.filter((item) => chaveLocalidade(item.cidade, "").startsWith(termo)).slice(0, 8);
  }, [cidade, estado, localidades]);

  return <div className="relative">
    <input
      value={cidade}
      onChange={(event) => { onChange({ cidade: event.target.value, estado: "" }); setAberto(true); }}
      onFocus={() => setAberto(true)}
      onBlur={() => window.setTimeout(() => setAberto(false), 150)}
      autoComplete="off"
      placeholder="Digite a cidade e selecione"
      className={className || "h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-retratt"}
    />
    {estado && <span className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold ${accentClassName}`}>{estado}</span>}
    {aberto && sugestoes.length > 0 && <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900 shadow-xl">
      {sugestoes.map((item) => <button key={`${item.cidade}|${item.estado}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(item); setAberto(false); }} className="flex w-full justify-between px-3 py-2 text-left text-xs text-white hover:bg-white/10"><span>{item.cidade}</span><span className={accentClassName}>{item.estado}</span></button>)}
    </div>}
    {erro && <p className="mt-1 text-[10px] text-amber-300">Não foi possível carregar as cidades. Reabra a página para tentar novamente.</p>}
    {!estado && cidade.trim() && !erro && localidades.length > 0 && !aberto && <p className="mt-1 text-[10px] text-amber-300">Selecione uma cidade da lista.</p>}
  </div>;
}
