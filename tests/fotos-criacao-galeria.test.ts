import assert from "node:assert/strict";
import test from "node:test";
import { precoGaleriaCentavos, precosGaleriaValidos } from "../app/lib/fotos-criacao-galeria";

test("converte valores brasileiros sem aceitar preço inválido silenciosamente", () => {
  assert.equal(precoGaleriaCentavos("15,00"), 1500);
  assert.equal(precoGaleriaCentavos("1.250,50"), 125050);
  assert.equal(precoGaleriaCentavos(" 25 "), 2500);
  for (const valor of ["", "-15", "quinze", "15,001", "1,2,3", "Infinity"]) assert.ok(Number.isNaN(precoGaleriaCentavos(valor)), valor);
});

test("venda exige preço positivo de foto e vídeo; gratuidade permite zero", () => {
  assert.equal(precosGaleriaValidos(1500, 2500, false), true);
  assert.equal(precosGaleriaValidos(0, 2500, false), false);
  assert.equal(precosGaleriaValidos(1500, 0, false), false);
  assert.equal(precosGaleriaValidos(0, 0, true), true);
  for (const valor of [NaN, Infinity, -1, 1.5, 1_000_001]) {
    assert.equal(precosGaleriaValidos(valor, 2500, true), false);
    assert.equal(precosGaleriaValidos(1500, valor, true), false);
  }
  assert.equal(precosGaleriaValidos(1_000_000, 1_000_000, false), true);
});
