"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import FotosNavbar from "./FotosNavbar";

export default function FotosShell({ children }: { children: ReactNode }) {
  const sitePrincipal = process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br";
  useEffect(() => {
    document.body.classList.add("fotos-route");
    return () => document.body.classList.remove("fotos-route");
  }, []);

  return (
    <div data-fotos-shell className="min-h-screen bg-black text-white flex flex-col font-sans">
      <FotosNavbar />
      
      {/* O conteúdo da página (Home, Eventos, etc) entra aqui e expande para preencher o ecrã */}
      <div className="flex-1">
        {children}
      </div>

      {/* 🔥 RODAPÉ GLOBAL DO MÓDULO DE FOTOS */}
      <footer className="border-t border-white/5 bg-[#050505] py-10 px-5 md:px-8 mt-auto relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex flex-col items-center md:items-start gap-2">
            <Link href={sitePrincipal} aria-label="Voltar ao site do Itatame" title="Voltar ao site do Itatame">
              <img src="/logo.svg" alt="iTatame" className="h-5 md:h-6 w-auto opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all" />
            </Link>
            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
              &copy; {new Date().getFullYear()} iTatame. Todos os direitos reservados.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[9px] font-black uppercase tracking-widest text-zinc-600">
            <Link href={sitePrincipal} className="hover:text-red-500 transition-colors">Voltar ao Sistema</Link>
            <Link href="/fotos/precos" className="hover:text-white transition-colors">Preços</Link>
            <Link href="/fotos/termos-de-uso" className="hover:text-white transition-colors">Termos de Uso</Link>
            <Link href="/fotos/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
            <a
              href="https://wa.me/5565993059729?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20no%20Itatame%20Fotos."
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors"
              aria-label="Falar com o suporte do Itatame Fotos pelo WhatsApp"
            >
              Suporte
            </a>
          </div>

        </div>
      </footer>
    </div>
  );
}
