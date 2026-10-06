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
assert.deepEqual(divergenciasCategoria(categoria, inscricao), { idade: true, peso: true, faixa: false });
assert.equal(grupoInscricao(inscricao, 'peso', [categoria]).categoria_id, categoria.id);
const categoriaMaisBaixa = { ...categoria, id: 'categoria-abaixo', idade_min: 8, idade_max: 10, peso_min: 30, peso_max: 40 };
assert.equal(categoriaPermitidaAoOrganizador(categoriaMaisBaixa, inscricao), true);
assert.deepEqual(divergenciasCategoria(categoriaMaisBaixa, inscricao), { idade: true, peso: true, faixa: false });
assert.equal(grupoInscricao({ ...inscricao, categoria_id: categoriaMaisBaixa.id }, 'peso', [categoriaMaisBaixa]).categoria_id, categoriaMaisBaixa.id);
const categoriaAdulta = { ...categoria, id: 'categoria-adulta', faixa: 'Azul', idade_min: 18, idade_max: 29, peso_min: 55, peso_max: 70 };
const juvenil = { ...inscricao, idade: 17, peso: 52, faixa: 'Roxa', categoria_id: categoriaAdulta.id };
assert.equal(categoriaPermitidaAoOrganizador(categoriaAdulta, juvenil), true);
assert.deepEqual(divergenciasCategoria(categoriaAdulta, juvenil), { idade: true, peso: true, faixa: true });
assert.equal(grupoInscricao(juvenil, 'peso', [categoriaAdulta]).categoria_id, categoriaAdulta.id);
assert.equal(categoriaPermitidaAoOrganizador({ ...categoria, sexo: 'Feminino' }, inscricao), false);
assert.equal(categoriaPermitidaAoOrganizador({ ...categoria, modalidade: 'Judô' }, inscricao), false);
assert.equal(categoriaPermitidaAoOrganizador({ ...categoria, ativa: false }, inscricao), false);
assert.equal(categoriaPermitidaAoOrganizador({ ...categoria, tipo: 'absoluto' }, inscricao), false);

console.log('Ajuste de categoria: idade, peso e faixa podem variar para cima ou para baixo; sexo e modalidade permanecem protegidos.');
