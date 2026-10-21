export type PedidoTarifaMP = { id: string; provedor_payment_id: string | null; total_centavos: number; evento_id: string };
export type TarifaPedidoMP = { pedidoId: string; galeriaId: string; tarifaCentavos: number | null; liquidoCentavos: number | null };

// O líquido já inclui as deduções do Mercado Pago. Não descontar a comissão outra vez.
type PagamentoMP = { id?: unknown; external_reference?: unknown; collector_id?: unknown; transaction_amount?: unknown; status?: unknown; fee_details?: unknown; transaction_details?: { net_received_amount?: unknown } };
export function conferirTarifaMP(pedido: PedidoTarifaMP, pagamento: PagamentoMP, recebedorId: string): TarifaPedidoMP {
  if (String(pagamento.id) !== pedido.provedor_payment_id || pagamento.external_reference !== `foto_pedido:${pedido.id}`
    || !recebedorId || String(pagamento.collector_id) !== recebedorId
    || Math.round(Number(pagamento.transaction_amount) * 100) !== pedido.total_centavos || pagamento.status !== 'approved') throw Error('Pagamento não conferido.');
  const detalhes = pagamento.fee_details;
  const taxas = Array.isArray(detalhes) && detalhes.every(f => f && typeof f === 'object') ? (detalhes as { type?: unknown; amount?: unknown }[]).filter(f => f.type === 'mercadopago_fee') : null;
  const tarifaCentavos = taxas && taxas.every(f => f.amount != null && Number.isFinite(Number(f.amount)) && Number(f.amount) >= 0)
    ? taxas.reduce((s: number, f) => s + Math.round(Number(f.amount) * 100), 0) : null;
  const valor = pagamento.transaction_details?.net_received_amount;
  const liquidoCentavos = valor != null && Number.isFinite(Number(valor)) && Number(valor) >= 0 ? Math.round(Number(valor) * 100) : null;
  return { pedidoId: pedido.id, galeriaId: pedido.evento_id, tarifaCentavos, liquidoCentavos };
}
