import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { carregarDadosOgFotos, metadataCompartilhamentoFotos } from '../app/lib/fotos-og';
import { GET } from '../app/api/fotos/og/route';

test('prévia do portfólio prioriza logo, mantém imagem inteira e usa endereço curto', async () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'teste' };
  const anteriores = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]])); Object.assign(process.env, env);
  const fetchAntes = globalThis.fetch;
  const avatar = 'https://supabase.test/storage/v1/object/public/perfis/logo.png';
  const logo = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#f02030' } }).png().toBuffer();
  let imagens = 0;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input)); assert.equal(u.hostname, 'supabase.test'); assert.equal(init?.method || 'GET', 'GET');
    if (u.pathname === '/rest/v1/foto_organizadores') return Response.json({ nome: 'Spartan', avatar_url: avatar, capa_url: 'https://supabase.test/storage/v1/object/public/perfis/capa.jpg' });
    assert.equal(u.href, avatar); imagens++; return new Response(new Uint8Array(logo));
  };
  try {
    const alvo = { tipo: 'organizador', slug: 'spartan-jiu-jitsu' } as const;
    const dados = await carregarDadosOgFotos(alvo); assert.equal(dados?.capaUrl, avatar);
    const meta = await metadataCompartilhamentoFotos(alvo);
    assert.equal(meta.alternates?.canonical, '/spartan-jiu-jitsu');
    const og = (meta.openGraph?.images as { url: string }[])[0].url; assert.ok(og.includes('perfil=logo')); assert.ok(og.includes('v='));
    const r = await GET(new NextRequest('https://retratt.com' + og)); assert.equal(r.status, 200); assert.equal(imagens, 1);
    const bytes = Buffer.from(await r.arrayBuffer()); const m = await sharp(bytes).metadata(); assert.equal(m.width, 1200); assert.equal(m.height, 630);
    const margem = await sharp(bytes).extract({ left: 20, top: 315, width: 1, height: 1 }).raw().toBuffer();
    const centro = await sharp(bytes).extract({ left: 600, top: 315, width: 1, height: 1 }).raw().toBuffer();
    assert.ok(margem[0] < 20 && margem[1] < 20); assert.ok(centro[0] > 220 && centro[1] < 60);
  } finally {
    globalThis.fetch = fetchAntes;
    for (const [k, v] of Object.entries(anteriores)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});
