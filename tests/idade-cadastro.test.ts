import assert from "node:assert/strict";
import test from "node:test";
import { MENSAGEM_MENOR_DE_IDADE, validarNascimentoTitular } from "../app/lib/idade-cadastro";

const hoje = new Date("2026-09-22T15:00:00-04:00");

test("bloqueia conta própria de menor e aceita quem já completou 18 anos", () => {
  const menor = validarNascimentoTitular("2010-01-01", hoje);
  assert.equal(menor.ok, false);
  if (!menor.ok) assert.equal(menor.erro, MENSAGEM_MENOR_DE_IDADE);
  assert.equal(validarNascimentoTitular("2008-09-23", hoje).ok, false);
  const maior = validarNascimentoTitular("2008-09-22", hoje);
  assert.equal(maior.ok, true);
  if (maior.ok) assert.equal(maior.idade, 18);
  const futuro = validarNascimentoTitular("2026-09-23", hoje);
  assert.equal(futuro.ok, false);
  if (!futuro.ok) assert.equal(futuro.erro, "A data de nascimento não pode estar no futuro.");
  assert.equal(validarNascimentoTitular("", hoje).ok, false);
  assert.equal(validarNascimentoTitular("2008-02-31", hoje).ok, false);
});
