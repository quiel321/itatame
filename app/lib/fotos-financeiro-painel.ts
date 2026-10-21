export type VendaFinanceiroFotografo = {
  id: string; eventoId: string | null; galeria: string; data: string; fotos: number;
  brutoCentavos: number; itatameCentavos: number; royaltyCentavos: number;
  taxaMercadoPagoCentavos: number | null; liquidoCentavos: number | null;
  liquidoAntesTarifaCentavos: number; metodo: string | null; confirmadoPeloMercadoPago: boolean;
};

const calendario = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' });
export function filtrarVendasFinanceiro(vendas: VendaFinanceiroFotografo[], galeria: string, inicio: string, fim: string) {
  return vendas.filter(v => {
    if (galeria && (v.eventoId || 'removida') !== galeria) return false;
    if (!inicio && !fim) return true;
    const data = new Date(v.data);
    if (!Number.isFinite(data.getTime())) return false;
    const dia = calendario.format(data);
    return (!inicio || dia >= inicio) && (!fim || dia <= fim);
  });
}
export function resumirVendasFinanceiro(vendas: VendaFinanceiroFotografo[]) {
  return vendas.reduce((s, v) => ({
    pedidos: s.pedidos + 1, arquivos: s.arquivos + v.fotos, bruto: s.bruto + v.brutoCentavos,
    retratt: s.retratt + v.itatameCentavos, royalty: s.royalty + v.royaltyCentavos,
    tarifa: s.tarifa + (v.taxaMercadoPagoCentavos ?? 0), liquido: s.liquido + (v.liquidoCentavos ?? 0),
    pendentes: s.pendentes + (v.liquidoCentavos === null || v.taxaMercadoPagoCentavos === null ? 1 : 0),
  }), { pedidos: 0, arquivos: 0, bruto: 0, retratt: 0, royalty: 0, tarifa: 0, liquido: 0, pendentes: 0 });
}
