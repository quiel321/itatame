import test from 'node:test';
import assert from 'node:assert/strict';
import { categoriasComTatamesProntos } from '../app/lib/planejamento-operacao';

const postos = [{ identificacao: 'AREA 1' }, { identificacao: 'AREA 2' }];
test('tatame padrão sem sequência salva e área sem mesário não liberam a categoria', () => {
 assert.deepEqual(categoriasComTatamesProntos([{ categoria_id: 'a', tatame: 'AREA 1' }], postos), []);
 assert.deepEqual(categoriasComTatamesProntos([{ categoria_id: 'a', tatame: 'Tatame 1', ordem_tatame: 1 }], postos), []);
});
test('todas as etapas devem ter área e posição válidas; outras categorias prontas continuam liberadas', () => {
 const lutas = [{ categoria_id: 'a', tatame: 'AREA 1', ordem_tatame: 1 }, { categoria_id: 'a', tatame: null, ordem_tatame: 2 }, { categoria_id: 'b', tatame: 'AREA 2', ordem_tatame: 1 }];
 assert.deepEqual(categoriasComTatamesProntos(lutas, postos), ['b']);
});
test('posição duplicada bloqueia os envolvidos e transferência válida entre postos mantém categoria pronta', () => {
 assert.deepEqual(categoriasComTatamesProntos([{ categoria_id: 'a', tatame: 'AREA 1', ordem_tatame: 1 }, { categoria_id: 'b', tatame: 'ÁREA 1', ordem_tatame: 1 }], postos), []);
 assert.deepEqual(categoriasComTatamesProntos([{ categoria_id: 'a', tatame: ' área  1 ', ordem_tatame: 1 }, { categoria_id: 'a', tatame: 'AREA 2', ordem_tatame: 1 }], postos), ['a']);
});
