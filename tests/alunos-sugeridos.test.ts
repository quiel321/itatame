import assert from 'node:assert/strict';
import test from 'node:test';
import { equipePreenchida, nomesProfessoresSemelhantes, podeSugerirAluno } from '../app/lib/alunos-sugeridos';

const professor = { user_id: 'prof-eber', nome: 'Eber Godofredo', equipe: 'AAMEP', academia: 'CT Eber' };
const aluno = { id: 408, user_id: 'aluno', nome: 'Aluma Dias', professor: 'Ebarson Amaro', professor_id: null, equipe: 'AAMEP', academia: '', role: 'atleta' };

test('sugere as grafias do exemplo sem depender de equipe ou academia iguais', () => {
  for (const nome of ['Eber', 'Ebar', 'Ebarson Amaro', 'Ebarson godofredo', 'Professor Éber Godofredo']) {
    assert.equal(podeSugerirAluno({ ...aluno, professor: nome, equipe: null }, professor), true, nome);
  }
});

test('não sugere aluno já vinculado, inclusive ao próprio professor', () => {
  assert.equal(podeSugerirAluno({ ...aluno, professor_id: 'outro' }, professor), false);
  assert.equal(podeSugerirAluno({ ...aluno, professor_id: professor.user_id }, professor), false);
  assert.equal(podeSugerirAluno({ ...aluno, professor_id: '' }, professor), true);
});

test('não confunde equipe em comum com vínculo e exclui perfis incompletos ou professores', () => {
  assert.equal(podeSugerirAluno({ ...aluno, professor: 'Jefferson Rony da Silva Garcia' }, professor), false);
  assert.equal(podeSugerirAluno({ ...aluno, professor: null }, professor), false);
  assert.equal(podeSugerirAluno({ ...aluno, nome: '' }, professor), false);
  assert.equal(podeSugerirAluno({ ...aluno, role: 'professor' }, professor), false);
  assert.equal(podeSugerirAluno({ ...aluno, user_id: professor.user_id }, professor), false);
});

test('aceita busca por outra grafia e evita coincidências de prefixos muito curtos', () => {
  assert.equal(podeSugerirAluno({ ...aluno, professor: 'Amaro' }, professor, 'Amaro'), true);
  assert.equal(podeSugerirAluno({ ...aluno, professor: 'Amaro' }, professor), false);
  assert.equal(nomesProfessoresSemelhantes('Ana Silva', 'Ana Souza'), false);
  assert.equal(nomesProfessoresSemelhantes('', ''), false);
});

test('equipe exige nome real, sem aceitar o antigo preenchimento automático', () => {
  for (const valor of [undefined, null, '', '   ', 'Independente', ' independente ']) assert.equal(equipePreenchida(valor), false);
  assert.equal(equipePreenchida(' AAMEP '), true);
});
