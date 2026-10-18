import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { caminhoPortfolioOrganizador, slugPortfolioCurtoPermitido } from '../app/lib/fotos-portfolio-url';
import { proxy, config } from '../proxy';
import { NextRequest } from 'next/server';

test('endereço curto aceita o slug público e mantém caminho antigo para nomes reservados', () => {
  assert.equal(caminhoPortfolioOrganizador('spartan-jiu-jitsu'), '/spartan-jiu-jitsu');
  for (const slug of ['admin', 'carrinho', 'login', 'fotografo', 'organizador', 'api', 'nova-senha']) {
    assert.equal(slugPortfolioCurtoPermitido(slug), false);
    assert.equal(caminhoPortfolioOrganizador(slug), `/organizador/${slug}`);
  }
  for (const slug of ['', '../admin', 'a/b', 'a?x=y', 'x'.repeat(121)]) assert.equal(slugPortfolioCurtoPermitido(slug), false);
  for (const pasta of readdirSync('app/fotos', { withFileTypes: true }).filter(p => p.isDirectory() && !/^[\[_]/.test(p.name))) {
    assert.equal(slugPortfolioCurtoPermitido(pasta.name), false, `Preservar rota ${pasta.name}`);
  }
});

test('proxy existente encaminha portfólio curto e preserva carrinho, login, API e iTatame', () => {
  function resposta(path: string, host = 'retratt.com') {
    return proxy(new NextRequest(`https://${host}${path}`, { headers: { host } }));
  }
  for (const path of ['/spartan-jiu-jitsu', '/carrinho', '/login', '/admin', '/organizador/spartan-jiu-jitsu', '/evento/galeria?album=album&acesso=token']) {
    assert.equal(resposta(path).headers.get('x-middleware-rewrite'), `https://retratt.com/fotos${path}`);
  }
  assert.equal(resposta('/nova-senha').headers.get('x-middleware-next'), '1');
  assert.equal(resposta('/spartan-jiu-jitsu', 'itatame.com.br').headers.get('x-middleware-rewrite'), null);
  assert.equal(resposta('/fotos/spartan-jiu-jitsu', 'itatame.com.br').headers.get('location'), 'https://retratt.com/spartan-jiu-jitsu');
  // O matcher do proxy exclui /api: chamadas reais de pagamento não entram no proxy.
  assert.ok(!new RegExp('^' + config.matcher[0]).test('/api/fotos/pagamento/webhook'));
});
