export type DadosFinanceirosInscricao = {
  valor_total?: number | string | null;
  valor_inscricao?: number | string | null;
  cupom_id?: string | null;
  cupom_codigo?: string | null;
  desconto_valor?: number | string | null;
  cortesia?: boolean | null;
  pagamento_ok?: boolean | null;
};

export function valorLiquidoInscricao(item: DadosFinanceirosInscricao) {
  const total = Number(item.valor_total);
  if (item.valor_total != null && item.valor_total !== "" && Number.isFinite(total) &&
      (total > 0 || (total === 0 && (item.cortesia || item.cupom_id || item.cupom_codigo || Number(item.desconto_valor) > 0)))) return total;
  const base = Number(item.valor_inscricao);
  return Number.isFinite(base) ? Math.max(0, base - (Number(item.desconto_valor) || 0)) : 0;
}

export function inscricaoCortesia(item: DadosFinanceirosInscricao) {
  return Boolean(item.pagamento_ok && valorLiquidoInscricao(item) === 0 &&
    (item.cortesia || item.cupom_id || item.cupom_codigo || Number(item.desconto_valor) > 0));
}

export function textoCupomInscricao(item: DadosFinanceirosInscricao) {
  if (!item.cupom_id && !item.cupom_codigo && !(Number(item.desconto_valor) > 0)) return item.cortesia ? "Cortesia sem cupom" : "Sem cupom";
  const desconto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.desconto_valor) || 0);
  return (item.cupom_codigo || "Cupom aplicado") + "\nDesconto: " + desconto;
}
