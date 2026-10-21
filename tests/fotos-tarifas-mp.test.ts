import test from 'node:test';
import assert from 'node:assert/strict';
import { conferirTarifaMP } from '../app/lib/fotos-tarifas-mp';
import { GET } from '../app/api/fotos/admin/tarifas/route';

const pedido = { id: 'pedido-a', evento_id: '11111111-1111-4111-8111-111111111111', provedor_payment_id: '123', total_centavos: 10000 };
const pagamento = () => ({ id: 123, external_reference: 'foto_pedido:pedido-a', collector_id: 'vendedor', transaction_amount: 100, status: 'approved',
  fee_details: [{ type: 'mercadopago_fee', amount: 4.99 }, { type: 'application_fee', amount: 5 }], transaction_details: { net_received_amount: 90.01 } });
test('tarifa real separa comissão e mantém o líquido do MP sem segunda dedução', () => {
  assert.deepEqual(conferirTarifaMP(pedido, pagamento(), 'vendedor'), { pedidoId: pedido.id, galeriaId: pedido.evento_id, tarifaCentavos: 499, liquidoCentavos: 9001 });
  assert.equal(conferirTarifaMP(pedido, { ...pagamento(), fee_details: [] }, 'vendedor').tarifaCentavos, 0);
  assert.equal(conferirTarifaMP(pedido, { ...pagamento(), fee_details: null, transaction_details: {} }, 'vendedor').liquidoCentavos, null);
  assert.equal(conferirTarifaMP(pedido, { ...pagamento(), fee_details: null }, 'vendedor').tarifaCentavos, null);
  for (const alteracao of [{ id: 456 }, { collector_id: 'outro' }, { external_reference: 'outro' }, { transaction_amount: 99 }, { status: 'refunded' }])
    assert.throws(() => conferirTarifaMP(pedido, { ...pagamento(), ...alteracao }, 'vendedor'));
});

test('relatório MP exige escopo do organizador, pagina só diárias pagas e nunca grava', async () => {
  const vars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const antes = Object.fromEntries(vars.map(k => [k, process.env[k]])), fetchAntes = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'ficticio'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'ficticio';
  let pagamentos = 0, modo = 'normal';
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); assert.equal(init?.method || 'GET', 'GET');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'org', user_metadata: {} });
    if (url.pathname === '/rest/v1/foto_eventos') { assert.equal(url.searchParams.get('organizador_user_id'), 'eq.org'); return Response.json([{ id: pedido.evento_id }]); }
    if (url.pathname === '/rest/v1/foto_pedidos') {
      assert.equal(url.searchParams.get('organizador_user_id'), 'eq.org'); assert.equal(url.searchParams.get('status'), 'eq.pago');
      assert.equal(url.searchParams.get('modelo_recebimento'), 'eq.diaria_organizador');
      return new Response(JSON.stringify([pedido]), { headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/21' } });
    }
    if (url.pathname === '/rest/v1/foto_mp_organizadores') { assert.equal(url.searchParams.get('user_id'), 'eq.org'); return Response.json({ mp_user_id: 'vendedor', mp_access_token: 'token-fixture' }); }
    if (url.hostname === 'api.mercadopago.com') {
      pagamentos++; assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer token-fixture');
      if (modo === 'falha') return new Response('', { status: 503 });
      return Response.json(pagamento());
    }
    throw Error('Rede não simulada: ' + url.pathname);
  };
  const req = (busca = '', login = true) => new Request('https://retratt.test/api/fotos/admin/tarifas' + busca, { headers: login ? { Authorization: 'Bearer fixture' } : {} });
  try {
    assert.equal((await GET(req('', false))).status, 401);
    assert.equal((await GET(req('?inicio=-1'))).status, 400);
    assert.equal((await GET(req('?galeria=22222222-2222-4222-8222-222222222222'))).status, 403); assert.equal(pagamentos, 0);
    const r = await GET(req()); assert.equal(r.status, 200); const d = await r.json();
    assert.equal(d.proximo, 1); assert.equal(d.total, 21); assert.equal(d.pedidos[0].tarifaCentavos, 499); assert.equal(d.pedidos[0].liquidoCentavos, 9001);
    assert(!JSON.stringify(d).includes('token-fixture')); assert(r.headers.get('Cache-Control')?.includes('no-store'));
    modo = 'falha'; const parcial = await (await GET(req())).json(); assert.equal(parcial.pedidos[0].liquidoCentavos, null); assert.equal(parcial.pedidos[0].tarifaCentavos, null);
  } finally { globalThis.fetch = fetchAntes; for (const v of vars) { if (antes[v] == null) delete process.env[v]; else process.env[v] = antes[v]; } }
});
