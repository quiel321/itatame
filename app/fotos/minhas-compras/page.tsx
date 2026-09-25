"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { formatarPrecoFotos } from "@/app/lib/fotos";
import { podeAcessarPerfilFotos, rotaLoginFotos } from "@/app/lib/fotos-acesso";
import FotosShell from "../_components/FotosShell";
import { ArrowRight, Download, Image as ImageIcon, Pencil, ShoppingCart, UserRound, LogOut, CheckCircle2, AlertCircle, History, PackageOpen, Video } from "lucide-react";

type MidiaPedido = { id: string; titulo: string | null; mime_type: string | null };
type Pedido = { id: string; status: string | null; total_centavos: number | null; created_at: string; foto_pedido_itens?: Array<{ id: string; download_liberado: boolean; download_expires_at: string | null; foto_arquivos?: MidiaPedido | MidiaPedido[] | null; }>; };
type CompradorPerfil = { nome: string | null; email: string | null; telefone: string | null; perfil_completo?: boolean | null; };
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
  const [pedidoAberto, setPedidoAberto] = useState<string | null>(null);
  const [baixandoItem, setBaixandoItem] = useState<string | null>(null);
  const perfilInvalido: 'fotógrafo' | 'organizador' | null = null;
  const [verificandoPedido, setVerificandoPedido] = useState<string | null>(null);
  const [mensagemPagamento, setMensagemPagamento] = useState("");

  const primeiroNome = useMemo(() => perfil?.nome?.split(' ')[0] || email?.split('@')[0] || "Comprador", [perfil?.nome, email]);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.replace(rotaLoginFotos("comprador", "/fotos/comprador"));
        return;
      }

      // 🔥 BLINDAGEM CORRIGIDA: Agora bate na tabela raiz "organizadores"
      if (!(await podeAcessarPerfilFotos(supabase, auth.user, "comprador"))) {
        router.replace(rotaLoginFotos("comprador", "/fotos/comprador", true));
        return;
      }

      setEmail(auth.user.email || null);
      setUserId(auth.user.id);

      try {
        const ids = JSON.parse(localStorage.getItem(CARRINHO_FOTOS_KEY) || "[]");
        setItensCarrinho(Array.isArray(ids) ? ids.length : 0);
      } catch { setItensCarrinho(0); }

      const perfilRes = await supabase.from("foto_compradores").select("nome, email, telefone, perfil_completo").eq("user_id", auth.user.id).maybeSingle();
      const perfilAtual = (perfilRes.data as CompradorPerfil | null) || null;
      const nomeInicial = perfilAtual?.nome || auth.user.user_metadata?.nome_completo || auth.user.user_metadata?.nome || auth.user.email?.split("@")[0] || "";

      setPerfil(perfilAtual);
      setPerfilForm({ nome: nomeInicial, telefone: perfilAtual?.telefone || "", });
      const abrirCadastro = new URLSearchParams(window.location.search).get("cadastro") === "1";
      setMostrarPerfil(abrirCadastro || !perfilAtual?.perfil_completo || !perfilAtual?.nome || !perfilAtual?.telefone);

      const consultaPedidos = () => supabase.from("foto_pedidos").select("id, status, total_centavos, created_at, foto_pedido_itens(id, download_liberado, download_expires_at, foto_arquivos(id, titulo, mime_type))").eq("comprador_user_id", auth.user.id).order("created_at", { ascending: false });
      let { data } = await consultaPedidos();
      const pendentes = ((data || []) as Pedido[]).filter((pedido) => pedido.status !== "pago").slice(0, 5);
      if (pendentes.length) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const resultados = await Promise.all(pendentes.map(async (pedido) => {
            const response = await fetch(`/api/fotos/pagamento/status?pedido_id=${pedido.id}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            return response.ok ? response.json() : null;
          }));
          if (resultados.some((resultado) => resultado?.status === "pago")) ({ data } = await consultaPedidos());
        }
      }

      setPedidos((data || []) as Pedido[]);
      const pedidoDoLink = new URLSearchParams(window.location.search).get("pedido");
      if (pedidoDoLink && (data || []).some((pedido) => pedido.id === pedidoDoLink)) setPedidoAberto(pedidoDoLink);
      setCarregando(false);
    }
    void carregar();
  }, [router]);

  async function deslogar() {
    await supabase.auth.signOut();
    router.push("/fotos/login?perfil=comprador");
  }

  async function salvarPerfilComprador() {
    if (!userId) return;
    setSalvandoPerfil(true);
    setMensagemPerfil("");

    const payload = { nome: perfilForm.nome.trim(), email, telefone: perfilForm.telefone.trim(), perfil_completo: true, };
    let resultado = await supabase.from("foto_compradores").update(payload).eq("user_id", userId).select("nome, email, telefone, perfil_completo").maybeSingle();

    if (!resultado.error && !resultado.data) {
      resultado = await supabase.from("foto_compradores").insert({ user_id: userId, ...payload }).select("nome, email, telefone, perfil_completo").maybeSingle();
    }

    setSalvandoPerfil(false);
    if (resultado.error) { setMensagemPerfil("Erro ao salvar. Tente novamente."); return; }

    setPerfil(resultado.data as CompradorPerfil);
    setMostrarPerfil(false);
    setMensagemPerfil("Perfil atualizado com sucesso!");
  }

  const fotosLiberadas = pedidos.reduce( (total, pedido) => total + (pedido.foto_pedido_itens || []).filter((item) => item.download_liberado).length, 0, );
  const arquivosLiberados = pedidos.flatMap((pedido) => (pedido.foto_pedido_itens || [])
    .filter((item) => item.download_liberado)
    .map((item) => ({ item, foto: Array.isArray(item.foto_arquivos) ? item.foto_arquivos[0] : item.foto_arquivos })));

  useEffect(() => {
    if (!carregando && window.location.hash === "#downloads") {
      document.getElementById("downloads")?.scrollIntoView();
    }
  }, [carregando]);

  async function baixarFoto(itemId: string) {
    setBaixandoItem(itemId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/fotos/login?perfil=comprador&next=/fotos/minhas-compras"); return; }
    const response = await fetch(`/api/fotos/download/${itemId}?link=1`, { headers: { Authorization: `Bearer ${session.access_token}` }, });
    const resultado = await response.json().catch(() => null);
    setBaixandoItem(null);
    if (!response.ok || !resultado?.url) {
      setMensagemPagamento(resultado?.error || "Não foi possível iniciar o download. Tente novamente.");
      return;
    }
    const link = document.createElement("a");
    link.href = resultado.url;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function verificarPagamento(pedidoId: string) {
    setVerificandoPedido(pedidoId);
    setMensagemPagamento("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push(rotaLoginFotos("comprador", "/fotos/minhas-compras"));
      return;
    }
    const response = await fetch(`/api/fotos/pagamento/status?pedido_id=${pedidoId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const resultado = await response.json().catch(() => null);
    setVerificandoPedido(null);
    if (!response.ok) {
      setMensagemPagamento(resultado?.error || "Não foi possível consultar o pagamento.");
      return;
    }
    if (resultado?.status === "pago") {
      setPedidos((atuais) => atuais.map((pedido) => pedido.id === pedidoId ? { ...pedido, status: "pago" } : pedido));
      setMensagemPagamento("Pagamento confirmado. Atualize a página para carregar os downloads liberados.");
    } else {
      setMensagemPagamento("O Mercado Pago ainda não confirmou este pagamento.");
    }
  }

  const StatusBadge = ({ status }: { status: string | null }) => {
    if (status === "approved" || status === "pago") return <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest"><CheckCircle2 size={10}/> Pago</span>;
    if (status === "pending" || status === "pendente") return <span className="inline-flex items-center gap-1 text-retratt bg-retratt/10 border border-retratt/20 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest"><AlertCircle size={10}/> Pendente</span>;
    return <span className="inline-flex items-center gap-1 text-zinc-400 bg-zinc-400/10 border border-zinc-400/20 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest">{status || "Desconhecido"}</span>;
  };

  if (carregando) return <FotosShell><main className="min-h-screen bg-[#050505] flex items-center justify-center text-zinc-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Verificando acessos...</main></FotosShell>;

  // 🔥 PORTÃO FECHADO PARA PROFISSIONAIS (Redirecionamento para a rota certa)
  if (perfilInvalido) {
    return (
      <FotosShell>
        <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
           <div className="max-w-md w-full bg-[#0a0a0e] border border-white/5 p-8 md:p-10 rounded-3xl text-center shadow-2xl">
              <AlertCircle size={48} className="mx-auto text-retratt mb-6 opacity-80" />
              <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-3">Acesso Negado</h2>
              <p className="text-xs text-zinc-400 mb-8 leading-relaxed">
                 O e-mail cadastrado pertence a uma conta de <strong className="text-white uppercase">{perfilInvalido}</strong>. Por motivos de segurança e organização, contas profissionais não operam no painel de compras.
              </p>
              <Link href={perfilInvalido === 'fotógrafo' ? '/fotos/fotografo/dashboard' : '/fotos/admin'} className="flex cursor-pointer justify-center w-full bg-retratt hover:bg-retratt text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(255,90,31,0.2)] mb-3">
                 Ir para o Painel Profissional
              </Link>
              <button onClick={deslogar} className="w-full cursor-pointer bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all border border-white/10">
                 Sair da Conta
              </button>
           </div>
        </main>
      </FotosShell>
    );
  }

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans pb-12">
        <section className="border-b border-white/5 bg-[radial-gradient(circle_at_15%_0%,rgba(255,90,31,0.12),transparent_40%),linear-gradient(180deg,#101014,#050505)]">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
            <Link href="/fotos" className="cursor-pointer text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500 hover:text-white transition-colors mb-4 inline-block">← Voltar para Eventos</Link>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-4">
              <div>
                <p className="inline-flex items-center gap-1.5 rounded-md border border-retratt/20 bg-retratt/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-retratt mb-2 shadow-sm"><UserRound size={12} /> Minhas Compras</p>
                <h1 className="text-2xl font-black uppercase tracking-tight md:text-4xl drop-shadow-sm">Olá, {primeiroNome}!</h1>
                <p className="mt-1 text-xs text-zinc-400 font-medium">{email ? `${email}` : "Conta Retratt"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setMostrarPerfil(!mostrarPerfil)} className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 px-4 text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-colors"><Pencil size={12} /> Perfil</button>
                <button onClick={deslogar} className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-retratt/20 bg-retratt/10 px-4 text-[9px] font-black uppercase tracking-widest text-retratt hover:bg-retratt hover:text-white transition-all">Sair <LogOut size={12} /></button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 md:mt-6 md:gap-3">
              <div className="flex min-w-0 flex-col justify-between rounded-xl border border-white/5 bg-[#0a0a0e]/80 p-2.5 md:p-4">
                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500"><ShoppingCart size={12} /> Carrinho</p>
                  <p className="text-2xl font-black text-retratt leading-none">{itensCarrinho}</p>
                </div>
                <Link href="/fotos/carrinho" className="cursor-pointer mt-1 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-retratt hover:text-orange-300">Ver Sacola <ArrowRight size={10} /></Link>
              </div>
              <div className="flex min-w-0 flex-col justify-between rounded-xl border border-white/5 bg-[#0a0a0e]/80 p-2.5 md:p-4">
                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500"><History size={12} /> Pedidos</p>
                  <p className="text-2xl font-black text-white leading-none">{carregando ? "-" : pedidos.length}</p>
                </div>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Histórico de compras</p>
              </div>
              <div className="flex min-w-0 flex-col justify-between rounded-xl border border-white/5 bg-[#0a0a0e]/80 p-2.5 md:p-4">
                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500"><Download size={12} /> Liberadas</p>
                  <p className="text-2xl font-black text-retratt leading-none">{fotosLiberadas}</p>
                </div>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Prontas para baixar</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6">
          {mensagemPagamento && (
            <p className="mb-4 rounded-xl border border-retratt/20 bg-retratt/10 p-3 text-xs font-bold text-orange-200">
              {mensagemPagamento}
            </p>
          )}
          {mostrarPerfil && (
            <div className="mb-6 rounded-2xl border border-retratt/20 bg-retratt/5 p-5 animate-in fade-in">
              <div className="flex items-center justify-between mb-4">
                <div><h2 className="text-sm font-black uppercase text-white">Dados Cadastrais</h2><p className="text-[9px] font-bold text-retratt uppercase tracking-widest mt-0.5">Necessário para liberar downloads.</p></div>
                <button onClick={() => setMostrarPerfil(false)} className="cursor-pointer h-7 px-3 rounded text-[9px] font-black uppercase bg-white/5 text-zinc-300 hover:bg-white/10">Cancelar</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
                <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome Completo</label><input value={perfilForm.nome} onChange={(e) => setPerfilForm({ ...perfilForm, nome: e.target.value })} className="cursor-text h-9 w-full rounded-lg border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="Seu nome" /></div>
                <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">WhatsApp</label><input value={perfilForm.telefone} onChange={(e) => setPerfilForm({ ...perfilForm, telefone: e.target.value })} className="cursor-text h-9 w-full rounded-lg border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="(00) 00000-0000" /></div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button type="button" onClick={salvarPerfilComprador} disabled={salvandoPerfil || !perfilForm.nome.trim() || !perfilForm.telefone.trim()} className="cursor-pointer h-9 px-6 rounded-lg bg-retratt text-[9px] font-black uppercase tracking-widest text-white hover:bg-retratt disabled:opacity-50">
                  {salvandoPerfil ? "Salvando..." : "Salvar Dados"}
                </button>
                {mensagemPerfil && <span className="text-[9px] font-black uppercase text-retratt">{mensagemPerfil}</span>}
              </div>
            </div>
          )}

          <div id="downloads" className="mb-4 scroll-mt-20 rounded-xl border border-retratt/20 bg-[#0a0a0e] p-3 md:mb-5 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase text-white"><Download size={16} className="text-retratt" /> Fotos para baixar</h2>
              <span className="text-xs font-bold text-retratt">{fotosLiberadas}</span>
            </div>
            {arquivosLiberados.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {arquivosLiberados.map(({ item, foto }) => (
                  <div key={item.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/5 bg-[#050505] p-2">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-900">
                      {foto?.mime_type?.startsWith("video/") ? <Video size={16} className="text-retratt" /> : <ImageIcon size={16} className="text-zinc-600" />}
                      {foto?.id && <img src={`/api/fotos/arquivo/${foto.id}?tipo=thumb`} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">{foto?.titulo || (foto?.mime_type?.startsWith("video/") ? "Vídeo" : "Foto")}</span>
                    <button type="button" disabled={baixandoItem === item.id} onClick={() => baixarFoto(item.id)} className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-retratt px-3 text-[10px] font-black uppercase text-black disabled:cursor-wait disabled:opacity-60">
                      <Download size={14} /> {baixandoItem === item.id ? "Abrindo..." : "Baixar"}
                    </button>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-zinc-400">Nenhum arquivo liberado no momento.</p>}
          </div>

          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div className="hidden space-y-4 lg:block">
              <div className="rounded-2xl border border-white/5 bg-[#0a0a0e] p-5 shadow-sm">
                <h2 className="flex items-center gap-1.5 text-xs font-black uppercase text-white mb-4"><UserRound size={14} className="text-retratt" /> Meu Perfil</h2>
                <div className="space-y-2">
                  <div className="rounded-xl border border-white/5 bg-[#050505] p-3"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome</p><p className="mt-0.5 text-[11px] font-bold text-white truncate">{perfil?.nome || perfilForm.nome || "Não informado"}</p></div>
                  <div className="rounded-xl border border-white/5 bg-[#050505] p-3"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Telefone</p><p className="mt-0.5 text-[11px] font-bold text-white truncate">{perfil?.telefone || "Não informado"}</p></div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-[#0a0a0e] p-5 text-center shadow-sm">
                 <div className="w-10 h-10 mx-auto rounded-full bg-retratt/10 flex items-center justify-center text-retratt mb-3 border border-retratt/20"><PackageOpen size={16} /></div>
                 <h3 className="text-[11px] font-black uppercase text-white mb-1.5">Faltou algo?</h3>
                 <p className="text-[9px] font-medium text-zinc-400 mb-4 leading-relaxed">Volte para a galeria oficial e encontre mais fotos suas.</p>
                 <Link href="/fotos" className="cursor-pointer w-full inline-block py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest border border-white/10 transition-colors">Explorar Galerias</Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#0a0a0e] p-5 md:p-6 shadow-sm">
              <h2 className="text-sm font-black uppercase text-white flex items-center gap-2 mb-4"><History size={16} className="text-zinc-500" /> Histórico de Pedidos</h2>
              <div className="space-y-3">
                {carregando ? (
                  <div className="rounded-xl border border-white/5 bg-[#050505] p-6 text-center text-[9px] font-black uppercase tracking-widest text-zinc-500 animate-pulse">Buscando pedidos...</div>
                ) : pedidos.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                    <ImageIcon size={24} className="mx-auto text-zinc-700 mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nenhuma compra realizada.</p>
                  </div>
                ) : (
                  pedidos.map((pedido) => (
                    <div key={pedido.id} className="rounded-xl border border-white/5 bg-[#050505] overflow-hidden">
                      <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">{new Date(pedido.created_at).toLocaleDateString('pt-BR')} • REF: {pedido.id.slice(0, 8)}</p>
                          <div className="flex items-center gap-2"><p className="text-sm font-black uppercase text-white">Pedido</p><StatusBadge status={pedido.status} /></div>
                        </div>
                        <div className="flex items-center sm:flex-col sm:items-end justify-between gap-3 sm:gap-1.5">
                          <p className="text-base font-black text-white">{formatarPrecoFotos(pedido.total_centavos)}</p>
                          {pedido.status !== "pago" && (
                            <button type="button" onClick={() => verificarPagamento(pedido.id)} disabled={verificandoPedido === pedido.id} className="cursor-pointer rounded-lg bg-retratt px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-black hover:bg-retratt disabled:cursor-wait disabled:opacity-60">
                              {verificandoPedido === pedido.id ? "Verificando..." : "Verificar pagamento"}
                            </button>
                          )}
                          <button onClick={() => setPedidoAberto((atual) => atual === pedido.id ? null : pedido.id)} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[8px] font-black uppercase tracking-widest transition-colors ${pedidoAberto === pedido.id ? "bg-white text-black border-white" : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10 hover:text-white"}`}>{pedidoAberto === pedido.id ? "Ocultar" : "Ver Downloads"}</button>
                        </div>
                      </div>

                      {pedidoAberto === pedido.id && (
                        <div className="border-t border-white/5 bg-[#0a0a0e] p-4">
                          <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-3">Itens do pedido ({pedido.foto_pedido_itens?.length || 0})</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {(pedido.foto_pedido_itens || []).map((item) => {
                              const foto = Array.isArray(item.foto_arquivos) ? item.foto_arquivos[0] : item.foto_arquivos;
                              return (
                                <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-[#050505] p-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                     <div className="relative w-10 h-10 rounded-md bg-zinc-900 flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
                                       {foto?.mime_type?.startsWith("video/") ? <Video size={12} className="text-retratt"/> : <ImageIcon size={12} className="text-zinc-600"/>}
                                       {foto?.id && (
                                         <img
                                           src={`/api/fotos/arquivo/${foto.id}?tipo=thumb`}
                                           alt={`Previa protegida de ${foto.titulo || "foto comprada"}`}
                                           loading="lazy"
                                           onError={(event) => { event.currentTarget.style.display = "none"; }}
                                           className="absolute inset-0 h-full w-full object-cover"
                                         />
                                       )}
                                     </div>
                                     <p className="truncate text-[10px] font-black uppercase text-white">{foto?.titulo || (foto?.mime_type?.startsWith("video/") ? "Vídeo" : "Foto")}</p>
                                  </div>
                                  <button disabled={!item.download_liberado || baixandoItem === item.id} onClick={() => baixarFoto(item.id)} className={`cursor-pointer inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[8px] font-black uppercase tracking-widest transition-all ${item.download_liberado ? "bg-retratt text-black hover:bg-retratt" : "bg-zinc-900 text-zinc-600 border border-white/5 disabled:cursor-not-allowed"}`}>
                                    <Download size={12} /> <span className="hidden sm:inline">{baixandoItem === item.id ? "Processando" : (item.download_liberado ? "Baixar" : "Aguardando")}</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
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
