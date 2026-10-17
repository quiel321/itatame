import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const requerer = createRequire(import.meta.url);
const modulo = requerer('node:module'), resolver = modulo._resolveFilename;
let POST: typeof import('../app/api/fotos/admin/royalty-fotografo/route').POST;
let GET: typeof import('../app/api/fotos/admin/resumo-galerias/route').GET;
try {
  modulo._resolveFilename = function(nome: string, ...args: unknown[]) { return resolver.call(this, nome === 'server-only' ? 'next/dist/compiled/server-only/empty' : nome, ...args); };
  POST = requerer('../app/api/fotos/admin/royalty-fotografo/route').POST;
  GET = requerer('../app/api/fotos/admin/resumo-galerias/route').GET;
} finally { modulo._resolveFilename = resolver; }

test('diária sem MP não grava; consulta distingue ausência de conta de falha e não expõe credenciais', async () => {
  const original = globalThis.fetch;
  const antes = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
  let conta: Record<string, unknown> | null = null, falha = false, escritas = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'fixture.supabase.co');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'organizador', email: 'qa@example.test' });
    if (url.pathname === '/rest/v1/foto_mp_organizadores') {
      assert.equal(url.searchParams.get('user_id'), 'eq.organizador');
      return falha ? Response.json({ message: 'Falha fictícia' }, { status: 500 }) : Response.json(conta);
    }
    if (url.pathname === '/rest/v1/foto_eventos') return Response.json(url.searchParams.get('select') === 'id' ? [] : { id: 'galeria', organizador_user_id: 'organizador' });
    if (url.pathname === '/rest/v1/foto_evento_fotografos' && init?.method === 'PATCH') {
      escritas++;
      assert.equal(url.searchParams.get('evento_id'), 'eq.galeria');
      assert.equal(url.searchParams.get('fotografo_id'), 'eq.fotografo');
      return Response.json({ evento_id: 'galeria', fotografo_id: 'fotografo', ...JSON.parse(String(init.body)) });
    }
    throw Error('Operação inesperada: ' + url.pathname);
  };
  const consulta = (autenticado = true) => new Request('https://retratt.test/api/fotos/admin/resumo-galerias', { headers: autenticado ? { Authorization: 'Bearer fixture' } : {} });
  const salvar = () => POST(new Request('https://retratt.test/api/fotos/admin/royalty-fotografo', { method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ eventoId: 'galeria', fotografoId: 'fotografo', modeloRecebimento: 'diaria_organizador' }) }));
  try {
    assert.equal((await GET(consulta(false))).status, 401);
    assert.equal((await (await GET(consulta())).json()).mercadoPagoOrganizadorConectado, false);
    const rejeitado = await salvar(); assert.equal(rejeitado.status, 409);
    const aviso = await rejeitado.json(); assert.equal(aviso.code, 'MP_CONEXAO_NECESSARIA'); assert.match(aviso.error, /Diária não salva/); assert.equal(escritas, 0);
    falha = true; const erro = await GET(consulta()); assert.equal(erro.status, 503); assert.equal('mercadoPagoOrganizadorConectado' in await erro.json(), false);
    falha = false; conta = { mp_connected_at: '2026-10-17', mp_access_token: 'privado-fixture', mp_public_key: 'publica-fixture' };
    const conectado = await GET(consulta()); const dados = await conectado.json(); assert.equal(dados.mercadoPagoOrganizadorConectado, true); assert.ok(!JSON.stringify(dados).includes('fixture'));
    assert.equal((await salvar()).status, 200); assert.equal(escritas, 1);
    conta = { mp_connected_at: '2026-10-17' }; assert.equal((await (await GET(consulta())).json()).mercadoPagoOrganizadorConectado, false);
  } finally {
    globalThis.fetch = original;
    if (antes.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = antes.url;
    if (antes.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = antes.key;
  }
});
