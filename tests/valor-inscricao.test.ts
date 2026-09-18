import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularValorInscricao,
  pacoteAposAmpliar,
  pacoteInscricao,
  podeAmpliarPacote,
  tarifaInfantilAplicavel,
  valorAddonAbsoluto,
  valorAindaDevido,
  valorLoteVigente,
} from "../app/lib/valor-inscricao";

const evento = {
  lote1_valor: 120,
  lote1_data_fim: "2099-01-01T23:59:59",
  lote2_valor: 150,
  lote2_data_fim: "2099-02-01T23:59:59",
  lote3_valor: 180,
  valor_absoluto: 40,
  regras_pontuacao_equipes: {
    valor_absoluto: 40,
    lote1_valor_infantil: 70,
    lote2_valor_infantil: 90,
    valor_absoluto_infantil: 20,
    idade_max_infantil: 15,
  },
};

test("adulto continua pagando o lote vigente quando não há preço infantil", () => {
  const soAdulto = { lote1_valor: 120, lote1_data_fim: "2099-01-01T23:59:59" };
  assert.equal(valorLoteVigente(soAdulto, new Date("2026-09-17"), 8), 120);
  assert.equal(calcularValorInscricao({ absoluto: false, idade: 8 }, soAdulto), 120);
});

test("infantil usa o lote mais barato e o absoluto infantil", () => {
  assert.equal(valorLoteVigente(evento, new Date("2026-09-17"), 12), 70);
  assert.equal(valorAddonAbsoluto(evento, 12), 20);
  assert.equal(calcularValorInscricao({ absoluto: true, categoria: "Galo", idade: 12 }, evento), 90);
  assert.equal(tarifaInfantilAplicavel(evento, 12, new Date("2026-09-17")), true);
});

test("idade 16 paga adulto; 15 paga infantil", () => {
  assert.equal(valorLoteVigente(evento, new Date("2026-09-17"), 16), 120);
  assert.equal(valorLoteVigente(evento, new Date("2026-09-17"), 15), 70);
});

test("infantil 0 é inscrição gratuita e não cai no preço adulto", () => {
  const gratis = {
    ...evento,
    regras_pontuacao_equipes: { ...evento.regras_pontuacao_equipes, lote1_valor_infantil: 0 },
  };
  assert.equal(valorLoteVigente(gratis, new Date("2026-09-17"), 10), 0);
});

test("absoluto sozinho cobra o avulso e o combo continua lote mais extra", () => {
  const comAvulso = {
    ...evento,
    regras_pontuacao_equipes: { ...evento.regras_pontuacao_equipes, valor_absoluto_avulso: 35, valor_absoluto_avulso_infantil: 15 },
  };
  assert.equal(calcularValorInscricao({ absoluto: true, categoria: "Absoluto", idade: 10 }, comAvulso), 15);
  assert.equal(calcularValorInscricao({ absoluto: true, categoria: "Absoluto", idade: 25 }, comAvulso), 35);
  assert.equal(calcularValorInscricao({ absoluto: true, categoria: "Galo", idade: 12 }, comAvulso), 90);
  assert.equal(calcularValorInscricao({ absoluto: false, categoria: "Galo", idade: 12 }, comAvulso), 70);
});

test("sem preço avulso, absoluto sozinho usa o extra do combo", () => {
  assert.equal(calcularValorInscricao({ absoluto: true, categoria: "Absoluto", idade: 12 }, evento), 20);
  assert.equal(calcularValorInscricao({ absoluto: true, categoria: "Absoluto", idade: 25 }, evento), 40);
});

test("sem preço infantil no lote vigente, a criança paga o adulto", () => {
  const semLote1 = {
    ...evento,
    regras_pontuacao_equipes: { valor_absoluto: 40, lote2_valor_infantil: 90 },
  };
  assert.equal(valorLoteVigente(semLote1, new Date("2026-09-17"), 10), 120);
});

test("quem já está no peso pode acrescentar absoluto e vira combo", () => {
  assert.equal(pacoteInscricao({ absoluto: false, categoria: "Galo" }), "peso");
  assert.equal(pacoteInscricao({ absoluto: true, categoria: "Absoluto" }), "absoluto");
  assert.equal(pacoteInscricao({ absoluto: true, categoria: "Galo" }), "combo");
  assert.equal(podeAmpliarPacote("peso", "absoluto"), true);
  assert.equal(podeAmpliarPacote("peso", "combo"), true);
  assert.equal(podeAmpliarPacote("peso", "peso"), false);
  assert.equal(podeAmpliarPacote("combo", "absoluto"), false);
  assert.equal(pacoteAposAmpliar("peso", "absoluto"), "combo");
  assert.equal(pacoteAposAmpliar("absoluto", "peso"), "combo");
});

test("upgrade de inscrição paga só cobra a diferença do combo", () => {
  const pagaPeso = { absoluto: true, categoria: "Galo", idade: 25, pagamento_ok: true, valor_inscricao: 120 };
  assert.equal(valorAindaDevido(pagaPeso, evento), 40);
  assert.equal(valorAindaDevido({ ...pagaPeso, absoluto: false }, evento), 0);
});
