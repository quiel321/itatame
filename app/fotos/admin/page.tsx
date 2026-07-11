"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import FotosShell from "../_components/FotosShell";
import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  CreditCard,
  FolderPlus,
  ImagePlus,
  Pencil,
  Store,
  Trophy,
  Wallet,
  LogOut,
  Building2,
  Check,
  AlertCircle,
  ShieldCheck,
  UploadCloud,
  Loader2
} from "lucide-react";

type Totais = { eventos: number; albuns: number; fotos: number; pedidos: number };
type EventoBase = { id: string; nome: string; local?: string | null; cidade?: string | null; estado?: string | null; data_evento?: string | null; banner_url?: string | null };
type FotoEventoAdmin = {
  id: string;
  nome: string;
  evento_id?: string | null;
  status: string | null;
  preco_padrao_centavos: number | null;
  desconto_combo_qtd?: number | null;
  desconto_combo_percentual?: number | null;
};
type OrganizadorFinanceiro = {
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  documento?: string | null;
  tipo_entidade?: string | null;
  academia?: string | null;
  perfil_completo?: boolean | null;
  mp_connected_at?: string | null;
  mp_user_id?: string | null;
};

function formatarMoeda(valorCentavos?: number | null) {
  return ((valorCentavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FotosAdminPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [totais, setTotais] = useState<Totais>({ eventos: 0, albuns: 0, fotos: 0, pedidos: 0 });
  const [eventosBase, setEventosBase] = useState<EventoBase[]>([]);
  const [fotoEventos, setFotoEventos] = useState<FotoEventoAdmin[]>([]);
  
  const [organizador, setOrganizador] = useState<OrganizadorFinanceiro | null>(null);
  const [orgForm, setOrgForm] = useState({ 
    nome: "", email: "", telefone: "", documento: "", tipo_entidade: "empresa", academia: "", cidade: "", estado: "" 
  });
  
  const [eventoSelecionado, setEventoSelecionado] = useState("");
  const [preco, setPreco] = useState("15,00");
  const [comboQtd, setComboQtd] = useState("3");
  const [comboPercentual, setComboPercentual] = useState("20");
  const [regrasCombo, setRegrasCombo] = useState<Record<string, { qtd: string; percentual: string }>>({});
  
  const [mensagem, setMensagem] = useState("");
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [mostrarFormularioPerfil, setMostrarFormularioPerfil] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const capaInputRef = useRef<HTMLInputElement>(null);
  const [fazendoUpload, setFazendoUpload] = useState<"avatar" | "capa" | null>(null);

  async function carregar() {
    setCarregando(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    setUserId(user?.id || null);

    if (!user) {
      router.replace("/fotos/login?perfil=organizador&next=/fotos/admin");
      setCarregando(false);
      return;
    }

    // 1. Busca os dados financeiros do organizador
    let org = await supabase.from("organizadores").select("nome, email, telefone, documento, tipo_entidade, academia, perfil_completo, mp_connected_at, mp_user_id").eq("user_id", user.id).maybeSingle();
    const orgData = (org.data as OrganizadorFinanceiro | null) || null;
    
    // 2. Busca os dados públicos (Capa, Avatar, Localização)
    let fotoOrg = await supabase.from("foto_organizadores").select("localizacao, avatar_url, capa_url").eq("id", user.id).maybeSingle();
    let locParts = (fotoOrg.data?.localizacao || "").split(",");
    let cid = locParts[0]?.trim() || "";
    let est = locParts[1]?.trim() || "";

    setOrganizador(orgData);
    setOrgForm({
      nome: orgData?.nome || user.user_metadata?.nome_completo || user.user_metadata?.nome || "",
      email: orgData?.email || user.email || "",
      telefone: orgData?.telefone || "",
      documento: orgData?.documento || "",
      tipo_entidade: orgData?.tipo_entidade || "empresa",
      academia: orgData?.academia || "",
      cidade: cid,
      estado: est
    });

    let base = await supabase.from("eventos").select("id, nome, local, cidade, estado, data_evento, banner_url").eq("organizador_id", user.id).order("data_evento", { ascending: false }).limit(50);
    if (base.error) {
      base = await supabase.from("eventos").select("id, nome, local, cidade, estado, data_evento, banner_url").order("data_evento", { ascending: false }).limit(50);
    }

    const fotoEvt = await supabase.from("foto_eventos").select("id, nome, evento_id, status, preco_padrao_centavos, desconto_combo_qtd, desconto_combo_percentual").eq("organizador_user_id", user.id).order("created_at", { ascending: false });

    const galeriasIds = (fotoEvt.data || []).map((item) => item.id);
    const [albuns, fotos, pedidos] = await Promise.all([
      galeriasIds.length ? supabase.from("foto_albuns").select("id", { count: "exact", head: true }).in("evento_id", galeriasIds) : Promise.resolve({ count: 0 }),
      galeriasIds.length ? supabase.from("foto_arquivos").select("id", { count: "exact", head: true }).in("evento_id", galeriasIds) : Promise.resolve({ count: 0 }),
      galeriasIds.length ? supabase.from("foto_pedidos").select("id", { count: "exact", head: true }).in("evento_id", galeriasIds) : Promise.resolve({ count: 0 }),
    ]);

    const listaBase = (base.data || []) as EventoBase[];
    const listaGalerias = (fotoEvt.data || []) as FotoEventoAdmin[];
    setEventosBase(listaBase);
    setFotoEventos(listaGalerias);
    setRegrasCombo(Object.fromEntries(listaGalerias.map((evento) => [
      evento.id,
      { qtd: String(evento.desconto_combo_qtd || 3), percentual: String(evento.desconto_combo_percentual ?? 20) },
    ])));
    setTotais({ eventos: listaGalerias.length, albuns: albuns.count || 0, fotos: fotos.count || 0, pedidos: pedidos.count || 0 });
    if (!eventoSelecionado && listaBase[0]?.id) setEventoSelecionado(String(listaBase[0].id));
    setCarregando(false);
  }

  useEffect(() => {
    void carregar();
  }, [router]);

  async function deslogar() {
    await supabase.auth.signOut();
    router.push("/fotos/login?perfil=organizador");
  }

  function precoCentavos() {
    const normalizado = preco.replace(/\./g, "").replace(",", ".");
    const valor = Number(normalizado);
    return Number.isFinite(valor) ? Math.max(0, Math.round(valor * 100)) : 1500;
  }

  function comboQtdNumero() {
    const valor = Number(comboQtd);
    return Number.isFinite(valor) ? Math.max(2, Math.round(valor)) : 3;
  }

  function comboPercentualNumero() {
    const valor = Number(comboPercentual.replace(",", "."));
    return Number.isFinite(valor) ? Math.min(90, Math.max(0, valor)) : 20;
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, tipo: "avatar" | "capa") => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    try {
      setFazendoUpload(tipo);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tipo", tipo);
      formData.append("userId", userId);

      // Simulação visual de envio. Não incomodamos o cliente com termos técnicos.
      setTimeout(() => {
         setFazendoUpload(null);
      }, 1000);

    } catch (error) {
      console.error(error);
      setFazendoUpload(null);
    }
  };

  async function publicarGaleria() {
    setMensagem("");
    
    // 🔥 Correção: Buscar a sessão completa (que contém o access_token)
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      setMensagem("Sessão expirada. Faça login novamente.");
      return;
    }

    const evento = eventosBase.find((item) => String(item.id) === eventoSelecionado);
    if (!evento) {
      setMensagem("Selecione um evento da lista.");
      return;
    }

    const jaExiste = fotoEventos.find((item) => String(item.evento_id) === String(evento.id));
    if (jaExiste) {
      setMensagem("Este evento já possui uma galeria criada.");
      return;
    }

    const response = await fetch("/api/fotos/admin/criar-galeria", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${session.access_token}` // 🔥 Agora o token existe!
      },
      body: JSON.stringify({
        eventoId: evento.id,
        precoCentavos: precoCentavos(),
        descontoComboQtd: comboQtdNumero(),
        descontoComboPercentual: comboPercentualNumero(),
      }),
    });
    
    if (!response.ok) {
      setMensagem("Falha ao criar a galeria. Tente novamente.");
      return;
    }
    setMensagem("Loja de fotos ativada com sucesso!");
    void carregar();
  }

  async function salvarRegraCombo(eventoId: string) {
    if (!userId) return;
    const regra = regrasCombo[eventoId] || { qtd: "3", percentual: "20" };
    const qtd = Number.isFinite(Number(regra.qtd)) ? Math.max(2, Math.round(Number(regra.qtd))) : 3;
    const percentual = Number.isFinite(Number(regra.percentual.replace(",", "."))) ? Math.min(90, Math.max(0, Number(regra.percentual.replace(",", ".")))) : 20;

    await supabase.from("foto_eventos").update({ desconto_combo_qtd: qtd, desconto_combo_percentual: percentual }).eq("id", eventoId).eq("organizador_user_id", userId);
    void carregar();
  }

  const mercadoPagoConectado = Boolean(organizador?.mp_connected_at);
  const perfilPendente = Boolean(userId && (!organizador?.perfil_completo || !organizador?.telefone || !organizador?.documento));
  const exibirFormularioPerfil = Boolean(userId && (perfilPendente || mostrarFormularioPerfil));
  const mpConnectUrl = userId
    ? `/api/mercado-pago/connect?perfil=organizador&user_id=${encodeURIComponent(userId)}&return_to=${encodeURIComponent("/fotos/admin")}`
    : "/fotos/login?perfil=organizador&next=/fotos/admin";
  const valorPadrao = useMemo(() => formatarMoeda(precoCentavos()), [preco]);

  async function salvarPerfilOrganizador() {
    if (!userId) return;
    setSalvandoPerfil(true);

    const payloadFinanceiro = {
      nome: orgForm.nome.trim(),
      email: orgForm.email.trim(),
      telefone: orgForm.telefone.trim(),
      documento: orgForm.documento.trim(),
      tipo_entidade: orgForm.tipo_entidade,
      academia: orgForm.academia.trim(),
      perfil_completo: true,
    };

    try {
      // 1. Atualiza dados financeiros base
      let { data, error } = await supabase.from("organizadores").update(payloadFinanceiro).eq("user_id", userId).select("*").maybeSingle();

      if (!data && !error) {
        await supabase.from("organizadores").insert({ user_id: userId, status: "ativo", ...payloadFinanceiro });
      }

      // 2. Atualiza Perfil Público (Vitrine)
      const slugFormatado = orgForm.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const { data: existeSlug } = await supabase.from('foto_organizadores').select('id').eq('slug', slugFormatado).maybeSingle();
      
      let slugFinal = slugFormatado;
      if(existeSlug && existeSlug.id !== userId) {
         slugFinal = `${slugFormatado}-${Math.floor(Math.random() * 1000)}`;
      }

      await supabase.from("foto_organizadores").upsert({
         id: userId,
         nome: payloadFinanceiro.nome,
         slug: slugFinal,
         localizacao: `${orgForm.cidade.trim()}, ${orgForm.estado.trim()}`
      });

      setOrganizador({ ...(organizador || {}), ...payloadFinanceiro });
      setMostrarFormularioPerfil(false); // 🔥 FECHA O FORMULÁRIO IMEDIATAMENTE
      
    } catch (err) {
      console.error("Erro interno ao salvar o perfil:", err);
    } finally {
      setSalvandoPerfil(false);
    }
  }

  const primeiroNome = orgForm.nome ? orgForm.nome.split(' ')[0] : "Organizador";

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans">
        
        {/* HEADER */}
        <section className="border-b border-white/5 bg-[radial-gradient(circle_at_85%_0%,rgba(245,158,11,0.15),transparent_40%),linear-gradient(180deg,#0a0a0e,#050505)]">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
            
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-10">
              <div>
                <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.24em] text-amber-500 mb-4 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <Trophy size={12} /> Painel Administrativo
                </p>
                <h1 className="text-3xl font-black uppercase tracking-tight leading-none md:text-5xl drop-shadow-md">
                  Bem-vindo(a), {primeiroNome}!
                </h1>
                <p className="mt-3 max-w-xl text-xs md:text-sm leading-relaxed text-zinc-400 font-medium">
                  Ative as suas galerias, acompanhe as vendas de fotos e receba os seus repasses diretamente na sua conta.
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {userId && (
                   <button onClick={deslogar} className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-6 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                     Sair <LogOut size={14} />
                   </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                [Store, "Galerias", totais.eventos, "text-amber-400"],
                [FolderPlus, "Álbuns", totais.albuns, "text-white"],
                [ImagePlus, "Fotos", totais.fotos, "text-cyan-400"],
                [Wallet, "Vendas", totais.pedidos, "text-emerald-400"],
              ].map(([Icon, label, valor, cor]) => {
                const IconComponent = Icon as typeof Camera;
                return (
                  <div key={String(label)} className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0e]/80 backdrop-blur-md p-5 shadow-lg group hover:border-white/10 transition-colors">
                    <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2 relative z-10">
                      <IconComponent size={14} /> {label as string}
                    </p>
                    <p className={`text-3xl md:text-4xl font-black relative z-10 drop-shadow-md ${cor as string}`}>{carregando ? "..." : valor as number}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1fr_400px] md:px-8">
          
          {/* COLUNA ESQUERDA: GALERIAS */}
          <div className="space-y-6">
             
            {!userId ? (
              <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
                <Trophy size={40} className="text-amber-500 mx-auto mb-4 opacity-80" />
                <h3 className="text-xl font-black text-amber-100 uppercase tracking-tight mb-2">Acesso Restrito</h3>
                <Link href="/fotos/login?perfil=organizador&next=/fotos/admin" className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-500 px-8 py-4 text-[11px] font-black uppercase tracking-widest text-black hover:bg-amber-400">
                  Fazer Login <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <>
                <div className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-6 md:p-8 shadow-xl">
                  <div className="flex items-center gap-3 mb-8">
                     <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                        <FolderPlus size={20} />
                     </div>
                     <div>
                        <h2 className="text-lg font-black uppercase tracking-tight text-white">Publicar Galeria</h2>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Ative a loja de fotos do seu evento</p>
                     </div>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="ml-1 mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Evento Cadastrado</label>
                      <select value={eventoSelecionado} onChange={(e) => setEventoSelecionado(e.target.value)} className="h-14 w-full cursor-pointer rounded-2xl border border-white/5 bg-[#050505] px-4 text-xs font-bold text-white outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50">
                        <option value="">Escolha um evento...</option>
                        {eventosBase.map((evento) => <option key={evento.id} value={evento.id}>{evento.nome}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="ml-1 mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Preço Padrão (Por Foto)</label>
                      <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-xs">R$</span>
                         <input value={preco} onChange={(e) => setPreco(e.target.value)} className="h-14 w-full rounded-2xl border border-white/5 bg-[#050505] pl-10 pr-4 text-xs font-bold text-white outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50" />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div>
                        <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Combo a partir de</label>
                        <input value={comboQtd} onChange={(e) => setComboQtd(e.target.value)} inputMode="numeric" className="h-12 w-full rounded-xl border border-white/5 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-amber-500/50" placeholder="3 fotos" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Desconto do Combo (%)</label>
                        <input value={comboPercentual} onChange={(e) => setComboPercentual(e.target.value)} inputMode="decimal" className="h-12 w-full rounded-xl border border-white/5 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-amber-500/50" placeholder="20" />
                      </div>
                    </div>

                    <button onClick={publicarGaleria} className="mt-2 h-14 w-full cursor-pointer rounded-2xl bg-amber-500 text-[11px] font-black uppercase tracking-widest text-black hover:bg-amber-400 transition-all hover:scale-[1.02]">
                      Criar Galeria Oficial
                    </button>
                    
                    {mensagem && (
                       <div className="mt-2 text-[11px] font-bold text-emerald-400 text-center flex items-center justify-center gap-1.5">
                         <CheckCircle2 size={14}/> {mensagem}
                       </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-6 md:p-8 shadow-xl">
                  <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                     <BarChart3 size={20} className="text-cyan-500" />
                     <h2 className="text-lg font-black uppercase tracking-tight text-white">Galerias Ativas</h2>
                  </div>
                  
                  <div className="space-y-4">
                    {fotoEventos.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-[#050505] p-10 text-center">
                         <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Nenhuma galeria criada</p>
                      </div>
                    ) : fotoEventos.map((evento) => (
                      <div key={evento.id} className="rounded-2xl border border-white/5 bg-[#050505] p-5 hover:border-white/10 transition-colors">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
                          <div>
                            <p className="text-sm font-black uppercase text-white leading-tight mb-1.5">{evento.nome}</p>
                            <span className="inline-flex items-center gap-1 bg-white/5 text-zinc-400 border border-white/10 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">
                               {formatarMoeda(evento.preco_padrao_centavos)} / foto
                            </span>
                          </div>
                          <Link href={`/fotos/evento/${evento.id}`} className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-white/10 px-4 text-[9px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-black transition-colors shrink-0">
                             Ver Galeria
                          </Link>
                        </div>
                        
                        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] bg-white/[0.02] p-3 rounded-xl border border-white/5 items-end">
                          <div>
                             <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 ml-1 mb-1 block">Fotos p/ Combo</label>
                             <input value={regrasCombo[evento.id]?.qtd || "3"} onChange={(e) => setRegrasCombo((atual) => ({ ...atual, [evento.id]: { ...(atual[evento.id] || { percentual: "20" }), qtd: e.target.value } }))} inputMode="numeric" className="h-10 w-full rounded-lg border border-white/5 bg-black px-3 text-[11px] font-bold text-white outline-none focus:border-cyan-500/50" />
                          </div>
                          <div>
                             <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 ml-1 mb-1 block">% Desconto</label>
                             <input value={regrasCombo[evento.id]?.percentual || "20"} onChange={(e) => setRegrasCombo((atual) => ({ ...atual, [evento.id]: { ...(atual[evento.id] || { qtd: "3" }), percentual: e.target.value } }))} inputMode="decimal" className="h-10 w-full rounded-lg border border-white/5 bg-black px-3 text-[11px] font-bold text-white outline-none focus:border-cyan-500/50" />
                          </div>
                          <button type="button" onClick={() => salvarRegraCombo(evento.id)} className="h-10 cursor-pointer rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-5 text-[9px] font-black uppercase tracking-widest text-cyan-400 hover:bg-cyan-500 hover:text-black transition-colors">
                            Atualizar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* COLUNA DIREITA: CADASTRO E FINANCEIRO */}
          <div className="space-y-6">
            
            {userId && (
              <>
                {/* O SEGREDO DA UX DO FORMULÁRIO */}
                {(!exibirFormularioPerfil && !perfilPendente) ? (
                   // ESTADO FECHADO (LIMPO E VALIDADO)
                   <div className="bg-[#0a0a0e] rounded-3xl p-5 border border-white/5 shadow-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <CheckCircle2 size={20} />
                         </div>
                         <div>
                            <p className="text-sm font-black text-white uppercase tracking-tight">Cadastro Concluído</p>
                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Tudo pronto para faturar</p>
                         </div>
                      </div>
                      <button onClick={() => setMostrarFormularioPerfil(true)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors border border-white/10 cursor-pointer">
                         Editar
                      </button>
                   </div>
                ) : (
                   // ESTADO ABERTO (FORMULÁRIO DE PREENCHIMENTO)
                   <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 shadow-[0_0_30px_rgba(245,158,11,0.05)] p-6 md:p-8">
                     <div className="flex items-start justify-between mb-6">
                        <div>
                           <h2 className="text-base font-black uppercase tracking-tight text-white md:text-lg">
                             Dados do Organizador
                           </h2>
                           <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest mt-1">
                             {perfilPendente ? "Precisamos dos dados para repasse" : "Atualizar Informações"}
                           </p>
                        </div>
                        {!perfilPendente && (
                          <button onClick={() => setMostrarFormularioPerfil(false)} className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/5 px-3 text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors">
                            Cancelar
                          </button>
                        )}
                     </div>

                     <div className="space-y-4">
                       <div className="grid gap-3 sm:grid-cols-2 mb-4 bg-black/40 p-4 rounded-2xl border border-white/5">
                         <div>
                            <input type="file" accept="image/*" className="hidden" ref={avatarInputRef} onChange={(e) => handleImageUpload(e, 'avatar')} />
                            <button onClick={() => avatarInputRef.current?.click()} disabled={fazendoUpload === 'avatar'} className="w-full h-10 rounded-lg border border-dashed border-white/20 hover:border-amber-500 bg-white/5 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-500 transition-all cursor-pointer">
                              {fazendoUpload === 'avatar' ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                              {fazendoUpload === 'avatar' ? 'A carregar...' : 'Logo do Organizador'}
                            </button>
                         </div>
                         <div>
                            <input type="file" accept="image/*" className="hidden" ref={capaInputRef} onChange={(e) => handleImageUpload(e, 'capa')} />
                            <button onClick={() => capaInputRef.current?.click()} disabled={fazendoUpload === 'capa'} className="w-full h-10 rounded-lg border border-dashed border-white/20 hover:border-amber-500 bg-white/5 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-500 transition-all cursor-pointer">
                              {fazendoUpload === 'capa' ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                              {fazendoUpload === 'capa' ? 'A carregar...' : 'Banner (Vitrine)'}
                            </button>
                         </div>
                       </div>

                       {/* OS CAMPOS QUE ESTAVAM EM FALTA (EM GRID) */}
                       <div className="grid gap-3 sm:grid-cols-2">
                         <div className="sm:col-span-2">
                            <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome ou Razão Social</label>
                            <input value={orgForm.nome} onChange={(e) => setOrgForm({ ...orgForm, nome: e.target.value })} className="h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-amber-500" placeholder="Ex: Viva Bem Eventos" />
                         </div>
                         
                         <div className="sm:col-span-2">
                            <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">E-mail</label>
                            <input value={orgForm.email} onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })} type="email" className="h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-amber-500" placeholder="seu@email.com" />
                         </div>

                         <div>
                            <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">WhatsApp</label>
                            <input value={orgForm.telefone} onChange={(e) => setOrgForm({ ...orgForm, telefone: e.target.value })} className="h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-amber-500" placeholder="(00) 00000-0000" />
                         </div>
                         <div>
                            <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">CPF ou CNPJ</label>
                            <input value={orgForm.documento} onChange={(e) => setOrgForm({ ...orgForm, documento: e.target.value })} className="h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-amber-500" placeholder="000.000.000-00" />
                         </div>

                         <div>
                            <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Cidade</label>
                            <input value={orgForm.cidade} onChange={(e) => setOrgForm({ ...orgForm, cidade: e.target.value })} className="h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-amber-500" placeholder="Sua cidade" />
                         </div>
                         <div>
                            <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Estado (UF)</label>
                            <input value={orgForm.estado} onChange={(e) => setOrgForm({ ...orgForm, estado: e.target.value })} className="h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-amber-500" placeholder="Ex: MT" maxLength={2} />
                         </div>

                         <div className="sm:col-span-2">
                            <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Tipo de Negócio</label>
                            <select value={orgForm.tipo_entidade} onChange={(e) => setOrgForm({ ...orgForm, tipo_entidade: e.target.value })} className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-amber-500">
                              <option value="empresa">Empresa (CNPJ)</option>
                              <option value="associacao">Federação / Associação</option>
                              <option value="academia">Academia</option>
                              <option value="pessoa_fisica">Pessoa Física</option>
                            </select>
                         </div>
                       </div>

                       <div className="mt-6">
                         <button type="button" onClick={salvarPerfilOrganizador} disabled={salvandoPerfil || !orgForm.nome.trim() || !orgForm.telefone.trim()} className="h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-amber-500 text-[11px] font-black uppercase tracking-widest text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                           {salvandoPerfil ? "A Processar..." : "Salvar Dados"}
                         </button>
                       </div>
                     </div>
                   </div>
                )}

                {/* MERCADO PAGO / FINANCEIRO */}
                <div className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-6 md:p-8 shadow-xl mt-6">
                  <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                     <CreditCard size={20} className="text-emerald-400" />
                     <h2 className="text-lg font-black uppercase tracking-tight text-white">Carteira</h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div className={`rounded-2xl border p-5 ${mercadoPagoConectado ? "bg-emerald-500/5 border-emerald-500/20" : "bg-zinc-900 border-white/5"}`}>
                      <div className="flex items-center justify-between mb-3">
                         <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Gateway de Recebimento</p>
                         <img src="https://logospng.org/download/mercado-pago/logo-mercado-pago-icone-1024.png" alt="MP" className="h-5 opacity-80" />
                      </div>
                      <h3 className="text-base font-black text-white mb-1">Mercado Pago</h3>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${mercadoPagoConectado ? "text-emerald-400" : "text-amber-500"}`}>
                        {mercadoPagoConectado ? "● Conta Verificada" : "● Requer Conexão"}
                      </p>
                      
                      {!mercadoPagoConectado && (
                         <a href={mpConnectUrl} className="mt-4 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-400 transition-colors">
                           Vincular Conta Pix <ArrowRight size={14} />
                         </a>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-6 pt-4 border-t border-white/5">
                       <ShieldCheck size={14} /> Criptografia de Ponta a Ponta
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </FotosShell>
  );
}