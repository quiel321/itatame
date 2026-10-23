'use client';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
const AreaTrabalhoFotografo = dynamic(() => import('./_components/AreaTrabalhoFotografo'), {
 loading: () => <p role="status" className="min-h-64 p-6 text-sm text-zinc-300">Abrindo painel do fotógrafo…</p>,
});
export default function LayoutFotografo({children}: {children: ReactNode}) {
 const pagina = usePathname().replace(/^\/fotos(?=\/)/,'').split('/')[2];
 const tela = pagina === 'dashboard' ? 'visao-geral' : pagina === 'galerias' || pagina === 'perfil' || pagina === 'vendas' || pagina === 'financeiro' ? pagina : null;
 return tela ? <><AreaTrabalhoFotografo tela={tela}/>{children}</> : children;
}
