import assert from 'node:assert/strict';
import test from 'node:test';
import { conferirRegistroVendas, modeloCheckoutAutores, ratearCentavos, registrarVendasFotografos } from '../app/lib/fotos-vendas-diaria';

test('compra conjunta exige organizador e diária ativa de todos os autores', () => {
  const diaria = (id: string) => ({ fotografo_id: id, status: 'ativo', modelo_recebimento: 'diaria_organizador' });
  assert.equal(modeloCheckoutAutores('organizador', ['a', 'b', 'a'], [diaria('a'), diaria('b')]), 'diaria_organizador');
  for (const regras of [[diaria('a')], [diaria('a'), { ...diaria('b'), status: 'removido' }], [diaria('a'), { ...diaria('b'), modelo_recebimento: 'royalty' }]]) {
    assert.throws(() => modeloCheckoutAutores('organizador', ['a', 'b'], regras));
  }
  assert.throws(() => modeloCheckoutAutores(null, ['a', 'b'], []));
  assert.equal(modeloCheckoutAutores(null, ['a'], []), 'royalty');
  assert.equal(modeloCheckoutAutores('organizador', ['a'], [{ ...diaria('a'), modelo_recebimento: 'royalty' }]), 'royalty');
});

test('rateio conserva centavos inclusive com valores grandes e desempate estável', () => {
  assert.deepEqual(ratearCentavos(2, [1, 1, 1]), [1, 1, 0]);
  const valor = 2147483647, partes = ratearCentavos(valor, [2147483646, 1]);
  assert.equal(partes.reduce((s, v) => s + v, 0), valor);
  assert.deepEqual(ratearCentavos(0, [0, 0]), [0, 0]);
  assert.throws(() => ratearCentavos(1, [0, 0]));
  assert.throws(() => ratearCentavos(-1, [1]));
});

test('desconto incide nas fotos; comissão usa as vendas já descontadas de cada autor', () => {
  const registro = registrarVendasFotografos([
    { fotografoId: 'a', nome: 'Ana', precoCentavos: 1000, mimeType: 'image/jpeg' },
    { fotografoId: 'a', nome: 'Ana', precoCentavos: 2000, mimeType: 'video/mp4' },
    { fotografoId: 'b', nome: 'Bia', precoCentavos: 1000 },
  ], 400, 180);
  assert.deepEqual(registro.map(v => [v.subtotalCentavos, v.descontoCentavos, v.totalCentavos, v.comissaoRetrattCentavos, v.antesTarifaCentavos]), [[3000, 200, 2800, 140, 2660], [1000, 200, 800, 40, 760]]);
  assert.equal(conferirRegistroVendas(registro, 3600, 180).length, 2);
});

test('registro financeiro não depende de regras ou preços posteriores', () => {
  const itens = [{ fotografoId: 'a', nome: 'Nome na compra', precoCentavos: 199 }, { fotografoId: 'b', nome: 'Bia', precoCentavos: 301 }];
  const salvo = JSON.parse(JSON.stringify(registrarVendasFotografos(itens, 101, 20)));
  itens[0].nome = 'Nome alterado'; itens[0].precoCentavos = 9000;
  assert.equal(conferirRegistroVendas(salvo, 399, 20)[0].nome, 'Nome na compra');
  assert.equal(salvo.reduce((s: number, v: any) => s + v.antesTarifaCentavos, 0), 379);
});

test('não aceita total, comissão ou autoria divergentes no relatório', () => {
  const registro = registrarVendasFotografos([{ fotografoId: 'a', nome: 'Ana', precoCentavos: 1000 }], 0, 50);
  assert.throws(() => conferirRegistroVendas(registro, 999, 50));
  assert.throws(() => conferirRegistroVendas(registro, 1000, 49));
  assert.throws(() => conferirRegistroVendas([{ ...registro[0], antesTarifaCentavos: 951 }], 1000, 50));
  assert.throws(() => conferirRegistroVendas([...registro, ...registro], 2000, 100));
  assert.throws(() => registrarVendasFotografos([{ fotografoId: 'a', nome: 'Ana', precoCentavos: 100, mimeType: 'video/mp4' }], 1, 0));
});
