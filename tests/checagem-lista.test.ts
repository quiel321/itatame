import assert from "node:assert/strict";
import test from "node:test";
import { FAIXA_TODAS_AS_FAIXAS, type CategoriaCompeticao } from "../app/lib/categorias-competicao";
import { obterEtapaEvento, periodoCorrecaoChecagem } from "../app/lib/evento-etapas";
import { chaveProfessor, letraAtleta, montarInscritosChecagem } from "../app/lib/checagem-publico";

test("lista de checagem fica visivel durante as inscricoes", () => {
  const etapa = obterEtapaEvento({
    data_inicio_inscricoes: "2020-01-01T00:00:00.000Z",
    data_fim_inscricoes: "2030-01-01T00:00:00.000Z",
    data_inicio_checagem: "2030-02-01T00:00:00.000Z",
    data_fim_checagem: "2030-02-02T00:00:00.000Z",
  }, new Date("2026-09-19T12:00:00.000Z"));
  assert.equal(etapa.codigo, "INSCRICOES_ABERTAS");
  assert.equal(etapa.inscricoesAbertas, true);
  assert.equal(etapa.checagemAberta, false);
  assert.equal(etapa.listaChecagemVisivel, true);
  assert.equal(periodoCorrecaoChecagem({
    data_inicio_checagem: "2030-02-01T00:00:00.000Z",
    data_fim_checagem: "2030-02-02T00:00:00.000Z",
  }, new Date("2026-09-19T12:00:00.000Z")), false);
});

test("correcao de categoria so no periodo de checagem", () => {
  const agora = new Date("2026-09-19T12:00:00.000Z");
  const etapa = obterEtapaEvento({
    data_inicio_inscricoes: "2020-01-01T00:00:00.000Z",
    data_fim_inscricoes: "2026-08-01T00:00:00.000Z",
    data_inicio_checagem: "2026-09-18T00:00:00.000Z",
    data_fim_checagem: "2026-09-20T00:00:00.000Z",
  }, agora);
  assert.equal(etapa.checagemAberta, true);
  assert.equal(etapa.listaChecagemVisivel, true);
  assert.equal(periodoCorrecaoChecagem({
    data_inicio_checagem: "2026-09-18T00:00:00.000Z",
    data_fim_checagem: "2026-09-20T00:00:00.000Z",
  }, agora), true);
});

test("agrupa professor com academia e letra do atleta", () => {
  assert.equal(chaveProfessor("Keneth", "4BRAVO", "4BRAVO"), "4BRAVO — Keneth");
  assert.equal(letraAtleta("Adailton"), "A");
});

const absolutoMasculino: CategoriaCompeticao = {
  id: "abs-masc-todas",
  evento_id: "evt",
  nome: "Absoluto",
  modalidade: "Jiu-Jitsu",
  sexo: "Masculino",
  faixa: FAIXA_TODAS_AS_FAIXAS,
  idade_min: 16,
  idade_max: 100,
  peso_min: 0,
  peso_max: null,
  tempo_minutos: 5,
  tipo: "absoluto",
  ativa: true,
};

test("aba absoluto lista inscritos mesmo sem idade na API", () => {
  const lista = montarInscritosChecagem(
    [
      { id: "1", user_id: "u1", atleta: "Nego Dario", equipe: "LEGADO", faixa: "Azul", sexo: "Masculino", absoluto: true, categoria: "Absoluto" },
      { id: "2", user_id: "u2", atleta: "Ruberson RBN", equipe: "LEGADO", faixa: "Azul", sexo: "Masculino", absoluto: true, categoria: "Absoluto" },
    ],
    [],
    [absolutoMasculino],
    [],
  );
  assert.equal(lista.length, 2);
  assert.ok(lista.every((item) => item.absoluto));
  assert.ok(lista.every((item) => item.chaves.some((chave) => chave.tipo === "absoluto")));
});

test("aba absoluto usa idade do nascimento quando a inscricao nao traz idade", () => {
  const lista = montarInscritosChecagem(
    [
      { id: "1", user_id: "u1", atleta: "Nego Dario", equipe: "LEGADO", faixa: "Azul", sexo: "Masculino", absoluto: true, categoria: "Absoluto" },
    ],
    [{ user_id: "u1", nascimento: "1980-01-01" }],
    [absolutoMasculino],
    [],
    [],
    "2026-09-19",
  );
  const chave = lista[0].chaves.find((item) => item.tipo === "absoluto");
  assert.ok(chave);
  assert.equal(chave.chave.startsWith("abs:inscrito:"), false);
  assert.equal(chave.rotulo.includes("Master"), false);
});
