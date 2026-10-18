import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export default function SecaoOrganizador({ titulo, resumo, children }: { titulo: string; resumo?: ReactNode; children: ReactNode }) {
  return <details className="group/secao mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.015]">
    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden"><span className="min-w-0"><span className="block text-xs font-bold text-white">{titulo}</span>{resumo && <span className="mt-1 block text-[10px] leading-4 text-zinc-500">{resumo}</span>}</span><span className="shrink-0 text-zinc-400 transition-transform group-open/secao:rotate-180"><ChevronDown size={16} /></span></summary>
    <div className="border-t border-white/10 p-3 sm:p-4">{children}</div>
  </details>;
}
