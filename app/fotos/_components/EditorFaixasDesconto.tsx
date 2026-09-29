"use client";

import type { FaixaDesconto } from "@/app/lib/fotos-descontos";

export default function EditorFaixasDesconto({ faixas, onChange }: { faixas: FaixaDesconto[]; onChange: (faixas: FaixaDesconto[]) => void }) {
  return <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:col-span-2">
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-white">Desconto progressivo</p>
      <p className="mt-1 text-[10px] text-zinc-400">A maior faixa alcançada vale para as fotos desta galeria. Vídeos ficam fora do desconto.</p>
    </div>
    {faixas.map((faixa, indice) => <div key={indice} className="flex items-end gap-2">
      <label className="min-w-0 flex-1 text-[9px] font-bold text-zinc-400">A partir de fotos
        <input type="number" min={2} max={50} value={faixa.quantidade} onChange={(e) => onChange(faixas.map((item, i) => i === indice ? { ...item, quantidade: Number(e.target.value) } : item))} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-xs text-white" />
      </label>
      <label className="min-w-0 flex-1 text-[9px] font-bold text-zinc-400">Desconto (%)
        <input type="number" min={1} max={90} step="0.01" value={faixa.percentual} onChange={(e) => onChange(faixas.map((item, i) => i === indice ? { ...item, percentual: Number(e.target.value) } : item))} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-xs text-white" />
      </label>
      <button type="button" onClick={() => onChange(faixas.filter((_, i) => i !== indice))} className="h-10 rounded-xl border border-white/10 px-3 text-xs text-zinc-400" aria-label={`Remover faixa ${indice + 1}`}>×</button>
    </div>)}
    {faixas.length < 5 && <button type="button" onClick={() => onChange([...faixas, { quantidade: (faixas.at(-1)?.quantidade || 2) + 2, percentual: Math.min(90, (faixas.at(-1)?.percentual || 0) + 5) }])} className="rounded-xl border border-white/15 px-3 py-2 text-[10px] font-bold text-white hover:bg-white/5">+ Adicionar faixa</button>}
  </div>;
}
