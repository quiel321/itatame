const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const assinatura = endpoint => ({ endpoint, keys: { p256dh: 'teste', auth: 'teste' } });
function rota({ anonimo = false, falha = 0 } = {}) {
  const enviados = [], consultas = [];
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'conta-a', is_anonymous: anonimo } } }) }, from(tabela) {
    const filtros = {}; const q = { select() { return q; }, eq(k, v) { filtros[k] = v; return q; }, then(resolve) { consultas.push({ tabela, ...filtros }); return Promise.resolve(resolve({ data: filtros.user_id === 'conta-a' ? [{ subscription: assinatura('https://fcm.googleapis.com/aparelho-a') }] : [], error: null })); } }; return q;
  } };
  const exports = {}, src = ts.transpileModule(fs.readFileSync('app/api/push/testar/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(src, { exports, URL, Date, JSON, String, Number, Map, Error, process: { env: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'publica-teste', VAPID_PRIVATE_KEY: 'privada-teste' } }, require: nome => nome === 'next/server' ? { NextResponse: { json: (b, o) => Response.json(b, o) } } : nome === 'web-push' ? { setVapidDetails() {}, sendNotification: async (s, p, opcoes) => { enviados.push({ assinatura: s, payload: JSON.parse(p), opcoes }); if (falha) throw { statusCode: falha }; } } : nome === 'node:crypto' ? { randomUUID: () => 'id-teste' } : nome.includes('supabase-server') ? { createSupabaseServerClient: () => db } : { assinaturasUnicas: rows => rows.map(r => r.subscription), hashPush: s => s } });
  return { post: exports.POST, enviados, consultas };
}
const req = (body = {}, auth = true, origin = 'https://itatame.test') => new Request('https://itatame.test/api/push/testar', { method: 'POST', headers: { 'content-type': 'application/json', origin, ...(auth ? { authorization: 'Bearer teste' } : {}) }, body: JSON.stringify({ confirmado: true, endpoint: 'https://fcm.googleapis.com/aparelho-a', ...body }) });
test('teste exige sessão, conta identificada, confirmação e origem correspondente', async () => {
  for (const [r, pedido, status] of [[rota(), req({}, false), 401], [rota({ anonimo: true }), req(), 403], [rota(), req({ confirmado: false }), 400], [rota(), req({}, true, 'https://outro.test'), 403]]) { assert.equal((await r.post(pedido)).status, status); assert.equal(r.enviados.length, 0); }
});
test('teste só pode usar a assinatura do próprio usuário e o endpoint escolhido', async () => {
  const r = rota(); assert.equal((await r.post(req({ endpoint: 'https://fcm.googleapis.com/outro-aparelho', user_id: 'conta-b' }))).status, 409); assert.equal(r.enviados.length, 0); assert.ok(r.consultas.every(q => q.user_id === 'conta-a'));
});
test('um teste explícito envia somente um aviso, com prazo curto e sem tocar na fila do campeonato', async () => {
  const r = rota(), resultado = await r.post(req()); assert.equal(resultado.status, 200); assert.equal((await resultado.json()).aceito, true); assert.equal(r.enviados.length, 1); assert.equal(r.enviados[0].assinatura.endpoint, 'https://fcm.googleapis.com/aparelho-a'); assert.equal(r.enviados[0].opcoes.urgency, 'high'); assert.equal(r.enviados[0].opcoes.TTL, 120); assert.ok(r.consultas.every(q => ['assinaturas_push', 'push_dispositivos'].includes(q.tabela)));
  assert.equal((await r.post(req())).status, 429); assert.equal(r.enviados.length, 1);
});
test('assinatura expirada orienta reativação e falha transitória não dispara novamente', async () => {
  const expirado = rota({ falha: 410 }), res = await expirado.post(req()); assert.equal(res.status, 409); assert.equal((await res.json()).codigo, 'ASSINATURA_EXPIRADA'); assert.equal(expirado.enviados.length, 1);
  const indisponivel = rota({ falha: 503 }); assert.equal((await indisponivel.post(req())).status, 503); assert.equal(indisponivel.enviados.length, 1);
});

