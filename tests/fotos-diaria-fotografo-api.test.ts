import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from '../app/api/fotos/fotografo/vendas-diaria/route';
import { registrarVendasFotografos } from '../app/lib/fotos-vendas-diaria';

test('fotógrafo vê somente sua parcela; identidade da URL não concede acesso a outro autor', async () => {
  const original = globalThis.fetch, variaveis = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const antes = Object.fromEntries(variaveis.map(k => [k, process.env[k]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
  let ativo = true, autenticado = true, autor = 'a', paginacao = false;
  const registro = registrarVendasFotografos([
    { fotografoId: 'a', nome: 'Ana', precoCentavos: 1000 }, { fotografoId: 'b', nome: 'Bruno privado', precoCentavos: 2000 },
  ], 600, 120);
  let consultas = 0;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input));
    if (u.hostname !== 'fixture.supabase.co' || (init?.method && init.method !== 'GET')) throw Error('Rede real ou gravação não permitida no teste');
    if (u.pathname === '/auth/v1/user') return autenticado ? Response.json({ id: `conta-${autor}`, email: 'qa@example.test' }) : Response.json({ message: 'Invalid JWT' }, { status: 401 });
    if (u.pathname === '/rest/v1/fotografos') {
      assert.equal(u.searchParams.get('user_id'), `eq.conta-${autor}`); assert.equal(u.searchParams.get('status'), 'eq.ativo');
      return Response.json(ativo ? { id: autor } : null);
    }
    if (u.pathname === '/rest/v1/foto_pedidos') {
      consultas++;
      assert.equal(u.searchParams.get('modelo_recebimento'), 'eq.diaria_organizador'); assert.equal(u.searchParams.get('status'), 'eq.pago');
      const legado = u.searchParams.get('vendas_fotografos') === 'is.null';
      if (legado) {
        assert.equal(u.searchParams.get('fotografo_id'), `eq.${autor}`);
        return Response.json(paginacao ? [] : [{ id: 'antigo', evento_id: 'galeria', fotografo_id: autor, total_centavos: 1000, comissao_itatame_centavos: 50, vendas_fotografos: null, foto_eventos: { nome: 'Galeria' }, foto_pedido_itens: [{ preco_centavos: 1000, foto_arquivos: { fotografo_id: autor, mime_type: 'image/jpeg', fotografos: { nome: autor } } }] }]);
      }
      assert.equal(u.searchParams.get('vendas_fotografos'), `cs.${JSON.stringify([{ fotografoId: autor }])}`);
      const pedido = { id: 'misto', evento_id: 'galeria', fotografo_id: null, total_centavos: 2400, comissao_itatame_centavos: 120, vendas_fotografos: registro, foto_eventos: { nome: 'Galeria' }, foto_pedido_itens: [] };
      // A lista simulada também contém outro autor. A resposta deve filtrar novamente no servidor.
      if (!paginacao) return Response.json([pedido]);
      const offset = Number(u.searchParams.get('offset') || 0);
      return Response.json(Array.from({ length: offset ? 1 : 250 }, (_, n) => ({ ...pedido, id: `pedido-${offset + n}` })));
    }
    throw Error('Consulta inesperada: ' + u.pathname);
  };
  const req = (token = true) => new Request('https://retratt.test/api/fotos/fotografo/vendas-diaria?fotografoId=b', { headers: token ? { Authorization: 'Bearer fixture' } : {} });
  try {
    assert.equal((await GET(req(false))).status, 401);
    const r = await GET(req()); assert.equal(r.status, 200); assert.match(r.headers.get('Cache-Control')!, /private, no-store/);
    const dados = await r.json(); assert.equal(dados.vendas.length, 1);
    assert.equal(dados.vendas[0].fotografoId, 'a'); assert.equal(dados.vendas[0].quantidade, 2);
    assert.equal(dados.vendas[0].totalCentavos, 1800); assert.equal(dados.vendas[0].antesTarifaCentavos, 1710);
    assert.ok(!JSON.stringify(dados).includes('Bruno privado'));
    autor = 'b';
    const b = await (await GET(req())).json(); assert.equal(b.vendas[0].totalCentavos, 2600); assert.equal(b.vendas[0].antesTarifaCentavos, 2470);
    assert.ok(!JSON.stringify(b).includes('Ana'));
    const chamadas = consultas; ativo = false; assert.equal((await GET(req())).status, 403); assert.equal(consultas, chamadas);
    ativo = true; autenticado = false; assert.equal((await GET(req())).status, 401); assert.equal(consultas, chamadas);
    autenticado = true; autor = 'a'; paginacao = true;
    const grande = await (await GET(req())).json(); assert.equal(grande.vendas[0].pedidosPagos, 251); assert.equal(grande.vendas[0].totalCentavos, 800 * 251);
  } finally {
    globalThis.fetch = original;
    for (const k of variaveis) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; }
  }
});
