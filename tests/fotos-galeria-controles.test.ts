import assert from 'node:assert/strict';
import test from 'node:test';
import { GET, PATCH } from '../app/api/fotos/galeria/em-breve/route';
import { edicaoGaleriaConfirmada } from '../app/lib/fotos-confirmar-edicao';

test('confirma os campos editados mesmo se o JSON do banco ordenar as propriedades diferentemente', () => {
  const esperado = { nome: 'Galeria', em_breve: false, descontos_progressivos: [{ quantidade: 10, percentual: 20 }], capa_url: null };
  const salvo = { id: 'id', ...esperado, descontos_progressivos: [{ percentual: 20, quantidade: 10 }] };
  assert.equal(edicaoGaleriaConfirmada(salvo, esperado), true);
  assert.equal(edicaoGaleriaConfirmada({ ...salvo, em_breve: true }, esperado), false);
  assert.equal(edicaoGaleriaConfirmada(null, esperado), false);
  assert.equal(edicaoGaleriaConfirmada({ ...salvo, descontos_progressivos: [{ quantidade: 10, percentual: 15 }] }, esperado), false);
});

test('em breve exige dono, altera apenas o aviso e repetir o estado não repete gravação', async () => {
  const original = globalThis.fetch;
  const env = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
  const id = '11111111-1111-4111-8111-111111111111';
  let userId = 'dono', organizador: string | null = null, ativo = true, escritas = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname !== 'fixture.supabase.co') throw Error('Rede externa bloqueada no teste');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: userId, email: 'qa@example.test' });
    if (url.pathname === '/rest/v1/foto_eventos') {
      assert.equal(url.searchParams.get('id'), `eq.${id}`);
      if (init?.method === 'PATCH') {
        const corpo = JSON.parse(String(init.body)); assert.deepEqual(Object.keys(corpo), ['em_breve']);
        if (organizador) assert.equal(url.searchParams.get('organizador_user_id'), `eq.${userId}`);
        else { assert.equal(url.searchParams.get('created_by'), `eq.${userId}`); assert.equal(url.searchParams.get('organizador_user_id'), 'is.null'); }
        ativo = corpo.em_breve; escritas++;
      }
      return Response.json({ id, em_breve: ativo, created_by: 'dono', organizador_user_id: organizador });
    }
    throw Error('Consulta inesperada');
  };
  const patch = (valor: unknown, login = true) => PATCH(new Request('https://retratt.test/api/fotos/galeria/em-breve', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(login ? { Authorization: 'Bearer fixture' } : {}) }, body: JSON.stringify({ galeriaId: id, emBreve: valor, nome: 'Não alterar', preco_padrao_centavos: 1 }) }));
  const get = () => GET(new Request(`https://retratt.test/api/fotos/galeria/em-breve?galeriaId=${id}`, { headers: { Authorization: 'Bearer fixture' } }));
  try {
    assert.equal((await patch(false, false)).status, 401);
    assert.equal((await patch('false')).status, 400);
    userId = 'colaborador'; assert.equal((await patch(false)).status, 404); assert.equal((await get()).status, 404); assert.equal(escritas, 0);
    userId = 'dono'; assert.equal((await patch(false)).status, 200); assert.equal(escritas, 1); assert.equal(ativo, false);
    const leitura = await (await get()).json(); assert.deepEqual(leitura, { galeria: { id, em_breve: false } });
    assert.equal((await patch(false)).status, 200); assert.equal(escritas, 1);
    organizador = 'organizador'; assert.equal((await patch(true)).status, 404); assert.equal(escritas, 1);
    userId = 'organizador'; assert.equal((await patch(true)).status, 200); assert.equal(escritas, 2);
  } finally {
    globalThis.fetch = original;
    if (env.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = env.url;
    if (env.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = env.key;
  }
});
