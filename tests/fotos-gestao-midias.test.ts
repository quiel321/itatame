import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as midias } from '../app/api/fotos/fotografo/gerenciar-fotos/route';
import { GET as vendas } from '../app/api/fotos/vendas-pedidos/route';
const eventoId = '11111111-1111-4111-8111-111111111111', fotografoId = '44444444-4444-4444-8444-444444444444';
const fotoId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
const itemId = (n: number) => `55555555-5555-4555-8555-${String(n).padStart(12, '0')}`;
const req = (url: string, auth = true) => new Request('https://retratt.com' + url, { headers: auth ? { Authorization: 'Bearer ficticio' } : {} });

async function simular(rodar: () => Promise<void>) {
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'ficticia' }, antes = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]])), fetchAntes = globalThis.fetch;
  Object.assign(process.env, env);
  try { await rodar(); }
  finally { globalThis.fetch = fetchAntes; for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}

test('gerenciador lista mais de mil mídias com URLs pequenas e mantém vendas/reservas paginadas do próprio autor', async () => simular(async () => {
  let credenciado = true, paginasFotos = 0, consultasItens = 0;
  globalThis.fetch = async input => {
    const u = new URL(String(input)); assert.equal(u.hostname, 'fixture.supabase.co');
    if (u.pathname.endsWith('/user')) return Response.json({ id: 'usuario-ficticio' });
    if (u.pathname.endsWith('/fotografos')) return Response.json({ id: fotografoId, user_id: 'usuario-ficticio', status: 'ativo' });
    if (u.pathname.endsWith('/foto_eventos')) return Response.json({ id: eventoId, created_by: 'organizador', organizador_user_id: 'organizador' });
    if (u.pathname.endsWith('/foto_evento_fotografos')) { assert.equal(u.searchParams.get('status'), 'eq.ativo'); return Response.json(credenciado ? { id: 'credencial' } : null); }
    if (u.pathname.endsWith('/foto_arquivos')) {
      paginasFotos++; assert.equal(u.searchParams.get('fotografo_id'), `eq.${fotografoId}`); assert.equal(u.searchParams.get('evento_id'), `eq.${eventoId}`);
      const depois = u.searchParams.get('id')?.replace(/^gt\./, '') || '';
      const fotos = Array.from({ length: 1101 }, (_, n) => ({ id: fotoId(n), evento_id: eventoId, fotografo_id: fotografoId, titulo: '', status: 'publicada', preco_centavos: 999, mime_type: 'image/jpeg', thumb_url: null, preview_url: null, r2_thumb_key: null, r2_preview_key: null, created_at: '2026-10-18T12:00:00Z' }));
      return Response.json(fotos.filter(f => f.id > depois).slice(0, Number(u.searchParams.get('limit') || 1000)));
    }
    assert.ok(u.pathname.endsWith('/foto_pedido_itens')); consultasItens++;
    if (u.href.length > 8000) return Response.json({ message: 'Bad Request' }, { status: 400 });
    const filtro = u.searchParams.get('foto_id') || '';
    const ids: string[] = [...(filtro.match(/[a-f0-9-]{36}/g) || [])];
    assert.ok(ids.length <= 100, 'IDs em lotes de 100');
    const depois = u.searchParams.get('id')?.replace(/^gt\./, '') || '';
    const itens = [...Array.from({ length: 1001 }, (_, n) => ({ id: itemId(n), foto_id: fotoId(0), foto_pedidos: { status: 'pago' } })), { id: itemId(1001), foto_id: fotoId(0), foto_pedidos: { status: 'pendente' } }, { id: itemId(1002), foto_id: fotoId(1100), foto_pedidos: { status: 'pago' } }];
    return Response.json(itens.filter(i => ids.includes(i.foto_id) && i.id > depois).slice(0, 1000));
  };
  const url = `/api/fotos/fotografo/gerenciar-fotos?eventoId=${eventoId}`;
  assert.equal((await midias(req(url, false))).status, 401);
  const r = await midias(req(url)); assert.equal(r.status, 200, await r.clone().text()); const d = await r.json();
  assert.equal(d.fotos.length, 1101); assert.equal(paginasFotos, 3); assert.equal(consultasItens, 13);
  assert.equal(d.fotos.find((f: { id: string }) => f.id === fotoId(0)).quantidade_vendas, 1001);
  assert.equal(d.fotos.find((f: { id: string }) => f.id === fotoId(0)).quantidade_reservas, 1);
  assert.equal(d.fotos.find((f: { id: string }) => f.id === fotoId(1100)).situacao_pedido, 'vendida');
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  credenciado = false; assert.equal((await midias(req(url))).status, 403); assert.equal(paginasFotos, 3);
}));

test('filtro de vendas exclui vínculo suspenso e bloqueia galeria suspensa informada pela URL', async () => simular(async () => {
  const suspensa = '66666666-6666-4666-8666-666666666666'; let pedidosLidos = 0;
  globalThis.fetch = async input => {
    const u = new URL(String(input)); assert.equal(u.hostname, 'fixture.supabase.co');
    if (u.pathname.endsWith('/user')) return Response.json({ id: 'usuario-ficticio' });
    if (u.pathname.endsWith('/fotografos')) return Response.json({ id: fotografoId });
    if (u.pathname.endsWith('/foto_eventos')) return Response.json([]);
    if (u.pathname.endsWith('/foto_evento_fotografos')) {
      assert.equal(u.searchParams.get('status'), 'eq.ativo');
      return Response.json([{ foto_eventos: { id: eventoId, nome: 'Ativa', slug: 'ativa', created_at: '2026-10-18T12:00:00Z' } }]);
    }
    assert.ok(u.pathname.endsWith('/foto_pedidos')); pedidosLidos++;
    assert.equal(u.searchParams.get('evento_id'), `eq.${eventoId}`);
    assert.equal(u.searchParams.get('foto_pedido_itens.foto_arquivos.fotografo_id'), `eq.${fotografoId}`);
    return Response.json([]);
  };
  const r = await vendas(req('/api/fotos/vendas-pedidos?perfil=fotografo')); assert.equal(r.status, 200); const d = await r.json(); assert.deepEqual(d.galerias.map((g: { id: string }) => g.id), [eventoId]);
  assert.equal((await vendas(req(`/api/fotos/vendas-pedidos?perfil=fotografo&galeria=${suspensa}`))).status, 403); assert.equal(pedidosLidos, 1);
}));
