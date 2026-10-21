"use client";

import type { ReactNode } from "react";
import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from 'next/image';
import { ShoppingBag, ArrowUpRight } from 'lucide-react';
import FotosNavbar from "./FotosNavbar";
import AcompanharPagamentosFotos from './AcompanharPagamentosFotos';
import WhatsAppSuporteRetratt from './WhatsAppSuporteRetratt';

type MarcaPortfolio = { nome: string; avatarUrl: string | null; href: string };
const escutarCarrinho = (cb: () => void) => { window.addEventListener('storage', cb); window.addEventListener('carrinho-fotos-atualizado', cb); return () => { window.removeEventListener('storage', cb); window.removeEventListener('carrinho-fotos-atualizado', cb); }; };
const carrinhoAtual = () => { try { return localStorage.getItem('carrinho_fotos') || '[]'; } catch { return '[]'; } };
function CabecalhoPortfolio({ marca }: { marca: MarcaPortfolio }) {
  const carrinho = useSyncExternalStore(escutarCarrinho, carrinhoAtual, () => '[]');
  let quantidade = 0;
  try { const ids = JSON.parse(carrinho); if (Array.isArray(ids)) quantidade = new Set(ids.filter(id => typeof id === 'string')).size; } catch { /* Carrinho inválido não interrompe a navegação. */ }
  return <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080809]/95 text-white backdrop-blur-lg"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8"><Link href={marca.href} className="flex min-w-0 items-center gap-3"><span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/5">{marca.avatarUrl ? <Image src={marca.avatarUrl} alt={`Logo de ${marca.nome}`} width={40} height={40} unoptimized className="h-full w-full object-contain" /> : <span className="text-sm font-black text-orange-300">{marca.nome.slice(0, 2).toUpperCase()}</span>}</span><span className="max-w-[200px] break-words text-sm font-bold leading-tight sm:max-w-xs sm:text-base">{marca.nome}</span></Link><nav aria-label="Navegação do portfólio" className="flex items-center gap-3 text-[11px] text-zinc-300 sm:gap-5"><a href="#galerias" className="hidden min-h-10 items-center hover:text-white sm:inline-flex">Galerias</a><a href="#sobre" className="hidden min-h-10 items-center hover:text-white sm:inline-flex">Sobre</a><Link href="/fotos/minhas-compras" className="inline-flex min-h-10 items-center hover:text-white">Minhas fotos</Link><Link href="/fotos/carrinho" aria-label={`Carrinho com ${quantidade} itens`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 hover:bg-white/5"><ShoppingBag size={15} /><span>{quantidade || 'Carrinho'}</span></Link></nav></div></header>;
}

export default function FotosShell({ children, area = "publico", marca, cabecalho }: { children: ReactNode; area?: "publico" | "fotografo"; marca?: MarcaPortfolio; cabecalho?: ReactNode }) {
  const sitePrincipal = process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br";
  useEffect(() => {
    document.body.classList.add("fotos-route");
    return () => document.body.classList.remove("fotos-route");
  }, []);

  return (
    <div data-fotos-shell className="min-h-screen bg-black text-white flex flex-col font-sans">
      {cabecalho || (marca ? <CabecalhoPortfolio marca={marca} /> : <FotosNavbar area={area} />)}
      <AcompanharPagamentosFotos />
      <WhatsAppSuporteRetratt />

      {/* O conteúdo da página (Home, Eventos, etc) entra aqui e expande para preencher o ecrã */}
      <div className="flex-1">
        {children}
      </div>

      {/* 🔥 RODAPÉ GLOBAL DO MÓDULO DE FOTOS */}
      {marca ? <footer className="mt-auto border-t border-white/10 bg-[#080809] px-5 py-6 text-zinc-500 sm:px-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5"><p className="text-xs">© {new Date().getFullYear()} {marca.nome}</p><div className="flex flex-wrap items-center gap-4 text-[10px]"><Link href="/fotos/termos-de-uso">Termos</Link><Link href="/fotos/privacidade">Privacidade</Link><Link href="/fotos" className="inline-flex items-center gap-1 text-zinc-400">Tecnologia Retratt <ArrowUpRight size={12} /></Link></div></div></footer> : <footer className="border-t border-white/5 bg-[#050505] py-10 px-5 md:px-8 mt-auto relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">

          <div className="flex flex-col items-center md:items-start gap-2">
            <Link href="/fotos" aria-label="Ir para a página inicial da Retratt" title="Retratt">
              <img src="/retratt/logo-white.svg" alt="Retratt" className="h-7 w-auto opacity-70 transition-all hover:opacity-100 md:h-8" />
            </Link>
            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
              &copy; {new Date().getFullYear()} Retratt. Todos os direitos reservados.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[9px] font-black uppercase tracking-widest text-zinc-600">
            <Link href={sitePrincipal} className="hover:text-retratt transition-colors">iTatame Eventos</Link>
            <Link href="/fotos/precos" className="hover:text-white transition-colors">Preços</Link>
            <Link href="/fotos/termos-de-uso" className="hover:text-white transition-colors">Termos de Uso</Link>
            <Link href="/fotos/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
            <a
              href="https://wa.me/5565993059729?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20na%20Retratt."
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors"
              aria-label="Falar com o suporte da Retratt pelo WhatsApp"
            >
              Suporte
            </a>
          </div>

        </div>
      </footer>}
    </div>
  );
}
