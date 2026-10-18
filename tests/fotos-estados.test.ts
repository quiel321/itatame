import test from 'node:test';
import assert from 'node:assert/strict';
import municipios from '../app/data/municipios-ibge.json';
import { ESTADOS_BRASIL, filtrarEstados, cidadesDoEstado, cidadeExataNoEstado } from '../app/lib/estados-brasil';

test('lista completa de UFs tem os mesmos 27 códigos dos municípios, incluindo DF', () => {
  assert.equal(ESTADOS_BRASIL.length, 27);
  assert.deepEqual([...new Set(municipios.map(m => m.estado))].sort(), ESTADOS_BRASIL.map(e => e.sigla).sort());
  assert.ok(ESTADOS_BRASIL.some(e => e.nome === 'Distrito Federal' && e.sigla === 'DF'));
});
test('busca de estado aceita nome, acentos, sigla e nome parcial', () => {
  assert.deepEqual(filtrarEstados('sao paulo').map(e => e.sigla), ['SP']);
  assert.deepEqual(filtrarEstados('mT').map(e => e.sigla), ['MT']);
  assert.deepEqual(filtrarEstados('AM').map(e => e.nome), ['Amazonas']);
  assert.deepEqual(filtrarEstados('PA').map(e => e.nome), ['Pará']);
  assert.deepEqual(filtrarEstados('mato grosso').map(e => e.sigla), ['MT', 'MS']);
  assert.deepEqual(filtrarEstados('  espírito ').map(e => e.sigla), ['ES']);
  assert.equal(filtrarEstados('').length, 27); assert.equal(filtrarEstados('inexistente').length, 0);
});
test('cidades pertencem à UF escolhida e um rascunho não vira cidade válida', () => {
  assert.deepEqual(cidadesDoEstado(municipios, '', 'cuiaba'), []);
  assert.ok(cidadesDoEstado(municipios, 'SP').length > 500);
  assert.ok(cidadesDoEstado(municipios, 'MT').every(c => c.estado === 'MT'));
  assert.deepEqual(cidadeExataNoEstado(municipios, 'MT', 'campos de julio'), { cidade: 'Campos de Júlio', estado: 'MT' });
  assert.equal(cidadeExataNoEstado(municipios, 'SP', 'Campos de Júlio'), null);
  assert.equal(cidadeExataNoEstado(municipios, 'MT', 'Cuiab'), null);
  assert.deepEqual(cidadeExataNoEstado(municipios, 'DF', 'brasilia'), { cidade: 'Brasília', estado: 'DF' });
  assert.equal(cidadesDoEstado(municipios, 'SP', 'cuiaba').length, 0);
});
