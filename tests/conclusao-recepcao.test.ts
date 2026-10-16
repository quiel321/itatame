import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todasCategoriasRecepcaoFinalizadas as finalizada, type InscritoCheckin } from '../app/lib/operacao-campeonato';

const inscrito = (categoria_id: string | null, pagamento_ok = true): InscritoCheckin => ({
  id: 1, user_id: 'teste', atleta: 'Atleta', categoria_id, pagamento_ok, status_checkin: 'aprovado',
});

test('exige fechamento de todas as categorias, mesmo com todos os atletas aprovados', () => {
  const lista = [inscrito('peso'), inscrito('absoluto')];
  assert.equal(finalizada(lista, [], ['peso']), false);
  assert.equal(finalizada(lista, [], ['peso', 'absoluto']), true);
  // Reabertura retira a conclusão, sem manter um aviso de sucesso antigo.
  assert.equal(finalizada(lista, [], ['absoluto']), false);
});

test('inclui categorias das chaves e inscrições pagas ainda sem chave', () => {
  const lista = [inscrito('peso'), inscrito('sem-chave')];
  const chaves = [{ categoria: 'Absoluto', categoria_id: 'absoluto' }];
  assert.equal(finalizada(lista, chaves, ['peso', 'absoluto']), false);
  assert.equal(finalizada(lista, chaves, ['peso', 'sem-chave']), false);
  assert.equal(finalizada(lista, chaves, ['peso', 'sem-chave', 'absoluto']), true);
});

test('não anuncia evento vazio ou categoria sem identificação; ignora inscrição sem pagamento e duplicatas', () => {
  assert.equal(finalizada([], [], ['antiga']), false);
  assert.equal(finalizada([inscrito(null)], [], ['peso']), false);
  assert.equal(finalizada([inscrito('peso'), inscrito('peso'), inscrito('sem-pagamento', false)], [], ['peso']), true);
});
