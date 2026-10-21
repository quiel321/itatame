'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import AreaTrabalhoOrganizador from './_components/AreaTrabalhoOrganizador';

export default function LayoutOrganizador({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/^\/fotos(?=\/)/, '');
  const pagina = pathname.split('/')[2];
  const tela = pagina === 'galerias' || pagina === 'fotografos' || pagina === 'vendas' || pagina === 'financeiro' || pagina === 'perfil' ? pagina : 'visao-geral';
  return <><AreaTrabalhoOrganizador tela={tela} />{children}</>;
}
