// Nomes da navegação e arquivos técnicos nunca viram portfólios na raiz.
export const ROTAS_RESERVADAS_PORTFOLIO = new Set([
  'acesso', 'admin', 'api', 'cadastro', 'carrinho', 'comprador', 'evento',
  'eventos', 'fotos', 'fotografo', 'login', 'minhas-compras', 'organizador',
  'precos', 'privacidade', 'termos-de-uso', 'recuperar-senha', 'nova-senha',
  'validar-codec-local', 'validar-data-local', '_next', 'sw', 'retratt-sw',
  'robots', 'sitemap', 'manifest', 'site', 'opengraph-image', 'icon',
]);

export function slugPortfolioCurtoPermitido(slug: string) {
  return /^[a-z0-9-]{1,120}$/i.test(slug) && !ROTAS_RESERVADAS_PORTFOLIO.has(slug.toLowerCase());
}

export function caminhoPortfolioOrganizador(slug: string) {
  const segmento = encodeURIComponent(slug);
  return slugPortfolioCurtoPermitido(slug) ? `/${segmento}` : `/organizador/${segmento}`;
}
