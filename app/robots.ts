import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br";
const fotosUrl = process.env.NEXT_PUBLIC_FOTOS_URL || "https://fotos.itatame.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/super-admin/",
        "/staff/",
        "/perfil",
        "/pagamento",
        "/minhas-inscricoes",
        "/login",
        "/login-organizador",
        "/recuperar-senha",
        "/nova-senha",
        "/fotos/admin",
        "/fotos/login",
        "/fotos/carrinho",
        "/fotos/comprador",
        "/fotos/minhas-compras",
        "/fotos/fotografo/dashboard",
        "/fotos/fotografo/painel",
      ],
    },
    sitemap: [`${baseUrl}/sitemap.xml`, `${fotosUrl}/sitemap.xml`],
    host: baseUrl,
  };
}
