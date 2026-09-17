import { strict as assert } from 'node:assert';
import { CategoriaCompeticao, categoriaCompativel, categoriaCompativelSemPeso, categoriaMaisLeve } from '../app/lib/categorias-competicao';

const base: CategoriaCompeticao = {
  id: 'leve', evento_id: 'campeonato', nome: 'Infantil', modalidade: 'Jiu-Jitsu',
  sexo: 'Feminino', faixa: 'Cinza', idade_min: 8, idade_max: 8,
  peso_min: 24, peso_max: 28, tempo_minutos: 3, tipo: 'peso', ativa: true,
};
const atual = { ...base, id: 'atual', peso_min: 28, peso_max: 32 };
const inscricao = { idade: 8, sexo: 'Feminino', faixa: 'Cinza', modalidade: 'Jiu-Jitsu', peso: 30 };

assert.equal(categoriaMaisLeve(atual, base), true);
assert.equal(categoriaCompativelSemPeso(base, inscricao), true);
assert.equal(categoriaCompativel(base, { ...inscricao, peso: 27.5 }), true);
assert.equal(categoriaCompativel(base, inscricao), false);
assert.equal(categoriaCompativel(base, { ...inscricao, peso: 24 }), false);
assert.equal(categoriaCompativelSemPeso(base, { ...inscricao, idade: 9 }), false);
assert.equal(categoriaCompativelSemPeso(base, { ...inscricao, sexo: 'Masculino' }), false);
assert.equal(categoriaMaisLeve(null, base), true);
assert.equal(categoriaMaisLeve(base, atual), false);
assert.equal(categoriaCompativel(atual, inscricao), true);
assert.equal(categoriaCompativel(atual, { ...inscricao, peso: 27.5 }), false);
console.log('Ajuste de peso infantil: limites, idade, sexo e direção verificados.');
