import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/super-admin/inscricoes-identificacao/route';

async function simular(role: string, verificar: (consultas: URL[]) => Promise<void>) {
  const original = globalThis.fetch;
  const urlOriginal = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chaveOriginal = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-ficticia';
  const consultas: URL[] = [];
  globalThis.fetch = async input => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, 'https://supabase.test');
    consultas.push(url);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'suporte', is_anonymous: false });
    if (url.searchParams.get('select') === 'role') return Response.json([{ role }]);
    if (url.pathname === '/rest/v1/inscricoes') {
      assert.equal(url.searchParams.get('id'), 'in.(408)');
      return Response.json([{ id: 408, atleta_id: 99, user_id: 'menor', idade: 12 }]);
    }
    if (url.searchParams.has('id')) {
      assert.equal(url.searchParams.get('id'), 'in.(99)');
      return Response.json([{ id: 99, user_id: 'menor', responsavel_id: 'adulto', nascimento: '2014-01-01' }]);
    }
    assert.equal(url.searchParams.get('user_id'), 'in.(adulto)');
    return Response.json([{ id: 1, user_id: 'adulto', nome: 'Maria', nascimento: '1985-01-01', telefone: '65999990000', email: 'adulto@example.test' }]);
  };
  try { await verificar(consultas); }
  finally {
    globalThis.fetch = original;
    if (urlOriginal === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = urlOriginal;
    if (chaveOriginal === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = chaveOriginal;
  }
}

function requisicao(ids: unknown = [408]) {
  return new Request('http://localhost/api/super-admin/inscricoes-identificacao', { method: 'POST', headers: { Authorization: 'Bearer token-teste', 'Content-Type': 'application/json' }, body: JSON.stringify({ inscricaoIds: ids }) });
}

test('identificação dos responsáveis exige sessão e super-admin', async () => {
  assert.equal((await POST(new Request('http://localhost/api/super-admin/inscricoes-identificacao', { method: 'POST' }))).status, 401);
  await simular('professor', async consultas => {
    assert.equal((await POST(requisicao())).status, 403);
    assert.equal(consultas.length, 2);
  });
});

test('API busca apenas responsáveis vinculados às inscrições pedidas e omite CPF e nascimento', async () => {
  await simular('super-admin', async () => {
    const resposta = await POST(requisicao());
    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await resposta.json(), { inscricoes: [{ id: 408, responsavel_nome: 'Maria', responsavel_contato: '65999990000 · adulto@example.test' }] });
  });
});

test('API limita consulta a 200 inscrições e recusa identificadores inválidos', async () => {
  await simular('super-admin', async () => {
    for (const ids of [[], Array(201).fill(408), ['408,999'], null]) assert.equal((await POST(requisicao(ids))).status, 400);
  });
});
