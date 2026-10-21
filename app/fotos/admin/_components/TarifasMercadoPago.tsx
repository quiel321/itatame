'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import type { TarifaPedidoMP } from '@/app/lib/fotos-tarifas-mp';
import { RefreshCw } from 'lucide-react';
import g from '@/app/fotos/fotografo/_components/gestao.module.css';

type Pagina = { pedidos: TarifaPedidoMP[]; total: number; proximo: number | null; error?: string };
const moeda = (n: number | null) => n == null ? 'Em consulta' : (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export default function TarifasMercadoPago({ galeria = '' }: { galeria?: string }) {
  const [pedidos, setPedidos] = useState<TarifaPedidoMP[]>([]), [total, setTotal] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true), [erro, setErro] = useState(''), [revisao, setRevisao] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    async function carregar() {
      setCarregando(true); setPedidos([]); setTotal(null); setErro('');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw Error('Entre novamente para consultar as tarifas.');
        let inicio: number | null = 0;
        while (inicio != null && !abort.signal.aborted) {
          const params = new URLSearchParams({ inicio: String(inicio), ...(galeria ? { galeria } : {}) });
          const r = await fetch(`/api/fotos/admin/tarifas?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal: abort.signal });
          const dados: Pagina = await r.json();
          if (!r.ok) throw Error(dados.error || 'Tarifas indisponíveis.');
          if (abort.signal.aborted) return;
          setTotal(dados.total); setPedidos(v => [...new Map([...v, ...dados.pedidos].map(p => [p.pedidoId, p])).values()]);
          if (dados.proximo != null && dados.proximo <= inicio) throw Error('Não foi possível concluir a conferência.');
          inicio = dados.proximo;
        }
      } catch (e) { if (!abort.signal.aborted) setErro(e instanceof Error ? e.message : 'Consulta indisponível.'); }
      finally { if (!abort.signal.aborted) setCarregando(false); }
    }
    void carregar(); return () => abort.abort();
  }, [galeria, revisao]);
  const tarifas = pedidos.filter(p => p.tarifaCentavos != null), liquidos = pedidos.filter(p => p.liquidoCentavos != null);
  const soma = (tipo: 'tarifaCentavos' | 'liquidoCentavos') => pedidos.length ? pedidos.reduce((s, p) => s + (p[tipo] || 0), 0) : total === 0 ? 0 : null;
  const pendentes = total == null ? null : total - pedidos.filter(p => p.tarifaCentavos != null && p.liquidoCentavos != null).length;
  return <section className={g.secao} aria-label="Tarifas reais do Mercado Pago"><header className={g.secaoCabecalho}><div><h2>Mercado Pago · Recebimentos por diária</h2><p>{galeria ? 'Galeria selecionada' : 'Todas as galerias'} · Tarifa e líquido da sua conta, conferidos no pagamento.</p></div><button type="button" disabled={carregando} onClick={() => setRevisao(v => v + 1)} className={g.botao}><RefreshCw size={14} />{carregando ? 'Conferindo…' : 'Conferir novamente'}</button></header><dl className={g.linhaResumo} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}><div><dt>Tarifas Mercado Pago</dt><dd>{moeda(tarifas.length || total === 0 ? soma('tarifaCentavos') : null)}</dd><small>{tarifas.length} de {total ?? '…'} pagamento(s) conferido(s)</small></div><div><dt>Líquido informado pelo MP</dt><dd className={g.positivo}>{moeda(liquidos.length || total === 0 ? soma('liquidoCentavos') : null)}</dd><small>{liquidos.length} de {total ?? '…'} pagamento(s) conferido(s)</small></div></dl>{erro && <p role="status" className={g.aviso}>{erro}</p>}{pendentes != null && pendentes > 0 && <p className={g.aviso}>{pendentes} pagamento(s) ainda sem tarifa ou líquido confirmado. As somas exibidas são parciais.</p>}<p className={g.nota}>A comissão Retratt já está descontada no líquido informado pelo Mercado Pago. Esse valor não representa saldo disponível para saque nem comprova repasse aos fotógrafos. Vendas por royalty entram na conta do fotógrafo e ficam fora deste total.</p></section>;
}
