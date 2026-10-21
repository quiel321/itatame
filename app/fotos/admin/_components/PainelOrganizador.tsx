'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ArrowUpRight, ChartNoAxesCombined, Check, FolderOpen, LayoutDashboard, LogOut, Menu, ReceiptText, Settings2, Trophy, Users, X } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import FotosShell from '@/app/fotos/_components/FotosShell';
import g from '@/app/fotos/fotografo/_components/gestao.module.css';
import s from './organizador.module.css';

export type TelaOrganizador = 'visao-geral' | 'galerias' | 'fotografos' | 'vendas' | 'financeiro' | 'perfil';
const menus = [
  { id: 'visao-geral', nome: 'Visão geral', href: '/fotos/admin', icon: LayoutDashboard },
  { id: 'galerias', nome: 'Galerias', href: '/fotos/admin/galerias', icon: FolderOpen },
  { id: 'fotografos', nome: 'Fotógrafos', href: '/fotos/admin/fotografos', icon: Users },
  { id: 'vendas', nome: 'Vendas e pedidos', href: '/fotos/admin/vendas', icon: ReceiptText },
  { id: 'financeiro', nome: 'Financeiro', href: '/fotos/admin/financeiro', icon: ChartNoAxesCombined },
  { id: 'perfil', nome: 'Perfil e recebimentos', href: '/fotos/admin/perfil', icon: Settings2 },
] as const;

export default function PainelOrganizador({ children, tela, titulo, descricao, acoes, nome, avatar, portfolio }: { children: ReactNode; tela: TelaOrganizador; titulo: string; descricao?: string; acoes?: ReactNode; nome?: string; avatar?: string | null; portfolio?: string | null }) {
  const [menu, setMenu] = useState(false), [saindo, setSaindo] = useState(false), [erro, setErro] = useState('');
  async function sair() {
    setSaindo(true); setErro('');
    try { const { error } = await supabase.auth.signOut({ scope: 'local' }); if (error) throw error; window.location.replace('/fotos/login?perfil=organizador'); }
    catch { setErro('Não foi possível sair da conta. Tente novamente.'); setSaindo(false); }
  }
  return <FotosShell cabecalho={<header className={s.topo}><Link href="/fotos/admin" aria-label="Retratt, painel do organizador"><img src="/retratt/logo-white.svg" alt="Retratt" width={120} height={28} /></Link><span className={s.selo}><Trophy size={12} /> Organizador</span><div className={s.acoesTopo}>{portfolio && <Link href={portfolio} className={g.botao}>Meu site público <ArrowUpRight size={14} /></Link>}<button type="button" onClick={() => void sair()} disabled={saindo} className={g.botao}><LogOut size={14} />{saindo ? 'Saindo…' : 'Sair'}</button></div></header>}>
    <div className={s.layout}>
      <aside className={s.lateral}><div className={s.identidade}><span>{avatar ? <img src={avatar} alt={`Logo de ${nome || 'sua organização'}`} /> : <Trophy size={22} />}</span><div><strong>{nome || 'Minha organização'}</strong><small>Seu espaço na Retratt</small></div></div><button type="button" className={s.menuMobile} aria-expanded={menu} aria-controls="menu-organizador" onClick={() => setMenu(!menu)}><span>{menus.find(m => m.id === tela)?.nome}</span>{menu ? <X size={18} /> : <Menu size={18} />}</button><nav id="menu-organizador" aria-label="Gestão do organizador" className={`${s.menu} ${menu ? s.menuAberto : ''}`}>{menus.map(m => <Link key={m.id} href={m.href} aria-current={m.id === tela ? 'page' : undefined} onClick={() => setMenu(false)}><span><m.icon size={17} /></span>{m.nome}{m.id === tela && <Check size={12} className={s.check} />}</Link>)}</nav><div className={s.atalho}><p>Seu próximo evento começa aqui.</p><Link href="/fotos/admin/galerias#nova-galeria">Criar nova galeria <ArrowUpRight size={14} /></Link></div><a className={s.suporte} href="https://wa.me/5565993059729" target="_blank" rel="noopener noreferrer">Falar com o suporte <ArrowUpRight size={12} /></a></aside>
      <main className={`${g.conteudo} ${s.conteudo}`}>{erro && <p role="alert" className={g.aviso}>{erro}</p>}<header className={s.cabecalho}><div><p className={s.eyebrow}>Painel do organizador</p><h1>{titulo}</h1>{descricao && <p className={s.descricao}>{descricao}</p>}</div>{acoes && <div className={g.acoes}>{acoes}</div>}</header>{children}</main>
    </div>
  </FotosShell>;
}
