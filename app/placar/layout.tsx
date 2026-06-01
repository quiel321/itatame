import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Placar Digital IBJJF Gratuito | iTatame',
  description: 'Eleve o nível do seu treino. Placar digital completo, 100% gratuito, com cronômetro e pontuação oficial. Do treino diário à gestão do seu campeonato.',
  openGraph: {
    title: 'Placar Digital IBJJF Gratuito | iTatame',
    description: 'Eleve o nível do seu treino. Placar digital completo, 100% gratuito, com cronômetro e pontuação oficial.',
    url: 'https://itatame.com.br/placar', // Ajuste para o domínio oficial do seu site
    siteName: 'iTatame',
    // Dentro do seu layout.tsx
   images: [
   {
    url: '/placar-og.svg?v=2', // Adicionamos esse ?v=2 para forçar o cache a atualizar
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
    images: ['/placar-og.svg'],
  },
};

export default function PlacarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}