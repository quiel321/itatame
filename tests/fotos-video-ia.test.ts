import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import sharp from 'sharp';
import { DescribeCollectionCommand, IndexFacesCommand, RekognitionClient } from '@aws-sdk/client-rekognition';
import { indexarMiniaturaIaDoR2 } from '../app/lib/fotos-ai-server';
import { fotoIaIndiceStorageKey, fotoIaStorageKey } from '../app/lib/fotos-ai';
import { enquadramentoQuadroIa, recortesMosaicoVideo } from '../app/lib/fotos-video-ia';

test('quadros verticais preservam o enquadramento e mosaicos antigos continuam legíveis', () => {
  const vertical = enquadramentoQuadroIa(1080, 1920, 0);
  assert.equal(vertical.height, 640); assert.equal(vertical.width, 360); assert.equal(vertical.x, 140); assert.equal(vertical.y, 0);
  const horizontal = enquadramentoQuadroIa(1920, 1080, 5);
  assert.equal(horizontal.width, 640); assert.equal(horizontal.height, 360); assert.equal(horizontal.x, 640); assert.equal(horizontal.y, 1420);
  assert.deepEqual(recortesMosaicoVideo(960, 810)[5], { left: 480, top: 540, width: 480, height: 270 });
  assert.equal(recortesMosaicoVideo(1280, 1920).length, 6);
  assert.deepEqual(recortesMosaicoVideo(960, 540), []);
});

test('indexação dos vídeos complementa rostos, retoma após falha e não reprocessa fotos', async () => {
  const env = { AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'teste', AWS_SECRET_ACCESS_KEY: 'teste', R2_ENDPOINT: 'https://r2.test', R2_BUCKET_NAME: 'teste', R2_ACCESS_KEY_ID: 'teste', R2_SECRET_ACCESS_KEY: 'teste' };
  const anteriores = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]])); Object.assign(process.env, env);
  const fetchAntes = globalThis.fetch;
  const objetos = new Map<string, Buffer>();
  const id = 'video-teste';
  objetos.set(fotoIaStorageKey(id), await sharp({ create: { width: 960, height: 810, channels: 3, background: '#ffffff' } }).jpeg().toBuffer());
  objetos.set(fotoIaIndiceStorageKey(id), Buffer.from(JSON.stringify({ fotoId: id, faceIds: ['rosto-anterior'], indexedFaces: 1, detectedNumbers: ['12'], strategy: 'full' })));
  let chamadas = 0, falhar = true;
  mock.method(RekognitionClient.prototype, 'send', async (comando: unknown) => {
    if (comando instanceof DescribeCollectionCommand) return { FaceModelVersion: '7', FaceCount: 1 };
    assert.ok(comando instanceof IndexFacesCommand, 'Não excluir rostos nem chamar outros serviços');
    chamadas++;
    if (falhar && chamadas === 3) throw Error('Falha temporária simulada');
    assert.equal(comando.input.ExternalImageId, id);
    const m = await sharp(comando.input.Image!.Bytes!).metadata(); assert.equal(m.width, 1280); assert.equal(m.height, 720);
    return { FaceModelVersion: '7', FaceRecords: [{ Face: { FaceId: `rosto-${chamadas}` } }] };
  });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); assert.equal(url.hostname, 'r2.test');
    const chave = decodeURIComponent(url.pathname.replace('/teste/', ''));
    if (init?.method === 'PUT') {
      assert.equal(chave, fotoIaIndiceStorageKey(id), 'Não alterar originais ou miniaturas');
      objetos.set(chave, Buffer.from(init.body as Uint8Array)); return new Response('', { status: 200 });
    }
    assert.equal(init?.method || 'GET', 'GET');
    return objetos.has(chave) ? new Response(new Uint8Array(objetos.get(chave)!)) : new Response('', { status: 404 });
  };
  try {
    await assert.rejects(indexarMiniaturaIaDoR2(id, { videoFrames: true }), /temporária/);
    const parcial = JSON.parse(objetos.get(fotoIaIndiceStorageKey(id))!.toString());
    assert.deepEqual(parcial.videoFramesIndexed, [0, 1]); assert.ok(parcial.faceIds.includes('rosto-anterior'));
    falhar = false;
    const resultado = await indexarMiniaturaIaDoR2(id, { videoFrames: true });
    assert.equal(chamadas, 7); assert.equal(resultado.strategy, 'video-frames-v1'); assert.equal(resultado.videoFramesIndexed?.length, 6);
    assert.equal(resultado.faceIds.length, 7); assert.ok(resultado.faceIds.includes('rosto-anterior'));
    assert.deepEqual(resultado.detectedNumbers, ['12']);
    assert.equal((await indexarMiniaturaIaDoR2(id, { videoFrames: true })).skipped, true); assert.equal(chamadas, 7);
    assert.equal((await indexarMiniaturaIaDoR2(id)).skipped, true); assert.equal(chamadas, 7);
  } finally {
    globalThis.fetch = fetchAntes; mock.restoreAll();
    for (const [k, v] of Object.entries(anteriores)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});
