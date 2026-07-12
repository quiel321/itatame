"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { Menu, X } from "lucide-react";

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
  const [perfilAtivo, setPerfilAtivo] = useState<string>("comprador");
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setNome(null);
        return;
      }
      
      // 🔥 O CÉREBRO DA NAVBAR: Descobre qual é o tipo de usuário para direcionar o botão vermelho!
      const [resAtleta, resComprador, resFotografo, resOrg] = await Promise.all([
        supabase.from("atletas").select("nome").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("foto_compradores").select("nome").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("fotografos").select("nome").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("foto_organizadores").select("nome").eq("user_id", data.user.id).maybeSingle(),
      ]);

      let nomeEncontrado = null;
      let rota = "comprador";

      if (resFotografo.data) {
        nomeEncontrado = resFotografo.data.nome;
        rota = "fotografo/dashboard";
      } else if (resOrg.data) {
        nomeEncontrado = resOrg.data.nome;
        rota = "organizador/dashboard";
      } else if (resComprador.data) {
        nomeEncontrado = resComprador.data.nome;
        rota = "comprador";
      } else if (resAtleta.data) {
        nomeEncontrado = resAtleta.data.nome;
        rota = "comprador";
      }

      setNome(nomeEncontrado?.split(" ")?.[0] || data.user.email?.split("@")[0] || "Conta");
      setPerfilAtivo(rota);
    }

    carregar();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void carregar());
    return () => listener.subscription.unsubscribe();
  }, []);

  const fecharMenu = () => setMenuAberto(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        
        <Link href="/fotos" className="shrink-0 cursor-pointer" onClick={fecharMenu}><LogoFotos /></Link>
        
        <nav className="hidden items-center gap-7 text-[10px] font-black uppercase tracking-widest text-zinc-500 md:flex">
          <Link href="/fotos" className="cursor-pointer hover:text-red-500 transition-colors">Eventos</Link>
          <Link href="/fotos/comprador" className="cursor-pointer hover:text-red-500 transition-colors">Minhas fotos</Link>
          <Link href="/fotos/fotografo/dashboard" className="cursor-pointer hover:text-red-500 transition-colors">Fotógrafo</Link>
          <Link href="/fotos/organizador/dashboard" className="cursor-pointer hover:text-red-500 transition-colors">Organizador</Link>
          <Link href="/fotos" className="cursor-pointer hover:text-white transition-colors">iTatame</Link>
        </nav>
        
        {/* 🔥 BOTÃO ÚNICO INTELIGENTE DESKTOP */}
        <div className="hidden md:flex items-center gap-3">
          <Link href={nome ? `/fotos/${perfilAtivo}` : "/fotos/login"} className="cursor-pointer rounded-xl bg-red-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-500 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            {nome ? `Olá, ${nome}` : "Entrar / Login"}
          </Link>
        </div>

        {/* BOTÃO HAMBÚRGUER MOBILE */}
        <button 
          onClick={() => setMenuAberto(!menuAberto)}
          className="cursor-pointer p-2 text-zinc-400 hover:text-white transition-colors md:hidden"
        >
          {menuAberto ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* OVERLAY DO MENU MOBILE */}
      {menuAberto && (
        <div className="absolute top-16 left-0 w-full h-[calc(100vh-64px)] bg-[#050505] border-t border-white/5 flex flex-col p-6 animate-in slide-in-from-top-2 md:hidden">
          
          <div className="flex flex-col gap-2 mb-8">
             <Link href={nome ? `/fotos/${perfilAtivo}` : "/fotos/login"} onClick={fecharMenu} className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-red-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]">
               {nome ? `Minha Conta (${nome})` : "Fazer Login"}
             </Link>
          </div>

          <nav className="flex flex-col gap-6 text-xs font-black uppercase tracking-widest text-zinc-400">
            <Link href="/fotos" onClick={fecharMenu} className="cursor-pointer hover:text-red-500 transition-colors border-b border-white/5 pb-4">Eventos & Galerias</Link>
            <Link href="/fotos/comprador" onClick={fecharMenu} className="cursor-pointer hover:text-red-500 transition-colors border-b border-white/5 pb-4">Minhas Fotos</Link>
            <Link href="/fotos/fotografo/dashboard" onClick={fecharMenu} className="cursor-pointer hover:text-red-500 transition-colors border-b border-white/5 pb-4">Área do Fotógrafo</Link>
            <Link href="/fotos/organizador/dashboard" onClick={fecharMenu} className="cursor-pointer hover:text-red-500 transition-colors border-b border-white/5 pb-4">Para Organizadores</Link>
            <Link href="/fotos" onClick={fecharMenu} className="cursor-pointer hover:text-white transition-colors pb-4">Voltar para o iTatame</Link>
          </nav>
        </div>
      )}
    </header>
  );
}