import type { Metadata } from "next";

const fotosUrl = process.env.NEXT_PUBLIC_FOTOS_URL || "https://retratt.com";

export const metadata: Metadata = {
  metadataBase: new URL(fotosUrl),
  title: {
    default: "Retratt | Encontre as fotos dos seus melhores momentos",
    template: "%s | Retratt",
  },
  description:
    "Encontre, compre e reviva seus melhores momentos em fotos de esportes, corridas, casamentos, formaturas, shows e eventos com busca facial inteligente.",
  applicationName: "Retratt",
  category: "Fotografia de eventos",
  icons: {
    icon: [
      { url: "/retratt/favicon.ico" },
      { url: "/retratt/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/retratt/favicon.ico",
    apple: [{ url: "/retratt/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  keywords: [
    "Retratt",
    "fotos de eventos",
    "venda de fotos online",
    "fotografia esportiva",
    "fotos de corridas",
    "fotos de futebol",
    "fotos de casamento",
    "fotos de formatura",
    "fotos de shows",
    "buscar fotos por rosto",
    "galeria de fotos com reconhecimento facial",
  ],
  openGraph: {
    title: "Retratt | Encontre suas fotos. Reviva seus momentos.",
    description:
      "Reviva suas conquistas. Encontre suas fotos por evento ou reconhecimento facial e faça o download digital.",
    url: "/",
    siteName: "Retratt",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Retratt" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Retratt | Encontre suas fotos. Reviva seus momentos.",
    description: "Esportes, casamentos, formaturas, shows e muito mais com busca facial inteligente.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const dadosEstruturados = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${fotosUrl}/#website`,
  name: "Retratt",
  alternateName: "Retratt Fotos",
  url: fotosUrl,
  description:
    "Plataforma de fotografia de eventos com galerias oficiais, busca facial inteligente e venda digital de fotos.",
  inLanguage: "pt-BR",
  publisher: {
    "@type": "Organization",
    name: "Retratt",
    url: fotosUrl,
  },
};

export default function FotosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados) }}
      />
      {children}
    </>
  );
}
