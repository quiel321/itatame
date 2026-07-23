import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const FOTOS_HOST = 'fotos.itatame.com.br';
const FOTOS_URL = process.env.NEXT_PUBLIC_FOTOS_URL || `https://${FOTOS_HOST}`;
const HOSTS_PRINCIPAIS = new Set(['itatame.com.br', 'www.itatame.com.br']);

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  const isHostFotos = host === FOTOS_HOST || host === 'fotos.localhost';

  // Mantém os links antigos válidos e transfere a autoridade de busca para o novo subdomínio.
  if (HOSTS_PRINCIPAIS.has(host) && (path === '/fotos' || path.startsWith('/fotos/'))) {
    const destino = new URL(path.slice('/fotos'.length) || '/', FOTOS_URL);
    destino.search = request.nextUrl.search;
    return NextResponse.redirect(destino, 308);
  }

  if (isHostFotos) {
    // Corrige links internos legados sem expor novamente o prefixo /fotos no endereço público.
    if (path === '/fotos' || path.startsWith('/fotos/')) {
      const destino = request.nextUrl.clone();
      destino.pathname = path.slice('/fotos'.length) || '/';
      return NextResponse.redirect(destino, 308);
    }

    // APIs, arquivos públicos e telas compartilhadas de redefinição continuam na raiz técnica.
    const rotaCompartilhada = path === '/recuperar-senha' || path === '/nova-senha';
    const arquivoPublico = /\.[a-z0-9]+$/i.test(path)
      && !['/robots.txt', '/sitemap.xml', '/manifest.webmanifest'].includes(path);
    if (rotaCompartilhada || arquivoPublico) return NextResponse.next();

    const destinoInterno = request.nextUrl.clone();
    destinoInterno.pathname = path === '/' ? '/fotos' : `/fotos${path}`;
    return NextResponse.rewrite(destinoInterno);
  }

  // As sessões principais do Supabase vivem no armazenamento do navegador.
  // Aqui fazemos apenas a barreira otimista do fluxo de staff, que usa cookie próprio após validar o PIN.
  const rotasProtegidas = ['/staff'];
  const isRotaProtegida = rotasProtegidas.some((rota) => path.startsWith(rota)) && path !== '/staff/login';

  const temAcessoStaff = path.startsWith('/staff') && request.cookies.get('itatame_staff_access')?.value === '1';

  if (isRotaProtegida && !temAcessoStaff) {
    return NextResponse.redirect(new URL('/staff/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
