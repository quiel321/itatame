import assert from "node:assert/strict";
import test from "node:test";
import {
  ordemOperacionalChaveTriangular,
  lutasFormamChaveDeSeis,
  lutasFormamChaveDeTres,
  placeholderSlotChaveDeTres,
  textoAguardandoChaveDeTres,
  textoOuroAposChecagem,
  resumoHumanoChave,
} from "../app/lib/chave-de-tres";
import { rotuloLuta } from "../app/lib/lutas-rotulos";
import { estruturaVisualChave, idsPrimeiraFasePorLado } from "../app/lib/chave-visual";
import { montarChaves, prepararGrupos } from "../app/lib/gerar-chaves";
import type { InscricaoCompeticao } from "../app/lib/categorias-competicao";

const chaveDeTres = [
  { id_visual: "1", fase: "Semifinal 1 · Chave de 3", proxima_luta: 999 },
  { id_visual: "2", fase: "Semifinal 2 · Chave de 3", proxima_luta: 999 },
  { id_visual: "999", fase: "Final · Chave de 3", proxima_luta: null },
];

const chaveDeSeis = [
  { id_visual: "1", fase: "Luta 1 esquerda · Chave de 3", proxima_luta: 101 },
  { id_visual: "2", fase: "Baia esquerda · Chave de 3", proxima_luta: 101 },
  { id_visual: "101", fase: "Decisão esquerda · Chave de 3", proxima_luta: 999 },
  { id_visual: "3", fase: "Luta 1 direita · Chave de 3", proxima_luta: 102 },
  { id_visual: "4", fase: "Baia direita · Chave de 3", proxima_luta: 102 },
  { id_visual: "102", fase: "Decisão direita · Chave de 3", proxima_luta: 999 },
  { id_visual: "999", fase: "Final · Chave de 6", proxima_luta: null },
];

const categoriaLeve = {
  id: "leve",
  evento_id: "evento-teste",
  nome: "Leve",
  modalidade: "Jiu-Jitsu",
  sexo: "Masculino",
  faixa: "Branca",
  idade_min: 18,
  idade_max: 29,
  peso_min: 0,
  peso_max: 200,
  tempo_minutos: 5,
  tipo: "peso" as const,
  ativa: true,
};

function atletas(lista: Array<Partial<InscricaoCompeticao>>): InscricaoCompeticao[] {
  return lista.map((item, indice) => ({
    id: `inscricao-${indice + 1}`,
    atleta_id: indice + 1,
    atleta: item.atleta || `Atleta ${indice + 1}`,
    categoria: "Leve",
    faixa: "Branca",
    sexo: "Masculino",
    idade: 25,
    peso: 70,
    equipe: item.equipe || "LEGADO",
    academia: item.academia || "",
    pagamento_ok: true,
  }));
}

test("chave de 3 não trata o atleta da baia como ouro após a checagem", () => {
  assert.equal(lutasFormamChaveDeTres(chaveDeTres), true);
  assert.equal(placeholderSlotChaveDeTres(chaveDeTres[1], 1), "Perdedor da luta 1");
  assert.equal(placeholderSlotChaveDeTres(chaveDeTres[2], 1), "Vencedor da luta 1");
  assert.equal(placeholderSlotChaveDeTres(chaveDeTres[2], 2), "Vencedor da luta 2");
  assert.match(textoAguardandoChaveDeTres(chaveDeTres[1]) || "", /perdedor da luta 1/i);
  assert.equal(textoAguardandoChaveDeTres({ id_visual: "1", fase: "Final" }), null);
  assert.equal(textoAguardandoChaveDeTres({ id_visual: "2", fase: "Semifinal" }), null);
  assert.equal(placeholderSlotChaveDeTres({ id_visual: "2", fase: "Semifinal" }, 1), null);
  assert.equal(rotuloLuta(chaveDeTres[0]), "Luta 1 · chave de 3");
  assert.equal(rotuloLuta(chaveDeTres[1]), "Luta 2 · baia");
  assert.equal(rotuloLuta(chaveDeTres[2]), "Final · chave de 3");
});

test("chave de 6 distribui dois lados e deixa a baia esperando o perdedor", () => {
  assert.equal(lutasFormamChaveDeSeis(chaveDeSeis), true);
  assert.equal(placeholderSlotChaveDeTres(chaveDeSeis[1], 1), "Perdedor da luta 1");
  assert.equal(placeholderSlotChaveDeTres(chaveDeSeis[4], 1), "Perdedor da luta 1 direita");
  assert.equal(placeholderSlotChaveDeTres(chaveDeSeis[6], 1), "Vencedor do lado esquerdo");
  assert.equal(placeholderSlotChaveDeTres(chaveDeSeis[6], 2), "Vencedor do lado direito");
  assert.match(textoAguardandoChaveDeTres(chaveDeSeis[4]) || "", /perdedor da luta 1 da direita/i);
  assert.equal(ordemOperacionalChaveTriangular(chaveDeTres[0]), 1);
  assert.equal(ordemOperacionalChaveTriangular(chaveDeTres[1]), 2);
  assert.equal(ordemOperacionalChaveTriangular(chaveDeSeis[2]), 3);
  assert.equal(ordemOperacionalChaveTriangular(chaveDeSeis[3]), 4);
  assert.equal(ordemOperacionalChaveTriangular(chaveDeSeis[6]), 7);
  assert.equal(rotuloLuta(chaveDeSeis[3]), "Luta 1 · direita");
  assert.equal(textoOuroAposChecagem(1), "Aguardando checagem · ouro só após a presença");
  assert.match(textoOuroAposChecagem(6), /baia/i);
});

