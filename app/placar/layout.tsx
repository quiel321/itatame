import { Metadata } from 'next';

export const metadata: Metadata = {
  // O Next.js precisa dessa base para gerar a URL absoluta da imagem pro WhatsApp
  metadataBase: new URL('https://itatame.com.br'), 
  title: 'Placar Digital IBJJF Gratuito | iTatame',
  description: 'Eleve o nível do seu treino. Placar digital completo, 100% gratuito, com cronômetro e pontuação oficial. Do treino diário à gestão do seu campeonato.',
  openGraph: {
    title: 'Placar Digital IBJJF Gratuito | iTatame',
    description: 'Eleve o nível do seu treino. Placar digital completo, 100% gratuito, com cronômetro e pontuação oficial.',
    url: 'https://itatame.com.br/placar',
    siteName: 'iTatame',
    images: [
      {
        // IMPORTANTE: Tem que ser PNG ou JPG! O WhatsApp não lê SVG.
        url: '/placar-og.png', 
        width: 1200,
        height: 630,
        alt: 'Placar Digital Gratuito iTatame',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Placar Digital IBJJF Gratuito | iTatame',
    description: 'Eleve o nível do seu treino. Placar digital completo, 100% gratuito, com cronômetro e pontuação oficial.',
    images: ['/placar-og.png'], // AQUI TAMBÉM
  },
};

export default function PlacarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}