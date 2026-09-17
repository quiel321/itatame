import assert from 'node:assert/strict';
import { faixasCadastradas, modelosPesoIBJJF, opcoesFaixaCategoria } from '../app/lib/categorias-ibjjf';

const kids = modelosPesoIBJJF.filter(modelo => modelo.id.startsWith('kids_'));
assert.equal(kids.length, 12, 'Devem existir modelos Kids para as idades de 4 a 15 anos.');
assert.deepEqual(kids.map(modelo => modelo.idade_min), [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

for (const modelo of kids) {
  assert.equal(modelo.idade_min, modelo.idade_max);
  assert.equal(modelo.pesos.length, 9);
  assert.equal(modelo.pesos[0].peso_min, 0);
  assert.equal(modelo.pesos.at(-1)?.peso_max, null);
  for (let indice = 1; indice < modelo.pesos.length; indice += 1) {
    assert.equal(modelo.pesos[indice].peso_min, modelo.pesos[indice - 1].peso_max);
  }
}

const quatroAnos = kids.find(modelo => modelo.idade_min === 4)!;
assert.equal(quatroAnos.tempo_minutos, 2);
assert.deepEqual(quatroAnos.faixasPermitidas, ['Cinza']);
assert.deepEqual(quatroAnos.pesos.map(peso => peso.peso_max), [12, 14.7, 18, 21, 24, 27, 30, 33, null]);

const quinzeAnos = kids.find(modelo => modelo.idade_min === 15)!;
assert.equal(quinzeAnos.tempo_minutos, 4);
assert.deepEqual(quinzeAnos.faixasPermitidas, ['Cinza', 'Amarela', 'Laranja', 'Verde']);
assert.deepEqual(quinzeAnos.pesos.map(peso => peso.peso_max), [44.3, 48.3, 52.5, 56.5, 60.5, 65, 69, 73, null]);

assert.deepEqual([...faixasCadastradas], ['Cinza', 'Amarela', 'Laranja', 'Verde', 'Branca', 'Azul', 'Roxa', 'Marrom', 'Preta', 'Coral', 'Vermelha']);
assert.ok(opcoesFaixaCategoria('Preta').includes('Preta'));
assert.ok(opcoesFaixaCategoria('Faixa Extra').includes('Faixa Extra'));

console.log('Modelos IBJJF Kids 2026 verificados: 12 idades e 108 divisões de peso.');