test("resumo humano da chave de 3 conta a baia e a final", () => {
  assert.match(resumoHumanoChave([
    { id_visual: "1", fase: "Semifinal 1 · Chave de 3", atleta_1: "Alex Nunes", atleta_2: "Aylan Rocha", vencedor: "Alex Nunes", status_luta: "concluida", proxima_luta: 999 },
    { id_visual: "2", fase: "Semifinal 2 · Chave de 3", atleta_1: "Aylan Rocha", atleta_2: "Ezequiel Castro", status_luta: "agendada", proxima_luta: 999 },
    { id_visual: "999", fase: "Final · Chave de 3", atleta_1: "Alex Nunes", atleta_2: "TBD", status_luta: "agendada", proxima_luta: null },
  ]), /Alex Nunes já está na final/i);
});

test("árvore de 8 coloca a primeira fase nos dois lados", () => {
  const ids = idsPrimeiraFasePorLado([
    { id_visual: "1" }, { id_visual: "2" }, { id_visual: "3" }, { id_visual: "4" }, { id_visual: "101" }, { id_visual: "999" },
  ]);
  assert.equal(ids.esquerda(1), 1);
  assert.equal(ids.esquerda(2), 2);
  assert.equal(ids.direita(1), 3);
  assert.equal(ids.direita(2), 4);
});

test("chave de 3 volta para a árvore de 4 e deixa a baia só à direita", () => {
  const arvore = estruturaVisualChave(chaveDeTres);
  assert.equal(arvore.tamanho, 4);
  assert.deepEqual(arvore.esquerda[0], ["1"]);
  assert.deepEqual(arvore.direita[0], ["2"]);
  assert.equal(arvore.esquerda.length, 1);
  assert.equal(arvore.direita.length, 1);
  assert.equal(arvore.final, "999");
});

test("chave de 8 não repete Jefferson e Nego Dario no canto esquerdo", () => {
  const lutas = [
    { id_visual: "1", atleta_1: "Aylan Rocha", atleta_2: "Alex Nunes" },
    { id_visual: "2", atleta_1: "Ezequiel Castro", atleta_2: "BYE" },
    { id_visual: "3", atleta_1: "Ruberson", atleta_2: "Jefferson" },
    { id_visual: "4", atleta_1: "Nego Dario", atleta_2: "BYE" },
    { id_visual: "101" },
    { id_visual: "102", atleta_1: "Jefferson", atleta_2: "Nego Dario" },
    { id_visual: "999", atleta_1: "TBD", atleta_2: "Nego Dario" },
  ];
  const arvore = estruturaVisualChave(lutas);
  assert.equal(arvore.tamanho, 8);
  assert.deepEqual(arvore.esquerda[1], ["101"]);
  assert.deepEqual(arvore.direita[1], ["102"]);
  assert.equal(arvore.esquerda.flat().includes("102"), false);
});

test("chave de 6 coloca a decisão 102 só à direita", () => {
  const arvore = estruturaVisualChave(chaveDeSeis);
  assert.equal(arvore.tamanho, 8);
  assert.deepEqual(arvore.esquerda[0], ["1", "2"]);
  assert.deepEqual(arvore.direita[0], ["3", "4"]);
  assert.deepEqual(arvore.esquerda[1], ["101"]);
  assert.deepEqual(arvore.direita[1], ["102"]);
});

test("seis atletas geram duas chaves de 3 e a final", () => {
  const preparados = prepararGrupos(atletas([
    { academia: "SPARTAN" }, { academia: "PORRADA" }, { academia: "SPARTAN" },
    { academia: "PORRADA" }, { academia: "SPARTAN" }, { academia: "PORRADA" },
  ]), "peso", [categoriaLeve]);
  const lutas = montarChaves("evento-teste", preparados);
  assert.equal(lutas.length, 7);
  assert.equal(lutasFormamChaveDeSeis(lutas), true);
  assert.equal(lutas.filter(luta => luta.lado === "esquerda").length, 3);
  assert.equal(lutas.filter(luta => luta.lado === "direita").length, 3);
  const baiaEsquerda = lutas.find(luta => String(luta.id_visual) === "2");
  const baiaDireita = lutas.find(luta => String(luta.id_visual) === "4");
  assert.equal(baiaEsquerda?.atleta_1, "TBD");
  assert.equal(baiaDireita?.atleta_1, "TBD");
});
