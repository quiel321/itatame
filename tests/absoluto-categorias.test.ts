import assert from "node:assert/strict";
import test from "node:test";
import {
  FAIXA_TODAS_AS_FAIXAS,
  absolutoDaInscricao,
  chavesDaInscricao,
  grupoInscricao,
  rotuloCategoriaAoVivo,
  serializarFaixasCategoria,
  type CategoriaCompeticao,
} from "../app/lib/categorias-competicao";
import { prepararGrupos } from "../app/lib/gerar-chaves";
import { calcularResultadosChaves } from "../app/lib/ranking-eventos";
import { chaveEquipeFlexivel, nomeEquipeChecagem, nomesEquipeIguais } from "../app/lib/equipes-nome";
import { chavesDoTipo, lutaChaveTravada } from "../app/lib/chaveamento-evento";

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

test("absoluto com mais de 64 abre chaves numeradas e continua sendo absoluto", () => {
  const inscricoes = Array.from({ length: 65 }, (_, indice) => ({
    id: indice + 1,
    atleta: `Atleta ${indice + 1}`,
    atleta_id: indice + 1,
    absoluto: true,
    idade: 25,
    sexo: "Masculino",
    faixa: indice % 2 ? "Preta" : "Branca",
    modalidade: "Jiu-Jitsu",
    categoria: "Leve",
    equipe: indice % 2 ? "PORRADA" : "LEGADO",
    academia: indice % 2 ? "PORRADA" : "SPARTAN",
  }));
  const preparados = prepararGrupos(inscricoes, "absoluto", categorias);
  const nomes = Object.values(preparados.metadados).map((meta) => meta.categoria);
  assert.equal(nomes.length, 2);
  assert.equal(nomes.every((nome) => nome.toLowerCase().includes("absoluto") && /Chave [12]$/.test(nome)), true);
  assert.equal(Object.values(preparados.grupos).reduce((total, grupo) => total + grupo.length, 0), 65);
  assert.equal(Object.values(preparados.grupos).every((grupo) => grupo.length <= 64), true);
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

test("combo entra na chave de peso e na de absoluto", () => {
  const galo: CategoriaCompeticao = {
    id: "galo",
    evento_id: "evt",
    nome: "Galo",
    modalidade: "Jiu-Jitsu",
    sexo: "Masculino",
    faixa: "Azul",
    idade_min: 16,
    idade_max: 100,
    peso_min: 0,
    peso_max: 57.5,
    tempo_minutos: 5,
    tipo: "peso",
    ativa: true,
  };
  const inscrito = {
    id: 1,
    atleta: "Alex",
    atleta_id: 1,
    absoluto: true,
    idade: 25,
    sexo: "Masculino",
    faixa: "Azul",
    modalidade: "Jiu-Jitsu",
    categoria: "Galo",
    categoria_id: "galo",
    equipe: "L",
    peso: 56,
  };
  const peso = prepararGrupos([inscrito], "peso", [galo, masculinoTodas]);
  const absoluto = prepararGrupos([inscrito], "absoluto", [galo, masculinoTodas]);
  assert.equal(Object.keys(peso.grupos).length, 1);
  assert.equal(Object.keys(absoluto.grupos).length, 1);
});

test("absoluto com faixa de peso só aceita atleta dentro do intervalo", () => {
  const absolutoLeve: CategoriaCompeticao = {
    ...masculinoTodas,
    id: "abs-leve",
    peso_min: 0,
    peso_max: 76,
  };
  assert.equal(absolutoDaInscricao({ idade: 28, sexo: "Masculino", faixa: "Azul", modalidade: "Jiu-Jitsu", peso: 70 }, [absolutoLeve])?.id, "abs-leve");
  assert.equal(absolutoDaInscricao({ idade: 28, sexo: "Masculino", faixa: "Azul", modalidade: "Jiu-Jitsu", peso: 90 }, [absolutoLeve]), null);
});

test("ranking trata ouro de peso e ouro de absoluto como categorias distintas", () => {
  const peso = {
    status_luta: "concluida",
    fase: "Final",
    id_visual: "999",
    metodo_vitoria: "finalizacao",
    categoria: "Jiu-Jitsu · Galo · Azul · 16-100 anos · Masculino · 0 a 57.5 kg",
    evento_id: "evt",
    vencedor: "Alex",
    vencedor_id: 1,
    atleta_1: "Alex",
    atleta_1_id: 1,
    equipe_1: "L",
    atleta_2: "Bruno",
    atleta_2_id: 2,
    equipe_2: "M",
  };
  const absoluto = {
    ...peso,
    categoria: "Jiu-Jitsu · Absoluto · Todas as faixas · 16-100 anos · Masculino · Absoluto",
    vencedor: "Alex",
    atleta_2: "Caio",
    atleta_2_id: 3,
    equipe_2: "N",
  };
  const juntos = calcularResultadosChaves([peso, absoluto], { evt: { absoluto_pontua: true } });
  assert.equal(juntos.atletas.find(atleta => atleta.atleta_id === "1")?.ouro, 2);
  const soPeso = calcularResultadosChaves([peso, absoluto], { evt: { absoluto_pontua: true } }, "peso");
  const soAbsoluto = calcularResultadosChaves([peso, absoluto], { evt: { absoluto_pontua: true } }, "absoluto");
  assert.equal(soPeso.atletas.find(atleta => atleta.atleta_id === "1")?.ouro, 1);
  assert.equal(soAbsoluto.atletas.find(atleta => atleta.atleta_id === "1")?.ouro, 1);
  assert.equal(soPeso.atletas.find(atleta => atleta.atleta_id === "3"), undefined);
  assert.equal(soAbsoluto.atletas.find(atleta => atleta.atleta_id === "2"), undefined);
});

test("mirim inscrito só no absoluto entra na chave de absoluto e não na de peso", () => {
  const absolutoMirim: CategoriaCompeticao = {
    ...femininoBranca,
    id: "abs-mirim",
    sexo: "Masculino",
    faixa: FAIXA_TODAS_AS_FAIXAS,
    idade_min: 4,
    idade_max: 15,
  };
  const inscrito = { id: 9, atleta: "Leo", atleta_id: 9, absoluto: true, idade: 8, sexo: "Masculino", faixa: "Cinza", modalidade: "Jiu-Jitsu", categoria: "Absoluto", equipe: "Spartan" };
  const peso = prepararGrupos([inscrito], "peso", [absolutoMirim]);
  const absoluto = prepararGrupos([inscrito], "absoluto", [absolutoMirim]);
  assert.equal(Object.keys(peso.grupos).length, 0);
  assert.equal(Object.keys(absoluto.grupos).length, 1);
  assert.equal(Object.values(absoluto.grupos)[0].length, 1);
});

test("absoluto cadastrado pelo organizador junta idades e faixas na mesma chave", () => {
  const preparados = prepararGrupos([
    { id: 1, atleta: "Nego Dario", atleta_id: 1, absoluto: true, idade: 46, sexo: "Masculino", faixa: "Azul", modalidade: "Jiu-Jitsu", categoria: "Absoluto", equipe: "LEGADO" },
    { id: 2, atleta: "Ruberson RBN", atleta_id: 2, absoluto: true, idade: 31, sexo: "Masculino", faixa: "Azul", modalidade: "Jiu-Jitsu", categoria: "Absoluto", equipe: "LEGADO" },
    { id: 3, atleta: "Jefferson Garcia", atleta_id: 3, absoluto: true, idade: 41, sexo: "Masculino", faixa: "Preta", modalidade: "Jiu-Jitsu", categoria: "AAAAA", equipe: "LEGADO" },
  ], "absoluto", [masculinoTodas]);
  assert.equal(Object.keys(preparados.grupos).length, 1);
  assert.equal(Object.values(preparados.grupos)[0].length, 3);
  assert.equal(preparados.metadados[Object.keys(preparados.grupos)[0]].categoria_id, "abs-masc-todas");
});

test("checagem usa só categorias do organizador e não inventa Master no absoluto", () => {
  const nego = chavesDaInscricao({ absoluto: true, idade: 46, sexo: "Masculino", faixa: "Azul", modalidade: "Jiu-Jitsu", categoria: "Absoluto" }, [masculinoTodas]);
  const ruberson = chavesDaInscricao({ absoluto: true, idade: 31, sexo: "Masculino", faixa: "Azul", modalidade: "Jiu-Jitsu", categoria: "Absoluto" }, [masculinoTodas]);
  assert.equal(nego.length, 1);
  assert.equal(nego[0].tipo, "absoluto");
  assert.equal(nego[0].chave, ruberson[0].chave);
  assert.equal(nego[0].rotulo.includes("Master"), false);
  assert.throws(() => grupoInscricao({ absoluto: true, categoria: "Absoluto", faixa: "Azul", sexo: "Masculino", idade: 46 }, "peso", [masculinoTodas]));
  assert.equal(chavesDaInscricao({ absoluto: true, idade: 25, sexo: "Masculino", faixa: "Azul", modalidade: "Jiu-Jitsu", categoria: "Absoluto" }, []).length, 0);
});

test("checagem mostra a equipe da inscrição mesmo sem lista oficial", () => {
  assert.equal(nomeEquipeChecagem({ equipe: "LEGADO" }, []), "LEGADO");
  assert.equal(nomeEquipeChecagem({ equipe: "Legado Jiu" }, [{ id: "1", nome: "LEGADO" }]), "LEGADO");
  assert.equal(nomeEquipeChecagem({ equipe_id: "1", equipe: "" }, [{ id: "1", nome: "LEGADO" }]), "LEGADO");
  assert.equal(nomeEquipeChecagem({ equipe: "" }, [], "SEM EQUIPE"), "SEM EQUIPE OFICIAL");
});

test("rótulo ao vivo corta modalidade, idade e sexo e evita faixa duplicada", () => {
  assert.equal(
    rotuloCategoriaAoVivo("Jiu-Jitsu · Pena · 18-29 anos · Masculino · 64 a 70 kg", "Branca"),
    "Pena · Branca",
  );
  assert.equal(
    rotuloCategoriaAoVivo("Jiu-Jitsu · Absoluto · Branca · Azul · Roxa · Preta · 18-50 anos · Masculino · Absoluto", "Branca · Azul · Roxa · Preta"),
    "Absoluto · Faixas mistas",
  );
});

test("logo da equipe casa nome com e sem espaço", () => {
  assert.equal(chaveEquipeFlexivel("Spartan Jiu Jitsu"), "SPARTAN");
  assert.equal(nomesEquipeIguais("GRACIE TESTE", "GRACIETESTE"), true);
  assert.equal(nomesEquipeIguais("LEGADO", "Legado Team"), true);
});

test("regenerar chave só mexe no tipo pedido e trava luta já iniciada", () => {
  const lutas = [
    { id: "peso-1", categoria: "Jiu-Jitsu · Leve · Branca", status_luta: "agendada" },
    { id: "abs-1", categoria: "Jiu-Jitsu · Absoluto · Todas as faixas", status_luta: "concluida", vencedor: "Ana" },
  ];
  assert.deepEqual(chavesDoTipo(lutas, "peso").map((luta) => luta.id), ["peso-1"]);
  assert.deepEqual(chavesDoTipo(lutas, "absoluto").map((luta) => luta.id), ["abs-1"]);
  assert.equal(chavesDoTipo(lutas, "peso").some(lutaChaveTravada), false);
  assert.equal(chavesDoTipo(lutas, "absoluto").some(lutaChaveTravada), true);
  assert.equal(lutaChaveTravada({ status_luta: "em_andamento" }), true);
  assert.equal(lutaChaveTravada({ status_luta: "agendada" }), false);
});
