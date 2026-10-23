'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import AreaTrabalhoFotografo from './_components/AreaTrabalhoFotografo';
export default function LayoutFotografo({children}: {children: ReactNode}) {
 const pagina = usePathname().replace(/^\/fotos(?=\/)/,'').split('/')[2];
 const tela = pagina === 'dashboard' ? 'visao-geral' : pagina === 'galerias' || pagina === 'perfil' || pagina === 'vendas' || pagina === 'financeiro' ? pagina : null;
 return tela ? <><AreaTrabalhoFotografo tela={tela}/>{children}</> : children;
}
