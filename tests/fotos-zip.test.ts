import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { criarZipFotos, nomeFotoZip, linkZipPedido, acessoZipValido } from '../app/lib/fotos-zip';
const require = createRequire(import.meta.url);
// Leitor independente que já vem com a dependência jspdf do projeto.
const { unzipSync } = require('fflate') as { unzipSync: (bytes: Uint8Array) => Record<string, Uint8Array> };

test('ZIP preserva os bytes, nomes UTF-8 e arquivos homônimos sem juntar tudo na memória do servidor', async () => {
  const original = new Uint8Array([0, 255, 12, 32, 1, 90]);
  let abertas = 0;
  const stream = criarZipFotos([
    { nome: nomeFotoZip('ação.jpg', 0, 'a'), abrir: async () => { abertas++; return new Response(original); } },
    { nome: nomeFotoZip('ação.jpg', 1, 'b'), abrir: async () => { abertas++; return new Response('123456789'); } },
  ]);
  assert.ok(abertas <= 1);
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer()), arquivos = unzipSync(bytes);
  assert.deepEqual(Object.keys(arquivos), ['001-ação.jpg', '002-ação.jpg']);
  assert.deepEqual(arquivos['001-ação.jpg'], original);
  assert.equal(new TextDecoder().decode(arquivos['002-ação.jpg']), '123456789');
  const b = Buffer.from(bytes); assert.ok(b.includes(Buffer.from([0x26, 0x39, 0xf4, 0xcb])), 'CRC32 padrão de 123456789');
  assert.ok(!nomeFotoZip('../../escape.jpg', 0, 'id').includes('/'));
});

test('ZIP falha em original indisponível e ao ultrapassar o limite; cancelamento não abre o próximo arquivo', async () => {
  await assert.rejects(() => new Response(criarZipFotos([{ nome: 'x.jpg', abrir: async () => new Response(null, { status: 404 }) }])).arrayBuffer(), /indisponível/);
  await assert.rejects(() => new Response(criarZipFotos([{ nome: 'x.jpg', abrir: async () => new Response('x', { headers: { 'Content-Length': String(3 * 1024 ** 3) } }) }])).arrayBuffer(), /2 GB/);
  let proximo = false;
  const reader = criarZipFotos([{ nome: 'a.jpg', abrir: async () => new Response('a') }, { nome: 'b.jpg', abrir: async () => { proximo = true; return new Response('b'); } }]).getReader();
  await reader.read(); await reader.cancel(); assert.equal(proximo, false);
});

test('link de ZIP expira e não serve para outro pedido nem para uma assinatura adulterada', () => {
  const antes = process.env.FOTOS_ACESSO_SECRET; process.env.FOTOS_ACESSO_SECRET = 'segredo-ficticio';
  try {
    const u = new URL(linkZipPedido('pedido-a'), 'https://fixture.test');
    assert.ok(acessoZipValido('pedido-a', u.searchParams.get('exp'), u.searchParams.get('assinatura')));
    assert.equal(acessoZipValido('pedido-b', u.searchParams.get('exp'), u.searchParams.get('assinatura')), false);
    assert.equal(acessoZipValido('pedido-a', '1', u.searchParams.get('assinatura')), false);
    assert.equal(acessoZipValido('pedido-a', u.searchParams.get('exp'), u.searchParams.get('assinatura') + 'x'), false);
  } finally { if (antes === undefined) delete process.env.FOTOS_ACESSO_SECRET; else process.env.FOTOS_ACESSO_SECRET = antes; }
});
