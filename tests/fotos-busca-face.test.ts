import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { DescribeCollectionCommand, RekognitionClient, SearchFacesByImageCommand } from "@aws-sdk/client-rekognition";
import { POST } from "../app/api/fotos/buscar-por-face/route";
import { correspondenciaSegura, MIN_SIMILARIDADE_BUSCA } from '../app/lib/fotos-busca-criterios';

const fotoId = "11111111-1111-4111-8111-111111111111";
const eventoId = "22222222-2222-4222-8222-222222222222";

test('critério do pacote aceita apenas similaridade válida de 99 a 100', () => {
  assert.equal(MIN_SIMILARIDADE_BUSCA, 95);
  for (const n of [0, 79, 95, 98.999, NaN, Infinity, 100.1]) assert.equal(correspondenciaSegura(n), false);
  for (const n of [99, 99.99, 100]) assert.equal(correspondenciaSegura(n), true);
});

test("busca facial informa download gratuito mesmo com preço cadastrado", async () => {
  const ambiente = { NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "teste", AWS_REGION: "us-east-1", AWS_ACCESS_KEY_ID: "teste", AWS_SECRET_ACCESS_KEY: "teste" };
  const anteriores = Object.fromEntries(Object.keys(ambiente).map(key => [key, process.env[key]]));
  Object.assign(process.env, ambiente);
  const fetchAnterior = globalThis.fetch;
  mock.method(RekognitionClient.prototype, "send", async (command: unknown) => {
    if (command instanceof DescribeCollectionCommand) return { FaceModelVersion: "7", FaceCount: 1 };
    assert.ok(command instanceof SearchFacesByImageCommand);
    assert.equal(command.input.FaceMatchThreshold, 95);
    return { SearchedFaceConfidence: 99, FaceMatches: [{ Similarity: 99, Face: { ExternalImageId: fotoId } }, { Similarity: 79, Face: { ExternalImageId: '99999999-9999-4999-8999-999999999999' } }] };
  });
  globalThis.fetch = async input => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, "https://supabase.test", "Não acessar serviços reais");
    if (url.pathname === "/rest/v1/foto_arquivos") {
      assert.ok(!url.searchParams.get('id')?.includes('99999999-9999-4999-8999-999999999999'));
      return Response.json([{ id: fotoId, evento_id: eventoId, titulo: "Foto", preco_centavos: 3500, mime_type: "image/jpeg", fotografo_id: "fotografo-teste" }]);
    }
    assert.equal(url.pathname, "/rest/v1/foto_eventos");
    assert.ok(url.searchParams.get("select")?.includes("permite_download_gratis"));
    assert.ok(url.searchParams.get("select")?.includes("descontos_progressivos"));
    assert.equal(url.searchParams.get("acesso_por_link"), "eq.false");
    return Response.json([{ id: eventoId, nome: "Gratuita", cidade: "Cuiabá", estado: "MT", permite_download_gratis: true, descontos_progressivos: [{ quantidade: 3, percentual: 20 }] }]);
  };
  try {
    const form = new FormData();
    form.set("eventoId", eventoId);
    form.set("imagem", new File(["selfie simulada"], "selfie.jpg", { type: "image/jpeg" }));
    const response = await POST(new Request("http://localhost/api/fotos/buscar-por-face", { method: "POST", body: form }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.resultados.length, 1);
    assert.equal(body.resultados[0].evento.permite_download_gratis, true);
    assert.equal(body.resultados[0].precoCentavos, 3500);
    assert.equal(body.resultados[0].fotografoId, "fotografo-teste");
    assert.deepEqual(body.resultados[0].evento.descontos_progressivos, [{ quantidade: 3, percentual: 20 }]);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally {
    globalThis.fetch = fetchAnterior;
    mock.restoreAll();
    for (const [key, value] of Object.entries(anteriores)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('portfólio encontra vídeo após muitos resultados externos, sem expor galerias de outros organizadores ou privadas', async () => {
  const orgId = '33333333-3333-4333-8333-333333333333', eventoExterno = '44444444-4444-4444-8444-444444444444';
  const videoId = '55555555-5555-4555-8555-555555555555';
  const externos = Array.from({ length: 501 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`);
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'teste', AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'teste', AWS_SECRET_ACCESS_KEY: 'teste' };
  const antes = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]])); Object.assign(process.env, env);
  const fetchAntes = globalThis.fetch; let buscas = 0;
  mock.method(RekognitionClient.prototype, 'send', async (comando: unknown) => {
    if (comando instanceof DescribeCollectionCommand) return { FaceModelVersion: '7', FaceCount: 999 };
    assert.ok(comando instanceof SearchFacesByImageCommand); buscas++;
    return { SearchedFaceConfidence: 99, FaceMatches: [...externos, videoId].map(id => ({ Similarity: 99, Face: { ExternalImageId: id } })) };
  });
  globalThis.fetch = async input => {
    const u = new URL(String(input)); assert.equal(u.hostname, 'supabase.test');
    if (u.pathname.endsWith('/foto_eventos')) {
      assert.equal(u.searchParams.get('organizador_user_id'), `eq.${orgId}`);
      assert.equal(u.searchParams.get('status'), 'eq.publicado');
      assert.equal(u.searchParams.get('or'), '(acesso_por_link.eq.false,acesso_por_link.is.null)');
      return Response.json(u.searchParams.get('select') === 'id' ? [{ id: eventoId }] : [{ id: eventoId, nome: 'Galeria pública', permite_download_gratis: false }]);
    }
    assert.ok(u.pathname.endsWith('/foto_arquivos'));
    assert.equal(u.searchParams.get('status'), 'eq.publicada');
    assert.equal(u.searchParams.get('evento_id'), `in.(${eventoId})`);
    const ids = u.searchParams.get('id') || '';
    // Inclui um registro fora do escopo para conferir a segunda proteção no servidor.
    return Response.json([{ id: externos[0], evento_id: eventoExterno, mime_type: 'image/jpeg' },
      ...(ids.includes(videoId) ? [{ id: videoId, evento_id: eventoId, mime_type: 'video/quicktime', preco_centavos: 3999 }] : [])]);
  };
  function pedido(org: string, evento?: string) {
    const f = new FormData(); f.set('organizadorId', org); if (evento) f.set('eventoId', evento);
    f.set('imagem', new File(['simulação'], 'selfie.jpg', { type: 'image/jpeg' }));
    return new Request('http://localhost/api/fotos/buscar-por-face', { method: 'POST', body: f });
  }
  try {
    assert.equal((await POST(pedido('invalido'))).status, 400); assert.equal(buscas, 0);
    assert.equal((await POST(pedido(orgId, eventoId))).status, 400); assert.equal(buscas, 0);
    const r = await POST(pedido(orgId)); assert.equal(r.status, 200);
    const json = await r.json(); assert.equal(json.resultados.length, 1); assert.equal(json.resultados[0].id, videoId);
    assert.equal(json.resultados[0].mimeType, 'video/quicktime'); assert.equal(r.headers.get('cache-control'), 'no-store');
  } finally {
    globalThis.fetch = fetchAntes; mock.restoreAll();
    for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});
