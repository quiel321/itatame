import { createR2PresignedGetUrl } from '@/app/lib/r2';
import { ARQUIVO_PUBLICO, CACHE_MIDIA_PUBLICA, chaveMidiaPublica } from '@/app/lib/midia-publica';

export const runtime = 'nodejs';

type Contexto = { params: Promise<{ escopo: string; arquivo: string }> };

async function servir(request: Request, { params }: Contexto, head: boolean) {
  const { escopo, arquivo } = await params;
  const erro = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!['itatame', 'retratt'].includes(escopo) || !ARQUIVO_PUBLICO.test(arquivo)) return erro(404);
  try {
    // URL estável no navegador e CDN; a assinatura privada só circula no servidor.
    const range = request.headers.get('range');
    const resposta = await fetch(createR2PresignedGetUrl(chaveMidiaPublica(arquivo), 120, escopo as 'itatame' | 'retratt'), {
      cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: range ? { Range: range } : undefined,
    });
    if (!resposta.ok) {
      await resposta.body?.cancel();
      return erro(resposta.status === 404 ? 404 : resposta.status === 416 ? 416 : 502);
    }
    const etag = `"${arquivo.split('.')[0]}"`;
    const headers = new Headers({
      'Content-Type': arquivo.endsWith('.pdf') ? 'application/pdf' : 'image/webp',
      'Cache-Control': CACHE_MIDIA_PUBLICA,
      'CDN-Cache-Control': 'public, s-maxage=31536000',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'ETag': etag,
      'Accept-Ranges': 'bytes',
    });
    if (request.headers.get('if-none-match')?.split(',').some(v => v.trim().replace(/^W\//, '') === etag)) {
      await resposta.body?.cancel();
      return new Response(null, { status: 304, headers });
    }
    for (const nome of ['content-length', 'content-range']) {
      const valor = resposta.headers.get(nome);
      if (valor) headers.set(nome, valor);
    }
    if (resposta.status === 206) {
      headers.set('Cache-Control', 'private, max-age=0');
      headers.set('CDN-Cache-Control', 'no-store');
    }
    if (head) await resposta.body?.cancel();
    return new Response(head ? null : resposta.body, { status: resposta.status, headers });
  } catch { return erro(502); }
}

export const GET = (request: Request, contexto: Contexto) => servir(request, contexto, false);
export const HEAD = (request: Request, contexto: Contexto) => servir(request, contexto, true);
