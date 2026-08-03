"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { resolverPerfilFotos, rotaLoginFotos, rotaPainelFotos, type PerfilFotos } from "@/app/lib/fotos-acesso";
import { ChartNoAxesCombined, FolderPlus, LayoutDashboard, Menu, Plus, ShoppingCart, UserRound, X } from "lucide-react";

const CARRINHO_FOTOS_KEY = "carrinho_fotos";

function LogoFotos() {
  return (
    <div className="group flex select-none items-center">
      <img
        src="/retratt/logo-white.png"
        alt="Retratt"
        className="h-8 w-auto object-contain transition-all duration-300 group-hover:brightness-110 md:h-9"
      />
    </div>
  );
}

type FotosNavbarProps = {
  area?: "publico" | "fotografo";
};

export default function FotosNavbar({ area = "publico" }: FotosNavbarProps) {
  const sitePrincipal = process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br";
  const [nome, setNome] = useState<string | null>(null);
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<PerfilFotos | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [itensCarrinho, setItensCarrinho] = useState(0);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setNome(null);
        setFotoPerfil(null);
        setPerfil(null);
        return;
      }
      const perfilAtual = await resolverPerfilFotos(supabase, data.user);

      // 🔥 O CÉREBRO DA NAVBAR: Descobre qual é o tipo de usuário para direcionar o botão vermelho!
      const [resAtleta, resComprador, resFotografo, resOrg] = await Promise.all([
        supabase.from("atletas").select("nome").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("foto_compradores").select("nome").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("fotografos").select("nome, foto_url").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("organizadores").select("nome").eq("user_id", data.user.id).maybeSingle(),
      ]);

      let nomeEncontrado = null;

      if (resFotografo.data) {
        nomeEncontrado = resFotografo.data.nome;
      } else if (resOrg.data) {
        nomeEncontrado = resOrg.data.nome;
      } else if (resComprador.data) {
        nomeEncontrado = resComprador.data.nome;
      } else if (resAtleta.data) {
        nomeEncontrado = resAtleta.data.nome;
      }

      setNome(nomeEncontrado?.split(" ")?.[0] || data.user.email?.split("@")[0] || "Conta");
      setFotoPerfil(resFotografo.data?.foto_url || null);
      setPerfil(perfilAtual);
    }

    carregar();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void carregar());
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const atualizarCarrinho = () => {
      try {
        const ids = JSON.parse(localStorage.getItem(CARRINHO_FOTOS_KEY) || "[]");
        setItensCarrinho(Array.isArray(ids) ? new Set(ids.map(String)).size : 0);
      } catch {
        setItensCarrinho(0);
      }
    };

    queueMicrotask(atualizarCarrinho);
    window.addEventListener("storage", atualizarCarrinho);
    window.addEventListener("carrinho-fotos-atualizado", atualizarCarrinho);
    return () => {
      window.removeEventListener("storage", atualizarCarrinho);
      window.removeEventListener("carrinho-fotos-atualizado", atualizarCarrinho);
    };
  }, []);

  const fecharMenu = () => setMenuAberto(false);
  const rotaConta = nome ? rotaPainelFotos(perfil) : "/fotos/login";
  const rotaMinhasFotos = perfil === "comprador"
    ? "/fotos/minhas-compras"
    : rotaLoginFotos("comprador", "/fotos/minhas-compras", Boolean(nome));

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">

        <Link href="/fotos" className="shrink-0 cursor-pointer" onClick={fecharMenu}><LogoFotos /></Link>

        {area === "fotografo" ? (
          <nav className="hidden items-center gap-7 text-[10px] font-black uppercase tracking-widest text-zinc-500 md:flex">
            <Link href="/fotos/fotografo/dashboard" className="inline-flex items-center gap-1.5 hover:text-retratt"><LayoutDashboard size={13}/> Visão geral</Link>
            <Link href="/fotos/fotografo/painel" className="inline-flex items-center gap-1.5 text-retratt hover:text-white"><FolderPlus size={13}/> Criar álbum</Link>
            <Link href="/fotos/fotografo/dashboard#criar-galeria" className="inline-flex items-center gap-1.5 hover:text-retratt"><Plus size={13}/> Minha galeria</Link>
            <Link href="/fotos/fotografo/financeiro" className="inline-flex items-center gap-1.5 hover:text-emerald-300"><ChartNoAxesCombined size={13}/> Financeiro</Link>
            <Link href="/fotos/fotografo/dashboard#perfil-fotografo" className="inline-flex items-center gap-1.5 hover:text-white"><UserRound size={13}/> Perfil</Link>
            <Link href="/fotos" className="hover:text-white">Ver loja</Link>
          </nav>
        ) : (
          <nav className="hidden items-center gap-7 text-[10px] font-black uppercase tracking-widest text-zinc-500 md:flex">
            <Link href="/fotos" className="cursor-pointer hover:text-retratt transition-colors">Eventos</Link>
            <Link href={rotaMinhasFotos} className="cursor-pointer hover:text-retratt transition-colors">Minhas fotos</Link>
            <Link href="/fotos/fotografo" className="cursor-pointer hover:text-retratt transition-colors">Fotógrafo</Link>
            <Link href="/fotos/organizador" className="cursor-pointer hover:text-retratt transition-colors">Organizador</Link>
            <Link href="/fotos/precos" className="cursor-pointer hover:text-retratt transition-colors">Preços</Link>
            <Link href={sitePrincipal} className="cursor-pointer hover:text-white transition-colors">iTatame</Link>
          </nav>
        )}

        {/* 🔥 BOTÃO ÚNICO INTELIGENTE DESKTOP */}
        <div className="hidden md:flex items-center gap-3">
          {area === "publico" && perfil !== "fotografo" && <Link href="/fotos/fotografo" className="rounded-xl border border-retratt/30 bg-retratt/10 px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-retratt hover:bg-retratt hover:text-black">Vender fotos e vídeos</Link>}
          <Link href="/fotos/carrinho" aria-label={`Carrinho com ${itensCarrinho} item(ns)`} className={`relative flex h-10 items-center gap-2 rounded-xl border px-3 text-[9px] font-black uppercase tracking-widest transition-all ${itensCarrinho > 0 ? "border-retratt/40 bg-retratt/10 text-retratt shadow-[0_0_18px_rgba(255,90,31,0.15)]" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"}`}>
            <ShoppingCart size={16} /> Carrinho
            {itensCarrinho > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-retratt px-1 text-[8px] text-white">{itensCarrinho > 99 ? "99+" : itensCarrinho}</span>}
          </Link>
          <Link href={rotaConta} className="flex cursor-pointer items-center gap-2 rounded-xl bg-retratt px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:brightness-110 shadow-[0_0_15px_rgba(255,90,31,0.2)]">
            {nome && <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/25 bg-black/20">{fotoPerfil ? <img src={fotoPerfil} alt="Foto de perfil" className="h-full w-full object-cover"/> : <UserRound size={14}/>}</span>}
            <span>{nome ? `Olá, ${nome}` : "Entrar / Login"}</span>
          </Link>
        </div>

        {/* BOTÃO HAMBÚRGUER MOBILE */}
        <div className="flex items-center gap-1 md:hidden">
          <Link href="/fotos/carrinho" onClick={fecharMenu} aria-label={`Carrinho com ${itensCarrinho} item(ns)`} className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${itensCarrinho > 0 ? "border-retratt/40 bg-retratt/10 text-retratt" : "border-white/10 text-zinc-400"}`}>
            <ShoppingCart size={19} />
            {itensCarrinho > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#050505] bg-retratt px-1 text-[8px] font-black text-white">{itensCarrinho > 99 ? "99+" : itensCarrinho}</span>}
          </Link>
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            className="cursor-pointer p-2 text-zinc-400 hover:text-white transition-colors"
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
          >
            {menuAberto ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* OVERLAY DO MENU MOBILE */}
      {menuAberto && (
        <div className="absolute top-16 left-0 w-full h-[calc(100vh-64px)] bg-[#050505] border-t border-white/5 flex flex-col p-6 animate-in slide-in-from-top-2 md:hidden">

          <div className="flex flex-col gap-2 mb-8">
             <Link href={rotaConta} onClick={fecharMenu} className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-retratt px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(255,90,31,0.2)]">
               {nome && <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/25 bg-black/20">{fotoPerfil ? <img src={fotoPerfil} alt="Foto de perfil" className="h-full w-full object-cover"/> : <UserRound size={16}/>}</span>}
               <span>{nome ? `Minha Conta (${nome})` : "Fazer Login"}</span>
             </Link>
          </div>

          <nav className="flex flex-col gap-6 text-xs font-black uppercase tracking-widest text-zinc-400">
            <Link href="/fotos/carrinho" onClick={fecharMenu} className="flex cursor-pointer items-center justify-between border-b border-white/5 pb-4 text-retratt">
              <span className="flex items-center gap-2"><ShoppingCart size={16} /> Carrinho</span>
              <span className="rounded-full bg-retratt px-2 py-1 text-[9px] text-white">{itensCarrinho}</span>
            </Link>
            {area === "fotografo" && <Link href="/fotos/fotografo/dashboard" onClick={fecharMenu} className="border-b border-white/5 pb-4 text-white">Visão geral</Link>}
            {area === "fotografo" && <Link href="/fotos/fotografo/painel" onClick={fecharMenu} className="border-b border-white/5 pb-4 text-retratt">Criar álbum</Link>}
            {area === "fotografo" && <Link href="/fotos/fotografo/dashboard#criar-galeria" onClick={fecharMenu} className="border-b border-white/5 pb-4 text-retratt">Minha própria galeria</Link>}
            {area === "fotografo" && <Link href="/fotos/fotografo/financeiro" onClick={fecharMenu} className="border-b border-white/5 pb-4 text-emerald-300">Financeiro</Link>}
            {area === "fotografo" && <Link href="/fotos/fotografo/dashboard#perfil-fotografo" onClick={fecharMenu} className="border-b border-white/5 pb-4">Meu perfil</Link>}
            <Link href="/fotos" onClick={fecharMenu} className="cursor-pointer hover:text-retratt transition-colors border-b border-white/5 pb-4">Eventos & Galerias</Link>
            {area === "publico" && <Link href="/fotos/fotografo" onClick={fecharMenu} className="cursor-pointer border-b border-retratt/20 pb-4 text-retratt">Vender fotos e vídeos</Link>}
            <Link href={rotaMinhasFotos} onClick={fecharMenu} className="cursor-pointer hover:text-retratt transition-colors border-b border-white/5 pb-4">Minhas Fotos</Link>
            <Link href="/fotos/organizador" onClick={fecharMenu} className="cursor-pointer hover:text-retratt transition-colors border-b border-white/5 pb-4">Para Organizadores</Link>
            <Link href="/fotos/precos" onClick={fecharMenu} className="cursor-pointer hover:text-retratt transition-colors border-b border-white/5 pb-4">Preços e Condições</Link>
            <Link href={sitePrincipal} onClick={fecharMenu} className="cursor-pointer hover:text-white transition-colors pb-4">Voltar para o iTatame</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
