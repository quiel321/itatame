import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Domínio antigo da plataforma de fotos.
 * Agora será usado somente para redirecionar visitantes.
 */
const FOTOS_HOST_ANTIGO = 'fotos.itatame.com.br';

/**
 * Novo domínio oficial da plataforma.
 */
const RETRATT_HOST = 'retratt.com';

const RETRATT_URL =
  process.env.NEXT_PUBLIC_RETRATT_URL || `https://${RETRATT_HOST}`;

/**
 * Domínios institucionais do iTatame.
 */
const HOSTS_ITATAME = new Set([
  'itatame.com.br',
  'www.itatame.com.br',
]);

/**
 * Todos os domínios que podem chegar à aplicação Retratt.
 *
 * Mesmo que a Vercel já faça os redirecionamentos,
 * deixamos esta proteção adicional no código.
 */
const HOSTS_RETRATT = new Set([
  'retratt.com',
  'www.retratt.com',
  'retratt.com.br',
  'www.retratt.com.br',
]);

/**
 * Permite testar usando:
 * http://retratt.localhost:3000
 *
 * O localhost normal continua disponível em:
 * http://localhost:3000/fotos
 */
const RETRATT_LOCAL_HOST = 'retratt.localhost';

const ROTAS_COMPARTILHADAS = new Set([
  '/recuperar-senha',
  '/nova-senha',
]);

const ARQUIVOS_SEO_RETRATT = new Set([
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/site.webmanifest',
]);

function obterHost(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const originalHost = request.headers.get('host');

  return (forwardedHost || originalHost || '')
    .split(',')[0]
    .trim()
    .split(':')[0]
    .toLowerCase();
}

function removerPrefixoFotos(path: string): string {
  if (path === '/fotos') {
    return '/';
  }

  if (path.startsWith('/fotos/')) {
    return path.slice('/fotos'.length) || '/';
  }

  return path;
}

function criarDestinoRetratt(
  request: NextRequest,
  path: string,
): URL {
  const destino = new URL(RETRATT_URL);

  destino.pathname = removerPrefixoFotos(path);
  destino.search = request.nextUrl.search;

  return destino;
}

function isArquivoPublico(path: string): boolean {
  return (
    /\.[a-z0-9]+$/i.test(path) &&
    !ARQUIVOS_SEO_RETRATT.has(path)
  );
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const host = obterHost(request);

  const isHostRetratt =
    HOSTS_RETRATT.has(host) ||
    host === RETRATT_LOCAL_HOST;

  /**
   * 1. Links antigos:
   *
   * itatame.com.br/fotos
   * itatame.com.br/fotos/eventos
   *
   * passam a apontar para:
   *
   * retratt.com
   * retratt.com/eventos
   */
  if (
    HOSTS_ITATAME.has(host) &&
    (path === '/fotos' || path.startsWith('/fotos/'))
  ) {
    return NextResponse.redirect(
      criarDestinoRetratt(request, path),
      308,
    );
  }

  /**
   * 2. Antigo subdomínio:
   *
   * fotos.itatame.com.br/eventos
   * passa a apontar para:
   * retratt.com/eventos
   */
  if (host === FOTOS_HOST_ANTIGO) {
    return NextResponse.redirect(
      criarDestinoRetratt(request, path),
      308,
    );
  }

  /**
   * 3. Toda a lógica pública da Retratt.
   */
  if (isHostRetratt) {
    /**
     * Segurança adicional para domínios alternativos.
     *
     * A Vercel provavelmente fará isso antes do proxy,
     * mas esta condição garante o domínio canônico.
     *
     * retratt.com.br/eventos
     * www.retratt.com/eventos
     *
     * tornam-se:
     *
     * retratt.com/eventos
     */
    if (
      HOSTS_RETRATT.has(host) &&
      host !== RETRATT_HOST
    ) {
      return NextResponse.redirect(
        criarDestinoRetratt(request, path),
        308,
      );
    }

    /**
     * Evita expor novamente o prefixo técnico.
     *
     * retratt.com/fotos/eventos
     * torna-se:
     * retratt.com/eventos
     */
    if (
      path === '/fotos' ||
      path.startsWith('/fotos/')
    ) {
      return NextResponse.redirect(
        criarDestinoRetratt(request, path),
        308,
      );
    }

    /**
     * Recuperação de senha continua utilizando
     * as rotas compartilhadas da aplicação principal.
     */
    if (ROTAS_COMPARTILHADAS.has(path)) {
      return NextResponse.next();
    }

    /**
     * Logos, fontes, PDFs, scripts e outros arquivos
     * públicos continuam sendo servidos normalmente.
     */
    if (isArquivoPublico(path)) {
      return NextResponse.next();
    }

    /**
     * SEO e manifesto específicos da antiga área /fotos.
     *
     * retratt.com/robots.txt
     * é entregue internamente por:
     * /fotos/robots.txt
     */
    if (ARQUIVOS_SEO_RETRATT.has(path)) {
      const destinoInterno = request.nextUrl.clone();

      destinoInterno.pathname = `/fotos${path}`;

      return NextResponse.rewrite(destinoInterno);
    }

    /**
     * Reescrita principal:
     *
     * retratt.com
     * entrega internamente:
     * /fotos
     *
     * retratt.com/eventos
     * entrega internamente:
     * /fotos/eventos
     *
     * O visitante nunca vê o prefixo /fotos.
     */
    const destinoInterno = request.nextUrl.clone();

    destinoInterno.pathname =
      path === '/'
        ? '/fotos'
        : `/fotos${path}`;

    return NextResponse.rewrite(destinoInterno);
  }

  /**
   * 4. Proteção original do painel staff do iTatame.
   *
   * Essa parte foi mantida praticamente intacta.
   */
  const rotasProtegidas = ['/staff'];

  const isRotaProtegida =
    rotasProtegidas.some((rota) =>
      path.startsWith(rota),
    ) && path !== '/staff/login';

  const temAcessoStaff =
    path.startsWith('/staff') &&
    request.cookies.get('itatame_staff_access')?.value === '1';

  if (isRotaProtegida && !temAcessoStaff) {
    return NextResponse.redirect(
      new URL('/staff/login', request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};