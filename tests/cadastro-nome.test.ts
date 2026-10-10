import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/cadastro/route';

function requisicao(perfil: string, nome?: string) {
  const form = new FormData();
  for (const [chave, valor] of Object.entries({ perfil, email: 'titular@example.test', password: 'senha-ficticia', cpf: '52998224725', telefone: '65999990000', nascimento: '1985-01-01' })) form.set(chave, valor);
  if (nome !== undefined) form.set('nome', nome);
  return new Request('http://localhost/api/cadastro', { method: 'POST', body: form });
}

test('recusa nome ausente, vazio ou só espaços antes de criar qualquer conta', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Cadastro inválido não deve acessar serviços externos'); };
  try {
    for (const perfil of ['atleta', 'professor', 'organizador']) {
      for (const nome of [undefined, '', '   ']) {
        const resposta = await POST(requisicao(perfil, nome));
        assert.equal(resposta.status, 400);
        assert.match((await resposta.json()).error, /nome completo/);
      }
    }
  } finally { globalThis.fetch = original; }
});

for (const perfil of ['atleta', 'professor']) test(`grava nome do ${perfil} no perfil inicial e metadados da conta`, async () => {
  const original = globalThis.fetch;
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'chave-ficticia', RESEND_API_KEY: 're_ficticia' };
  const anteriores = Object.fromEntries(Object.keys(env).map(chave => [chave, process.env[chave]]));
  Object.assign(process.env, env);
  let nomePerfil = '';
  let nomeConta = '';
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assert.ok(['https://supabase.test', 'https://api.resend.com'].includes(url.origin), 'Sem acesso a serviços reais');
    if (url.pathname === '/rest/v1/atletas') {
      if (init?.method === 'POST') { nomePerfil = JSON.parse(String(init.body)).nome; return new Response(null, { status: 201 }); }
      return Response.json([]);
    }
    if (url.pathname === '/auth/v1/admin/users') {
      nomeConta = JSON.parse(String(init?.body)).user_metadata.nome;
      return Response.json({ id: 'conta-ficticia', email: 'titular@example.test' });
    }
    if (url.pathname === '/auth/v1/admin/generate_link') return Response.json({ id: 'conta-ficticia', email: 'titular@example.test', action_link: 'https://supabase.test/auth/v1/verify?token=ficticio', verification_type: 'signup' });
    if (url.pathname === '/emails') return Response.json({ id: 'email-ficticio' });
    throw new Error(`Requisição inesperada no teste: ${url.pathname}`);
  };
  try {
    const resposta = await POST(requisicao(perfil, '  Maria da Silva  '));
    assert.equal(resposta.status, 200, JSON.stringify(await resposta.json()));
    assert.equal(nomePerfil, 'Maria da Silva');
    assert.equal(nomeConta, 'Maria da Silva');
  } finally {
    globalThis.fetch = original;
    for (const [chave, valor] of Object.entries(anteriores)) { if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor; }
  }
});
