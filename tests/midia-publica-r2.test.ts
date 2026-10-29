import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { enderecoMidiaPublica, prepararMidiaPublica, salvarMidiaPublica } from '../app/lib/midia-publica-servidor';
import { origemPublicaSupabase, chaveMidiaPublica } from '../app/lib/midia-publica';
import { r2Config, createR2PresignedGetUrl } from '../app/lib/r2';
import { GET, HEAD } from '../app/api/midia-publica/[escopo]/[arquivo]/route';
import { POST } from '../app/api/midia-publica/upload/route';

const env = {
  R2_ENDPOINT: 'https://r2.test', R2_BUCKET_NAME: 'retratt-privado', R2_ACCESS_KEY_ID: 'chave', R2_SECRET_ACCESS_KEY: 'segredo',
  R2_ITATAME_BUCKET_NAME: 'itatame-separado', NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fixture',
};
async function simular(rodar: () => Promise<void>) {
  const antes = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  const fetchAntes = globalThis.fetch;
  Object.assign(process.env, env);
  try { await rodar(); }
  finally {
    globalThis.fetch = fetchAntes;
    for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}
const arquivo = 'a'.repeat(64) + '.webp';
const ctx = (escopo = 'itatame', nome = arquivo) => ({ params: Promise.resolve({ escopo, arquivo: nome }) });

test('avatares são WebP pequenos; banners preservam proporção; nomes mudam com o conteúdo', async () => {
  const entrada = await sharp({ create: { width: 1800, height: 900, channels: 4, background: '#aa1122' } }).png().toBuffer();
  const avatar = await prepararMidiaPublica(entrada, 'avatar');
  const meta = await sharp(avatar.bytes).metadata();
  assert.equal(meta.width, 500); assert.equal(meta.height, 250); assert.equal(meta.format, 'webp');
  assert.ok(avatar.bytes.length < entrada.length);
  const banner = await prepararMidiaPublica(entrada, 'banner');
  assert.equal((await sharp(banner.bytes).metadata()).width, 1280);
  assert.notEqual(avatar.arquivo, banner.arquivo);
  assert.equal((await prepararMidiaPublica(entrada, 'avatar')).arquivo, avatar.arquivo);
  const pdf = Buffer.from('%PDF-1.7\nfixture');
  assert.deepEqual((await prepararMidiaPublica(pdf, 'documento')).bytes, pdf);
  await assert.rejects(prepararMidiaPublica(Buffer.from('<script/>'), 'documento'));
  await assert.rejects(prepararMidiaPublica(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'), 'avatar'));
});

test('separação exige bucket próprio para iTatame e mantém fotos existentes no Retratt', async () => simular(async () => {
  assert.equal(r2Config().bucket, 'retratt-privado');
  assert.equal(r2Config('itatame').bucket, 'itatame-separado');
  assert.match(new URL(createR2PresignedGetUrl('original.jpg')).pathname, /^\/retratt-privado\//);
  delete process.env.R2_ITATAME_BUCKET_NAME;
  assert.throws(() => r2Config('itatame'), /R2_ITATAME_BUCKET_NAME/);
  process.env.R2_ITATAME_BUCKET_NAME = 'retratt-privado';
  assert.throws(() => r2Config('itatame'), /diferentes/);
}));

test('upload usa apenas o bucket escolhido e fornece URL estável sem assinatura', async () => simular(async () => {
  const destinos: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); destinos.push(url.pathname);
    assert.equal(init?.method, 'PUT');
    assert.match(new Headers(init?.headers).get('Cache-Control')!, /immutable/);
    return new Response(null, { status: 200 });
  };
  const entrada = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#abcdef' } }).png().toBuffer();
  const i = await salvarMidiaPublica(entrada, 'avatar', 'itatame');
  const r = await salvarMidiaPublica(entrada, 'avatar', 'retratt');
  assert.match(destinos[0], /^\/itatame-separado\/midia-publica\/v1\//);
  assert.match(destinos[1], /^\/retratt-privado\/midia-publica\/v1\//);
  assert.ok(!i.publicUrl.includes('X-Amz')); assert.match(i.publicUrl, /\/api\/midia-publica\/itatame\//);
  assert.match(r.publicUrl, /\/api\/midia-publica\/retratt\//);
}));

test('entrega não consulta Supabase, permite cache e nunca expõe originais ou assinatura privada', async () => simular(async () => {
  let leituras = 0;
  globalThis.fetch = async input => {
    const url = new URL(String(input)); leituras++;
    assert.equal(url.hostname, 'r2.test'); assert.match(url.pathname, /^\/itatame-separado\/midia-publica\/v1\//);
    return new Response('webp', { headers: { 'content-length': '4', 'set-cookie': 'nao-repassar' } });
  };
  const resposta = await GET(new Request('https://itatame.com.br/api/midia-publica/itatame/' + arquivo), ctx());
  assert.equal(resposta.status, 200); assert.equal(await resposta.text(), 'webp');
  assert.match(resposta.headers.get('cache-control')!, /31536000.*immutable/);
  assert.match(resposta.headers.get('cdn-cache-control')!, /s-maxage/);
  assert.equal(resposta.headers.get('location'), null); assert.equal(resposta.headers.get('set-cookie'), null);
  const condicional = await GET(new Request('https://itatame.com.br', { headers: { 'If-None-Match': resposta.headers.get('etag')! } }), ctx());
  assert.equal(condicional.status, 304); assert.equal(await condicional.text(), '');
  const cabecalho = await HEAD(new Request('https://itatame.com.br'), ctx());
  assert.equal(await cabecalho.text(), '');
  for (const [escopo, nome] of [['outro', arquivo], ['retratt', 'original.jpg'], ['itatame', '../fotos/original.jpg'], ['retratt', 'a'.repeat(64) + '.svg']]) {
    assert.equal((await GET(new Request('https://itatame.com.br'), ctx(escopo, nome))).status, 404);
  }
  assert.equal(leituras, 3);
  assert.throws(() => chaveMidiaPublica('../../foto-original.jpg'));
}));

test('falhas não ficam em cache e PDFs aceitam leitura parcial sem cache compartilhado', async () => simular(async () => {
  globalThis.fetch = async () => new Response(null, { status: 404 });
  const ausente = await GET(new Request('https://itatame.com.br'), ctx());
  assert.equal(ausente.status, 404); assert.equal(ausente.headers.get('cache-control'), 'no-store');
  globalThis.fetch = async (_input, init) => {
    assert.equal(new Headers(init?.headers).get('range'), 'bytes=0-3');
    return new Response('%PDF', { status: 206, headers: { 'content-range': 'bytes 0-3/10', 'content-length': '4' } });
  };
  const parcial = await GET(new Request('https://itatame.com.br', { headers: { Range: 'bytes=0-3' } }), ctx('itatame', 'a'.repeat(64) + '.pdf'));
  assert.equal(parcial.status, 206); assert.equal(parcial.headers.get('content-range'), 'bytes 0-3/10');
  assert.equal(parcial.headers.get('cdn-cache-control'), 'no-store');
}));

test('migração só aceita URLs públicas do projeto, nunca links assinados ou hosts externos', () => {
  const base = 'https://fixture.supabase.co';
  assert.ok(origemPublicaSupabase(base + '/storage/v1/object/public/avatars/foto.webp', base));
  for (const url of [base + '/storage/v1/object/sign/avatars/foto.webp?token=segredo', base + '/storage/v1/object/public/privado/foto.webp', 'https://outro.test/storage/v1/object/public/avatars/foto.webp', base + '/storage/v1/object/public/avatars/%2e%2e%2ffoto.webp']) {
    assert.equal(origemPublicaSupabase(url, base), null);
  }
});

test('domínio próprio do R2 é opcional e preserva URLs estáveis sem URLs de desenvolvimento', () => {
  const antes = process.env.R2_ITATAME_PUBLIC_BASE_URL;
  try {
    process.env.R2_ITATAME_PUBLIC_BASE_URL = 'https://midia.itatame.com.br';
    assert.equal(enderecoMidiaPublica(arquivo, 'itatame'), 'https://midia.itatame.com.br/midia-publica/v1/' + arquivo);
    process.env.R2_ITATAME_PUBLIC_BASE_URL = 'http://inseguro.test';
    assert.throws(() => enderecoMidiaPublica(arquivo, 'itatame'));
  } finally { if (antes === undefined) delete process.env.R2_ITATAME_PUBLIC_BASE_URL; else process.env.R2_ITATAME_PUBLIC_BASE_URL = antes; }
});

test('upload exige login e autorização de organizador para arquivos do evento', async () => simular(async () => {
  let puts = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === 'r2.test') { puts++; return new Response(null); }
    if (url.pathname.endsWith('/user')) return Response.json({ id: 'atleta' });
    if (url.pathname.endsWith('/organizadores')) return Response.json(null);
    if (url.pathname.endsWith('/atletas')) return Response.json({ role: 'atleta' });
    throw new Error('Consulta inesperada: ' + url.pathname + String(init?.method));
  };
  const pedido = (tipo: string, auth = true) => {
    const form = new FormData(); form.set('tipo', tipo); form.set('file', new File(['%PDF-1.7'], 'arquivo.pdf', { type: 'application/pdf' }));
    return new Request('https://itatame.com.br/api/midia-publica/upload', { method: 'POST', body: form, headers: auth ? { Authorization: 'Bearer teste' } : {} });
  };
  assert.equal((await POST(pedido('documento', false))).status, 401);
  assert.equal((await POST(pedido('documento'))).status, 403);
  assert.equal((await POST(pedido('invalido'))).status, 400);
  assert.equal(puts, 0);
}));

test('organizador envia banner ao iTatame e fotógrafo envia avatar ao Retratt, sem alterar perfis alheios', async () => simular(async () => {
  const destinos: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === 'r2.test') { assert.equal(init?.method, 'PUT'); destinos.push(url.pathname); return new Response(null); }
    assert.equal(init?.method || 'GET', 'GET', 'upload não concede edição de perfis no banco');
    if (url.pathname.endsWith('/user')) return Response.json({ id: 'organizador' });
    if (url.pathname.endsWith('/organizadores')) return Response.json({ id: 'org', status: 'aprovado' });
    if (url.pathname.endsWith('/atletas')) return Response.json(null);
    throw new Error('Consulta inesperada: ' + url.pathname);
  };
  const bytes = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#aaaaaa' } }).png().toBuffer();
  for (const [tipo, escopo] of [['banner', 'itatame'], ['avatar', 'retratt']]) {
    const form = new FormData(); form.set('tipo', tipo); form.set('escopo', escopo);
    form.set('file', new File([new Uint8Array(bytes)], 'foto.png', { type: 'image/png' }));
    const r = await POST(new Request('https://itatame.com.br/api/midia-publica/upload', { method: 'POST', body: form, headers: { Authorization: 'Bearer fixture' } }));
    assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'private, no-store');
    assert.match((await r.json()).publicUrl, new RegExp('/api/midia-publica/' + escopo + '/'));
  }
  assert.match(destinos[0], /^\/itatame-separado\//); assert.match(destinos[1], /^\/retratt-privado\//);
}));
