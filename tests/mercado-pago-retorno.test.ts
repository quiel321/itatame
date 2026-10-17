import assert from 'node:assert/strict';
import test from 'node:test';
import { retornoConexaoMercadoPago } from '../app/lib/mercado-pago-retorno';
test('confirma retorno OAuth somente quando o painel reconhece a conta conectada', () => {
  assert.equal(retornoConexaoMercadoPago('conectado', null, true)?.sucesso, true);
  assert.equal(retornoConexaoMercadoPago('conectado', null, false)?.sucesso, false);
  assert.match(retornoConexaoMercadoPago('conectado', null, true)!.mensagem, /autorização foi salva/);
  assert.equal(retornoConexaoMercadoPago(null, null, true), null);
});
test('retorno com erro explica a recuperação e não mostra conteúdo arbitrário da URL', () => {
  for (const motivo of ['access_denied', 'oauth_invalido', 'env_mercado_pago', 'token', 'banco', '<script>segredo</script>']) {
    const retorno = retornoConexaoMercadoPago('erro', motivo, true)!;
    assert.equal(retorno.sucesso, false); assert.ok(retorno.mensagem.length > 20); assert.ok(!retorno.mensagem.includes('<script>'));
  }
  assert.match(retornoConexaoMercadoPago('erro', 'oauth_invalido', true)!.mensagem, /expirou/);
});
