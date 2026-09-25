import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularDistribuicaoFotos,
  calcularDistribuicaoDiariaFotos,
  COMISSAO_ITATAME_FOTOS_PERCENTUAL,
  LIMITE_ROYALTY_ORGANIZADOR_PERCENTUAL,
} from "../app/lib/fotos-financeiro";

test("venda freelancer separa 5% para Retratt e deixa tarifa do gateway com o vendedor", () => {
  const distribuicao = calcularDistribuicaoFotos({
    totalCentavos: 10_000,
    percentualItatame: COMISSAO_ITATAME_FOTOS_PERCENTUAL,
    percentualOrganizador: 0,
  });
  assert.equal(distribuicao.comissaoItatameCentavos, 500);
  assert.equal(distribuicao.comissaoMarketplaceCentavos, 500);
  assert.equal(distribuicao.fotografoAntesDaTarifaCentavos, 9_500);
});

test("royalty de 50% preserva os 5% da Retratt", () => {
  assert.equal(LIMITE_ROYALTY_ORGANIZADOR_PERCENTUAL, 50);
  const distribuicao = calcularDistribuicaoFotos({
    totalCentavos: 10_000,
    percentualItatame: COMISSAO_ITATAME_FOTOS_PERCENTUAL,
    percentualOrganizador: LIMITE_ROYALTY_ORGANIZADOR_PERCENTUAL,
  });
  assert.equal(distribuicao.comissaoItatameCentavos, 500);
  assert.equal(distribuicao.comissaoOrganizadorCentavos, 5_000);
  assert.equal(distribuicao.comissaoMarketplaceCentavos, 5_500);
  assert.equal(distribuicao.fotografoAntesDaTarifaCentavos, 4_500);
});

test("diária deixa 95% na conta do organizador e zero para o fotógrafo", () => {
  const distribuicao = calcularDistribuicaoDiariaFotos(10_000);
  assert.equal(distribuicao.comissaoItatameCentavos, 500);
  assert.equal(distribuicao.comissaoMarketplaceCentavos, 500);
  assert.equal(distribuicao.comissaoOrganizadorCentavos, 0);
  assert.equal(distribuicao.receitaDiretaOrganizadorCentavos, 9_500);
  assert.equal(distribuicao.fotografoAntesDaTarifaCentavos, 0);
});
