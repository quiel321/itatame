import type { resumoAvancoSemCombate } from '@/app/lib/avanco-sem-combate';
type Resumo=NonNullable<ReturnType<typeof resumoAvancoSemCombate>>;
export default function AvancoSemCombateCard({avanco,impedimento}:{avanco:Resumo;impedimento?:string|null}) {
 return <article aria-label={avanco.titulo+' — '+avanco.nome} className="min-w-0 rounded-xl border border-cyan-400/25 bg-[#0c1220] p-3 shadow-sm">
  <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-300">{impedimento?'Atleta não liberado':avanco.titulo}</p>
  <p className="mt-3 break-words text-xs font-bold uppercase leading-snug text-white">{avanco.nome}</p>
  <p className="mt-1 break-words text-[10px] text-zinc-400">{avanco.equipe||'Sem equipe'}</p>
  <p className="mt-3 border-t border-white/10 pt-2 text-xs text-zinc-300">Sem combate nesta fase.</p>
  <p className={'mt-1 text-[10px] leading-relaxed '+(impedimento?'text-red-300':'text-zinc-400')}>{impedimento|| (avanco.confirmado?'Avanço confirmado. Aguarda o adversário da próxima fase.':'O avanço depende da aprovação e do fechamento do check-in da categoria.')}</p>
 </article>;
}
