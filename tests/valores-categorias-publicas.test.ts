import assert from 'node:assert/strict';
import test from 'node:test';
import { existeComboCategorias, type CategoriaValoresPublicos } from '../app/lib/valores-categorias-publicas';

const peso: CategoriaValoresPublicos = {
  tipo: 'peso', ativa: true, modalidade: 'Jiu-Jitsu', sexo: 'Masculino',
  faixa: 'Branca', idade_min: 16, idade_max: 100, peso_min: 0, peso_max: 65,
};
const absoluto: CategoriaValoresPublicos = {
  ...peso, tipo: 'absoluto', faixa: 'Branca · Azul · Roxa · Marrom · Preta', peso_max: null,
};

test('Spartan: peso infantil e feminino adulto não permitem combo com absoluto masculino adulto', () => {
  assert.equal(existeComboCategorias([
    { ...peso, idade_min: 7, idade_max: 15 },
    { ...peso, sexo: 'Feminino' }, absoluto,
  ]), false);
});

test('combo exige modalidade, sexo, faixa e idade compatíveis e categorias ativas', () => {
  assert.equal(existeComboCategorias([peso, absoluto]), true);
  for (const diferente of [
    { ...absoluto, modalidade: 'No-Gi' }, { ...absoluto, sexo: 'Feminino' },
    { ...absoluto, faixa: 'Azul' }, { ...absoluto, idade_min: 4, idade_max: 15 },
    { ...absoluto, ativa: false },
  ]) assert.equal(existeComboCategorias([peso, diferente]), false);
  assert.equal(existeComboCategorias([]), false);
  assert.equal(existeComboCategorias([absoluto]), false);
});

test('peso restrito no absoluto precisa ter interseção real, sem incluir o limite inferior', () => {
  assert.equal(existeComboCategorias([peso, { ...absoluto, peso_min: 65 }]), false);
  assert.equal(existeComboCategorias([peso, { ...absoluto, peso_min: 64 }]), true);
});

test('todas as faixas e faixas mistas usam a mesma normalização das inscrições', () => {
  assert.equal(existeComboCategorias([peso, { ...absoluto, faixa: 'Todas as faixas' }]), true);
  assert.equal(existeComboCategorias([{ ...peso, faixa: 'Todas as faixas' }, absoluto]), true);
  assert.equal(existeComboCategorias([{ ...peso, faixa: 'Cinza / branca' }, { ...absoluto, faixa: 'BRANCA;Azul' }]), true);
});

test('preços do combo infantil só aparecem quando a interseção também inclui crianças', () => {
  assert.equal(existeComboCategorias([peso, absoluto], 4, 15), false);
  const crianca = { ...peso, idade_min: 14, idade_max: 15 };
  const absolutoCrianca = { ...absoluto, idade_min: 15, idade_max: 16 };
  assert.equal(existeComboCategorias([crianca, absolutoCrianca], 4, 15), true);
  assert.equal(existeComboCategorias([crianca, absolutoCrianca], 16, 100), false);
});
