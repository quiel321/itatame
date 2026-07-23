import type { Metadata } from "next";

const fotosUrl = process.env.NEXT_PUBLIC_FOTOS_URL || "https://fotos.itatame.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(fotosUrl),
  title: {
    default: "iTatame Fotos | Encontre suas fotos esportivas",
    template: "%s | iTatame Fotos",
  },
  description:
    "Encontre e compre suas fotos de campeonatos e eventos esportivos com busca facial inteligente, galerias oficiais e download digital.",
  applicationName: "iTatame Fotos",
  category: "Fotografia esportiva",
  icons: {
    icon: [{ url: "/fotos-icon.svg", type: "image/svg+xml" }],
    shortcut: "/fotos-icon.svg",
  },
  keywords: [
    "fotos de jiu-jitsu",
    "fotografia esportiva",
    "fotos de campeonatos",
    "buscar fotos por rosto",
    "fotos de atletas",
    "iTatame Fotos",
  ],
  openGraph: {
    title: "iTatame Fotos | Encontre suas fotos esportivas",
    description:
      "Reviva suas conquistas. Encontre suas fotos por evento ou reconhecimento facial e faça o download digital.",
    url: "/",
    siteName: "iTatame Fotos",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "iTatame Fotos" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "iTatame Fotos | Encontre suas fotos esportivas",
    description: "Galerias esportivas oficiais com busca facial inteligente.",
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
  name: "iTatame Fotos",
  alternateName: "Itatame Fotos",
  url: fotosUrl,
  description:
    "Plataforma de fotografia esportiva com galerias oficiais, busca facial inteligente e venda digital de fotos.",
  inLanguage: "pt-BR",
  publisher: {
    "@type": "Organization",
    name: "iTatame Fotos",
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
