import assert from 'node:assert/strict';
import test from 'node:test';
import type { AlunoSemVinculo } from '../app/lib/alunos-sugeridos';
import { GET, POST } from '../app/api/professor/alunos-sugeridos/route';

const professor = { user_id: 'prof-eber', nome: 'Eber Godofredo', equipe: 'AAMEP', academia: 'CT Eber', role: 'professor' };
const aluno: AlunoSemVinculo = { id: 408, user_id: 'aluno', nome: 'Aluma Dias', professor: 'Ebarson Amaro', professor_id: null, equipe: 'AAMEP', academia: '', role: 'atleta' };

async function simular(opcoes: { professor?: typeof professor | null; aluno?: typeof aluno; concorrencia?: boolean; segundaPagina?: boolean }, verificar: (writes: unknown[], consultas: URL[]) => Promise<void>) {
  const fetchOriginal = globalThis.fetch;
  const ambienteOriginal = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-ficticia-teste';
  const writes: unknown[] = [];
  const consultas: URL[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, 'https://supabase.test', 'Teste nunca deve acessar serviços reais');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: professor.user_id, is_anonymous: false });
    assert.equal(url.pathname, '/rest/v1/atletas', 'Nenhuma inscrição ou outra tabela deve ser alterada');
    consultas.push(url);
    if (init?.method === 'PATCH') {
      writes.push(JSON.parse(String(init.body)));
      assert.equal(url.searchParams.get('id'), 'eq.408');
      assert.equal(url.searchParams.get('professor_id'), 'is.null');
      assert.equal(url.searchParams.get('professor'), 'eq.Ebarson Amaro');
      return Response.json(opcoes.concorrencia ? null : { id: aluno.id });
    }
    if (url.searchParams.has('user_id')) return Response.json(opcoes.professor === null ? [] : [opcoes.professor || professor]);
    if (url.searchParams.has('id')) return Response.json([opcoes.aluno || aluno]);
    if (opcoes.segundaPagina && url.searchParams.get('offset') === '0') {
      return Response.json(Array.from({ length: 500 }, (_, i) => ({ ...aluno, id: i + 1, professor: 'Jefferson' })));
    }
    return Response.json([opcoes.aluno || aluno]);
  };
  try { await verificar(writes, consultas); }
  finally {
    globalThis.fetch = fetchOriginal;
    for (const [key, value] of [['NEXT_PUBLIC_SUPABASE_URL', ambienteOriginal.url], ['SUPABASE_SERVICE_ROLE_KEY', ambienteOriginal.key]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
  }
}

function requisicao(body: unknown) {
  return new Request('http://localhost/api/professor/alunos-sugeridos', {
    method: 'POST', headers: { Authorization: 'Bearer token-teste', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const confirmacao = { aluno, professor, confirmado: true };

test('API exige autenticação e perfil de professor', async () => {
  assert.equal((await GET(new Request('http://localhost/api/professor/alunos-sugeridos'))).status, 401);
  await simular({ professor: { ...professor, role: 'atleta' } }, async writes => {
    assert.equal((await POST(requisicao(confirmacao))).status, 403);
    assert.equal(writes.length, 0);
  });
});

test('API exige equipe e academia salvas antes de corrigir alunos', async () => {
  await simular({ professor: { ...professor, equipe: 'Independente' } }, async writes => {
    assert.equal((await POST(requisicao(confirmacao))).status, 400);
    assert.equal(writes.length, 0);
  });
});

test('API busca todas as páginas sem expor campos privados', async () => {
  await simular({ segundaPagina: true }, async (_, consultas) => {
    const resposta = await GET(new Request('http://localhost/api/professor/alunos-sugeridos', { headers: { Authorization: 'Bearer token-teste' } }));
    assert.equal(resposta.status, 200);
    assert.deepEqual((await resposta.json()).alunos, [aluno]);
    assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
    assert.ok(consultas.some(url => url.searchParams.get('offset') === '500'));
    assert.ok(consultas.every(url => !/cpf|telefone|email/.test(url.searchParams.get('select') || '')));
  });
});

test('API corrige apenas o aluno confirmado com os dados salvos do professor', async () => {
  await simular({}, async writes => {
    assert.equal((await POST(requisicao(confirmacao))).status, 200);
    assert.deepEqual(writes, [{ professor_id: professor.user_id, professor: professor.nome, equipe: professor.equipe, academia: professor.academia }]);
  });
});

test('API exige confirmação explícita e recusa vínculo existente', async () => {
  await simular({}, async writes => {
    assert.equal((await POST(requisicao({ ...confirmacao, confirmado: false }))).status, 400);
    assert.equal(writes.length, 0);
  });
  await simular({ aluno: { ...aluno, professor_id: 'outro-professor' } }, async writes => {
    assert.equal((await POST(requisicao(confirmacao))).status, 409);
    assert.equal(writes.length, 0);
  });
});

test('API recusa dados alterados depois da busca', async () => {
  await simular({ aluno: { ...aluno, equipe: 'Nova equipe' } }, async writes => {
    assert.equal((await POST(requisicao(confirmacao))).status, 409);
    assert.equal(writes.length, 0);
  });
  await simular({ professor: { ...professor, academia: 'Outro CT' } }, async writes => {
    assert.equal((await POST(requisicao(confirmacao))).status, 409);
    assert.equal(writes.length, 0);
  });
});

test('API trata disputa por aluno como conflito sem informar sucesso', async () => {
  await simular({ concorrencia: true }, async () => {
    assert.equal((await POST(requisicao(confirmacao))).status, 409);
  });
});
