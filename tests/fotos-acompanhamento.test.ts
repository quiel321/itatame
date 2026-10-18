import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/fotos/vendas-pedidos/route';
import { apresentarPedidoFotos, prepararTextoLembreteFotos, relacionarComprasFotos, type PedidoAcompanhamento, type PedidoFotosPainel } from '../app/lib/fotos-acompanhamento';
import { registrarVendasFotografos } from '../app/lib/fotos-vendas-diaria';

function pedido(id: string, status = 'pendente'): PedidoAcompanhamento {
  const itens = ['a', 'b', 'c'].map((foto, i) => ({ id: `item-${id}-${foto}`, foto_id: foto, preco_centavos: 1000, download_liberado: status === 'pago', download_expires_at: null,
    foto_arquivos: { fotografo_id: i === 2 ? 'autor-b' : 'autor-a', titulo: `Foto ${foto}`, nome_original: `${foto}.jpg`, mime_type: 'image/jpeg', fotografos: { nome: i === 2 ? 'Outro fotógrafo' : 'Autor A' } } }));
  return { id, evento_id: 'galeria', comprador_user_id: 'cliente', comprador_nome: 'Ana Julya Exemplo', comprador_email: 'cliente@example.test', status,
    created_at: '2026-10-18T12:00:00Z', pago_em: status === 'pago' ? '2026-10-18T12:02:00Z' : null,
    provedor_payment_id: '123', provedor_status_detail: status === 'pago' ? 'accredited' : 'pending_waiting_transfer',
    total_centavos: 2700, subtotal_centavos: 3000, desconto_centavos: 300, comissao_itatame_centavos: 135, comissao_organizador_centavos: 0,
    modelo_recebimento: 'diaria_organizador', fotografo_id: null, organizador_user_id: 'org', email_confirmacao_enviado_em: status === 'pago' ? '2026-10-18T12:02:01Z' : null, email_confirmacao_erro: null,
    foto_pedido_itens: itens, vendas_fotografos: registrarVendasFotografos(itens.map(i => ({ fotografoId: i.foto_arquivos.fotografo_id, nome: i.foto_arquivos.fotografos.nome, precoCentavos: i.preco_centavos })), 300, 135) };
}

test('compras relacionadas distinguem identidade confirmada, coincidência de nome e itens restantes', () => {
  const p = pedido('aberto'), q = pedido('pago', 'pago');
  q.foto_pedido_itens = q.foto_pedido_itens.slice(0, 2);
  assert.deepEqual(relacionarComprasFotos(p, [p, q]), { tipo: 'confirmada', pedidos: ['pago'], quantidade: 2, restantes: 1 });
  q.comprador_user_id = 'outro'; q.comprador_email = 'outro@example.test'; q.comprador_nome = ' Ána  Julya Exemplo ';
  assert.equal(relacionarComprasFotos(p, [p, q])?.tipo, 'possivel');
  assert.equal(apresentarPedidoFotos(p, [p, q], null, true).lembrete.permitido, false);
  q.comprador_nome = 'Pessoa diferente'; assert.equal(relacionarComprasFotos(p, [p, q]), null);
  q.comprador_user_id = p.comprador_user_id; q.evento_id = 'outra'; assert.equal(relacionarComprasFotos(p, [p, q]), null);
  q.evento_id = p.evento_id; q.status = 'pendente'; assert.equal(relacionarComprasFotos(p, [p, q]), null);
});

test('rascunho não cobra o Pix antigo e exclui a quantidade já comprada', () => {
  const p = pedido('aberto'), q = pedido('pago', 'pago'); q.foto_pedido_itens = q.foto_pedido_itens.slice(0, 2);
  const dto = apresentarPedidoFotos(p, [p, q], null, true);
  assert.equal(dto.lembrete.quantidade, 1);
  const r = prepararTextoLembreteFotos(dto, 'Galeria', 'https://retratt.example.test/evento/galeria');
  assert.ok(r.texto.includes('1 arquivo(s)')); assert.ok(!r.texto.includes('27,00')); assert.ok(!r.texto.includes('123'));
  q.foto_pedido_itens = [...p.foto_pedido_itens];
  assert.equal(apresentarPedidoFotos(p, [p, q], null, true).lembrete.permitido, false);
  assert.equal(apresentarPedidoFotos(p, [p], null, false).lembrete.permitido, false);
  p.provedor_payment_id = null;
  assert.equal(apresentarPedidoFotos(p, [p], null, true).situacao, 'checkout_iniciado');
  p.status = 'pago'; assert.equal(apresentarPedidoFotos(p, [p], null, true).lembrete.permitido, false);
});

test('participação do fotógrafo conserva centavos e oculta comprador, pagamento e outros autores', () => {
  const p = pedido('pago', 'pago'), original = structuredClone(p);
  const dto = apresentarPedidoFotos(p, [p], 'autor-a', true);
  assert.equal(dto.quantidade, 2); assert.equal(dto.valores?.total, 1800); assert.equal(dto.valores?.comissao, 90); assert.equal(dto.valores?.antesTarifa, 1710);
  assert.equal(dto.comprador, null); assert.equal(dto.email, null); assert.equal(dto.pagamentoId, null);
  assert.equal(dto.autores.length, 1); assert.equal(dto.autores[0].nome, 'Autor A');
  assert.ok(!JSON.stringify(dto).includes('cliente@example.test')); assert.ok(!JSON.stringify(dto).includes('Outro fotógrafo'));
  assert.deepEqual(p, original, 'A apresentação nunca altera o pedido');
});

