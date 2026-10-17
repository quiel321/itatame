"use client";

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import type { ResumoFotografoDiaria } from '@/app/lib/fotos-vendas-diaria';
import { Download, Loader2, RefreshCw } from 'lucide-react';

const moeda = (n: number) => (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export default function VendasDiariaFotografos() {
  const [vendas, setVendas] = useState<ResumoFotografoDiaria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [atualizadoEm, setAtualizadoEm] = useState('');
  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw Error('Entre novamente para conferir as vendas.');
      const resposta = await fetch('/api/fotos/admin/vendas-diaria', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(25000) });
      const dados = await resposta.json();
      if (!resposta.ok) throw Error(dados.error || 'Não foi possível conferir as vendas.');
      setVendas(dados.vendas); setAtualizadoEm(dados.atualizadoEm);
    } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível conferir as vendas.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  function exportar() {
    const celula = (v: string | number) => `"${String(v).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
    const reais = (n: number) => (n / 100).toFixed(2).replace('.', ',');
    const linhas = [['Galeria', 'Fotógrafo', 'Arquivos vendidos', 'Pedidos pagos', 'Preço dos arquivos (R$)', 'Descontos (R$)', 'Vendas após descontos (R$)', 'Comissão Retratt (R$)', 'Valor antes da tarifa MP (R$)'],
      ...vendas.map(v => [v.galeria, v.nome, v.quantidade, v.pedidosPagos, reais(v.subtotalCentavos), reais(v.descontoCentavos), reais(v.totalCentavos), reais(v.comissaoRetrattCentavos), reais(v.antesTarifaCentavos)])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + linhas.map(l => l.map(celula).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'vendas-fotografos-diaria.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section aria-label="Vendas por fotógrafo no modelo diária" className="rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-bold text-white">Vendas por fotógrafo · Diária</h3>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void carregar()} disabled={carregando} className="flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs text-white disabled:opacity-50"><RefreshCw size={13} /> Atualizar vendas</button>
        <button type="button" onClick={exportar} disabled={!vendas.length || carregando || Boolean(erro)} className="flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs text-white disabled:opacity-40"><Download size={13} /> Baixar planilha</button>
      </div>
    </div>
    <p className="mt-2 text-xs leading-relaxed text-zinc-400">Somente vendas pagas recebidas pelo organizador no modelo diária. Os arquivos continuam identificados pelo fotógrafo que os enviou.</p>
    <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">O valor abaixo já desconta os descontos da compra e a comissão da Retratt. A tarifa do Mercado Pago ainda precisa ser conferida no extrato. O repasse é manual, conforme seu acordo com cada fotógrafo.</p>
    {carregando ? <p role="status" className="mt-4 flex items-center gap-2 text-xs text-zinc-400"><Loader2 size={15} className="animate-spin" /> Conferindo vendas…</p>
      : erro ? <p role="alert" className="mt-4 text-xs text-orange-300">{erro}</p>
      : !vendas.length ? <p className="mt-4 text-xs text-zinc-400">Ainda não há vendas pagas no modelo diária. Elas aparecerão aqui após a confirmação do pagamento.</p>
      : <div className="mt-4 space-y-3">{vendas.map(v => <article key={`${v.galeriaId}:${v.fotografoId}`} className="rounded-xl border border-white/10 p-4">
        <p className="break-words text-sm font-bold text-white">{v.nome}</p>
        <p className="mt-1 break-words text-xs text-zinc-400">{v.galeria} · {v.quantidade} arquivo(s) vendido(s) em {v.pedidosPagos} pedido(s)</p>
        <dl className="mt-4 space-y-2 text-xs">
          {([['Preço dos arquivos', v.subtotalCentavos], ['Descontos da compra', -v.descontoCentavos], ['Vendas após descontos', v.totalCentavos], ['Comissão Retratt', -v.comissaoRetrattCentavos]] as const).map(([titulo, valor]) => <div key={titulo} className="flex justify-between gap-3"><dt className="text-zinc-400">{titulo}</dt><dd className="shrink-0 text-white">{moeda(valor)}</dd></div>)}
          <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-3 font-bold text-emerald-300"><dt>Valor antes da tarifa MP</dt><dd>{moeda(v.antesTarifaCentavos)}</dd></div>
        </dl>
      </article>)}</div>}
    {!carregando && !erro && atualizadoEm && <p className="mt-3 text-[10px] text-zinc-500">Conferido em {new Date(atualizadoEm).toLocaleString('pt-BR')}. Pedidos cancelados e reembolsados não entram nesta soma. Valores não indicam repasses já realizados.</p>}
  </section>;
}
