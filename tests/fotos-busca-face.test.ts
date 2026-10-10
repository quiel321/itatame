import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { DescribeCollectionCommand, RekognitionClient, SearchFacesByImageCommand } from "@aws-sdk/client-rekognition";
import { POST } from "../app/api/fotos/buscar-por-face/route";

const fotoId = "11111111-1111-4111-8111-111111111111";
const eventoId = "22222222-2222-4222-8222-222222222222";

test("busca facial informa download gratuito mesmo com preço cadastrado", async () => {
  const ambiente = { NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "teste", AWS_REGION: "us-east-1", AWS_ACCESS_KEY_ID: "teste", AWS_SECRET_ACCESS_KEY: "teste" };
  const anteriores = Object.fromEntries(Object.keys(ambiente).map(key => [key, process.env[key]]));
  Object.assign(process.env, ambiente);
  const fetchAnterior = globalThis.fetch;
  mock.method(RekognitionClient.prototype, "send", async (command: unknown) => {
    if (command instanceof DescribeCollectionCommand) return { FaceModelVersion: "7", FaceCount: 1 };
    assert.ok(command instanceof SearchFacesByImageCommand);
    return { SearchedFaceConfidence: 99, FaceMatches: [{ Similarity: 99, Face: { ExternalImageId: fotoId } }] };
  });
  globalThis.fetch = async input => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, "https://supabase.test", "Não acessar serviços reais");
    if (url.pathname === "/rest/v1/foto_arquivos") return Response.json([{ id: fotoId, evento_id: eventoId, titulo: "Foto", preco_centavos: 3500, mime_type: "image/jpeg", fotografo_id: "fotografo-teste" }]);
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
