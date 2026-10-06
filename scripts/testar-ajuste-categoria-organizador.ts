import assert from 'node:assert/strict';
import { categoriaPermitidaAoOrganizador, divergenciasCategoria } from '../app/lib/ajuste-categoria-organizador';
import { grupoInscricao, type CategoriaCompeticao } from '../app/lib/categorias-competicao';

const categoria: CategoriaCompeticao = {
  id: 'categoria-acima', evento_id: 'evento', nome: 'Leve', modalidade: 'Jiu-Jitsu',
  sexo: 'Masculino', faixa: 'Branca', idade_min: 12, idade_max: 13,
  peso_min: 47, peso_max: 55, tempo_minutos: 4, tipo: 'peso', ativa: true,
};
const inscricao = {
  id: 999999, atleta: 'Atleta de teste', categoria_id: categoria.id,
  idade: 11, peso: 43, sexo: 'Masculino', faixa: 'Branca', modalidade: 'Jiu-Jitsu',
  absoluto: false,
};

assert.equal(categoriaPermitidaAoOrganizador(categoria, inscricao), true);
assert.deepEqual(divergenciasCategoria(categoria, inscricao), { idade: true, peso: true });
assert.equal(grupoInscricao(inscricao, 'peso', [categoria]).categoria_id, categoria.id);
assert.equal(categoriaPermitidaAoOrganizador({ ...categoria, sexo: 'Feminino' }, inscricao), false);
assert.equal(categoriaPermitidaAoOrganizador({ ...categoria, faixa: 'Azul' }, inscricao), false);
assert.equal(categoriaPermitidaAoOrganizador({ ...categoria, modalidade: 'Judô' }, inscricao), false);
assert.equal(categoriaPermitidaAoOrganizador({ ...categoria, ativa: false }, inscricao), false);
assert.equal(categoriaPermitidaAoOrganizador({ ...categoria, tipo: 'absoluto' }, inscricao), false);

console.log('Ajuste de categoria: exceções de idade/peso entram na chave oficial; sexo, faixa e modalidade permanecem protegidos.');
