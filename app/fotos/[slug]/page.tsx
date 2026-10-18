import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PaginaPortfolio, { generateMetadata as metadataPortfolio } from '../organizador/[slug]/page';
import { slugPortfolioCurtoPermitido } from '@/app/lib/fotos-portfolio-url';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  return slugPortfolioCurtoPermitido(slug) ? metadataPortfolio(props) : {};
}

export default async function PortfolioCurto(props: Props) {
  const { slug } = await props.params;
  if (!slugPortfolioCurtoPermitido(slug)) notFound();
  return PaginaPortfolio(props);
}
