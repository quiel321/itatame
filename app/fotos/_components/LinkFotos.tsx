'use client';

import Link from 'next/link';
import { useSyncExternalStore, type ComponentProps } from 'react';
import { destinoNavegacaoFotos } from '@/app/lib/fotos-navegacao';

const assinar = () => () => {};
const host = () => window.location.hostname;
const servidor = () => '';

export default function LinkFotos({ href, ...props }: ComponentProps<typeof Link>) {
  const hostname = useSyncExternalStore(assinar, host, servidor);
  const destino = typeof href === 'string' ? destinoNavegacaoFotos(href, hostname)
    : href.host || href.hostname || href.protocol ? href : { ...href, pathname: href.pathname ? destinoNavegacaoFotos(href.pathname, hostname) : href.pathname };
  return <Link {...props} href={destino} />;
}
