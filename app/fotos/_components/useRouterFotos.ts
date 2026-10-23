'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { destinoNavegacaoFotos } from '@/app/lib/fotos-navegacao';

export function useRouterFotos() {
  const router = useRouter();
  return useMemo(() => ({ ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(destinoNavegacaoFotos(href, window.location.hostname), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(destinoNavegacaoFotos(href, window.location.hostname), options),
    prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(destinoNavegacaoFotos(href, window.location.hostname), options),
  }), [router]);
}
