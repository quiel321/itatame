"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Navbar() {
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data } = await supabase.from("atletas").select("nome").eq("user_id", session.user.id).single();
        if (data && data.nome) {
          setUserName(data.nome.split(" ")[0]);
        } else {
          setUserName("Atleta");
        }
      } else {
        setUserName(null);
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  const linkConta = userName ? "/perfil" : "/login";

  return (
    <>
      {/* HEADER MAIS FINO (py-2.5 em vez de py-4) */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between">
          
          {/* LOGO FEITO 100% EM CÓDIGO (CSS) - Não usa mais imagem! */}
          <Link href="/" className="flex flex-col group">
            <div className="flex items-center">
              {/* Bloquinhos inclinados */}
              <div className="flex transform -skew-x-12 mr-1.5 h-4">
                <div className="bg-red-600 w-2.5 h-full mr-0.5 rounded-sm"></div>
                <div className="bg-white w-2.5 h-full rounded-sm"></div>
              </div>
              {/* Texto iTATAME */}
              <div className="text-white font-black text-xl italic tracking-tighter leading-none">
                <span className="text-red-600">i</span>TATAME
              </div>
            </div>
            <span className="text-[6px] text-zinc-400 font-black tracking-[0.25em] uppercase mt-0.5 ml-[28px] leading-none">
              Sistema de Campeonatos
            </span>
          </Link>
          
          {/* NAVEGAÇÃO DESKTOP */}
          <nav className="hidden md:flex gap-6 text-zinc-400 font-medium text-xs tracking-wide items-center">
            <Link href="/" className="hover:text-white transition">Início</Link>
            
            {/* NOVO BOTÃO RANKING (Com a Estrela Dourada) */}
            <Link href="/ranking" className="flex items-center gap-1.5 text-amber-500 hover:text-amber-400 transition font-bold">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
              Ranking
            </Link>
            
            <a href="https://wa.me/5565993059729" target="_blank" className="hover:text-white transition flex items-center gap-1.5 border-l border-white/10 pl-6">
              <svg className="w-3.5 h-3.5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.015c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Leve o iTATAME para seu Evento
            </a>
            
            {!loading && (
              <Link href={linkConta} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full transition font-bold shadow-[0_0_10px_rgba(239,68,68,0.2)] ml-2">
                {userName ? `Olá, ${userName.toUpperCase()}!` : "Entrar / Cadastrar"}
              </Link>
            )}
          </nav>

          <div className="md:hidden">
            {!loading && (
              <Link href={linkConta} className="bg-red-600 text-white text-[10px] uppercase tracking-wider font-bold px-4 py-2 rounded-full">
                {userName ? userName : "Entrar"}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* BOTTOM BAR MOBILE MANTIDA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#07070a]/95 backdrop-blur-xl border-t border-white/5 pb-safe">
        <div className="flex justify-around items-center h-16 px-2">
          <Link href="/" className="flex flex-col items-center justify-center w-16 gap-1 text-zinc-500 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            <span className="text-[10px] font-medium">Início</span>
          </Link>
          <Link href="/" className="flex flex-col items-center justify-center w-16 gap-1 text-zinc-500 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <span className="text-[10px] font-medium">Buscar</span>
          </Link>
          <Link href={linkConta} className="flex flex-col items-center justify-center w-16 gap-1 text-zinc-500 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            <span className="text-[10px] font-medium">Perfil</span>
          </Link>
        </div>
      </div>
    </>
  );
}