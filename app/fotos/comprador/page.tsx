"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { podeAcessarPerfilFotos, rotaLoginFotos } from "@/app/lib/fotos-acesso";
import FotosShell from "../_components/FotosShell";
import { ArrowRight, Download, Images, ShoppingCart, UserRound, LogOut, History, AlertCircle } from "lucide-react";

type ResumoComprador = {
  nome: string;
  email: string;
  pedidos: number;
  pendentes: number;
  fotosLiberadas: number;
};

export default function FotosCompradorPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [resumo, setResumo] = useState<ResumoComprador>({ nome: "Comprador", email: "", pedidos: 0, pendentes: 0, fotosLiberadas: 0 });
  const [itensCarrinho, setItensCarrinho] = useState(0);

  const primeiroNome = useMemo(() => resumo.nome.split(" ")[0], [resumo.nome]);

  useEffect(() => {
    async function carregar() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace(rotaLoginFotos("comprador", "/fotos/comprador"));
        return;
      }
      if (!(await podeAcessarPerfilFotos(supabase, auth.user, "comprador"))) {
        router.replace(rotaLoginFotos("comprador", "/fotos/comprador", true));
        return;
      }

      const [{ data: perfil }, { data: pedidos }] = await Promise.all([
        supabase.from("foto_compradores").select("nome, email").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("foto_pedidos").select("id, status, foto_pedido_itens(download_liberado)").eq("comprador_user_id", auth.user.id).order("created_at", { ascending: false }),
      ]);
      const lista = pedidos || [];
      const fotosLiberadas = lista.reduce((total, pedido) => total + (pedido.foto_pedido_itens || []).filter((item) => item.download_liberado).length, 0);

      try {
        const ids = JSON.parse(localStorage.getItem("carrinho_fotos") || "[]");
        setItensCarrinho(Array.isArray(ids) ? ids.length : 0);
      } catch {
        setItensCarrinho(0);
      }

      setResumo({
        nome: perfil?.nome || auth.user.user_metadata?.nome_completo || auth.user.email?.split("@")[0] || "Cliente",
        email: perfil?.email || auth.user.email || "",
        pedidos: lista.length,
        pendentes: lista.filter((pedido) => pedido.status !== "pago").length,
        fotosLiberadas,
      });
      setCarregando(false);
    }
    void carregar();
  }, [router]);

  async function deslogar() {
    await supabase.auth.signOut();
    router.push("/fotos/login?perfil=comprador");
  }

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans relative overflow-x-hidden w-full pb-12">

        {/* 🚀 HERO SECTION (Cabeçalho Premium Red - Tamanhos Padronizados) */}
        <section className="border-b border-white/5 bg-[radial-gradient(circle_at_15%_0%,rgba(255,90,31,0.12),transparent_40%),linear-gradient(180deg,#101014,#050505)] w-full">
          <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">

            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 rounded-md border border-retratt/20 bg-retratt/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-retratt mb-2 shadow-sm">
                  <UserRound size={12} /> Painel do Cliente
                </p>
                <h1 className="text-2xl font-black uppercase tracking-tight md:text-4xl drop-shadow-sm truncate">
                  {carregando ? "Carregando..." : `Olá, ${primeiroNome}!`}
                </h1>
                <p className="mt-1 max-w-md text-xs font-medium text-zinc-400">Suas compras e fotos em um só lugar.</p>
              </div>

              {/* Botões Menores e Alinhados para Mobile/Desktop */}
              <div className="flex flex-row items-center gap-2 shrink-0 w-full md:w-auto">
                <Link href="/fotos" className="cursor-pointer flex-1 md:flex-none inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-retratt px-4 text-[9px] font-black uppercase tracking-widest text-white hover:bg-retratt transition-colors shadow-sm">
                  Encontrar fotos <Images size={12} className="shrink-0" />
                </Link>
                <button onClick={deslogar} className="cursor-pointer flex-1 md:flex-none inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-[9px] font-black uppercase tracking-widest text-zinc-300 hover:bg-white/10 hover:text-white transition-all shadow-sm">
                  Sair <LogOut size={12} className="shrink-0" />
                </button>
              </div>
            </div>

            {/* 📊 GRID DE RESUMO (Glassmorphism Padronizado) */}
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">

              <Link href="/fotos/carrinho" className="flex items-center justify-between rounded-xl border border-retratt/20 bg-retratt/5 p-3 transition-colors hover:bg-retratt/10 md:block md:p-4">
                <div className="flex items-center justify-between md:mb-2">
                  <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400"><ShoppingCart size={12} className="text-retratt" /> Carrinho</p>
                </div>
                <p className="text-2xl font-black text-retratt leading-none">{carregando ? "-" : itensCarrinho}</p>
              </Link>

              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0a0a0e]/80 p-3 md:block md:p-4">
                <div className="flex items-center justify-between md:mb-2">
                  <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500"><History size={12} /> Pedidos</p>
                </div>
                <p className="text-2xl font-black text-white leading-none">{carregando ? "-" : resumo.pedidos}</p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0a0a0e]/80 p-3 md:block md:p-4">
                <div className="flex items-center justify-between md:mb-2">
                  <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500"><AlertCircle size={12} className="text-retratt" /> Aguardando</p>
                </div>
                <p className="text-2xl font-black text-retratt leading-none">{carregando ? "-" : resumo.pendentes}</p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0a0a0e]/80 p-3 md:block md:p-4">
                <div className="flex items-center justify-between md:mb-2">
                  <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500"><Download size={12} className="text-retratt" /> Liberadas</p>
                </div>
                <p className="text-2xl font-black text-retratt leading-none">{carregando ? "-" : resumo.fotosLiberadas}</p>
              </div>

            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl space-y-3 px-4 py-4 md:space-y-5 md:px-6 md:py-6">

          {/* ⚡ ATALHOS RÁPIDOS */}
          <div className="grid gap-2 sm:gap-4 md:grid-cols-2">

             <Link href="/fotos/minhas-compras#downloads" className="group flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-retratt/30 bg-retratt/10 p-3 transition-colors hover:bg-retratt/15 md:p-4">
               <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-retratt/15 text-retratt"><Download size={18} /></div>
               <div className="min-w-0 flex-1"><h2 className="text-sm font-black uppercase text-white">Baixar minhas fotos</h2><p className="text-[11px] text-zinc-400">{resumo.fotosLiberadas} {resumo.fotosLiberadas === 1 ? "arquivo liberado" : "arquivos liberados"}</p></div>
               <ArrowRight size={16} className="shrink-0 text-retratt" />
             </Link>

             <Link href="/fotos/minhas-compras" className="group flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#0a0a0e] p-3 transition-colors hover:bg-[#111] md:p-4">
               <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white"><History size={18} /></div>
               <div className="min-w-0 flex-1"><h2 className="text-sm font-black uppercase text-white">Pedidos e pagamentos</h2><p className="text-[11px] text-zinc-400">Acompanhe seu histórico</p></div>
               <ArrowRight size={16} className="shrink-0 text-zinc-500" />
             </Link>

          </div>

          {/* ⚙ï¸ DADOS CADASTRAIS */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#0a0a0e] p-4 shadow-sm mt-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 border border-white/10">
                <UserRound size={14} className="text-zinc-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-tight text-white mb-0.5 truncate">{resumo.nome}</p>
                <p className="text-[10px] text-zinc-500 truncate">{resumo.email}</p>
              </div>
            </div>
            {/* Redireciona para a página de Minhas Compras e abre o form automaticamente via parâmetro ?cadastro=1 */}
            <Link href="/fotos/minhas-compras?cadastro=1" className="shrink-0 w-full sm:w-auto cursor-pointer rounded-lg bg-white/5 px-4 py-2 text-center text-[9px] font-black uppercase tracking-widest text-zinc-300 hover:bg-white/10 hover:text-white transition-colors border border-white/5">
              Editar Perfil
            </Link>
          </div>

        </section>
      </main>
    </FotosShell>
  );
}
