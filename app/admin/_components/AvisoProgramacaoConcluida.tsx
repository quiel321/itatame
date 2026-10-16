'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, X } from 'lucide-react';

export default function AvisoProgramacaoConcluida({ eventoId }: { eventoId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  if (!eventoId || params.get('programacao_concluida') !== eventoId || params.get('evento') !== eventoId) return null;

  const fechar = () => {
    const novos = new URLSearchParams(params.toString());
    novos.delete('programacao_concluida');
    router.replace(`/admin?${novos.toString()}`, { scroll: false });
  };

  return <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
    <span className="mt-0.5 shrink-0"><CheckCircle className="h-5 w-5" aria-hidden="true" /></span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold">Programação dos tatames concluída</p>
      <p className="mt-1 text-xs leading-relaxed">Distribuição, sequência e horários salvos. Você pode continuar a organização do campeonato.</p>
    </div>
    <button type="button" onClick={fechar} aria-label="Fechar confirmação da programação" className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-emerald-500/10"><X size={16} aria-hidden="true" /></button>
  </div>;
}
