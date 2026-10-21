import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrarVendasFinanceiro, resumirVendasFinanceiro, type VendaFinanceiroFotografo } from '../app/lib/fotos-financeiro-painel';

const venda = (extra: Partial<VendaFinanceiroFotografo>): VendaFinanceiroFotografo => ({ id: 'pedido', eventoId: 'galeria', galeria: 'Evento', data: '2026-10-20T02:00:00Z', fotos: 2, brutoCentavos: 2000, itatameCentavos: 100, royaltyCentavos: 200, taxaMercadoPagoCentavos: 40, liquidoCentavos: 1660, liquidoAntesTarifaCentavos: 1700, metodo: 'Pix', confirmadoPeloMercadoPago: true, ...extra });
test('recorte financeiro usa galeria e dia do pagamento em Cuiabá, incluindo as bordas', () => {
  const a = venda({ id: 'anterior' }), b = venda({ id: 'hoje', data: '2026-10-20T04:00:00Z' }), c = venda({ id: 'outra', eventoId: 'outra', data: b.data });
  assert.deepEqual(filtrarVendasFinanceiro([a,b,c], 'galeria', '2026-10-20', '2026-10-20').map(v => v.id), ['hoje']);
  assert.deepEqual(filtrarVendasFinanceiro([a,b,c], '', '2026-10-19', '2026-10-19').map(v => v.id), ['anterior']);
  assert.equal(filtrarVendasFinanceiro([a,b,c], '', '', '').length, 3);
  assert.equal(filtrarVendasFinanceiro([venda({ eventoId: null })], 'removida', '', '').length, 1);
});
test('resumo preserva centavos e não estima tarifas ou líquido indisponíveis', () => {
  const vendas = [venda({}), venda({ id: 'pendente', taxaMercadoPagoCentavos: null, liquidoCentavos: null, confirmadoPeloMercadoPago: false })];
  const antes = JSON.stringify(vendas);
  assert.deepEqual(resumirVendasFinanceiro(vendas), { pedidos: 2, arquivos: 4, bruto: 4000, retratt: 200, royalty: 400, tarifa: 40, liquido: 1660, pendentes: 1 });
  assert.equal(JSON.stringify(vendas), antes);
  assert.equal(resumirVendasFinanceiro([venda({ taxaMercadoPagoCentavos: 0, liquidoCentavos: 0 })]).pendentes, 0);
  assert.equal(resumirVendasFinanceiro([]).liquido, 0);
});
