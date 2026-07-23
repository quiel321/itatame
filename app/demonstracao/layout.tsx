import type { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br";
const canonical = `${baseUrl}/demonstracao`;
const titulo = "Sistema de Campeonatos de Jiu-Jitsu e Lutas | iTatame";
const descricao =
  "Sistema para campeonatos de Jiu-Jitsu e artes marciais com inscrições, pagamentos, categorias, chaves, check-in, chamador, mesários, placares, ranking e resultados.";

export const metadata: Metadata = {
  title: titulo,
  description: descricao,
  alternates: { canonical },
  keywords: [
    "sistema de campeonato de jiu-jitsu",
    "software para campeonato de luta",
    "gestão de campeonatos de artes marciais",
    "chaveamento de jiu-jitsu",
    "placar eletrônico de jiu-jitsu",
    "inscrição para campeonato de jiu-jitsu",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: canonical,
    siteName: "iTatame",
    title: titulo,
    description: descricao,
    images: [
      {
        url: `${baseUrl}/capa-compartilhamento.jpg`,
        width: 1200,
        height: 630,
        alt: "iTatame — sistema para campeonatos de Jiu-Jitsu e artes marciais",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: titulo,
    description: descricao,
    images: [`${baseUrl}/capa-compartilhamento.jpg`],
  },
};

const dadosEstruturados = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${baseUrl}/#organization`,
      name: "iTatame",
      url: baseUrl,
      logo: `${baseUrl}/logo.svg`,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        telephone: "+55-65-99305-9729",
        availableLanguage: "Portuguese",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${canonical}#software`,
      name: "iTatame — Sistema de Campeonatos",
      applicationCategory: "SportsApplication",
      applicationSubCategory: "Gestão de campeonatos de artes marciais",
      operatingSystem: "Web",
      url: canonical,
      description: descricao,
      publisher: { "@id": `${baseUrl}/#organization` },
      audience: {
        "@type": "Audience",
        audienceType: "Organizadores de campeonatos de Jiu-Jitsu e artes marciais",
      },
      featureList: [
        "Inscrições e pagamentos",
        "Checagem de atletas",
        "Chaveamento de categorias",
        "Check-in e chamada de atletas",
        "Operação de mesários e placares",
        "Ranking, resultados e PDFs de contingência",
      ],
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Início",
          item: baseUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Sistema de campeonatos",
          item: canonical,
        },
      ],
    },
  ],
};

export default function DemonstracaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
