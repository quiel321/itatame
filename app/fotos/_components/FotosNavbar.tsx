"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { Menu, X } from "lucide-react"; // 🔥 Adicionados ícones do menu

function LogoFotos() {
  return (
    <div className="flex items-center gap-3 md:gap-4 group select-none">
      <img 
        src="/logo.svg" 
        alt="iTatame" 
        className="h-6 md:h-7 w-auto object-contain transition-opacity group-hover:opacity-80" 
      />
      <div className="w-[1px] h-5 md:h-6 bg-white/15"></div>
      <span className="text-[12px] md:text-[14px] font-black uppercase tracking-[0.35em] text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-700 mt-0.5">
        FOTOS
      </span>
    </div>
  );
}

export default function FotosNavbar() {
  const [nome, setNome] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false); // 🔥 Estado do Menu Mobile

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setNome(null);
        return;
      }
      const [{ data: atleta }, { data: comprador }] = await Promise.all([
        supabase.from("atletas").select("nome").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("foto_compradores").select("nome").eq("user_id", data.user.id).maybeSingle(),
      ]);
      setNome(atleta?.nome?.split(" ")?.[0] || comprador?.nome?.split(" ")?.[0] || data.user.email?.split("@")[0] || "Conta");
    }

    carregar();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void carregar());
    return () => listener.subscription.unsubscribe();
  }, []);

  // Fecha o menu ao clicar num link
  const fecharMenu = () => setMenuAberto(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        
        <Link href="/fotos" className="shrink-0 cursor-pointer" onClick={fecharMenu}><LogoFotos /></Link>
        
        {/* 🔥 MENU DESKTOP */}
        <nav className="hidden items-center gap-7 text-[10px] font-black uppercase tracking-widest text-zinc-500 md:flex">
          <Link href="/fotos" className="cursor-pointer hover:text-red-500 transition-colors">Eventos</Link>
          <Link href="/fotos/comprador" className="cursor-pointer hover:text-red-500 transition-colors">Minhas fotos</Link>
          <Link href="/fotos/fotografo" className="cursor-pointer hover:text-red-500 transition-colors">Fotógrafo</Link>
          <Link href="/fotos/organizador" className="cursor-pointer hover:text-red-500 transition-colors">Organizador</Link>
          <Link href="/fotos" className="cursor-pointer hover:text-white transition-colors">iTatame</Link>
        </nav>
        
        {/* 🔥 BOTÕES DESKTOP */}
        <div className="hidden md:flex items-center gap-3">
          <Link href={nome ? "/fotos/comprador" : "/fotos/login"} className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:bg-white/10 hover:text-white transition-all">
            {nome ? `Olá, ${nome}` : "Entrar"}
          </Link>
          <Link href="/fotos/login?perfil=fotografo&next=/fotos/fotografo/dashboard" className="cursor-pointer rounded-xl bg-red-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-500 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            Login/Entrar
          </Link>
        </div>

        {/* 🔥 BOTÃO HAMBÚRGUER MOBILE */}
        <button 
          onClick={() => setMenuAberto(!menuAberto)}
          className="cursor-pointer p-2 text-zinc-400 hover:text-white transition-colors md:hidden"
        >
          {menuAberto ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* 🔥 OVERLAY DO MENU MOBILE */}
      {menuAberto && (
        <div className="absolute top-16 left-0 w-full h-[calc(100vh-64px)] bg-[#050505] border-t border-white/5 flex flex-col p-6 animate-in slide-in-from-top-2 md:hidden">
          
          <div className="flex flex-col gap-2 mb-8">
             <Link href={nome ? "/fotos/comprador" : "/fotos/login"} onClick={fecharMenu} className="w-full cursor-pointer text-center rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-xs font-black uppercase tracking-widest text-zinc-200">
               {nome ? `Minha Conta (${nome})` : "Fazer Login"}
             </Link>
          </div>

          <nav className="flex flex-col gap-6 text-xs font-black uppercase tracking-widest text-zinc-400">
            <Link href="/fotos" onClick={fecharMenu} className="cursor-pointer hover:text-red-500 transition-colors border-b border-white/5 pb-4">Eventos & Galerias</Link>
            <Link href="/fotos/comprador" onClick={fecharMenu} className="cursor-pointer hover:text-red-500 transition-colors border-b border-white/5 pb-4">Minhas Fotos</Link>
            <Link href="/fotos/fotografo" onClick={fecharMenu} className="cursor-pointer hover:text-red-500 transition-colors border-b border-white/5 pb-4">Área do Fotógrafo</Link>
            <Link href="/fotos/organizador" onClick={fecharMenu} className="cursor-pointer hover:text-red-500 transition-colors border-b border-white/5 pb-4">Para Organizadores</Link>
            <Link href="/fotos" onClick={fecharMenu} className="cursor-pointer hover:text-white transition-colors pb-4">Voltar para o iTatame</Link>
          </nav>

          <div className="mt-auto pb-8">
             <Link href="/fotos/login?perfil=fotografo&next=/fotos/fotografo/dashboard" onClick={fecharMenu} className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-red-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]">
               Painel de Upload
             </Link>
          </div>
        </div>
      )}
    </header>
  );
}
