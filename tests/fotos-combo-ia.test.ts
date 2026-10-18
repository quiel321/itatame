import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularCompraComCombosIa, percentualComboIa, type ComboIaAssinado } from '../app/lib/fotos-combo-ia';
import { assinarComboIa, conferirAssinaturasComboIa, validarComboIaNoCheckout, criarOfertasComboIa } from '../app/lib/fotos-combo-ia-servidor';
import { registrarVendasFotografos, conferirRegistroVendas } from '../app/lib/fotos-vendas-diaria';
import { createSupabaseServerClient } from '../app/lib/supabase-server';

const eventoId = '11111111-1111-4111-8111-111111111111';
const id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
const combo = (n = 15): ComboIaAssinado => ({ versao: 1, eventoId, fotoIds: Array.from({ length: n }, (_, i) => id(i)), percentual: percentualComboIa(n), expira: Math.floor(Date.now() / 1000) + 3600 });

test('faixas são inclusivas em 15, 25 e 35 fotos; vídeos não recebem desconto', () => {
  for (const [n, p] of [[14, 0], [15, 65], [24, 65], [25, 75], [34, 75], [35, 85]]) assert.equal(percentualComboIa(n), p);
  const fotos = Array.from({ length: 15 }, (_, n) => ({ id: id(n), precoCentavos: 999, mimeType: 'image/jpeg' }));
  const r = calcularCompraComCombosIa([...fotos, { id: 'video', precoCentavos: 3999, mimeType: 'video/quicktime' }], [{ quantidade: 3, percentual: 10 }], [combo()]);
  assert.equal(r.descontoCentavos, Math.round(15 * 999 * .65)); assert.equal(r.descontoPorItem.at(-1), 0);
  assert.equal(r.totalCentavos, 15 * 999 + 3999 - r.descontoCentavos);
  assert.throws(() => calcularCompraComCombosIa(fotos.slice(1), [], [combo()]), /todas/);
  assert.throws(() => calcularCompraComCombosIa(fotos, [], [combo(), combo()]), /dois pacotes/);
  assert.equal(calcularCompraComCombosIa(fotos, [{ quantidade: 3, percentual: 90 }], [combo()]).descontoCentavos, Math.round(15 * 999 * .9));
});

test('assinatura recusa alteração, prazo vencido e quantidade falsa; ativação é revalidada', () => {
  const antes = process.env.FOTOS_ACESSO_SECRET; process.env.FOTOS_ACESSO_SECRET = 'segredo-ficticio-do-teste';
  try {
    const c = combo(), token = assinarComboIa(c); assert.deepEqual(conferirAssinaturasComboIa([token]), [c]);
    assert.throws(() => conferirAssinaturasComboIa([token + 'a']), /inválido/);
    const [payload, assinatura] = token.split('.');
    const forjado = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), percentual: 99 })).toString('base64url') + '.' + assinatura;
    assert.throws(() => conferirAssinaturasComboIa([forjado]), /inválido/);
    assert.throws(() => conferirAssinaturasComboIa([assinarComboIa({ ...c, expira: 1 })]), /expirou/);
    assert.throws(() => conferirAssinaturasComboIa([assinarComboIa({ ...c, fotoIds: c.fotoIds.slice(1) })]), /inválido/);
    const itens = c.fotoIds.map(i => ({ id: i, evento_id: eventoId, mime_type: 'image/jpeg' }));
    assert.throws(() => validarComboIaNoCheckout([c], itens, { id: eventoId, combo_ia_ativo: false }), /disponível/);
    assert.throws(() => validarComboIaNoCheckout([c], itens.slice(1), { id: eventoId, combo_ia_ativo: true }), /disponível/);
    assert.doesNotThrow(() => validarComboIaNoCheckout([c], itens, { id: eventoId, combo_ia_ativo: true }));
  } finally { if (antes === undefined) delete process.env.FOTOS_ACESSO_SECRET; else process.env.FOTOS_ACESSO_SECRET = antes; }
});

test('autoria conserva os descontos específicos do pacote e todos os centavos', () => {
  const itens = Array.from({ length: 16 }, (_, i) => ({ id: id(i), precoCentavos: 1000, mimeType: 'image/jpeg' }));
  const r = calcularCompraComCombosIa(itens, [{ quantidade: 3, percentual: 20 }], [combo()]);
  const registro = registrarVendasFotografos(itens.map((i, n) => ({ ...i, fotografoId: n < 15 ? 'a' : 'b', nome: n < 15 ? 'A' : 'B' })), r.descontoCentavos, Math.round(r.totalCentavos * .05), r.descontoPorItem);
  assert.equal(registro.find(v => v.fotografoId === 'a')?.descontoCentavos, 9750);
  assert.equal(registro.find(v => v.fotografoId === 'b')?.descontoCentavos, 200);
  assert.doesNotThrow(() => conferirRegistroVendas(registro, r.totalCentavos, Math.round(r.totalCentavos * .05)));
});

test('ofertas exigem opt-in e combinam autores somente na diária ativa', async () => {
  const antesFetch = globalThis.fetch, nomes = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const antes = nomes.map(n => process.env[n]); process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'ficticio';
  let chamadas = 0, diaria = true;
  globalThis.fetch = async input => {
    const u = new URL(String(input)); assert.equal(u.hostname, 'fixture.supabase.co'); assert.equal(u.pathname, '/rest/v1/foto_evento_fotografos'); chamadas++;
    return Response.json(['a', 'b'].map(fotografo_id => ({ evento_id: eventoId, fotografo_id, status: 'ativo', modelo_recebimento: diaria ? 'diaria_organizador' : 'royalty' })));
  };
  const resultados = Array.from({ length: 15 }, (_, i) => ({ id: id(i), eventoId, fotografoId: i < 8 ? 'a' : 'b', mimeType: 'image/jpeg', precoCentavos: 999, evento: { id: eventoId, nome: 'Galeria', permite_download_gratis: false, combo_ia_ativo: false } }));
  try {
    const db = createSupabaseServerClient(); assert.deepEqual(await criarOfertasComboIa(db, resultados), []); assert.equal(chamadas, 0);
    resultados.forEach(r => { r.evento.combo_ia_ativo = true; });
    const ofertas = await criarOfertasComboIa(db, resultados); assert.equal(ofertas.length, 1); assert.equal(ofertas[0].quantidade, 15); assert.equal(ofertas[0].percentual, 65);
    diaria = false; assert.deepEqual(await criarOfertasComboIa(db, resultados), []);
  } finally { globalThis.fetch = antesFetch; nomes.forEach((n, i) => { if (antes[i] === undefined) delete process.env[n]; else process.env[n] = antes[i]; }); }
});
