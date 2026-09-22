"use client";

import { useMemo, useState } from "react";
import { filtrarNomes, nomeOficial } from "@/app/lib/vinculo-equipe";

type CampoNomeOficialProps = {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  existentes: string[];
  placeholder: string;
  disabled?: boolean;
  destaque?: "amarelo" | "ciano";
};

export default function CampoNomeOficial({ rotulo, valor, onChange, existentes, placeholder, disabled, destaque = "amarelo" }: CampoNomeOficialProps) {
  const [aberto, setAberto] = useState(false);
  const oficial = nomeOficial(valor, existentes);
  const precisaUnir = Boolean(valor.trim() && oficial && oficial !== valor.trim());
  const sugestoes = useMemo(() => filtrarNomes(valor, existentes), [existentes, valor]);
  const foco = destaque === "amarelo" ? "focus:border-yellow-500" : "focus:border-cyan-500";

  function escolher(nome: string) {
    onChange(nomeOficial(nome, existentes));
    setAberto(false);
  }

  return (
    <div className="relative">
      <label className={`mb-1 block pl-1 text-[10px] font-bold uppercase tracking-wider ${destaque === "amarelo" ? "text-yellow-500" : "text-zinc-500"}`}>{rotulo}</label>
      <input
        type="text"
        value={valor}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setAberto(true)}
        onBlur={() => {
          setAberto(false);
          if (!disabled && valor.trim()) onChange(oficial);
        }}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border border-white/5 bg-black/50 px-3 py-2 text-xs text-white outline-none transition-colors ${foco} disabled:cursor-not-allowed disabled:border-transparent disabled:bg-black/30 disabled:text-zinc-500`}
      />
      {precisaUnir && (
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => escolher(oficial)} className="mt-1 block text-left text-[10px] font-bold text-yellow-300">
          Já existe no iTatame como {oficial}. Usar este nome.
        </button>
      )}
      {aberto && !disabled && sugestoes.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#0e0e12] shadow-2xl">
          {sugestoes.map((nome) => (
            <button key={nome} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => escolher(nome)} className="block w-full px-3 py-2 text-left text-xs font-bold text-white hover:bg-white/5">
              {nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