test('API permite só leitura, confere escopo, limita o histórico e consulta MP apenas sob demanda', async () => {
  const fetchAntes = globalThis.fetch;
  const nomes = ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','R2_ENDPOINT','R2_BUCKET_NAME','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'];
  const envAntes = nomes.map(n => process.env[n]);
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'ficticia' });
  let autor = false, ativo = true, erroBanco = false, mpFalha = false, lotado = false, mpConsultas = 0, contaConsultas = 0;
  const p = pedido('aberto');
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input)), metodo = init?.method || 'GET';
    assert.equal(metodo, 'GET', 'Nenhum INSERT/UPDATE, renovação OAuth ou envio de mensagem é permitido');
    if (u.hostname === 'api.mercadopago.com') {
      mpConsultas++;
      assert.equal(u.pathname, '/v1/payments/123');
      if (mpFalha) return Response.json({}, { status: 503 });
      return Response.json({ id: 123, collector_id: 42, external_reference: 'foto_pedido:aberto', transaction_amount: 27, status: 'pending', payment_method_id: 'pix' });
    }
    assert.equal(u.hostname, 'fixture.supabase.co');
    if (u.pathname === '/auth/v1/user') return Response.json({ id: autor ? 'user-autor' : 'org', user_metadata: { role: 'admin' } });
    if (u.pathname === '/rest/v1/fotografos') return Response.json(ativo ? { id: 'autor-a' } : null);
    if (u.pathname === '/rest/v1/foto_evento_fotografos') { assert.equal(u.searchParams.get('fotografo_id'), 'eq.autor-a'); return Response.json([{ foto_eventos: { id: 'galeria', nome: 'Galeria', slug: 'galeria', created_at: '2026-10-18' } }]); }
    if (u.pathname === '/rest/v1/foto_eventos') {
      assert.equal(u.searchParams.get(autor ? 'created_by' : 'organizador_user_id'), autor ? 'eq.user-autor' : 'eq.org');
      return Response.json([{ id: 'galeria', nome: 'Galeria', slug: 'galeria', created_at: '2026-10-18' }]);
    }
    if (u.pathname === '/rest/v1/foto_pedidos') {
      assert.equal(u.searchParams.get('evento_id'), 'eq.galeria');
      if (autor) { assert.equal(u.searchParams.get('foto_pedido_itens.foto_arquivos.fotografo_id'), 'eq.autor-a'); assert.ok(u.searchParams.get('select')?.includes('foto_pedido_itens!inner')); }
      else assert.equal(u.searchParams.get('organizador_user_id'), 'eq.org');
      if (erroBanco) return Response.json({ message: 'Falha simulada' }, { status: 503 });
      const offset = Number(u.searchParams.get('offset') || 0), limit = Number(u.searchParams.get('limit') || 250);
      return Response.json(lotado ? Array.from({ length: Math.min(limit, 501 - offset) }, (_, n) => ({ ...p, id: `pedido-${offset + n}` })) : [p]);
    }
    if (u.pathname === '/rest/v1/foto_downloads') {
      if (autor) assert.ok(!u.searchParams.get('item_id')?.includes('item-aberto-c'));
      return new Response('[]', { headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' } });
    }
    if (u.pathname === '/rest/v1/foto_mp_organizadores') {
      contaConsultas++; assert.equal(u.searchParams.get('user_id'), 'eq.org');
      return Response.json({ mp_access_token: 'ficticio', mp_user_id: '42' });
    }
    throw Error('Chamada inesperada: ' + u.pathname);
  };
  const get = (qs = '', token = true) => GET(new Request(`https://retratt.test/api/fotos/vendas-pedidos?perfil=${autor ? 'fotografo' : 'organizador'}${qs}`, { headers: token ? { Authorization: 'Bearer fixture' } : {} }));
  try {
    assert.equal((await get('', false)).status, 401);
    assert.equal((await get('&galeria=alheia')).status, 403);
    assert.equal(mpConsultas, 0); assert.equal(contaConsultas, 0);
    let r = await get(); assert.equal(r.status, 200); assert.equal(r.headers.get('Cache-Control'), 'private, no-store');
    assert.equal((await r.json()).pedidos[0].comprador.email, p.comprador_email);
    assert.equal((await get('&pedido=inexistente')).status, 404);
    r = await get('&pedido=aberto&acao=lembrete'); assert.equal(r.status, 200); assert.equal((await r.json()).rascunho.destinatario, p.comprador_email); assert.equal(mpConsultas, 0);
    r = await get('&pedido=aberto&conferirMP=1'); assert.equal(r.status, 200); assert.equal((await r.json()).mercadoPago.metodo, 'pix'); assert.equal(mpConsultas, 1);
    mpFalha = true; r = await get('&pedido=aberto&conferirMP=1'); assert.equal(r.status, 200); assert.ok((await r.json()).erroMP);
    lotado = true; r = await get(); const dados = await r.json(); assert.equal(dados.parcial, true); assert.equal(dados.pedidos.length, 500); assert.ok(dados.pedidos.every((x: PedidoFotosPainel) => !x.lembrete.permitido)); lotado = false;
    autor = true;
    r = await get(); const proprio = (await r.json()).pedidos[0]; assert.equal(proprio.comprador, null); assert.equal(proprio.quantidade, 2); assert.equal(proprio.valores.total, 1800);
    const consultasAntes = mpConsultas; r = await get('&pedido=aberto&conferirMP=1'); assert.equal(r.status, 200); assert.equal(mpConsultas, consultasAntes);
    assert.equal((await get('&pedido=aberto&acao=lembrete')).status, 409);
    ativo = false; assert.equal((await get()).status, 403); ativo = true;
    erroBanco = true; assert.equal((await get()).status, 503);
  } finally { globalThis.fetch = fetchAntes; nomes.forEach((n, i) => { if (envAntes[i] === undefined) delete process.env[n]; else process.env[n] = envAntes[i]; }); }
});
