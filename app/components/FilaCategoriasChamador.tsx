import type { LutaSequencia } from '@/app/lib/sequencia-tatames';

type CategoriaFila = { chave: string; luta: LutaSequencia; lutas: LutaSequencia[] };
export default function FilaCategoriasChamador({ sequencias, categoriaAtiva, prontasIds, selecionar }: {
  sequencias: { tatame: string; categorias: CategoriaFila[] }[];
  categoriaAtiva: string; prontasIds: Set<string>; selecionar: (chave: string) => void;
}) {
  if (!sequencias.length) return null;
  return <details className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5">
    <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-bold text-cyan-100">Ver sequência das categorias <span className="ml-1 text-xs font-normal text-zinc-400">· definida pelo organizador</span></summary>
    <div className="space-y-4 px-3 pb-3">
      <p className="px-1 text-xs leading-relaxed text-zinc-400">Toque em uma categoria para ver suas lutas. Você pode atender outra categoria enquanto a anterior aguarda check-in ou presença.</p>
      {sequencias.map(({ tatame, categorias }) => <section key={tatame} aria-label={`Sequência do ${tatame}`}>
        <h2 className="mb-2 px-1 text-sm font-black text-white">{tatame}</h2>
        <ol className="space-y-2">
          {categorias.map((categoria, index) => {
            const prontas = categoria.lutas.filter(l => prontasIds.has(String(l.id))).length;
            const emLuta = categoria.lutas.some(l => l.status_luta === 'em_andamento');
            const chamadas = categoria.lutas.some(l => l.iniciada_em && l.status_luta !== 'em_andamento');
            const primeiraHora = categoria.lutas.map(l => l.horario_estimado).filter((h): h is string => Boolean(h)).sort()[0];
            return <li key={categoria.chave}>
              <button onClick={e => { selecionar(categoria.chave); e.currentTarget.closest('details')?.removeAttribute('open'); }} className={`flex min-h-16 w-full items-start gap-3 rounded-xl border p-3 text-left ${categoriaAtiva === categoria.chave ? 'border-yellow-400 bg-yellow-500/10' : 'border-white/10 bg-black/40'}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-sm font-black text-cyan-200">{index + 1}</span>
                <span className="min-w-0 flex-1"><strong className="block break-words text-[13px] leading-snug text-white">{categoria.luta.categoria}</strong>
                  <span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">{categoria.luta.faixa} · {categoria.lutas.length} luta(s) pendente(s){primeiraHora ? ` · previsão ${new Date(primeiraHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ' · sem horário'}</span>
                  <span className={`mt-1.5 inline-block rounded-md px-2 py-1 text-[11px] font-bold ${emLuta ? 'bg-red-500/15 text-red-200' : chamadas ? 'bg-yellow-500/15 text-yellow-200' : prontas ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/5 text-zinc-400'}`}>{emLuta ? 'Em luta' : chamadas ? 'Aguardando mesário' : prontas ? `${prontas} pronta(s) para chamar` : 'Aguardando atletas / liberação'}</span>
                </span>
              </button>
            </li>;
          })}
        </ol>
      </section>)}
    </div>
  </details>;
}
