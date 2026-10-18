import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { assinarComboIa } from '../app/lib/fotos-combo-ia-servidor';
import { percentualComboIa } from '../app/lib/fotos-combo-ia';
import { POST as conferir } from '../app/api/fotos/combo-ia/conferir/route';
import { GET as configuracao, PATCH as salvarConfiguracao } from '../app/api/fotos/combo-ia/configuracao/route';
const requerer = createRequire(import.meta.url), modulo = requerer('node:module'), resolver = modulo._resolveFilename;
let preparar: typeof import('../app/api/fotos/pagamento/preparar/route').POST;
try { modulo._resolveFilename = function(nome: string, ...args: unknown[]) { return resolver.call(this, nome === 'server-only' ? 'next/dist/compiled/server-only/empty' : nome, ...args); }; preparar = requerer('../app/api/fotos/pagamento/preparar/route').POST; }
finally { modulo._resolveFilename = resolver; }
const eventoId = '11111111-1111-4111-8111-111111111111', orgId = '33333333-3333-4333-8333-333333333333';
const fotoId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;

test('conferência e cobrança do pacote usam os mesmos centavos e não aceitam token parcial ou desativado', async () => {
  const nomes = ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'], antes = nomes.map(n => process.env[n]);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'ficticia';
  const fetchAntes = globalThis.fetch;
  let quantidade = 15, ativo = true, gravacoes = 0, preferencia: { items: { unit_price: number }[] } | null = null, pedido: { total_centavos: number; desconto_centavos: number; vendas_fotografos: { totalCentavos: number }[] } | null = null;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input)), method = init?.method || 'GET';
    assert.ok(['fixture.supabase.co','api.mercadopago.com'].includes(u.hostname));
    if (u.pathname === '/auth/v1/user') return Response.json({ id: 'comprador', email: 'fixture@example.test', user_metadata: {} });
    if (u.pathname === '/rest/v1/foto_arquivos') {
      const filtro = u.searchParams.get('id') || '';
      const ids = [...Array.from({ length: quantidade }, (_, n) => fotoId(n)), fotoId(999)];
      return Response.json(ids.filter(id => filtro.includes(id)).map(id => ({ id, evento_id: eventoId, fotografo_id: id.endsWith('999') ? 'b' : 'a', preco_centavos: id.endsWith('999') ? 3999 : 999, mime_type: id.endsWith('999') ? 'video/mp4' : 'image/jpeg', status: 'publicada',
        foto_eventos: { id: eventoId, nome: 'Galeria', status: 'publicado', organizador_user_id: orgId, combo_ia_ativo: ativo, descontos_progressivos: [{ quantidade: 3, percentual: 10 }] }, fotografos: { id: 'a', nome: 'Fotógrafo', status: 'ativo' } })));
    }
    if (u.pathname === '/rest/v1/foto_evento_fotografos') return Response.json(['a','b'].map(fotografo_id => ({ fotografo_id, status: 'ativo', modelo_recebimento: 'diaria_organizador', comissao_organizador_percentual: 0 })));
    if (u.pathname === '/rest/v1/foto_mp_organizadores') return Response.json({ mp_access_token: 'ficticio', mp_public_key: 'publica-ficticia' });
    if (u.pathname === '/rest/v1/foto_pedidos' && method === 'POST') { gravacoes++; pedido = JSON.parse(String(init?.body)); return Response.json({ id: 'pedido-ficticio' }); }
    if (u.pathname === '/rest/v1/foto_pedido_itens' && method === 'POST') { gravacoes++; return new Response(null, { status: 204 }); }
    if (u.pathname === '/rest/v1/foto_pedidos' && method === 'PATCH') return new Response(null, { status: 204 });
    if (u.hostname === 'api.mercadopago.com') { assert.equal(u.pathname, '/checkout/preferences'); preferencia = JSON.parse(String(init?.body)); return Response.json({ id: 'preferencia-ficticia' }); }
    throw new Error('Acesso inesperado: ' + u.pathname);
  };
  function dados() {
    const ids = Array.from({ length: quantidade }, (_, n) => fotoId(n));
    const token = assinarComboIa({ versao: 1, eventoId, fotoIds: ids, percentual: percentualComboIa(quantidade), expira: Math.floor(Date.now() / 1000) + 3600 });
    return { ids: [...ids, fotoId(999)], token };
  }
  const req = (body: unknown) => new Request('https://retratt.com/api/fotos/teste', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ficticio' }, body: JSON.stringify(body) });
  try {
    for (const n of [15, 25, 35, 101]) {
      quantidade = n; const { ids, token } = dados();
      const r = await conferir(req({ fotoIds: ids, tokens: [token] })); assert.equal(r.status, 200); const resumo = await r.json();
      assert.equal(resumo.descontoCentavos, Math.round(n * 999 * percentualComboIa(n) / 100));
      assert.equal(resumo.totalCentavos, n * 999 + 3999 - resumo.descontoCentavos);
      const checkout = await preparar(req({ fotoIds: ids, combosIa: [token], totalEsperadoCentavos: resumo.totalCentavos })); assert.equal(checkout.status, 200, await checkout.clone().text());
      assert.equal((await checkout.json()).total, resumo.totalCentavos / 100);
      assert.equal(preferencia!.items[0].unit_price, resumo.totalCentavos / 100); assert.equal(pedido!.total_centavos, resumo.totalCentavos);
      assert.equal(pedido!.vendas_fotografos.reduce((s, v) => s + v.totalCentavos, 0), resumo.totalCentavos);
    }
    const { ids, token } = dados(), antesGravar = gravacoes;
    assert.equal((await preparar(req({ fotoIds: ids, combosIa: [token], totalEsperadoCentavos: 1 }))).status, 409);
    assert.equal((await preparar(req({ fotoIds: ids.slice(1), combosIa: [token] }))).status, 409);
    assert.equal((await preparar(req({ fotoIds: ids, combosIa: [token + 'x'] }))).status, 409);
    ativo = false; assert.equal((await preparar(req({ fotoIds: ids, combosIa: [token] }))).status, 409); assert.equal(gravacoes, antesGravar);
  } finally { globalThis.fetch = fetchAntes; nomes.forEach((n, i) => { if (antes[i] === undefined) delete process.env[n]; else process.env[n] = antes[i]; }); }
});

