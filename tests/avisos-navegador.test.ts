import test from 'node:test';
import assert from 'node:assert/strict';
import { assinaturaNesteAparelho, prepararRegistroAvisos } from '../app/lib/avisos-navegador';

test('ativação normal preserva a assinatura existente; renovação só ocorre quando solicitada', async () => {
  let removidas = 0, criadas = 0;
  const antiga = { endpoint: 'antiga', unsubscribe: async () => { removidas++; return true; } };
  const nova = { endpoint: 'nova' };
  const registro: any = { pushManager: { getSubscription: async () => antiga, subscribe: async () => { criadas++; return nova; } } };
  assert.equal(await assinaturaNesteAparelho(registro, 'AQID'), antiga); assert.equal(removidas, 0); assert.equal(criadas, 0);
  assert.equal(await assinaturaNesteAparelho(registro, 'AQID', true), nova); assert.equal(removidas, 1); assert.equal(criadas, 1);
});

test('preparação aguarda o worker novo ativar em vez de usar a versão antiga', async () => {
  const anterior = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const worker: any = new EventTarget(); worker.state = 'installing';
  const registro: any = { active: {}, installing: worker };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true, serviceWorker: { register: async (url: string, opcoes: any) => { assert.equal(url, '/sw.js'); assert.equal(opcoes.updateViaCache, 'none'); return registro; } } } });
  try {
    let terminou = false; const preparando = prepararRegistroAvisos().then(r => { terminou = true; return r; });
    await Promise.resolve(); await Promise.resolve(); assert.equal(terminou, false);
    worker.state = 'activated'; worker.dispatchEvent(new Event('statechange'));
    assert.equal(await preparando, registro);
  } finally { if (anterior) Object.defineProperty(globalThis, 'navigator', anterior); else Reflect.deleteProperty(globalThis, 'navigator'); }
});

test('aparelho offline não tenta registrar nem alterar assinatura', async () => {
  const anterior = Object.getOwnPropertyDescriptor(globalThis, 'navigator'); let chamadas = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false, serviceWorker: { register: async () => { chamadas++; } } } });
  try { await assert.rejects(prepararRegistroAvisos(), /internet/); assert.equal(chamadas, 0); }
  finally { if (anterior) Object.defineProperty(globalThis, 'navigator', anterior); else Reflect.deleteProperty(globalThis, 'navigator'); }
});
