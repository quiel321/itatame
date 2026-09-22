import assert from "node:assert/strict";
import test from "node:test";
import { academiasDaEquipe, equipesOficiais, nomeOficial } from "../app/lib/vinculo-equipe";

const vinculos = [
  { equipe: "Legado Jiu-Jitsu", academia: "Spartan" },
  { equipe: "LEGADO", academia: "Spartan Jiu-Jitsu" },
  { equipe: "Nova União", academia: "Matriz Centro" },
];

test("une grafias da mesma equipe e guarda o nome mais completo", () => {
  assert.deepEqual(equipesOficiais(vinculos), ["Legado Jiu-Jitsu", "Nova União"]);
});

test("academias repetidas ficam dentro da equipe escolhida", () => {
  assert.deepEqual(academiasDaEquipe("legado jiu jitsu", vinculos), ["Spartan Jiu-Jitsu"]);
  assert.deepEqual(academiasDaEquipe("Nova Uniao", vinculos), ["Matriz Centro"]);
});

test("nome parecido volta para o cadastro que já existe", () => {
  assert.equal(nomeOficial("legado jiu jitsu", equipesOficiais(vinculos)), "Legado Jiu-Jitsu");
  assert.equal(nomeOficial("Spartan CT", academiasDaEquipe("Legado", vinculos)), "Spartan Jiu-Jitsu");
  assert.equal(nomeOficial("CheckMat", equipesOficiais(vinculos)), "CheckMat");
});
