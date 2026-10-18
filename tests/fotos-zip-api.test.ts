import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), mod = require('node:module'), resolver = mod._resolveFilename;
let GET: typeof import('../app/api/fotos/download-pedido/[pedidoId]/route').GET;
try { mod._resolveFilename = function(n: string, ...args: unknown[]) { return resolver.call(this, n === 'server-only' ? 'next/dist/compiled/server-only/empty' : n, ...args); }; GET = require('../app/api/fotos/download-pedido/[pedidoId]/route').GET; }
finally { mod._resolveFilename = resolver; }
const pedidoId = '11111111-1111-4111-8111-111111111111';

test('ZIP exige dono e pagamento, revalida liberação no link e entrega, exclui vídeos e registra solicitações', async () => {
  const ambiente = { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'ficticia', FOTOS_ACESSO_SECRET: 'ficticio', R2_ENDPOINT: 'https://fixture.r2.test', R2_BUCKET_NAME: 'teste', R2_ACCESS_KEY_ID: 'ficticio', R2_SECRET_ACCESS_KEY: 'ficticio' };
  const antes = Object.fromEntries(Object.keys(ambiente).map(k => [k, process.env[k]])); Object.assign(process.env, ambiente);
  const fetchAntes = globalThis.fetch; let dono = 'comprador', pago = true, liberado = true, expirado = false, acessos = 0, registros = 0;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input));
    if (u.hostname === 'fixture.r2.test') { acessos++; assert.ok(u.pathname.endsWith('.jpg')); return new Response('original-' + u.pathname); }
    assert.equal(u.hostname, 'fixture.supabase.co');
    if (u.pathname.endsWith('/user')) return Response.json({ id: 'comprador' });
    if (u.pathname.endsWith('/foto_pedidos')) return Response.json({ id: pedidoId, comprador_user_id: dono, status: pago ? 'pago' : 'pendente' });
    if (u.pathname.endsWith('/foto_pedido_itens')) return Response.json([0, 1, 2].map(i => ({ id: String(i), download_liberado: liberado, download_expires_at: expirado ? '2020-01-01' : null, foto_arquivos: { r2_original_key: `${i}.${i === 2 ? 'mp4' : 'jpg'}`, nome_original: 'foto.jpg', mime_type: i === 2 ? 'video/mp4' : 'image/jpeg' } })));
    assert.ok(u.pathname.endsWith('/foto_downloads')); const linhas = JSON.parse(String(init?.body)); assert.equal(linhas.length, 2); registros++; return new Response(null, { status: 201 });
  };
  const chamar = (url = `https://retratt.com/api/fotos/download-pedido/${pedidoId}?link=1`, auth = true) => GET(new Request(url, { headers: auth ? { Authorization: 'Bearer ficticio' } : {} }), { params: Promise.resolve({ pedidoId }) });
  try {
    assert.equal((await chamar(undefined, false)).status, 401);
    dono = 'outro'; assert.equal((await chamar()).status, 404); dono = 'comprador';
    pago = false; assert.equal((await chamar()).status, 403); pago = true;
    liberado = false; assert.equal((await chamar()).status, 403); liberado = true;
    expirado = true; assert.equal((await chamar()).status, 403); expirado = false;
    const r = await chamar(); assert.equal(r.status, 200); const link = await r.json(); assert.equal(link.quantidade, 2); assert.equal(acessos, 0); assert.equal(registros, 0);
    liberado = false; assert.equal((await chamar('https://retratt.com' + link.url, false)).status, 403); liberado = true;
    const zip = await chamar('https://retratt.com' + link.url, false); assert.equal(zip.headers.get('content-type'), 'application/zip'); assert.equal(zip.headers.get('cache-control'), 'private, no-store');
    const bytes = await zip.arrayBuffer(); assert.ok(bytes.byteLength > 100); assert.equal(acessos, 2); assert.equal(registros, 1);
    assert.equal((await chamar('https://retratt.com' + link.url + 'x', false)).status, 401);
  } finally { globalThis.fetch = fetchAntes; for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});
