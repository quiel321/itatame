import test from 'node:test';
import assert from 'node:assert/strict';
import { destinoNavegacaoFotos } from '../app/lib/fotos-navegacao';

test('navegação Retratt evita o prefixo sem perder parâmetros, tokens ou âncoras', () => {
  for (const host of ['retratt.com', 'www.retratt.com', 'retratt.com.br', 'www.retratt.com.br', 'retratt.localhost']) {
    for (const path of ['/admin', '/admin/galerias', '/fotografo/dashboard', '/fotografo/financeiro#vendas-diaria', '/carrinho', '/login?perfil=organizador&next=%2Ffotos%2Fadmin', '/evento/id?acesso=segredo&album=1#foto']) {
      assert.equal(destinoNavegacaoFotos('/fotos' + path, host), path);
    }
    assert.equal(destinoNavegacaoFotos('/fotos', host), '/');
    assert.equal(destinoNavegacaoFotos('/fotos?categoria=jiu-jitsu', host), '/?categoria=jiu-jitsu');
    assert.equal(destinoNavegacaoFotos('/fotos#galerias', host), '/#galerias');
  }
});
test('navegação preserva iTatame, localhost, arquivos públicos e destinos externos', () => {
  for (const host of ['', 'localhost', '127.0.0.1', 'itatame.com.br', 'www.itatame.com.br', 'outro.com'])
    assert.equal(destinoNavegacaoFotos('/fotos/fotografo/dashboard?evento=1#albuns', host), '/fotos/fotografo/dashboard?evento=1#albuns');
  for (const href of ['/api/fotos/admin/tarifas', '/fotos-icon.svg', '/fotosXYZ', 'https://outro.com/fotos', '//outro.com/fotos', '#perfil', '/admin'])
    assert.equal(destinoNavegacaoFotos(href, 'retratt.com'), href);
});
