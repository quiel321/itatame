"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { formatarPrecoFotos } from "@/app/lib/fotos";
import FotosShell from "../_components/FotosShell";
import { ArrowRight, Download, Image as ImageIcon, Pencil, ShoppingCart, UserRound } from "lucide-react";

type Pedido = {
  id: string;
  status: string | null;
  total_centavos: number | null;
  created_at: string;
};

type CompradorPerfil = {
  nome: string | null;
  email: string | null;
  telefone: string | null;
  perfil_completo?: boolean | null;
};

const CARRINHO_FOTOS_KEY = "carrinho_fotos";

export default function FotosMinhasComprasPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<CompradorPerfil | null>(null);
  const [perfilForm, setPerfilForm] = useState({ nome: "", telefone: "" });
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [mensagemPerfil, setMensagemPerfil] = useState("");
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [itensCarrinho, setItensCarrinho] = useState(0);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.replace("/fotos/login?perfil=comprador&next=/fotos/comprador");
        setCarregando(false);
        return;
      }

      setEmail(auth.user.email || null);
      setUserId(auth.user.id);

      try {
        const ids = JSON.parse(localStorage.getItem(CARRINHO_FOTOS_KEY) || "[]");
        setItensCarrinho(Array.isArray(ids) ? ids.length : 0);
      } catch {
        setItensCarrinho(0);
      }

      const perfilRes = await supabase
        .from("foto_compradores")
        .select("nome, email, telefone, perfil_completo")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      const perfilAtual = (perfilRes.data as CompradorPerfil | null) || null;
      const nomeInicial = perfilAtual?.nome || auth.user.user_metadata?.nome_completo || auth.user.user_metadata?.nome || auth.user.email?.split("@")[0] || "";
      setPerfil(perfilAtual);
      setPerfilForm({
        nome: nomeInicial,
        telefone: perfilAtual?.telefone || "",
      });
      setMostrarPerfil(!perfilAtual?.perfil_completo || !perfilAtual?.nome || !perfilAtual?.telefone);

      const { data } = await supabase
        .from("foto_pedidos")
        .select("id, status, total_centavos, created_at")
        .eq("comprador_user_id", auth.user.id)
        .order("created_at", { ascending: false });

      setPedidos((data || []) as Pedido[]);
      setCarregando(false);
    }

    void carregar();
  }, [router]);

  async function salvarPerfilComprador() {
    if (!userId) return;
    setSalvandoPerfil(true);
    setMensagemPerfil("");

    const payload = {
      nome: perfilForm.nome.trim(),
      email,
      telefone: perfilForm.telefone.trim(),
      perfil_completo: true,
    };

    let resultado = await supabase
      .from("foto_compradores")
      .update(payload)
      .eq("user_id", userId)
      .select("nome, email, telefone, perfil_completo")
      .maybeSingle();

    if (!resultado.error && !resultado.data) {
      resultado = await supabase
        .from("foto_compradores")
        .insert({ user_id: userId, ...payload })
        .select("nome, email, telefone, perfil_completo")
        .maybeSingle();
    }

    setSalvandoPerfil(false);
    if (resultado.error) {
      setMensagemPerfil("Não foi possível salvar. Rode a migração de compradores no Supabase.");
      return;
    }

    setPerfil(resultado.data as CompradorPerfil);
    setMostrarPerfil(false);
    setMensagemPerfil("Perfil salvo com sucesso.");
  }

  const pedidosPagos = pedidos.filter((pedido) => ["pago", "aprovado", "approved"].includes(String(pedido.status || "").toLowerCase())).length;

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] px-4 py-6 text-white md:px-6">
        <section className="mx-auto max-w-6xl">
          <Link href="/fotos" className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 hover:text-white">Voltar para fotos</Link>

          <div className="mt-5 rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_85%_10%,rgba(239,68,68,0.14),transparent_34%),#0a0a0e] p-5 md:p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-red-400">Conta do comprador</p>
            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-2xl font-black uppercase leading-none md:text-4xl">Minhas fotos</h1>
                <p className="mt-2 text-xs leading-5 text-zinc-400 md:text-sm">{email ? `Conta: ${email}` : "Conta iTatame Fotos"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/fotos/carrinho" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-4 text-[9px] font-black uppercase tracking-wider text-white hover:bg-red-500">
                  Carrinho <ShoppingCart size={13} />
                </Link>
                <button
                  type="button"
                  onClick={() => setMostrarPerfil((atual) => !atual)}
                  className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-4 text-[9px] font-black uppercase tracking-wider text-zinc-200 hover:bg-white hover:text-black"
                >
                  <Pencil size={13} /> Alterar cadastro
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-4">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-500"><ShoppingCart size={13} /> Carrinho</p>
              <p className="mt-1 text-2xl font-black text-red-400">{itensCarrinho}</p>
              <Link href="/fotos/carrinho" className="mt-2 inline-flex text-[10px] font-black uppercase tracking-wider text-red-300 hover:text-red-200">Finalizar compra <ArrowRight size={12} /></Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-4">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-500"><ImageIcon size={13} /> Pedidos</p>
              <p className="mt-1 text-2xl font-black text-white">{carregando ? "..." : pedidos.length}</p>
              <p className="mt-2 text-xs text-zinc-500">Histórico de compras realizadas.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-4">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-500"><Download size={13} /> Fotos liberadas</p>
              <p className="mt-1 text-2xl font-black text-cyan-300">{pedidosPagos}</p>
              <p className="mt-2 text-xs text-zinc-500">Pedidos pagos aparecem para download.</p>
            </div>
          </div>

          {mostrarPerfil && (
            <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-300">Cadastro</p>
              <h2 className="mt-1 text-base font-black uppercase">Dados básicos</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-300">Usamos esses dados para localizar compras, liberar downloads e falar com você sobre seus pedidos.</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <input value={perfilForm.nome} onChange={(e) => setPerfilForm({ ...perfilForm, nome: e.target.value })} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-xs font-bold outline-none focus:border-cyan-400" placeholder="Nome completo" />
                <input value={perfilForm.telefone} onChange={(e) => setPerfilForm({ ...perfilForm, telefone: e.target.value })} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-xs font-bold outline-none focus:border-cyan-400" placeholder="Telefone / WhatsApp" />
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button type="button" onClick={salvarPerfilComprador} disabled={salvandoPerfil || !perfilForm.nome.trim() || !perfilForm.telefone.trim()} className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-cyan-400 px-5 text-[10px] font-black uppercase tracking-wider text-black hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">
                  {salvandoPerfil ? "Salvando..." : "Salvar dados"}
                </button>
                {mensagemPerfil && <p className="text-xs font-bold text-cyan-100">{mensagemPerfil}</p>}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
              <h2 className="flex items-center gap-2 text-base font-black uppercase"><UserRound size={17} className="text-cyan-300" /> Perfil</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-lg border border-white/10 bg-black p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Nome</p>
                  <p className="mt-1 font-bold text-white">{perfil?.nome || perfilForm.nome || "Não informado"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Telefone</p>
                  <p className="mt-1 font-bold text-white">{perfil?.telefone || "Não informado"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
              <h2 className="text-base font-black uppercase">Pedidos realizados</h2>
              <div className="mt-4 space-y-3">
                {carregando ? (
                  <div className="rounded-xl border border-white/10 bg-black p-4 text-sm text-zinc-400">Carregando pedidos...</div>
                ) : pedidos.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 bg-black p-5 text-sm text-zinc-400">
                    Nenhuma compra encontrada ainda.
                  </div>
                ) : (
                  pedidos.map((pedido) => (
                    <div key={pedido.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-black uppercase">Pedido {pedido.id.slice(0, 8)}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Status: {pedido.status || "pendente"}</p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-lg font-black text-cyan-400">{formatarPrecoFotos(pedido.total_centavos)}</p>
                        <button className="mt-2 cursor-pointer rounded-md border border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-white hover:text-black">Ver downloads</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </FotosShell>
  );
}
