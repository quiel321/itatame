import assert from 'node:assert/strict';
import test from 'node:test';
import { mesmoCT, podeVerAlunoDoCT } from '../app/lib/alunos-ct';
const professor = { user_id: 'murilo', equipe: 'AAMEP', academia: 'AAMEP SAPEZAL' };
const aluno = { user_id: 'aluno', role: 'atleta', professor_id: 'eberson', equipe: 'AAMEP', academia: 'AAMEP SAPEZAL' };

test('colegas da mesma equipe e CT veem o aluno sem substituir o responsável', () => {
  for (const user_id of ['murilo', 'eberson', 'outro-professor']) assert.equal(podeVerAlunoDoCT(aluno, { ...professor, user_id }), true);
  assert.equal(aluno.professor_id, 'eberson');
  assert.equal(podeVerAlunoDoCT({ ...aluno, professor_id: null }, professor), true);
});
test('identidade tolera somente caixa, acentos e espaços repetidos', () => {
  assert.equal(mesmoCT(professor, { equipe: ' aamep ', academia: ' Aamép  Sapezal ' }), true);
  for (const academia of ['AAMEP', 'AAMEP SAPEZAL CENTRO', 'AAMEP SAPEZAL CT', 'AAMEPSAPEZAL', 'Outro CT', '', 'Independente']) {
    assert.equal(podeVerAlunoDoCT({ ...aluno, academia }, professor), false, academia);
  }
  for (const equipe of ['Legado', 'AAMEP TEAM', '', 'Independente']) assert.equal(podeVerAlunoDoCT({ ...aluno, equipe }, professor), false, equipe);
});
test('equipe sem CT e CT sem equipe nunca concedem leitura compartilhada', () => {
  for (const parcial of [{ equipe: '', academia: '' }, { equipe: 'AAMEP', academia: '' }, { equipe: '', academia: 'AAMEP SAPEZAL' }]) {
    assert.equal(podeVerAlunoDoCT(aluno, { ...professor, ...parcial }), false);
  }
});
test('preserva os próprios alunos antigos e exclui professores, contas organizadoras e a própria conta', () => {
  assert.equal(podeVerAlunoDoCT({ ...aluno, professor_id: 'murilo', equipe: '', academia: '' }, professor), true);
  for (const role of ['professor', 'organizador', null]) assert.equal(podeVerAlunoDoCT({ ...aluno, role }, professor), false);
  assert.equal(podeVerAlunoDoCT({ ...aluno, user_id: 'murilo' }, professor), false);
});
