'use client';
import { Images, Trash2 } from 'lucide-react';
import { formatarPrecoFotos } from '@/app/lib/fotos';
import type { OfertaComboIa } from '@/app/lib/fotos-combo-ia';

export default function PacoteIaCarrinho({ pacote, editavel, onRemover, onDesfazer, onAmpliar }: {
  pacote: OfertaComboIa; editavel: boolean; onRemover: () => void; onDesfazer: () => void; onAmpliar: (id: string) => void;
}) {
  return <article className="rounded-2xl border border-orange-400/25 bg-[#0a0a0e] p-4 sm:p-5">
    <p className="mb-4 break-words text-sm font-bold text-white">{pacote.eventoNome}</p>
    <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[96px_minmax(0,1fr)_auto]">
      <button type="button" onClick={() => onAmpliar(pacote.fotoIds[0])} aria-label="Ver fotos do pacote" className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24">
        {pacote.fotoIds.slice(0, 3).reverse().map((id, n) => <img key={id} src={`/api/fotos/arquivo/${id}?tipo=thumb`} alt="Prévia protegida do pacote" className="absolute h-16 w-16 rounded-lg border-2 border-zinc-800 object-cover shadow-lg sm:h-20 sm:w-20" style={{ top: n * 4, left: n * 4, transform: `rotate(${(n - 1) * 5}deg)` }} />)}
      </button>
      <div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-sm font-bold text-white"><Images size={15} />Pacote com {pacote.quantidade} fotos</p><p className="mt-1 text-[10px] text-zinc-500">Encontradas na sua busca de IA · sem vídeos</p><p className="mt-2 text-[11px] text-emerald-300">Economia de {formatarPrecoFotos(pacote.descontoCentavos)}</p><p className="mt-1 text-[10px] text-zinc-500"><s>{formatarPrecoFotos(pacote.subtotalCentavos)}</s> · {formatarPrecoFotos(Math.round(pacote.totalCentavos / pacote.quantidade))} por foto</p></div>
      <p className="col-start-2 text-base font-bold text-white sm:col-start-auto sm:text-xl">{formatarPrecoFotos(pacote.totalCentavos)}</p>
    </div>
    <details className="mt-4 border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs font-bold text-zinc-300">Ver as {pacote.quantidade} fotos incluídas</summary><div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">{pacote.fotoIds.map((id, n) => <button key={id} type="button" onClick={() => onAmpliar(id)} aria-label={`Ampliar foto ${n + 1} do pacote`} className="aspect-square overflow-hidden rounded-lg"><img src={`/api/fotos/arquivo/${id}?tipo=thumb`} alt="Foto incluída no pacote" loading="lazy" className="h-full w-full object-cover" /></button>)}</div></details>
    {editavel && <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onRemover} className="inline-flex min-h-10 items-center gap-2 text-xs text-red-300"><Trash2 size={13} />Remover pacote</button><button type="button" onClick={onDesfazer} className="min-h-10 text-[10px] text-zinc-500 underline underline-offset-4">Escolher fotos avulsas · perde o desconto do pacote</button></div>}
  </article>;
}
