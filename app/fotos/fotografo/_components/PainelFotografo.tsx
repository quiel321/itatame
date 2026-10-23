'use client';

import Link from '@/app/fotos/_components/LinkFotos';
import { useState, type ReactNode } from 'react';
import { ArrowUpRight, Camera, CircleDollarSign, FolderOpen, LayoutDashboard, LogOut, Menu, ReceiptText, UserRound, X } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import FotosShell from '../../_components/FotosShell';
import s from './gestao.module.css';

export type PaginaFotografo = 'visao-geral' | 'galerias' | 'vendas' | 'financeiro' | 'perfil';
const paginas = [
  { id: 'visao-geral', href: '/fotos/fotografo/dashboard', nome: 'Visão geral', icon: LayoutDashboard },
  { id: 'galerias', href: '/fotos/fotografo/galerias', nome: 'Galerias e mídias', icon: FolderOpen },
  { id: 'vendas', href: '/fotos/fotografo/vendas', nome: 'Vendas e pedidos', icon: ReceiptText },
  { id: 'financeiro', href: '/fotos/fotografo/financeiro', nome: 'Financeiro', icon: CircleDollarSign },
  { id: 'perfil', href: '/fotos/fotografo/perfil', nome: 'Perfil e conta', icon: UserRound },
] as const;

export default function PainelFotografo({ children, pagina, titulo, descricao, acoes, nome, fotoUrl }: { children: ReactNode; pagina: PaginaFotografo; titulo: string; descricao?: string; acoes?: ReactNode; nome?: string; fotoUrl?: string | null }) {
  const [menu, setMenu] = useState(false);
  const [saindo, setSaindo] = useState(false), [erroSair, setErroSair] = useState('');
  async function sair() {
    if (saindo) return;
    setSaindo(true); setErroSair('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      window.location.replace('/fotos/login?perfil=fotografo');
    } catch {
      setErroSair('Não foi possível sair da conta. Tente novamente.'); setSaindo(false);
    }
  }
  return <FotosShell area="fotografo" cabecalho={<header className={s.topo}><Link href="/fotos/fotografo/dashboard" aria-label="Retratt, visão geral"><img src="/retratt/logo-white.svg" alt="Retratt" width={120} height={28} /></Link><span className={s.identificacao}>Área do fotógrafo</span><Link href="/fotos" className={s.loja}>Ver loja <ArrowUpRight size={14} /></Link><button type="button" onClick={() => void sair()} disabled={saindo} className={`${s.botao} ${s.sair}`}><LogOut size={15} />{saindo ? 'Saindo…' : 'Sair'}</button></header>}>
    <div className={s.estrutura}>
      <aside className={s.lateral}>
        <div className={s.usuario}><span className={s.avatar}>{fotoUrl ? <img src={fotoUrl} alt="Sua foto de perfil" /> : <Camera size={20} />}</span><span><strong>{nome || 'Meu painel'}</strong><small>Fotógrafo Retratt</small></span></div>
        <button type="button" className={s.menuBotao} aria-expanded={menu} aria-controls="navegacao-fotografo" onClick={() => setMenu(!menu)}><span>{paginas.find(p => p.id === pagina)?.nome}</span>{menu ? <X size={18} /> : <Menu size={18} />}</button>
        <nav id="navegacao-fotografo" aria-label="Gestão do fotógrafo" className={`${s.navegacao} ${menu ? s.menuAberto : ''}`}>{paginas.map(p => <Link key={p.id} href={p.href} aria-current={pagina === p.id ? 'page' : undefined} onClick={() => setMenu(false)}><span><p.icon size={17} /></span>{p.nome}</Link>)}<a href="https://wa.me/5565993059729" target="_blank" rel="noopener noreferrer" className={s.suporte}>Falar com o suporte <ArrowUpRight size={13} /></a></nav>
      </aside>
      <main className={s.conteudo}>{erroSair && <p role="alert" className={s.aviso}>{erroSair}</p>}<header className={s.cabecalho}><div><h1>{titulo}</h1>{descricao && <p>{descricao}</p>}</div>{acoes && <div className={s.acoes}>{acoes}</div>}</header>{children}</main>
    </div>
  </FotosShell>;
}
