import assert from 'node:assert/strict';
import test from 'node:test';
import { contaSomenteResponsavel, competidoresDaConta } from '../app/lib/conta-responsavel';
test('modo responsável é explícito e não converte atletas, professores ou contas antigas', () => {
  assert.equal(contaSomenteResponsavel('atleta', { somente_responsavel: true }), true);
  for (const role of ['professor', 'organizador', 'super-admin', null]) assert.equal(contaSomenteResponsavel(role, { somente_responsavel: true }), false);
  for (const metadata of [undefined, {}, { somente_responsavel: false }, { somente_responsavel: 'true' }]) assert.equal(contaSomenteResponsavel('atleta', metadata), false);
});
test('responsável inscreve apenas dependentes; atleta ou professor pode inscrever a si e aos filhos', () => {
  const adulto = { user_id: 'adulto' }, filho = { user_id: 'filho', responsavel_id: 'adulto' };
  assert.deepEqual(competidoresDaConta(adulto, [filho], true), [filho]);
  assert.deepEqual(competidoresDaConta(adulto, [], true), []);
  assert.deepEqual(competidoresDaConta(adulto, [filho], false), [adulto, filho]);
  assert.deepEqual(competidoresDaConta(null, [filho], false), [filho]);
  assert.equal(filho.responsavel_id, 'adulto');
});