test('somente o responsável ativa o combo; fotógrafo convidado tem leitura', async () => {
  const nomes = ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'], antes = nomes.map(n => process.env[n]);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'ficticia';
  const fetchAntes = globalThis.fetch; let usuario = orgId, ativo = false, escritas = 0, freelancer = false;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input)); assert.equal(u.hostname, 'fixture.supabase.co');
    if (u.pathname === '/auth/v1/user') return Response.json({ id: usuario });
    if (u.pathname === '/rest/v1/foto_eventos') {
      if (init?.method === 'PATCH') { assert.deepEqual(JSON.parse(String(init.body)), { combo_ia_ativo: true }); escritas++; ativo = true; return Response.json({ combo_ia_ativo: true }); }
      return Response.json({ id: eventoId, organizador_user_id: freelancer ? null : orgId, created_by: freelancer ? 'fotografo-dono' : orgId, combo_ia_ativo: ativo });
    }
    if (u.pathname === '/rest/v1/fotografos') return Response.json({ id: 'fotografo' });
    if (u.pathname === '/rest/v1/foto_evento_fotografos') return Response.json({ evento_id: eventoId });
    throw new Error('Requisição inesperada');
  };
  const request = () => new Request('https://retratt.com/api/fotos/combo-ia/configuracao', { method: 'PATCH', headers: { Authorization: 'Bearer ficticio', 'Content-Type': 'application/json' }, body: JSON.stringify({ galeriaId: eventoId, ativo: true }) });
  try {
    assert.equal((await configuracao(new Request(`https://retratt.com/api/fotos/combo-ia/configuracao?galeriaId=${eventoId}`))).status, 401);
    usuario = 'convidado'; const leitura = await configuracao(new Request(`https://retratt.com/api/fotos/combo-ia/configuracao?galeriaId=${eventoId}`, { headers: { Authorization: 'Bearer ficticio' } }));
    assert.equal((await leitura.json()).podeEditar, false); assert.equal((await salvarConfiguracao(request())).status, 403); assert.equal(escritas, 0);
    usuario = orgId; assert.equal((await salvarConfiguracao(request())).status, 200); assert.equal(escritas, 1);
    freelancer = true; usuario = 'fotografo-dono'; assert.equal((await salvarConfiguracao(request())).status, 200); assert.equal(escritas, 2);
  } finally { globalThis.fetch = fetchAntes; nomes.forEach((n, i) => { if (antes[i] === undefined) delete process.env[n]; else process.env[n] = antes[i]; }); }
});
