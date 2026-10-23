"use client";
import Link from '@/app/fotos/_components/LinkFotos';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { lerCarrinhoFotos, pagamentosFotosPendentes, retirarFotosCompradas, retirarPagamentoFotos } from '@/app/lib/fotos-carrinho-pagamentos';

export default function AcompanharPagamentosFotos() {
  const [pendentes, setPendentes] = useState(0);
  const [confirmado, setConfirmado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [autenticado, setAutenticado] = useState(false);
  const conferirRef = useRef<() => void>(() => {});
  useEffect(() => {
    let encerrado = false, ocupado = false;
    async function conferir(reconciliarCarrinho = true) {
      if (ocupado || document.visibilityState === 'hidden' || !navigator.onLine) return;
      ocupado = true; setVerificando(true);
      try {
        const registros = pagamentosFotosPendentes(); setPendentes(registros.length);
        const { data: { session } } = await supabase.auth.getSession();
        if (!encerrado) setAutenticado(Boolean(session));
        for (const registro of registros) {
          if (encerrado) break;
          try {
            const params = new URLSearchParams({ pedido_id: registro.pedidoId });
            const headers: Record<string, string> = {};
            if (registro.acesso) params.set('acesso', registro.acesso);
            else if (session) headers.Authorization = `Bearer ${session.access_token}`;
            else continue;
            const response = await fetch(`/api/fotos/pagamento/status?${params}`, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) });
            const pedido = await response.json();
            if (!response.ok || pedido.id !== registro.pedidoId || encerrado) continue;
            if (pedido.status === 'pago') {
              retirarFotosCompradas(registro.fotoIds); retirarPagamentoFotos(registro.pedidoId); setConfirmado(true);
              window.dispatchEvent(new CustomEvent('retratt-pagamento-confirmado', { detail: { pedidoId: registro.pedidoId } }));
            } else if (pedido.status === 'cancelado' || pedido.status === 'reembolsado') { retirarPagamentoFotos(registro.pedidoId); setConfirmado(false); }
          } catch { /* Uma falha de consulta preserva pagamento e carrinho para a próxima tentativa. */ }
        }
        // Recupera também compras anteriores à introdução do acompanhamento local.
        const carrinho = lerCarrinhoFotos();
        if (reconciliarCarrinho && session && carrinho.length && !encerrado) {
          const { data, error } = await supabase.from('foto_pedido_itens').select('foto_id, foto_pedidos!inner(status, comprador_user_id)').in('foto_id', carrinho).eq('foto_pedidos.status', 'pago').eq('foto_pedidos.comprador_user_id', session.user.id).eq('download_liberado', true).or(`download_expires_at.is.null,download_expires_at.gt.${new Date().toISOString()}`);
          if (!error && data && !encerrado) retirarFotosCompradas(data.map(item => String(item.foto_id)));
        }
      } finally {
        ocupado = false;
        if (!encerrado) { setPendentes(pagamentosFotosPendentes().length); setVerificando(false); }
      }
    }
    const atualizar = () => { void conferir().catch(() => {}); };
    const atualizouPagamentos = () => { setPendentes(pagamentosFotosPendentes().length); atualizar(); };
    conferirRef.current = atualizar;
    setPendentes(pagamentosFotosPendentes().length);
    atualizar();
    const intervalo = window.setInterval(() => { if (pagamentosFotosPendentes().length) void conferir(false).catch(() => {}); }, 5000);
    window.addEventListener('focus', atualizar); window.addEventListener('online', atualizar); window.addEventListener('storage', atualizar);
    window.addEventListener('retratt-pagamentos-atualizados', atualizouPagamentos);
    document.addEventListener('visibilitychange', atualizar);
    return () => { encerrado = true; window.clearInterval(intervalo); window.removeEventListener('focus', atualizar); window.removeEventListener('online', atualizar); window.removeEventListener('storage', atualizar); window.removeEventListener('retratt-pagamentos-atualizados', atualizouPagamentos); document.removeEventListener('visibilitychange', atualizar); };
  }, []);
  if (!pendentes && !confirmado) return null;
  return <aside aria-label="Acompanhamento da compra" className={`mx-auto w-full max-w-7xl border-b px-4 py-3 text-xs sm:px-8 ${confirmado && !pendentes ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-retratt/20 bg-retratt/10 text-orange-100'}`}>
    {pendentes ? <div className="flex flex-wrap items-center justify-between gap-3"><p>Pagamento em acompanhamento. A confirmação também chega por e-mail, mesmo com a página fechada.</p><button type="button" disabled={verificando} onClick={() => conferirRef.current()} className="min-h-10 rounded-lg border border-current px-3 font-bold disabled:opacity-50">{verificando ? 'Verificando…' : 'Verificar pagamento'}</button></div> : <p role="status">Pagamento confirmado. As fotos pagas foram retiradas do carrinho. <Link href={autenticado ? '/fotos/minhas-compras' : '/fotos/acesso'} className="font-bold underline">Acessar minhas fotos</Link></p>}
  </aside>;
}
