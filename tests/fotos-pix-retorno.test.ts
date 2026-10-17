import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { validarAssinaturaWebhookFotos } from '../app/lib/fotos-webhook-assinatura';
import { remetenteEmailRetratt } from '../app/lib/fotos-email-remetente';
import { pagamentosFotosPendentes, registrarPagamentoFotos, retirarFotosCompradas, retirarPagamentoFotos } from '../app/lib/fotos-carrinho-pagamentos';

const secret = 'segredo-fixture';
function assinar(ts: string) { return `ts=${ts},v1=${crypto.createHmac('sha256', secret).update(`id:123;request-id:req;ts:${ts};`).digest('hex')}`; }
test('assinatura mantém HMAC e tolerância para timestamps em segundos e milissegundos', () => {
  const agora = Date.now();
  for (const ts of [String(Math.floor(agora / 1000)), String(agora)]) assert.doesNotThrow(() => validarAssinaturaWebhookFotos({ assinatura: assinar(ts), requestId: 'req', dataId: '123', secret, agora }));
  for (const ts of [String(Math.floor(agora / 1000) - 301), String(agora + 301000)]) assert.throws(() => validarAssinaturaWebhookFotos({ assinatura: assinar(ts), requestId: 'req', dataId: '123', secret, agora }));
  assert.throws(() => validarAssinaturaWebhookFotos({ assinatura: assinar(String(agora)), requestId: 'outro', dataId: '123', secret, agora }));
});
test('somente o remetente Retratt recebe a marca nova, preservando o endereço configurado', () => {
  assert.equal(remetenteEmailRetratt('iTatame Fotos <fotos@example.test>'), 'Retratt <fotos@example.test>');
  assert.equal(remetenteEmailRetratt('fotos@example.test'), 'Retratt <fotos@example.test>');
  assert.equal(remetenteEmailRetratt(), 'Retratt <suporte@itatame.com.br>');
  assert.throws(() => remetenteEmailRetratt('fotos@example.test\r\nBcc: outro@example.test'));
});
test('acompanhamento sobrevive à releitura e remove somente as fotos pagas do carrinho atual', () => {
  const armazenamento = new Map<string, string>();
  const antes = { storage: globalThis.localStorage, window: globalThis.window };
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => armazenamento.get(k) ?? null, setItem: (k: string, v: string) => armazenamento.set(k, v) }, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true });
  try {
    localStorage.setItem('carrinho_fotos', JSON.stringify(['a', 'b', 'nova']));
    registrarPagamentoFotos({ pedidoId: 'pedido', acesso: 'token-fixture', fotoIds: ['a', 'b'] });
    assert.deepEqual(pagamentosFotosPendentes()[0].fotoIds, ['a', 'b']);
    assert.deepEqual(retirarFotosCompradas(pagamentosFotosPendentes()[0].fotoIds), ['nova']);
    assert.deepEqual(retirarFotosCompradas(['a', 'b']), ['nova']);
    retirarPagamentoFotos('pedido'); assert.equal(pagamentosFotosPendentes().length, 0);
    assert.deepEqual(JSON.parse(localStorage.getItem('carrinho_fotos')!), ['nova']);
  } finally { Object.defineProperty(globalThis, 'localStorage', { value: antes.storage, configurable: true }); Object.defineProperty(globalThis, 'window', { value: antes.window, configurable: true }); }
});
