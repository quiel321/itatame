import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/cadastro/route';
import { PATCH } from '../app/api/professor/perfil/route';

const dados = { nome: 'Erick Murilo', equipe: 'AAMEP', academia: 'AAMEP', cpf: '52998224725', telefone: '65999990000', nascimento: '1985-01-01', peso: 80 };

test('cadastro inicial recusa equipe ou CT vazio antes de criar conta', async () => {
  const fetchAnterior = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Não criar conta ou enviar e-mail com cadastro incompleto'); };
  try {
    for (const campo of ['equipe', 'academia']) for (const valor of ['', '  ', 'Independente']) {
      const form = new FormData();
      for (const [key, value] of Object.entries({ ...dados, perfil: 'professor', email: 'erick@example.test', password: 'ficticia', [campo]: valor })) form.set(key, String(value));
      const resposta = await POST(new Request('http://localhost/api/cadastro', { method: 'POST', body: form }));
      assert.equal(resposta.status, 400);
      assert.match((await resposta.json()).error, /equipe e a academia/);
    }
  } finally { globalThis.fetch = fetchAnterior; }
});

test('salvamento valida professor no servidor e altera apenas a própria conta', async () => {
  assert.equal((await PATCH(new Request('http://localhost/api/professor/perfil', { method: 'PATCH' }))).status, 401);
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'ficticia' };
  const anteriores = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const fetchAnterior = globalThis.fetch;
  const writes: Record<string, unknown>[] = [];
  let role = 'professor';
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, 'https://supabase.test');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'erick', is_anonymous: false });
    assert.equal(url.pathname, '/rest/v1/atletas');
    assert.equal(url.searchParams.get('user_id'), 'eq.erick');
    if (init?.method === 'PATCH') {
      assert.equal(url.searchParams.get('role'), 'eq.professor');
      writes.push(JSON.parse(String(init.body)));
      return Response.json({ id: 426 });
    }
    return Response.json({ role });
  };
  const requisicao = (body: unknown) => new Request('http://localhost/api/professor/perfil', { method: 'PATCH', headers: { Authorization: 'Bearer teste', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    for (const campo of ['equipe', 'academia']) for (const valor of ['', '  ', 'Independente']) assert.equal((await PATCH(requisicao({ ...dados, [campo]: valor }))).status, 400);
    assert.equal(writes.length, 0);
    role = 'atleta';
    assert.equal((await PATCH(requisicao(dados))).status, 403);
    role = 'professor';
    assert.equal((await PATCH(requisicao({ ...dados, user_id: 'outra-conta', role: 'super-admin', academia: ' AAMEP ' }))).status, 200);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].equipe, 'AAMEP');
    assert.equal(writes[0].academia, 'AAMEP');
    assert.equal(writes[0].peso, 80);
    assert.equal(writes[0].user_id, undefined);
    assert.equal(writes[0].role, undefined);
  } finally {
    globalThis.fetch = fetchAnterior;
    for (const [key, value] of Object.entries(anteriores)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
