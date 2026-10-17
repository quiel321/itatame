import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
// Next resolve esse marcador no build; o executor Node de testes usa o módulo vazio equivalente.
const requerer = createRequire(import.meta.url);
const modulo = requerer('node:module'), resolver = modulo._resolveFilename;
let POST: typeof import('../app/api/fotos/pagamento/preparar/route').POST;
let GET: typeof import('../app/api/fotos/admin/vendas-diaria/route').GET;
try {
  modulo._resolveFilename = function(nome: string, ...args: unknown[]) {
    return resolver.call(this, nome === 'server-only' ? 'next/dist/compiled/server-only/empty' : nome, ...args);
  };
  POST = requerer('../app/api/fotos/pagamento/preparar/route').POST;
  GET = requerer('../app/api/fotos/admin/vendas-diaria/route').GET;
} finally { modulo._resolveFilename = resolver; }

test('checkout e relatório de diária: autoria, destinatário, regras e autorização conferidos sem rede real', async () => {
  const originalFetch = globalThis.fetch;
  const variaveis = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const antes = Object.fromEntries(variaveis.map(k => [k, process.env[k]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-servidor-ficticia';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-ficticio';
  let pedidoCriado: any, preferencia: any, chamadasPreferencia = 0, modoB = 'diaria_organizador', autorBAtivo = true, outraGaleria = false, organizador = true, semGalerias = false;
  const evento = { id: 'galeria', nome: 'Galeria', status: 'publicado', organizador_user_id: 'organizador', descontos_progressivos: [{ quantidade: 2, percentual: 20 }] };
  let pedidosRelatorio: any[] = [];
  const fetchFixture: typeof fetch = async (input, init) => {
    const url = new URL(String(input)), metodo = init?.method || 'GET';
    let dados: unknown;
    if (url.pathname === '/auth/v1/user') dados = { id: organizador ? 'organizador' : 'comprador', email: 'comprador@example.test', user_metadata: {} };
    else if (url.pathname === '/rest/v1/foto_arquivos') dados = ['a', 'b'].map((id, n) => ({ id: `foto-${id}`, evento_id: outraGaleria && n ? 'outra-galeria' : 'galeria', fotografo_id: id, preco_centavos: n ? 2000 : 1000, mime_type: 'image/jpeg', status: 'publicada', foto_eventos: evento, fotografos: { id, nome: id.toUpperCase(), status: n && !autorBAtivo ? 'inativo' : 'ativo' } }));
    else if (url.pathname === '/rest/v1/foto_evento_fotografos') dados = ['a', 'b'].map(id => ({ fotografo_id: id, status: 'ativo', modelo_recebimento: id === 'a' ? 'diaria_organizador' : modoB, comissao_organizador_percentual: 0 }));
    else if (url.pathname === '/rest/v1/foto_mp_organizadores') {
      assert.equal(url.searchParams.get('user_id'), 'eq.organizador');
      dados = { mp_access_token: 'token-organizador-ficticio', mp_public_key: 'pk-organizador-ficticio' };
    } else if (url.pathname === '/rest/v1/foto_pedidos' && metodo === 'POST') { pedidoCriado = JSON.parse(String(init?.body)); dados = { id: 'pedido-ficticio' }; }
    else if (url.pathname === '/rest/v1/foto_pedidos' && metodo === 'PATCH') return new Response(null, { status: 204 });
    else if (url.pathname === '/rest/v1/foto_pedido_itens' && metodo === 'POST') {
      assert.equal(JSON.parse(String(init?.body)).length, 2); return new Response(null, { status: 204 });
    } else if (url.hostname === 'api.mercadopago.com' && url.pathname === '/checkout/preferences') {
      chamadasPreferencia++; assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer token-organizador-ficticio');
      preferencia = JSON.parse(String(init?.body)); dados = { id: 'preferencia-ficticia' };
    } else if (url.pathname === '/rest/v1/foto_eventos') {
      assert.equal(url.searchParams.get('organizador_user_id'), organizador ? 'eq.organizador' : 'eq.comprador');
      dados = semGalerias ? [] : [{ id: 'galeria', nome: 'Galeria' }];
    } else if (url.pathname === '/rest/v1/foto_pedidos' && metodo === 'GET') {
      assert.equal(url.searchParams.get('organizador_user_id'), 'eq.organizador');
      assert.equal(url.searchParams.get('modelo_recebimento'), 'eq.diaria_organizador');
      assert.equal(url.searchParams.get('status'), 'eq.pago');
      dados = pedidosRelatorio;
    } else throw Error(`Chamada não simulada (bloqueada): ${metodo} ${url.pathname}`);
    return Response.json(dados);
  };
  globalThis.fetch = fetchFixture;
  const pedido = () => new Request('https://retratt.test/api/fotos/pagamento/preparar', { method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ fotoIds: ['foto-a', 'foto-b'], modeloRecebimento: 'diaria_organizador', total: 0.01 }) });
  const consulta = (token = true) => new Request('https://retratt.test/api/fotos/admin/vendas-diaria', { headers: token ? { Authorization: 'Bearer fixture' } : {} });
  try {
    const response = await POST(pedido()); assert.equal(response.status, 200);
    assert.equal(pedidoCriado.total_centavos, 2400); assert.equal(pedidoCriado.comissao_itatame_centavos, 120);
    assert.equal(pedidoCriado.fotografo_id, null); assert.equal(pedidoCriado.organizador_user_id, 'organizador');
    assert.equal(pedidoCriado.receita_direta_organizador_centavos, 2280);
    assert.equal(pedidoCriado.vendas_fotografos.length, 2);
    assert.equal(preferencia.items.length, 1); assert.equal(preferencia.items[0].unit_price, 24); assert.equal(preferencia.marketplace_fee, 1.2);
    assert.equal((await response.json()).quantidadeFotografos, 2);
    modoB = 'royalty'; assert.equal((await POST(pedido())).status, 409);
    modoB = 'diaria_organizador'; autorBAtivo = false; assert.equal((await POST(pedido())).status, 409);
    autorBAtivo = true; outraGaleria = true; assert.equal((await POST(pedido())).status, 409);
    assert.equal(chamadasPreferencia, 1);
    assert.equal((await GET(consulta(false))).status, 401);
    pedidosRelatorio = [{ id: 'novo', evento_id: 'galeria', total_centavos: 2400, comissao_itatame_centavos: 120, vendas_fotografos: pedidoCriado.vendas_fotografos, foto_pedido_itens: [] },
      { id: 'antigo', evento_id: 'galeria', fotografo_id: 'a', total_centavos: 1000, comissao_itatame_centavos: 50, vendas_fotografos: null, foto_pedido_itens: [{ preco_centavos: 1000, foto_arquivos: { fotografo_id: 'a', fotografos: { nome: 'A' }, mime_type: 'image/jpeg' } }] }];
    const relatorio = await GET(consulta()); assert.equal(relatorio.status, 200);
    const vendas = (await relatorio.json()).vendas;
    assert.equal(vendas.find((v: any) => v.fotografoId === 'a').antesTarifaCentavos, 1710);
    assert.equal(vendas.find((v: any) => v.fotografoId === 'b').antesTarifaCentavos, 1520);
    assert.equal(vendas.reduce((s: number, v: any) => s + v.totalCentavos, 0), 3400);
    semGalerias = true; organizador = false;
    assert.deepEqual((await (await GET(consulta())).json()).vendas, []);
  } finally {
    globalThis.fetch = originalFetch;
    for (const k of variaveis) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; }
  }
});
