import assert from "node:assert/strict";
import test from "node:test";
import { FAIXA_TODAS_AS_FAIXAS, type CategoriaCompeticao } from "../app/lib/categorias-competicao";
import { obterEtapaEvento, periodoCorrecaoChecagem } from "../app/lib/evento-etapas";
import { chaveProfessor, letraAtleta, montarInscritosChecagem, rotuloPesoDeclarado } from "../app/lib/checagem-publico";
import { prepararChavesEvento } from '../app/lib/chaveamento-evento';

test('estorno sai da checagem e dos totais, mas nova inscrição pendente permanece', () => {
  const antiga = { id: 320, atleta: 'Kaleb', absoluto: true, pagamento_ok: false, estorno_status: 'estornado' };
  const nova = { id: 326, atleta: 'KALEB', absoluto: false, pagamento_ok: false, estorno_status: null };
  const paga = { id: 327, atleta: 'Outro atleta', pagamento_ok: true };
  const lista = montarInscritosChecagem([antiga, nova, paga], [], [], []);
  assert.deepEqual(lista.map(item => item.id), ['326', '327']);
  assert.equal(lista.filter(item => item.pagamento_ok).length, 1);
  assert.equal(lista.filter(item => !item.pagamento_ok).length, 1);
  assert.equal(lista[0].numero, '0001');
  assert.equal(antiga.estorno_status, 'estornado');
});

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

test("agrupa professor por equipe e preserva atleta sem professor", () => {
  assert.equal(chaveProfessor("Keneth", "4BRAVO"), "4BRAVO — Keneth");
  const lista = montarInscritosChecagem(
    [{ id: "1", user_id: "u1", atleta: "Esther", equipe: "Legado", equipe_id: "e1", faixa: "Branca", sexo: "Feminino" }],
    [{ user_id: "u1", professor: "", academia: "Spartan" }],
    [],
    [{ id: "e1", nome: "Legado", academia: "Spartan", professor: "Jefferson" }],
  );
  assert.equal(lista[0].professor, "Sem professor");
  assert.equal(chaveProfessor(lista[0].professor, lista[0].equipe), "Legado — Sem professor");
  assert.equal(letraAtleta("Adailton"), "A");
  assert.equal(rotuloPesoDeclarado("58"), "Peso declarado · 58 kg");
  assert.equal(rotuloPesoDeclarado("58,5"), "Peso declarado · 58,5 kg");
  assert.equal(rotuloPesoDeclarado(""), "Peso não informado");
});

test("peso declarado usa o da inscricao e, se faltar, o do cadastro", () => {
  const lista = montarInscritosChecagem(
    [{ id: "1", user_id: "u1", atleta: "Jeize", equipe: "Spartan", faixa: "Branca", sexo: "Feminino", peso: "60", pagamento_ok: false }],
    [{ user_id: "u2", nome: "Sem peso na inscricao", peso: "70" }],
    [],
    [],
  );
  assert.equal(lista[0].peso, "60");
  const peloCadastro = montarInscritosChecagem(
    [{ id: "2", user_id: "u2", atleta: "Sem peso na inscricao", equipe: "Spartan", faixa: "Branca", sexo: "Feminino" }],
    [{ user_id: "u2", nome: "Sem peso na inscricao", peso: "70" }],
    [],
    [],
  );
  assert.equal(peloCadastro[0].peso, "70");
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

test('geração exclui estorno mesmo ao ignorar pagamentos e preserva os registros', async () => {
  const registros = [
    { id: 320, atleta: 'Inscrição antiga', idade: 37, peso: 32, faixa: 'Branca', sexo: 'Masculino', modalidade: 'Jiu-Jitsu', absoluto: true, estorno_status: 'estornado', pagamento_ok: false },
    { id: 326, atleta: 'Inscrição ativa', idade: 18, peso: 70, faixa: 'Branca', sexo: 'Masculino', modalidade: 'Jiu-Jitsu', absoluto: true, estorno_status: null, pagamento_ok: false },
  ];
  const db = {
    from(tabela: string) {
      const data = tabela === 'inscricoes' ? registros : tabela === 'categorias_evento' ? [absolutoMasculino] : [];
      const consulta = { select() { return consulta; }, eq() { return consulta; }, order() { return consulta; }, in() { return consulta; },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data, error: null }).then(resolve); } };
      return consulta;
    },
    rpc() { throw new Error('O teste não deve gravar dados'); },
  };
  const vinculados = registros.map((item, indice) => Object.assign(item, { atleta_id: indice + 1 }));
  assert.equal(vinculados.length, 2);
  const preparado = await prepararChavesEvento(db, 'evt', 'absoluto', true);
  assert.deepEqual(preparado.inscritos.map(item => item.id), [326]);
  assert.equal(registros.length, 2);
  assert.equal(registros[0].estorno_status, 'estornado');
});

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
