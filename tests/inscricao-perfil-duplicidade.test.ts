import assert from 'node:assert/strict';
import test from 'node:test';
import { camposPerfilInscricao } from '../app/lib/perfil-inscricao';
import { POST as conferirCpf } from '../app/api/inscricoes/conferir-cpf/route';
import { POST as equipeAtleta } from '../app/api/equipes/atleta/route';

const perfil = { id: 10, user_id: 'titular', responsavel_id: null as string | null, nome: 'Professor teste', equipe: 'Equipe teste', academia: 'CT teste', faixa: 'Preta', professor: '', role: 'professor', cpf: '123.456.789-00' };
const eventoId = '7885981f-90e7-41ad-86f2-2bd328a7088c';
function req(path: string) { return new Request(`http://localhost/api/${path}`, { method: 'POST', headers: { Authorization: 'Bearer ficticio', 'Content-Type': 'application/json' }, body: JSON.stringify({ eventoId, atletaId: perfil.id }) }); }

test('professor compete sem indicar outro professor, mantendo academia e equipe obrigatórias', () => {
  assert.deepEqual(camposPerfilInscricao(perfil), []);
  assert.deepEqual(camposPerfilInscricao({ ...perfil, role: 'atleta' }), ['professor']);
  assert.deepEqual(camposPerfilInscricao({ ...perfil, academia: '', equipe: 'Independente' }), ['equipe', 'academia']);
  assert.deepEqual(camposPerfilInscricao({ ...perfil, nome: ' ', faixa: '' }), ['nome', 'faixa']);
});

async function simular(opcoes: { perfil?: typeof perfil; ativa?: boolean; falha?: boolean }, run: (queries: URL[]) => Promise<void>) {
  const original = globalThis.fetch;
  const env = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'ficticia';
  const queries: URL[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
    assert.equal(url.origin, 'https://supabase.test');
    assert.ok(!init?.method || init.method === 'GET', 'Conferência não pode gravar registros');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'titular', is_anonymous: false });
    queries.push(url);
    if (url.pathname === '/rest/v1/atletas') {
      if (url.searchParams.has('cpf')) return Response.json([{ id: 10 }, { id: 11 }]);
      return Response.json([opcoes.perfil || perfil]);
    }
    if (url.pathname === '/rest/v1/inscricoes') {
      assert.equal(url.searchParams.get('evento_id'), `eq.${eventoId}`);
      assert.equal(url.searchParams.get('or'), '(estorno_status.is.null,estorno_status.neq.estornado)');
      assert.equal(url.searchParams.get('atleta_id'), 'in.(10,11)');
      assert.equal(url.searchParams.has('email'), false, 'E-mail compartilhado não identifica atleta');
      if (opcoes.falha) return Response.json({ message: 'falha fictícia', code: '500' }, { status: 500 });
      return Response.json(opcoes.ativa ? [{ id: 99 }] : []);
    }
    if (url.pathname === '/rest/v1/eventos') return Response.json([{ id: eventoId }]);
    if (url.pathname === '/rest/v1/equipes_evento') return Response.json([{ id: 'equipe-teste', nome: perfil.equipe, ativa: true }]);
    throw Error('Consulta inesperada: ' + url.pathname);
  };
  try { await run(queries); }
  finally {
    globalThis.fetch = original;
    if (env.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = env.url;
    if (env.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = env.key;
  }
}

test('CPF consulta somente inscrições ativas e não bloqueia histórico estornado', async () => {
  for (const ativa of [false, true]) await simular({ ativa }, async () => {
    const r = await conferirCpf(req('inscricoes/conferir-cpf'));
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { inscrito: ativa });
  });
});
test('conferência de CPF exige sessão e propriedade do atleta; responsável pode consultar dependente', async () => {
  assert.equal((await conferirCpf(new Request('http://localhost/api/inscricoes/conferir-cpf', { method: 'POST' }))).status, 401);
  await simular({ perfil: { ...perfil, user_id: 'outro' } }, async queries => {
    assert.equal((await conferirCpf(req('inscricoes/conferir-cpf'))).status, 403);
    assert.equal(queries.length, 1);
  });
  await simular({ perfil: { ...perfil, user_id: 'filho', responsavel_id: 'titular' } }, async () => {
    assert.equal((await conferirCpf(req('inscricoes/conferir-cpf'))).status, 200);
  });
});
test('falha de consulta não libera inscrição indevidamente', async () => {
  await simular({ falha: true }, async () => assert.equal((await conferirCpf(req('inscricoes/conferir-cpf'))).status, 500));
});
test('API de equipe permite professor competir sem professor e continua exigindo professor do aluno', async () => {
  await simular({}, async () => assert.equal((await equipeAtleta(req('equipes/atleta'))).status, 200));
  await simular({ perfil: { ...perfil, role: 'atleta' } }, async () => assert.equal((await equipeAtleta(req('equipes/atleta'))).status, 400));
});
