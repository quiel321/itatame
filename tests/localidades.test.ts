import assert from 'node:assert/strict';
import test from 'node:test';
import municipios from '../app/data/municipios-ibge.json';
import { chaveLocalidade } from '../app/lib/localidades';

test('lista oficial mantém municípios de todas as UFs e sugestões com acentos', () => {
  assert.equal(municipios.length, 5571);
  assert.equal(new Set(municipios.map(m => m.estado)).size, 27);
  assert.equal(new Set(municipios.map(m => chaveLocalidade(m.cidade, m.estado))).size, municipios.length);
  assert.ok(municipios.some(m => m.cidade === 'Campos de Júlio' && m.estado === 'MT'));
  assert.ok(municipios.filter(m => chaveLocalidade(m.cidade, '').startsWith('cuiaba')).some(m => m.cidade === 'Cuiabá'));
});
