import assert from 'node:assert/strict';
import test from 'node:test';
import { dataHoraInscricao, idadeCivil, identificarResponsavel } from '../app/lib/inscricao-identificacao';
import { montarLinhaSuporte } from '../app/lib/super-admin-painel';

const agora = new Date('2026-10-10T16:00:00Z');
const menor = { id: 408, user_id: 'menor', nascimento: '2014-01-10', responsavel_id: 'adulto' };
const adulto = { id: 1, user_id: 'adulto', nome: 'Maria da Silva', nascimento: '1985-04-20', telefone: '65999999999', email: 'adulto@example.test' };

test('responsável vem do vínculo do menor, sem deduzir por nome ou equipe', () => {
  assert.deepEqual(identificarResponsavel({ idade: 12 }, menor, adulto, agora), { responsavel_nome: 'Maria da Silva', responsavel_contato: '65999999999 · adulto@example.test' });
  assert.equal(identificarResponsavel({ idade: 12 }, menor, { ...adulto, user_id: 'outro' }, agora).responsavel_nome, 'Responsável não localizado');
});

test('menores antigos sem responsável são identificados; adultos não usam idade da categoria', () => {
  assert.equal(identificarResponsavel({ idade: 12 }, undefined, undefined, agora).responsavel_nome, 'Não informado (menor)');
  assert.equal(identificarResponsavel({ idade: 16 }, { ...menor, nascimento: '2000-01-10', responsavel_id: null }, undefined, agora).responsavel_nome, '—');
  assert.equal(identificarResponsavel({}, undefined, undefined, agora).responsavel_nome, '—');
});

test('sinaliza responsável sem idade comprovada ou cadastrado como menor', () => {
  assert.match(identificarResponsavel({}, menor, { ...adulto, nascimento: null }, agora).responsavel_nome, /idade não informada/);
  assert.match(identificarResponsavel({}, menor, { ...adulto, nascimento: '2010-01-01' }, agora).responsavel_nome, /menor de 18/);
});

test('idade considera aniversário e rejeita data impossível', () => {
  assert.equal(idadeCivil('2008-10-10', agora), 18);
  assert.equal(idadeCivil('2008-10-11', agora), 17);
  assert.equal(idadeCivil('2014-02-30', agora), null);
});

test('hora da inscrição usa Cuiabá e não inventa data para registro antigo', () => {
  assert.equal(dataHoraInscricao('2026-10-10T03:15:20Z'), '09/10/2026, 23:15:20');
  assert.equal(dataHoraInscricao(null), 'Não registrada');
  assert.equal(dataHoraInscricao('invalido'), 'Não registrada');
});

test('linha do relatório inclui responsável e horário original da inscrição', () => {
  const linha = montarLinhaSuporte({ id: 408, atleta: 'Aluna', created_at: '2026-10-10T03:15:20Z', responsavel_nome: adulto.nome, responsavel_contato: adulto.telefone });
  assert.equal(linha.responsavel, adulto.nome);
  assert.equal(linha.contatoResponsavel, adulto.telefone);
  assert.equal(linha.dataInscricao, '09/10/2026, 23:15:20');
});
