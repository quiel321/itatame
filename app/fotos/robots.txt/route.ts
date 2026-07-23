const fotosUrl = process.env.NEXT_PUBLIC_FOTOS_URL || "https://fotos.itatame.com.br";
const fotosHost = new URL(fotosUrl).host;

export function GET() {
  const conteudo = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /admin",
    "Disallow: /login",
    "Disallow: /carrinho",
    "Disallow: /comprador",
    "Disallow: /minhas-compras",
    "Disallow: /fotografo/dashboard",
    "Disallow: /fotografo/painel",
    `Sitemap: ${fotosUrl}/sitemap.xml`,
    `Host: ${fotosHost}`,
    "",
  ].join("\n");

  return new Response(conteudo, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
