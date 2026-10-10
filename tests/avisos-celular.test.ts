import assert from 'node:assert/strict';
import test from 'node:test';
import { assinaturaCorresponde, deveConvidarAvisos } from '../app/lib/avisos-celular';

const base = { role: 'atleta', suportado: true, permissao: 'default', assinaturaNoNavegador: false, assinaturaNaConta: false, adiadoAte: 0, agora: 1000 };

test('convida atleta e professor que ainda não ativaram avisos', () => {
  assert.equal(deveConvidarAvisos(base), true);
  assert.equal(deveConvidarAvisos({ ...base, role: 'professor' }), true);
  assert.equal(deveConvidarAvisos({ ...base, role: 'organizador' }), false);
});

test('navegador já ativado não recebe convite, mas permissão sozinha não basta', () => {
  assert.equal(deveConvidarAvisos({ ...base, permissao: 'granted', assinaturaNoNavegador: true, assinaturaNaConta: true }), false);
  assert.equal(deveConvidarAvisos({ ...base, permissao: 'granted' }), true);
  assert.equal(deveConvidarAvisos({ ...base, permissao: 'granted', assinaturaNoNavegador: true }), true);
});

test('respeita adiamento e navegadores incompatíveis', () => {
  assert.equal(deveConvidarAvisos({ ...base, adiadoAte: 2000 }), false);
  assert.equal(deveConvidarAvisos({ ...base, adiadoAte: 1000 }), true);
  assert.equal(deveConvidarAvisos({ ...base, suportado: false }), false);
});

test('confere a assinatura deste navegador sem confundir com outro dispositivo', () => {
  assert.equal(assinaturaCorresponde({ endpoint: 'navegador-a' }, 'navegador-a'), true);
  assert.equal(assinaturaCorresponde('{"endpoint":"navegador-a"}', 'navegador-a'), true);
  assert.equal(assinaturaCorresponde({ endpoint: 'navegador-b' }, 'navegador-a'), false);
  assert.equal(assinaturaCorresponde('json-invalido', 'navegador-a'), false);
});
