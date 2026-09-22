import assert from "node:assert/strict";
import test from "node:test";
import { classificarVinculoInscricao } from "../app/lib/vinculo-inscricao";

const equipes = [{ id: "eq-1", nome: "Legado Jiu-Jitsu", academia: "Spartan Jiu-Jitsu", professor: "Jefferson" }];
const unidades = [
  { equipeId: "eq-1", academia: "Spartan Jiu-Jitsu", professor: "Jefferson" },
  { equipeId: "eq-1", academia: "Zezinhi", professor: "Cidao" },
];

test("atleta ligado à equipe e à academia oficiais fica vinculado", () => {
  const vinculo = classificarVinculoInscricao({
    equipePerfil: "Legado",
    academiaPerfil: "Zezinhi",
    professorPerfil: "Cidao",
    equipes,
    unidades,
  });
  assert.equal(vinculo.situacao, "vinculado");
  assert.equal(vinculo.equipe, "Legado Jiu-Jitsu");
  assert.equal(vinculo.academia, "Zezinhi");
});

test("nome solto que não é equipe do campeonato fica sem vínculo", () => {
  const vinculo = classificarVinculoInscricao({
    equipeInscricao: "Spartan",
    academiaPerfil: "",
    equipes,
    unidades,
  });
  assert.equal(vinculo.situacao, "sem-equipe");
  assert.equal(vinculo.escrito, "Spartan");
});

test("equipe certa com academia fora das unidades fica sem academia", () => {
  const vinculo = classificarVinculoInscricao({
    equipeId: "eq-1",
    academiaPerfil: "Outra Casa",
    professorPerfil: "Ana",
    equipes,
    unidades,
  });
  assert.equal(vinculo.situacao, "sem-academia");
  assert.equal(vinculo.equipe, "Legado Jiu-Jitsu");
  assert.equal(vinculo.escrito, "Outra Casa");
});
