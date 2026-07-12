"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { podeAcessarPerfilFotos, rotaLoginFotos } from "@/app/lib/fotos-acesso";
import FotosShell from "../_components/FotosShell";
import { ArrowRight, Download, Images, ShoppingCart, UserRound } from "lucide-react";

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
        nome: perfil?.nome || auth.user.user_metadata?.nome_completo || auth.user.email?.split("@")[0] || "Comprador",
        email: perfil?.email || auth.user.email || "",
        pedidos: lista.length,
        pendentes: lista.filter((pedido) => pedido.status !== "pago").length,
        fotosLiberadas,
      });
      setCarregando(false);
    }
    void carregar();
  }, [router]);

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] px-4 py-7 text-white md:px-6 md:py-10">
        <section className="mx-auto max-w-6xl">
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-red-400">Conta do comprador</p>
          <div className="mt-2 flex flex-col gap-5 border-b border-white/10 pb-7 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black uppercase leading-none md:text-4xl">{carregando ? "Carregando..." : `Olá, ${resumo.nome.split(" ")[0]}`}</h1>
              <p className="mt-2 text-xs text-zinc-400">Acompanhe suas compras e baixe as fotos já liberadas.</p>
            </div>
            <Link href="/fotos" className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-[9px] font-black uppercase tracking-wider hover:bg-white hover:text-black">Encontrar fotos <Images size={14} /></Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ResumoCard titulo="Pedidos" valor={resumo.pedidos} />
            <ResumoCard titulo="Aguardando pagamento" valor={resumo.pendentes} destaque="text-amber-300" />
            <ResumoCard titulo="Fotos liberadas" valor={resumo.fotosLiberadas} destaque="text-cyan-300" />
            <ResumoCard titulo="Carrinho" valor={itensCarrinho} destaque="text-red-300" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Atalho href="/fotos/minhas-compras" titulo="Minhas compras" texto="Ver pedidos, confirmar pagamentos pendentes e baixar originais." icone={<Download size={18} />} />
            <Atalho href="/fotos/carrinho" titulo="Carrinho" texto="Revisar as fotos selecionadas e finalizar uma nova compra." icone={<ShoppingCart size={18} />} />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950 p-4">
            <div className="flex min-w-0 items-center gap-3"><UserRound size={16} className="shrink-0 text-zinc-500" /><div className="min-w-0"><p className="truncate text-xs font-bold">{resumo.nome}</p><p className="truncate text-[10px] text-zinc-500">{resumo.email}</p></div></div>
            <Link href="/fotos/minhas-compras?cadastro=1" className="shrink-0 cursor-pointer text-[9px] font-black uppercase tracking-wider text-zinc-400 hover:text-white">Alterar cadastro</Link>
          </div>
        </section>
      </main>
    </FotosShell>
  );
}

function ResumoCard({ titulo, valor, destaque = "text-white" }: { titulo: string; valor: number; destaque?: string }) {
  return <div className="rounded-xl border border-white/10 bg-zinc-950 p-4"><p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">{titulo}</p><p className={`mt-2 text-2xl font-black ${destaque}`}>{valor}</p></div>;
}

function Atalho({ href, titulo, texto, icone }: { href: string; titulo: string; texto: string; icone: ReactNode }) {
  return <Link href={href} className="group flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-zinc-950 p-5 transition-colors hover:bg-white/5"><div>{icone}<h2 className="mt-4 text-base font-black uppercase">{titulo}</h2><p className="mt-1 text-xs leading-5 text-zinc-400">{texto}</p></div><ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></Link>;
}
