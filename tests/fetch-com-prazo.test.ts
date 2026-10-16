import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarFetchComPrazo } from '../app/lib/fetch-com-prazo';
import { createClient } from '@supabase/supabase-js';

test('interrompe autenticação travada e permite nova tentativa sem apagar sessão', async () => {
  let chamadas = 0;
  let signal: AbortSignal | undefined | null;
  const buscar = criarFetchComPrazo(async (_, init) => {
    chamadas++;
    signal = init?.signal;
    if (chamadas === 1) return new Promise<Response>(() => {});
    return Response.json({ access_token: 'sessao-preservada' });
  }, 20);
  await assert.rejects(buscar('https://teste.test/auth/v1/token'), { name: 'TimeoutError' });
  assert.equal(signal?.aborted, true);
  assert.deepEqual(await (await buscar('https://teste.test/auth/v1/token')).json(), { access_token: 'sessao-preservada' });
});

test('limita resposta cujo corpo parou após os cabeçalhos', async () => {
  const buscar = criarFetchComPrazo(async () => new Response(new ReadableStream({ start() {} })), 20);
  await assert.rejects(buscar('https://teste.test/rest/v1/eventos'), { name: 'TimeoutError' });
});

test('gravação com resposta perdida não é reenviada automaticamente', async () => {
  let chamadas = 0;
  const buscar = criarFetchComPrazo(async () => { chamadas++; return new Promise<Response>(() => {}); }, 20);
  await assert.rejects(buscar('https://teste.test/rest/v1/chaves', { method: 'PATCH', body: '{}' }), { name: 'TimeoutError' });
  assert.equal(chamadas, 1);
});

test('preserva cancelamento do chamador, códigos de erro e conteúdo', async () => {
  const controller = new AbortController();
  controller.abort();
  const buscar = criarFetchComPrazo(async (_, init) => {
    assert.equal(init?.signal?.aborted, true);
    return Response.json({ message: 'Sem autorização' }, { status: 403, headers: { 'x-teste': 'ok' } });
  });
  const resposta = await buscar('https://teste.test/rest/v1/eventos', { signal: controller.signal });
  assert.equal(resposta.status, 403);
  assert.equal(resposta.headers.get('x-teste'), 'ok');
  assert.deepEqual(await resposta.json(), { message: 'Sem autorização' });
});

test('não altera upload/download de fotos', async () => {
  const resposta = new Response('foto');
  const buscar = criarFetchComPrazo(async () => resposta, 1);
  assert.equal(await buscar('https://teste.test/storage/v1/object/fotos/foto.jpg'), resposta);
});

test('SDK renova sessão perto de expirar após falha de rede e libera consultas e login', async () => {
  const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'teste@example.test' };
  const token = (exp: number) => [{ alg: 'HS256' }, { sub: user.id, exp, role: 'authenticated' }, {}].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
  const expira = Math.floor(Date.now() / 1000);
  const registros = new Map([['teste-conexao', JSON.stringify({ user, access_token: token(expira + 20), refresh_token: 'refresh-ficticio', expires_at: expira + 20, token_type: 'bearer' })]]);
  let renovacoes = 0;
  let consultas = 0;
  const buscar = criarFetchComPrazo(async (input) => {
    const url = String(input);
    if (url.includes('/auth/v1/token')) {
      renovacoes++;
      if (renovacoes === 1) return new Promise<Response>(() => {});
      return Response.json({ user, access_token: token(expira + 3600), refresh_token: 'refresh-ficticio', expires_in: 3600, token_type: 'bearer' });
    }
    if (url.includes('/auth/v1/user')) return Response.json(user);
    consultas++;
    return Response.json([{ id: 'evento-ficticio' }]);
  }, 30);
  const cliente = createClient('https://teste-conexao.supabase.co', 'fixture', {
    auth: { storageKey: 'teste-conexao', detectSessionInUrl: false, storage: {
      getItem: key => registros.get(key) ?? null,
      setItem: (key, value) => { registros.set(key, value); },
      removeItem: key => { registros.delete(key); },
    } },
    global: { fetch: buscar },
  });
  let limite: ReturnType<typeof setTimeout> | undefined;
  try {
    const resultado = await Promise.race([
      cliente.from('eventos').select('id'),
      new Promise<never>((_, reject) => { limite = setTimeout(() => reject(new Error('SDK permaneceu bloqueado')), 3000); }),
    ]);
    assert.equal(resultado.error, null);
    assert.equal(consultas, 1);
    assert.equal(renovacoes, 2);
    assert.ok(registros.has('teste-conexao'));
    const login = await cliente.auth.signInWithPassword({ email: user.email, password: 'ficticio' });
    assert.equal(login.error, null);
  } finally {
    clearTimeout(limite);
    await cliente.auth.stopAutoRefresh();
  }
});
