"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { resolverPerfilFotos, rotaLoginFotos, rotaPainelFotos, type PerfilFotos } from "@/app/lib/fotos-acesso";
import { Menu, ShoppingCart, X } from "lucide-react";

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

export default function FotosNavbar() {
  const sitePrincipal = process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br";
  const [nome, setNome] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<PerfilFotos | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [itensCarrinho, setItensCarrinho] = useState(0);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setNome(null);
        setPerfil(null);
        return;
      }
      const perfilAtual = await resolverPerfilFotos(supabase, data.user);

      // 🔥 O CÉREBRO DA NAVBAR: Descobre qual é o tipo de usuário para direcionar o botão vermelho!
      const [resAtleta, resComprador, resFotografo, resOrg] = await Promise.all([
        supabase.from("atletas").select("nome").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("foto_compradores").select("nome").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("fotografos").select("nome").eq("user_id", data.user.id).maybeSingle(),
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

        <nav className="hidden items-center gap-7 text-[10px] font-black uppercase tracking-widest text-zinc-500 md:flex">
          <Link href="/fotos" className="cursor-pointer hover:text-retratt transition-colors">Eventos</Link>
          <Link href={rotaMinhasFotos} className="cursor-pointer hover:text-retratt transition-colors">Minhas fotos</Link>
          <Link href="/fotos/fotografo" className="cursor-pointer hover:text-retratt transition-colors">Fotógrafo</Link>
          <Link href="/fotos/organizador" className="cursor-pointer hover:text-retratt transition-colors">Organizador</Link>
          <Link href="/fotos/precos" className="cursor-pointer hover:text-retratt transition-colors">Preços</Link>
          <Link href={sitePrincipal} className="cursor-pointer hover:text-white transition-colors">iTatame</Link>
        </nav>

        {/* 🔥 BOTÃO ÚNICO INTELIGENTE DESKTOP */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/fotos/carrinho" aria-label={`Carrinho com ${itensCarrinho} item(ns)`} className={`relative flex h-10 items-center gap-2 rounded-xl border px-3 text-[9px] font-black uppercase tracking-widest transition-all ${itensCarrinho > 0 ? "border-retratt/40 bg-retratt/10 text-retratt shadow-[0_0_18px_rgba(255,90,31,0.15)]" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"}`}>
            <ShoppingCart size={16} /> Carrinho
            {itensCarrinho > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-retratt px-1 text-[8px] text-white">{itensCarrinho > 99 ? "99+" : itensCarrinho}</span>}
          </Link>
          <Link href={rotaConta} className="cursor-pointer rounded-xl bg-retratt px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-retratt transition-all shadow-[0_0_15px_rgba(255,90,31,0.2)]">
            {nome ? `Olá, ${nome}` : "Entrar / Login"}
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
             <Link href={rotaConta} onClick={fecharMenu} className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-retratt px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(255,90,31,0.2)]">
               {nome ? `Minha Conta (${nome})` : "Fazer Login"}
             </Link>
          </div>

          <nav className="flex flex-col gap-6 text-xs font-black uppercase tracking-widest text-zinc-400">
            <Link href="/fotos/carrinho" onClick={fecharMenu} className="flex cursor-pointer items-center justify-between border-b border-white/5 pb-4 text-retratt">
              <span className="flex items-center gap-2"><ShoppingCart size={16} /> Carrinho</span>
              <span className="rounded-full bg-retratt px-2 py-1 text-[9px] text-white">{itensCarrinho}</span>
            </Link>
            <Link href="/fotos" onClick={fecharMenu} className="cursor-pointer hover:text-retratt transition-colors border-b border-white/5 pb-4">Eventos & Galerias</Link>
            <Link href={rotaMinhasFotos} onClick={fecharMenu} className="cursor-pointer hover:text-retratt transition-colors border-b border-white/5 pb-4">Minhas Fotos</Link>
            <Link href="/fotos/fotografo" onClick={fecharMenu} className="cursor-pointer hover:text-retratt transition-colors border-b border-white/5 pb-4">Área do Fotógrafo</Link>
            <Link href="/fotos/organizador" onClick={fecharMenu} className="cursor-pointer hover:text-retratt transition-colors border-b border-white/5 pb-4">Para Organizadores</Link>
            <Link href="/fotos/precos" onClick={fecharMenu} className="cursor-pointer hover:text-retratt transition-colors border-b border-white/5 pb-4">Preços e Condições</Link>
            <Link href={sitePrincipal} onClick={fecharMenu} className="cursor-pointer hover:text-white transition-colors pb-4">Voltar para o iTatame</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
