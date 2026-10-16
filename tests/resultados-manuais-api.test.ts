import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/organizador/resultados/route';

test('API confere autorização, atletas e hierarquia antes de chamar o registro atômico', async () => {
  const fetchOriginal = globalThis.fetch;
  const urlOriginal = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keyOriginal = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture';
  let autorizado = true;
  let chamadas = 0;
  const primeira = { id: 'primeira', id_visual: '1', categoria: 'Adulto', faixa: 'Branca', fase: 'Semifinal', proxima_luta: '999', atleta_1: 'Ana', atleta_2: 'Bia', atleta_1_id: 1, atleta_2_id: 2, vencedor: null as string | null, vencedor_id: null as number | null, status_luta: 'agendada' };
  const final = { ...primeira, id: 'final', id_visual: '999', fase: 'Final', proxima_luta: null };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    let data: unknown;
    if (url.pathname === '/auth/v1/user') data = { id: 'organizador', aud: 'authenticated', role: 'authenticated', email: 'qa@example.com', is_anonymous: false };
    else if (url.pathname === '/rest/v1/eventos') data = autorizado ? { id: 'evento' } : null;
    else if (url.pathname === '/rest/v1/chaves') data = url.searchParams.has('id') ? final : [primeira, final];
    else if (url.pathname === '/rest/v1/rpc/registrar_resultado_manual') {
      chamadas++;
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer fixture-token');
      return new Response(null, { status: 204 });
    } else throw new Error('Consulta inesperada: ' + url.pathname);
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  };
  const pedido = (extra = {}, token = true) => new Request('http://localhost/api/organizador/resultados', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer fixture-token' } : {}) },
    body: JSON.stringify({ eventoId: 'evento', lutaId: 'final', atleta1: 1, atleta2: 2, vencedor: 1, metodo: 'pontos', motivo: 'Súmula conferida', ...extra }),
  });
  try {
    assert.equal((await POST(pedido({}, false))).status, 401);
    autorizado = false;
    assert.equal((await POST(pedido())).status, 403);
    autorizado = true;
    assert.equal((await POST(pedido({ atleta1: 3 }))).status, 409);
    const bloqueada = await POST(pedido());
    assert.equal(bloqueada.status, 409);
    assert.match((await bloqueada.json()).error, /lutas anteriores/);
    assert.equal(chamadas, 0);
    primeira.status_luta = 'concluida'; primeira.vencedor = 'Ana'; primeira.vencedor_id = 1;
    assert.equal((await POST(pedido({ vencedor: 999 }))).status, 400);
    assert.equal((await POST(pedido())).status, 200);
    assert.equal(chamadas, 1);
  } finally {
    globalThis.fetch = fetchOriginal;
    if (urlOriginal === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = urlOriginal;
    if (keyOriginal === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = keyOriginal;
  }
});
