import assert from "node:assert/strict";
import test from "node:test";
import {
  FAIXA_TODAS_AS_FAIXAS,
  absolutoDaInscricao,
  grupoInscricao,
  serializarFaixasCategoria,
  type CategoriaCompeticao,
} from "../app/lib/categorias-competicao";
import { prepararGrupos } from "../app/lib/gerar-chaves";
import { calcularResultadosChaves } from "../app/lib/ranking-eventos";

const femininoBranca: CategoriaCompeticao = {
  id: "abs-fem-branca",
  evento_id: "evt",
  nome: "Absoluto",
  modalidade: "Jiu-Jitsu",
  sexo: "Feminino",
  faixa: "Branca",
  idade_min: 16,
  idade_max: 100,
  peso_min: 0,
  peso_max: null,
  tempo_minutos: 5,
  tipo: "absoluto",
  ativa: true,
};

const masculinoTodas: CategoriaCompeticao = {
  ...femininoBranca,
  id: "abs-masc-todas",
  sexo: "Masculino",
  faixa: FAIXA_TODAS_AS_FAIXAS,
};

const categorias = [femininoBranca, masculinoTodas];

test("absoluto feminino só aceita faixa branca de 16 anos para cima", () => {
  assert.equal(absolutoDaInscricao({ idade: 25, sexo: "Feminino", faixa: "Branca", modalidade: "Jiu-Jitsu" }, categorias)?.id, "abs-fem-branca");
  assert.equal(absolutoDaInscricao({ idade: 25, sexo: "Feminino", faixa: "Azul", modalidade: "Jiu-Jitsu" }, categorias), null);
  assert.equal(absolutoDaInscricao({ idade: 15, sexo: "Feminino", faixa: "Branca", modalidade: "Jiu-Jitsu" }, categorias), null);
});

test("absoluto masculino reúne todas as faixas de juvenil a master", () => {
  assert.equal(absolutoDaInscricao({ idade: 16, sexo: "Masculino", faixa: "Branca", modalidade: "Jiu-Jitsu" }, categorias)?.id, "abs-masc-todas");
  assert.equal(absolutoDaInscricao({ idade: 34, sexo: "Masculino", faixa: "Preta", modalidade: "Jiu-Jitsu" }, categorias)?.id, "abs-masc-todas");
  assert.equal(absolutoDaInscricao({ idade: 15, sexo: "Masculino", faixa: "Azul", modalidade: "Jiu-Jitsu" }, categorias), null);
});

test("absoluto feminino branca e azul reúne só essas faixas na mesma chave", () => {
  const femininoBrancaAzul: CategoriaCompeticao = {
    ...femininoBranca,
    id: "abs-fem-branca-azul",
    faixa: serializarFaixasCategoria(["Azul", "Branca"]),
  };
  assert.equal(femininoBrancaAzul.faixa, "Branca · Azul");
  assert.equal(absolutoDaInscricao({ idade: 22, sexo: "Feminino", faixa: "Branca", modalidade: "Jiu-Jitsu" }, [femininoBrancaAzul])?.id, "abs-fem-branca-azul");
  assert.equal(absolutoDaInscricao({ idade: 28, sexo: "Feminino", faixa: "Azul", modalidade: "Jiu-Jitsu" }, [femininoBrancaAzul])?.id, "abs-fem-branca-azul");
  assert.equal(absolutoDaInscricao({ idade: 25, sexo: "Feminino", faixa: "Roxa", modalidade: "Jiu-Jitsu" }, [femininoBrancaAzul]), null);
  assert.equal(absolutoDaInscricao({ idade: 25, sexo: "Masculino", faixa: "Azul", modalidade: "Jiu-Jitsu" }, [femininoBrancaAzul]), null);
  const preparados = prepararGrupos([
    { id: 1, atleta: "Ana", atleta_id: 1, absoluto: true, idade: 22, sexo: "Feminino", faixa: "Branca", modalidade: "Jiu-Jitsu", categoria: "Pena", equipe: "A" },
    { id: 2, atleta: "Bia", atleta_id: 2, absoluto: true, idade: 31, sexo: "Feminino", faixa: "Azul", modalidade: "Jiu-Jitsu", categoria: "Leve", equipe: "B" },
    { id: 3, atleta: "Carla", atleta_id: 3, absoluto: true, idade: 24, sexo: "Feminino", faixa: "Roxa", modalidade: "Jiu-Jitsu", categoria: "Médio", equipe: "C" },
  ], "absoluto", [femininoBrancaAzul]);
  assert.equal(Object.keys(preparados.grupos).length, 1);
  assert.equal(Object.values(preparados.grupos)[0].length, 2);
  assert.equal(grupoInscricao({ idade: 22, sexo: "Feminino", faixa: "Branca", modalidade: "Jiu-Jitsu" }, "absoluto", [femininoBrancaAzul]).faixa, "Branca · Azul");
});

test("ranking ignora medalha de absoluto quando o edital não pontua essa chave", () => {
  const luta = {
    status_luta: "concluida",
    fase: "Final",
    id_visual: "999",
    metodo_vitoria: "finalizacao",
    categoria: "Jiu-Jitsu · Absoluto · Branca · Azul · 16-100 anos · Feminino · Absoluto",
    faixa: "Branca · Azul",
    evento_id: "evt",
    vencedor: "Ana",
    vencedor_id: 1,
    atleta_1: "Ana",
    atleta_1_id: 1,
    equipe_1: "A",
    atleta_2: "Bia",
    atleta_2_id: 2,
    equipe_2: "B",
  };
  const semPontuar = calcularResultadosChaves([luta], { evt: { absoluto_pontua: false } });
  assert.equal(semPontuar.atletas.length, 0);
  const pontua = calcularResultadosChaves([luta], { evt: { absoluto_pontua: true } });
  assert.equal(pontua.atletas.find(atleta => atleta.atleta_id === "1")?.ouro, 1);
  assert.equal(pontua.atletas.find(atleta => atleta.atleta_id === "2")?.prata, 1);
});

test("a chave de absoluto não mistura os dois grupos cadastrados", () => {
  const preparados = prepararGrupos([
    { id: 1, atleta: "Ana", atleta_id: 1, absoluto: true, idade: 22, sexo: "Feminino", faixa: "Branca", modalidade: "Jiu-Jitsu", categoria: "Pena", equipe: "A" },
    { id: 2, atleta: "Bia", atleta_id: 2, absoluto: true, idade: 31, sexo: "Feminino", faixa: "Azul", modalidade: "Jiu-Jitsu", categoria: "Leve", equipe: "B" },
    { id: 3, atleta: "Caio", atleta_id: 3, absoluto: true, idade: 17, sexo: "Masculino", faixa: "Azul", modalidade: "Jiu-Jitsu", categoria: "Médio", equipe: "C" },
    { id: 4, atleta: "Davi", atleta_id: 4, absoluto: true, idade: 40, sexo: "Masculino", faixa: "Preta", modalidade: "Jiu-Jitsu", categoria: "Pesado", equipe: "D" },
  ], "absoluto", categorias);
  assert.equal(Object.keys(preparados.grupos).length, 2);
  assert.equal(grupoInscricao({ idade: 22, sexo: "Feminino", faixa: "Branca", modalidade: "Jiu-Jitsu", categoria: "Pena" }, "absoluto", categorias).categoria_id, "abs-fem-branca");
  assert.equal(grupoInscricao({ idade: 40, sexo: "Masculino", faixa: "Preta", modalidade: "Jiu-Jitsu", categoria: "Pesado" }, "absoluto", categorias).categoria_id, "abs-masc-todas");
});
