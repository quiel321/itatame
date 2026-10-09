import assert from 'node:assert/strict';
import test from 'node:test';
import { inscricaoCortesia, textoCupomInscricao, valorLiquidoInscricao } from './inscricao-relatorio';
import { montarLinhaSuporte, resumirItatame, valorInscricao } from './super-admin-painel';
const cortesia = { id: 299, atleta: 'Arthur de Oliveira Andrade', cupom_id: 'cupom', cupom_codigo: 'VIPSPARTAN', desconto_valor: 35, cortesia: true, pagamento_ok: true, valor_inscricao: 35, valor_total: 0 };
test('cupom integral exibe zero e cortesia sem inventar faturamento', () => {
  assert.equal(valorLiquidoInscricao(cortesia), 0);
  assert.equal(valorInscricao(cortesia), 0);
  assert.equal(inscricaoCortesia(cortesia), true);
  const linha = montarLinhaSuporte(cortesia);
  assert.equal(linha.inscricao, '299'); assert.equal(linha.pagamento, 'Cortesia');
  assert.match(linha.cupom, /VIPSPARTAN/); assert.match(linha.cupom, /35,00/); assert.match(linha.valor, /0,00/);
  const resumo = resumirItatame([{valor: valorInscricao(cortesia), situacao: 'pago', taxaPercentual: 10}]);
  assert.equal(resumo.faturamento, 0); assert.equal(resumo.comissao, 0); assert.equal(resumo.repasse, 0);
});
test('desconto parcial mantém cobrança e valor líquido', () => {
  const item = {...cortesia, desconto_valor: 10, cortesia: false, valor_total: 25};
  assert.equal(valorInscricao(item), 25); assert.equal(inscricaoCortesia(item), false);
  assert.equal(montarLinhaSuporte(item).pagamento, 'Pago');
});
test('inscrições antigas sem desconto preservam valor base', () => {
  assert.equal(valorInscricao({valor_total: 0, valor_inscricao: 35}), 35);
  assert.equal(valorInscricao({valor_total: null, valor_inscricao: 35}), 35);
  assert.equal(textoCupomInscricao({}), 'Sem cupom');
});
test('estorno mantém valor e situação mesmo em inscrição com cupom', () => {
  const item = {...cortesia, estorno_status: 'estornado', estorno_valor: 25};
  assert.equal(valorInscricao(item), 25); assert.equal(montarLinhaSuporte(item).pagamento, 'Estornado');
});
