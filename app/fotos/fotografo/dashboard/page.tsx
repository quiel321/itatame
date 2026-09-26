"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { comprimirAvatar } from "@/app/lib/comprimir-avatar";
import FotosShell from "../../_components/FotosShell";
import { Camera, CheckCircle2, ChevronDown, CloudUpload, CreditCard, FolderOpen, ImagePlus, ShieldCheck, Wallet, LogOut, AlertCircle, Store, X, Edit, Calendar, MapPin, Trash2, Loader2, Check, Plus, Images, Trophy, ChartNoAxesCombined, Link2 } from "lucide-react";
import MercadoPagoConnectButton from "@/app/admin/_components/MercadoPagoConnectButton";
import GerenciadorMidias from "../_components/GerenciadorMidias";

type FotografoPerfil = { id: string; nome: string | null; email: string | null; foto_url?: string | null; telefone?: string | null; documento?: string | null; cep?: string | null; endereco?: string | null; cidade?: string | null; estado?: string | null; bio?: string | null; perfil_completo?: boolean | null; status: string | null; mp_connected_at?: string | null; mp_user_id?: string | null; };
type Totais = { fotos: number; albuns: number; eventos: number; vendas: number };
type PerfilForm = { nome: string; telefone: string; documento: string; cep: string; endereco: string; cidade: string; estado: string; bio: string; };

type GaleriaFreelancer = { id: string; nome: string; cidade?: string | null; estado?: string | null; data_evento?: string | null; preco_padrao_centavos?: number | null; preco_bloqueado?: boolean; capa_url?: string | null; comissao_organizador_percentual?: number | null; modelo_recebimento?: "royalty" | "diaria_organizador"; created_by?: string | null; desconto_combo_qtd?: number | null; desconto_combo_percentual?: number | null; };

function perfilParaForm(perfil: FotografoPerfil | null, email: string | null): PerfilForm {
  return { nome: perfil?.nome || email?.split("@")[0] || "", telefone: perfil?.telefone || "", documento: perfil?.documento || "", cep: perfil?.cep || "", endereco: perfil?.endereco || "", cidade: perfil?.cidade || "", estado: perfil?.estado || "", bio: perfil?.bio || "", };
}

export default function FotografoDashboardPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<FotografoPerfil | null>(null);
  const [totais, setTotais] = useState<Totais>({ fotos: 0, albuns: 0, eventos: 0, vendas: 0 });
  const [carregando, setCarregando] = useState(true);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [mostrarFormularioPerfil, setMostrarFormularioPerfil] = useState(false);
  const [perfilForm, setPerfilForm] = useState<PerfilForm>(() => perfilParaForm(null, null));
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const criarGaleriaRef = useRef<HTMLDivElement>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const [mostrarCriarGaleria, setMostrarCriarGaleria] = useState(false);
  const [mostrarDetalhesMp, setMostrarDetalhesMp] = useState(false);
  const [galeriaForm, setGaleriaForm] = useState({ nome: "", cidade: "", estado: "", dataEvento: "", preco: "15,00" });
  const [capaGaleria, setCapaGaleria] = useState<File | null>(null);
  const [criandoGaleria, setCriandoGaleria] = useState(false);
  const [mensagemGaleria, setMensagemGaleria] = useState("");

  const [minhasGalerias, setMinhasGalerias] = useState<GaleriaFreelancer[]>([]);
  const [galeriasOficiais, setGaleriasOficiais] = useState<GaleriaFreelancer[]>([]);
  const [editandoGaleria, setEditandoGaleria] = useState<GaleriaFreelancer | null>(null);
  const [editGaleriaForm, setEditGaleriaForm] = useState({ nome: "", cidade: "", estado: "", dataEvento: "", preco: "15,00", comboQtd: "3", comboPercentual: "20" });
  const [editCapaGaleria, setEditCapaGaleria] = useState<File | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [excluindoGaleria, setExcluindoGaleria] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null);

  const [gerenciandoGaleria, setGerenciandoGaleria] = useState<string | null>(null);

  const nomeExibicao = useMemo(() => perfil?.nome || email?.split("@")[0] || "Fotógrafo", [perfil?.nome, email]);
  const mercadoPagoConectado = useMemo(() => Boolean(perfil?.mp_connected_at), [perfil?.mp_connected_at]);
  const perfilPendente = useMemo(() => Boolean(userId && (!perfil?.perfil_completo || !perfil?.telefone || !perfil?.documento)), [userId, perfil]);
  const exibirFormularioPerfil = useMemo(() => Boolean(userId && (perfilPendente || mostrarFormularioPerfil)), [userId, perfilPendente, mostrarFormularioPerfil]);
  const primeiroNome = useMemo(() => nomeExibicao.split(' ')[0], [nomeExibicao]);

  function abrirCriacaoGaleria() {
    setMostrarCriarGaleria(true);
    window.setTimeout(() => criarGaleriaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  useEffect(() => {
    const abrirPeloAtalho = () => {
      if (window.location.hash === "#criar-galeria") abrirCriacaoGaleria();
    };
    abrirPeloAtalho();
    window.addEventListener("hashchange", abrirPeloAtalho);
    return () => window.removeEventListener("hashchange", abrirPeloAtalho);
  }, []);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        router.replace("/fotos/login?perfil=fotografo&next=/fotos/fotografo/dashboard");
        return;
      }

      const { data: isOrg } = await supabase.from("organizadores").select("user_id").eq("user_id", user.id).maybeSingle();
      if (isOrg) {
        router.replace("/fotos/admin");
        return;
      }

      setUserId(user.id);
      setEmail(user.email || null);

      let perfilAtual: FotografoPerfil | null = null;
      const tentativaCompleta = await supabase.from("fotografos").select("id, nome, email, foto_url, telefone, documento, cep, endereco, cidade, estado, bio, perfil_completo, status, mp_connected_at, mp_user_id").eq("user_id", user.id).maybeSingle();

      if (tentativaCompleta.data) {
        perfilAtual = tentativaCompleta.data as FotografoPerfil;
      } else {
        const tentativaBasica = await supabase.from("fotografos").select("id, nome, email, telefone, documento, bio, status").eq("user_id", user.id).maybeSingle();
        perfilAtual = (tentativaBasica.data as FotografoPerfil | null) || null;
      }

      if (!perfilAtual) {
        router.replace("/fotos/login?perfil=fotografo");
        return;
      }

      setPerfil(perfilAtual);
      setPerfilForm(perfilParaForm(perfilAtual, user.email || null));

      if (perfilAtual?.id) {
        const [fotos, albuns, vendas, galeriasDb, credenciais] = await Promise.all([
          supabase.from("foto_arquivos").select("id", { count: "exact", head: true }).eq("fotografo_id", perfilAtual.id),
          supabase.from("foto_albuns").select("id", { count: "exact", head: true }).eq("fotografo_id", perfilAtual.id),
          supabase.from("foto_pedidos").select("id", { count: "exact", head: true }).eq("fotografo_id", perfilAtual.id).eq("status", "pago"),
          supabase.from("foto_eventos").select("id, nome, cidade, estado, data_evento, preco_padrao_centavos, preco_bloqueado, capa_url, desconto_combo_qtd, desconto_combo_percentual").eq("created_by", user.id).order("created_at", { ascending: false }),
           supabase.from("foto_evento_fotografos").select("evento_id, comissao_organizador_percentual, modelo_recebimento").eq("fotografo_id", perfilAtual.id).eq("status", "ativo")
        ]);

        setMinhasGalerias(galeriasDb.data || []);

        const eventosPermitidos = (credenciais.data || []).map((item) => item.evento_id);
        let oficiaisDb: GaleriaFreelancer[] = [];

        if (eventosPermitidos.length > 0) {
           const { data } = await supabase
              .from("foto_eventos")
              .select("id, nome, cidade, estado, data_evento, preco_padrao_centavos, preco_bloqueado, capa_url, created_by")
              .in("id", eventosPermitidos)
              .order("created_at", { ascending: false });

            const royaltyPorEvento = new Map(
             (credenciais.data || []).map((item) => [
               String(item.evento_id),
               Number(item.comissao_organizador_percentual || 0),
             ] as const),
            );
            const modeloPorEvento = new Map((credenciais.data || []).map((item) => [
              String(item.evento_id),
              item.modelo_recebimento === "diaria_organizador" ? "diaria_organizador" : "royalty",
            ] as const));
           oficiaisDb = (data || [])
             .filter((galeria) => galeria.created_by !== user.id)
             .map((galeria) => ({
               ...galeria,
                comissao_organizador_percentual: royaltyPorEvento.get(String(galeria.id)) || 0,
                modelo_recebimento: modeloPorEvento.get(String(galeria.id)) || "royalty",
             }));
        }

        setGaleriasOficiais(oficiaisDb);
        setTotais((atual) => ({
           ...atual,
           fotos: fotos.count || 0,
           albuns: albuns.count || 0,
           vendas: vendas.count || 0,
           eventos: (galeriasDb.data?.length || 0) + oficiaisDb.length
        }));
      }

      setCarregando(false);
    }
    void carregar();
  }, [router]);

  async function deslogar() {
    await supabase.auth.signOut();
    router.push("/fotos/login?perfil=fotografo");
  }

  async function salvarPerfilFotografo() {
    if (!perfil?.id) return;
    setSalvandoPerfil(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
      const response = await fetch("/api/fotos/fotografo/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(perfilForm),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) throw new Error(resultado?.error || "Não foi possível salvar o perfil.");
      setPerfil({ ...perfil, ...(resultado.perfil as FotografoPerfil) });
      setMostrarFormularioPerfil(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível salvar o perfil.");
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function enviarFotoPerfil(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !perfil?.id || !userId) return;
    setEnviandoFoto(true);
    try {
      const leve = await comprimirAvatar(file);
      const caminho = `fotos-fotografos/${userId}/perfil-${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(caminho, leve, { contentType: "image/webp", upsert: false });
      if (uploadError) throw uploadError;
      const fotoUrl = supabase.storage.from("avatars").getPublicUrl(caminho).data.publicUrl;
      const { error } = await supabase.from("fotografos").update({ foto_url: fotoUrl }).eq("id", perfil.id).eq("user_id", userId);
      if (error) throw error;
      setPerfil({ ...perfil, foto_url: fotoUrl });
    } catch (error) {
      console.error("Foto de perfil do fotógrafo:", error);
      alert("Não foi possível enviar a foto de perfil.");
    } finally {
      setEnviandoFoto(false);
      event.target.value = "";
    }
  }

  async function criarGaleriaFreelancer() {
    setMensagemGaleria("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const normalizado = Number(galeriaForm.preco.replace(/\./g, "").replace(",", "."));
    setCriandoGaleria(true);
    let capaUrl: string | null = null;
    if (capaGaleria) {
      const form = new FormData();
      form.append("file", capaGaleria);
      const uploadResponse = await fetch("/api/fotos/capa-upload", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
      const upload = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok || !upload?.publicUrl) { setCriandoGaleria(false); setMensagemGaleria(upload?.error || "Não foi possível enviar a foto de capa."); return; }
      capaUrl = upload.publicUrl;
    }
    const response = await fetch("/api/fotos/fotografo/criar-galeria", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ...galeriaForm, capaUrl, precoCentavos: Number.isFinite(normalizado) ? Math.round(normalizado * 100) : 1500 }),
    });
    const resultado = await response.json().catch(() => null);
    setCriandoGaleria(false);
    if (!response.ok) { setMensagemGaleria(resultado?.error || "Não foi possível criar a galeria."); return; }

    window.location.reload();
  }

  async function desvincularMercadoPago() {
    if (!perfil?.id) return;
    if (!confirm("Tem certeza que deseja desvincular sua conta do Mercado Pago?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { alert("Sessão expirada. Entre novamente."); return; }
    const response = await fetch("/api/fotos/fotografo/mercado-pago", { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
    const resultado = await response.json().catch(() => null);
    if (!response.ok) { alert(resultado?.error || "Não foi possível desvincular a conta."); return; }
    setPerfil({ ...perfil, mp_connected_at: null, mp_user_id: null });
    alert("Conta desvinculada com sucesso.");
  }

  function abrirEdicaoGaleria(galeria: GaleriaFreelancer) {
    setGerenciandoGaleria(null);
    setEditandoGaleria(galeria);
    setEditGaleriaForm({
      nome: galeria.nome || "",
      cidade: galeria.cidade || "",
      estado: galeria.estado || "",
      dataEvento: galeria.data_evento || "",
      preco: ((galeria.preco_padrao_centavos || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      comboQtd: String(galeria.desconto_combo_qtd ?? 3),
      comboPercentual: String(galeria.desconto_combo_percentual ?? 20).replace(".", ","),
    });
    setEditCapaGaleria(null);
  }

  async function salvarEdicaoGaleria() {
    if (!editandoGaleria) return;
    setSalvandoEdicao(true);
    let novaCapaUrl = editandoGaleria.capa_url;
    const { data: { session } } = await supabase.auth.getSession();

    if (editCapaGaleria && session) {
      const form = new FormData();
      form.append("file", editCapaGaleria);
      const uploadResponse = await fetch("/api/fotos/capa-upload", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
      const upload = await uploadResponse.json().catch(() => null);
      if (upload?.publicUrl) novaCapaUrl = upload.publicUrl;
    }

    const precoCentavos = Math.max(0, Math.round(Number(editGaleriaForm.preco.replace(/\./g, "").replace(",", ".")) * 100));
    const comboQtdDigitado = Math.round(Number(editGaleriaForm.comboQtd));
    const comboPercentualDigitado = Number(editGaleriaForm.comboPercentual.replace(",", "."));
    const comboQtd = Number.isFinite(comboQtdDigitado) ? Math.max(2, comboQtdDigitado) : 3;
    const comboPercentual = Number.isFinite(comboPercentualDigitado) ? Math.min(90, Math.max(0, comboPercentualDigitado)) : 0;

    const { error } = await supabase.from("foto_eventos").update({
      nome: editGaleriaForm.nome.trim(),
      cidade: editGaleriaForm.cidade.trim(),
      estado: editGaleriaForm.estado.trim().toUpperCase(),
      data_evento: editGaleriaForm.dataEvento || null,
      preco_padrao_centavos: precoCentavos,
      desconto_combo_qtd: comboQtd,
      desconto_combo_percentual: comboPercentual,
      capa_url: novaCapaUrl
    }).eq("id", editandoGaleria.id);

    setSalvandoEdicao(false);
    if (error) {
      alert("Erro ao salvar alterações. Verifique sua conexão.");
    } else {
      window.location.reload();
    }
  }

  async function excluirGaleria(galeriaId: string) {
    if (!confirm("Excluir esta galeria? Todas as mídias dela serão apagadas do sistema e da nuvem. Galerias com pedidos não podem ser excluídas.")) return;
    setExcluindoGaleria(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
      const response = await fetch("/api/fotos/fotografo/excluir-galeria", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ galeriaId }),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) throw new Error(resultado?.error || "Não foi possível excluir a galeria.");
      if (resultado?.aviso) alert(resultado.aviso);
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível excluir a galeria.");
    } finally {
      setExcluindoGaleria(false);
    }
  }

  function abrirGerenciadorFotos(galeriaId: string) {
    setEditandoGaleria(null);
    setGerenciandoGaleria((atual) => atual === galeriaId ? null : galeriaId);
  }

  async function copiarLinkGaleria(galeriaId: string) {
    const prefixo = window.location.pathname.startsWith("/fotos") ? "/fotos" : "";
    const link = `${window.location.origin}${prefixo}/evento/${galeriaId}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopiado(galeriaId);
      window.setTimeout(() => setLinkCopiado((atual) => atual === galeriaId ? null : atual), 2000);
    } catch {
      prompt("Copie o link da galeria:", link);
    }
  }

  function renderizarGerenciador(galeriaId: string) {
    if (gerenciandoGaleria !== galeriaId) return null;
    return (
      <GerenciadorMidias
        key={galeriaId}
        galeriaId={galeriaId}
        precoBloqueado={[...minhasGalerias, ...galeriasOficiais].find((galeria) => galeria.id === galeriaId)?.preco_bloqueado === true}
        onFechar={() => setGerenciandoGaleria(null)}
        onMidiasExcluidas={(quantidade) => setTotais((atual) => ({ ...atual, fotos: Math.max(0, atual.fotos - quantidade) }))}
      />
    );
  }

  if (carregando) return <FotosShell area="fotografo"><main className="min-h-screen bg-[#050505] flex items-center justify-center"><Camera size={32} className="text-retratt animate-pulse"/></main></FotosShell>;

  return (
    <FotosShell area="fotografo">
      <main className="min-h-screen bg-[#050505] text-white font-sans relative overflow-x-hidden w-full">

        <section className="border-b border-white/5 bg-[radial-gradient(circle_at_85%_0%,rgba(255,90,31,0.18),transparent_32%),linear-gradient(180deg,#101014,#050505)] w-full">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
            <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-retratt/40 bg-retratt/10 shadow-[0_0_24px_rgba(255,90,31,0.16)] sm:h-20 sm:w-20">
                  {perfil?.foto_url ? <img src={perfil.foto_url} alt={`Foto de ${nomeExibicao}`} className="h-full w-full object-cover" /> : <Camera size={26} className="text-retratt" />}
                  {perfil?.perfil_completo && <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-black"><Check size={12}/></span>}
                </div>
                <div className="min-w-0">
                  <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-retratt/20 bg-retratt/10 px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-retratt shadow-[0_0_15px_rgba(255,90,31,0.1)] sm:text-[9px]"><Camera size={12} /> Dashboard do Fotógrafo</p>
                  <h1 className="break-words text-3xl font-black uppercase leading-none tracking-tight drop-shadow-md sm:text-4xl md:text-5xl">Olá, {primeiroNome}!</h1>
                  <p className="mt-3 max-w-xl text-xs font-medium leading-relaxed text-zinc-400 md:text-sm">Crie suas galerias, publique mídias e acompanhe vendas e repasses em um só lugar.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-3">
                <Link href="/fotos/fotografo/financeiro" className="cursor-pointer inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 text-[10px] font-black uppercase tracking-widest text-emerald-300 hover:bg-emerald-400 hover:text-black transition-colors shadow-sm">Financeiro <ChartNoAxesCombined size={14} className="shrink-0" /></Link>
                <Link href="/fotos/fotografo/painel" className="cursor-pointer inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-retratt px-5 text-[10px] font-black uppercase tracking-widest text-black hover:bg-retratt transition-colors shadow-sm">Criar álbum <CloudUpload size={14} className="shrink-0" /></Link>
                <button type="button" onClick={abrirCriacaoGaleria} className="cursor-pointer inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-retratt/40 bg-retratt/10 px-5 text-[10px] font-black uppercase tracking-widest text-retratt transition-colors hover:bg-retratt hover:text-black sm:w-auto"><Plus size={14}/> Minha galeria</button>
                {userId && <button onClick={deslogar} className="cursor-pointer inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-retratt/20 bg-retratt/10 px-6 text-[10px] font-black uppercase tracking-widest text-retratt hover:bg-retratt hover:text-white transition-all shadow-sm">Sair <LogOut size={14} className="shrink-0" /></button>}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[[ImagePlus, "Mídias Publicadas", totais.fotos, "text-retratt"], [FolderOpen, "Álbuns Criados", totais.albuns, "text-white"], [Store, "Eventos", totais.eventos, "text-retratt"], [Wallet, "Vendas", totais.vendas, "text-emerald-400"]].map(([Icon, label, valor, cor], index) => {
                const IconComponent = Icon as typeof Camera;
                return (
                  <div key={index} className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0e]/80 backdrop-blur-md p-4 sm:p-5 shadow-lg group hover:border-white/10 transition-colors">
                    <p className="flex items-center gap-2 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2 relative z-10 truncate"><IconComponent size={14} className="shrink-0" /> <span className="truncate">{label as string}</span></p>
                    <p className={`text-2xl sm:text-3xl md:text-4xl font-black relative z-10 drop-shadow-md ${cor as string}`}>{carregando ? "..." : valor as number}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 md:px-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="space-y-6 w-full min-w-0">
            {!userId ? null : (
              <>
                {(!exibirFormularioPerfil && !perfilPendente) ? (
                   <div id="perfil-fotografo" className="scroll-mt-24 bg-[#0a0a0e] rounded-3xl p-5 sm:p-6 border border-white/5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-retratt/30 bg-retratt/10">
                          {perfil?.foto_url ? <img src={perfil.foto_url} alt="Foto de perfil" className="h-full w-full object-cover" /> : <Camera size={28} className="text-retratt" />}
                          <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-black"><Check size={12}/></span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-black uppercase tracking-tight text-white">{nomeExibicao}</p>
                          <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-emerald-400">Perfil verificado • apto a faturar</p>
                          <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">{perfil?.bio || "Adicione uma apresentação curta para compradores e organizadores conhecerem o seu trabalho."}</p>
                        </div>
                      </div>
                      <button onClick={() => setMostrarFormularioPerfil(true)} className="cursor-pointer w-full sm:w-auto px-6 py-3 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-colors border border-white/10 text-center">Editar foto e perfil</button>
                   </div>
                ) : (
                   <div id="perfil-fotografo" className="scroll-mt-24 rounded-3xl border border-retratt/30 bg-retratt/5 shadow-[0_0_30px_rgba(255,90,31,0.05)] p-5 sm:p-6 md:p-8">
                     <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                        <div><h2 className="text-base font-black uppercase tracking-tight text-white md:text-lg">Dados do Fotógrafo</h2><p className="text-[10px] font-bold text-retratt/80 uppercase tracking-widest mt-1">{perfilPendente ? "Necessário para repasses" : "Atualizar Informações"}</p></div>
                        {!perfilPendente && (<button onClick={() => setMostrarFormularioPerfil(false)} className="cursor-pointer w-full sm:w-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white/5 px-4 text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors">Cancelar</button>)}
                     </div>

                     <div className="space-y-4">
                       {perfilPendente && (<div className="flex items-start gap-3 bg-black/40 p-4 rounded-xl border border-retratt/20 mb-4"><AlertCircle size={16} className="text-retratt shrink-0 mt-0.5" /><p className="text-[10px] font-bold text-orange-100 leading-relaxed uppercase tracking-wider">Preencha os campos abaixo para que as suas fotos possam ser exibidas nas galerias oficiais.</p></div>)}

                       <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-white/5 bg-black/40 p-4 sm:p-5">
                         <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-retratt/30 bg-retratt/10">
                           {perfil?.foto_url ? <img src={perfil.foto_url} alt="Foto do fotógrafo" className="h-full w-full object-cover" /> : <Camera size={24} className="text-retratt" />}
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-xs font-black uppercase text-white">Foto de perfil</p>
                           <p className="mt-1 text-[10px] text-zinc-500">Esta imagem identifica você nas galerias e no painel.</p>
                           <input ref={fotoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={enviarFotoPerfil} />
                           <button type="button" onClick={() => fotoInputRef.current?.click()} disabled={enviandoFoto} className="mt-3 w-full sm:w-auto h-9 cursor-pointer rounded-lg border border-retratt/30 bg-retratt/10 px-4 text-[9px] font-black uppercase tracking-widest text-retratt disabled:opacity-50 text-center">{enviandoFoto ? "Enviando..." : "Adicionar foto"}</button>
                         </div>
                       </div>

                       <div className="grid gap-3 sm:grid-cols-2">
                         <div className="sm:col-span-2"><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome Completo</label><input value={perfilForm.nome} onChange={(e) => setPerfilForm({ ...perfilForm, nome: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="Seu nome" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">WhatsApp</label><input value={perfilForm.telefone} onChange={(e) => setPerfilForm({ ...perfilForm, telefone: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="(00) 00000-0000" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">CPF</label><input value={perfilForm.documento} onChange={(e) => setPerfilForm({ ...perfilForm, documento: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="000.000.000-00" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">CEP</label><input value={perfilForm.cep} onChange={(e) => setPerfilForm({ ...perfilForm, cep: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="00000-000" /></div>
                         <div className="sm:col-span-2"><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Endereço Completo</label><input value={perfilForm.endereco} onChange={(e) => setPerfilForm({ ...perfilForm, endereco: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="Rua, Número, Bairro" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Cidade</label><input value={perfilForm.cidade} onChange={(e) => setPerfilForm({ ...perfilForm, cidade: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="Sua cidade" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Estado (UF)</label><input value={perfilForm.estado} onChange={(e) => setPerfilForm({ ...perfilForm, estado: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="Ex: SP" maxLength={2} /></div>
                         <div className="sm:col-span-2"><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Bio (Equipamento / Foco)</label><textarea value={perfilForm.bio} onChange={(e) => setPerfilForm({ ...perfilForm, bio: e.target.value })} className="cursor-text min-h-20 w-full rounded-xl border border-white/10 bg-[#050505] p-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="Ex: Especialista em desporto. Utilizo Sony A7IV com lente 70-200mm." /></div>
                       </div>
                       <div className="mt-6"><button type="button" onClick={salvarPerfilFotografo} disabled={salvandoPerfil || !perfilForm.nome.trim() || !perfilForm.telefone.trim() || !perfilForm.documento.trim()} className="cursor-pointer h-12 w-full flex items-center justify-center rounded-xl bg-retratt text-[11px] font-black uppercase tracking-widest text-black hover:bg-retratt disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,90,31,0.2)]">{salvandoPerfil ? "A Processar..." : "Salvar Perfil Seguro"}</button></div>
                     </div>
                   </div>
                )}

                {/* 🔥 EVENTOS OFICIAIS */}
                {galeriasOficiais.length > 0 && (
                  <div className="rounded-3xl border border-emerald-500/10 bg-[#0a0a0e] p-5 sm:p-6 md:p-8 shadow-xl mt-6">
                    <h2 className="text-lg font-black uppercase tracking-tight text-white mb-6 flex items-center gap-2">
                       <ShieldCheck size={20} className="text-emerald-500 shrink-0"/> Eventos Oficiais
                    </h2>
                    <p className="text-[10px] text-zinc-400 mb-6 font-medium leading-relaxed">Você foi credenciado para produzir estes eventos. Adicione fotos ou vídeos e acompanhe tudo no mesmo painel.</p>

                    <div className="space-y-4">
                      {galeriasOficiais.map((galeria) => (
                         <div key={galeria.id} className="rounded-2xl border border-white/5 bg-[#050505] p-4 sm:p-5 hover:border-emerald-500/20 transition-colors">
                            <div className="flex min-w-0 items-start gap-4">
                                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-zinc-900 sm:h-24 sm:w-24">
                                     {galeria.capa_url ? <img src={galeria.capa_url} className="w-full h-full object-cover" alt="Capa" /> : <Trophy className="text-emerald-500/50" size={24}/>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                     <h3 className="line-clamp-2 text-sm font-black uppercase leading-snug text-white sm:text-base">{galeria.nome}</h3>
                                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                                         <span className="flex items-center gap-1 shrink-0"><Calendar size={10} className="shrink-0"/> {galeria.data_evento ? new Date(galeria.data_evento).toLocaleDateString('pt-BR') : "Sem data"}</span>
                                         <span className="flex min-w-0 items-center gap-1"><MapPin size={10} className="shrink-0"/> <span className="truncate">{galeria.cidade || "Local"} / {galeria.estado || "UF"}</span></span>
                                      </div>
                                      <div className="mt-3 flex flex-wrap gap-1.5 text-[8px] font-black uppercase tracking-wider">
                                        <span className="rounded-full bg-retratt/10 px-2 py-1 text-retratt">Retratt 5%</span>
                                         {galeria.modelo_recebimento === "diaria_organizador" ? (
                                           <span className="rounded-full bg-amber-400/10 px-2 py-1 text-amber-300">Diária: organizador recebe as vendas</span>
                                         ) : <><span className="rounded-full bg-amber-400/10 px-2 py-1 text-amber-300">Organizador {Number(galeria.comissao_organizador_percentual || 0).toLocaleString("pt-BR")}%</span><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-300">Você {(95 - Number(galeria.comissao_organizador_percentual || 0)).toLocaleString("pt-BR")}%*</span></>}
                                      </div>
                                       <p className="mt-2 text-[8px] leading-relaxed text-zinc-600">{galeria.modelo_recebimento === "diaria_organizador" ? "Sua diária é combinada com o organizador fora da Retratt. A tarifa do pagamento sai da conta dele." : "*Antes da tarifa do meio de pagamento, descontada da sua conta."}</p>
                                  </div>
                            </div>

                               <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                  <Link href={`/fotos/fotografo/painel?evento=${galeria.id}`} className="cursor-pointer inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-retratt px-3 text-[9px] font-black uppercase tracking-wider text-black transition-colors hover:brightness-110">
                                    <CloudUpload size={12} className="shrink-0"/> Adicionar mídias
                                  </Link>
                                  <button onClick={() => abrirGerenciadorFotos(galeria.id)} className="cursor-pointer inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-retratt/30 bg-retratt/10 px-3 text-[9px] font-black uppercase tracking-wider text-retratt transition-colors hover:bg-retratt hover:text-black">
                                    <Images size={12} className="shrink-0"/> Minhas mídias
                                  </button>
                                  <button onClick={() => void copiarLinkGaleria(galeria.id)} className="cursor-pointer inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[9px] font-black uppercase tracking-wider text-zinc-300 transition-colors hover:bg-white hover:text-black">
                                    {linkCopiado === galeria.id ? <><Check size={12} className="shrink-0"/> Copiado</> : <><Link2 size={12} className="shrink-0"/> Copiar link</>}
                                  </button>
                                  <Link href={`/fotos/evento/${galeria.id}`} className="cursor-pointer inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 text-[9px] font-black uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-black">
                                    Loja Oficial
                                  </Link>
                               </div>

                            {renderizarGerenciador(galeria.id)}
                         </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 🔥 GALERIAS FREELANCER DO FOTOGRAFO */}
                {minhasGalerias.length > 0 && (
                  <div className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-5 sm:p-6 md:p-8 shadow-xl mt-6">
                    <h2 className="text-lg font-black uppercase tracking-tight text-white mb-6 flex items-center gap-2">
                       <ImagePlus size={20} className="text-retratt shrink-0"/> Trabalho Freelancer
                    </h2>

                    <div className="space-y-4">
                      {minhasGalerias.map((galeria) => (
                         <div key={galeria.id} className="rounded-2xl border border-white/5 bg-[#050505] p-4 sm:p-5 hover:border-white/10 transition-colors">

                            <div className="flex min-w-0 items-start gap-4">
                                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-zinc-900 sm:h-24 sm:w-24">
                                     {galeria.capa_url ? <img src={galeria.capa_url} className="w-full h-full object-cover" alt="Capa" /> : <Camera className="text-zinc-700" size={24}/>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                     <h3 className="line-clamp-2 text-sm font-black uppercase leading-snug text-white sm:text-base">{galeria.nome}</h3>
                                     <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                                        <span className="flex items-center gap-1 shrink-0"><Calendar size={10} className="shrink-0"/> {galeria.data_evento ? new Date(galeria.data_evento).toLocaleDateString('pt-BR') : "Sem data"}</span>
                                        <span className="flex min-w-0 items-center gap-1"><MapPin size={10} className="shrink-0"/> <span className="truncate">{galeria.cidade || "Local"} / {galeria.estado || "UF"}</span></span>
                                     </div>
                                      <div className="mt-3 flex flex-wrap gap-1.5 text-[8px] font-black uppercase tracking-wider">
                                        <span className="rounded-full bg-retratt/10 px-2 py-1 text-retratt">R$ {((galeria.preco_padrao_centavos || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} por foto</span>
                                        <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-300">Você recebe 95%*</span>
                                      </div>
                                      <p className="mt-2 text-[8px] leading-relaxed text-zinc-600">*Antes da tarifa do meio de pagamento.</p>
                                  </div>
                            </div>

                               <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                                  <Link href={`/fotos/fotografo/painel?evento=${galeria.id}`} className="cursor-pointer inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-retratt px-2 text-[8px] font-black uppercase tracking-wider text-black transition-colors hover:brightness-110 sm:text-[9px]">
                                    <CloudUpload size={12} className="shrink-0"/> Adicionar mídias
                                  </Link>
                                  <button onClick={() => abrirGerenciadorFotos(galeria.id)} className="cursor-pointer inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-retratt/30 bg-retratt/10 px-2 text-[8px] font-black uppercase tracking-wider text-retratt transition-colors hover:bg-retratt hover:text-black sm:text-[9px]">
                                    <Images size={12} className="shrink-0"/> Mídias
                                  </button>
                                  <button onClick={() => abrirEdicaoGaleria(galeria)} className="cursor-pointer inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-zinc-500/30 bg-zinc-500/10 px-2 text-[8px] font-black uppercase tracking-wider text-zinc-400 transition-colors hover:bg-zinc-500 hover:text-white sm:text-[9px]">
                                    <Edit size={12} className="shrink-0"/> Editar
                                  </button>
                                  <button onClick={() => void copiarLinkGaleria(galeria.id)} className="cursor-pointer inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 text-[8px] font-black uppercase tracking-wider text-zinc-300 transition-colors hover:bg-white hover:text-black sm:text-[9px]">
                                    {linkCopiado === galeria.id ? <><Check size={12} className="shrink-0"/> Copiado</> : <><Link2 size={12} className="shrink-0"/> Link</>}
                                  </button>
                                  <Link href={`/fotos/evento/${galeria.id}`} className="cursor-pointer inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-2 text-[8px] font-black uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-black sm:text-[9px]">
                                    Loja
                                  </Link>
                               </div>

                            {renderizarGerenciador(galeria.id)}

                            {/* 🔥 PAINEL: EDIÇÃO DE DADOS DA GALERIA */}
                            {editandoGaleria?.id === galeria.id && (
                              <div className="mt-4 sm:mt-6 mb-2 rounded-2xl border border-zinc-500/30 bg-[#050505] overflow-hidden shadow-[0_0_30px_rgba(113,113,122,0.05)] animate-in slide-in-from-top-2 fade-in duration-200">
                                <div className="flex items-center justify-between border-b border-white/5 bg-zinc-500/[0.02] px-4 sm:px-5 py-3 sm:py-4">
                                   <div className="flex items-center gap-2">
                                      <Edit size={16} className="text-zinc-400 shrink-0" />
                                      <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-white">Editar Galeria</h3>
                                   </div>
                                   <button type="button" onClick={() => setEditandoGaleria(null)} className="cursor-pointer text-zinc-500 hover:text-white transition-colors p-1">
                                      <X size={16} className="shrink-0" />
                                   </button>
                                </div>

                                <div className="p-4 sm:p-5 grid gap-3 sm:gap-4 sm:grid-cols-2">
                                   <div className="sm:col-span-2">
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome do Evento/Ensaio</label>
                                      <input
                                        value={editGaleriaForm.nome}
                                        onChange={(e) => setEditGaleriaForm({ ...editGaleriaForm, nome: e.target.value })}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-retratt focus:ring-1 focus:ring-retratt/50 transition-all"
                                      />
                                   </div>

                                   <div>
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Cidade</label>
                                      <input
                                        value={editGaleriaForm.cidade}
                                        onChange={(e) => setEditGaleriaForm({ ...editGaleriaForm, cidade: e.target.value })}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-retratt focus:ring-1 focus:ring-retratt/50 transition-all"
                                      />
                                   </div>

                                   <div>
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Estado (UF)</label>
                                      <input
                                        value={editGaleriaForm.estado}
                                        onChange={(e) => setEditGaleriaForm({ ...editGaleriaForm, estado: e.target.value })}
                                        maxLength={2}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white uppercase outline-none focus:border-retratt focus:ring-1 focus:ring-retratt/50 transition-all"
                                      />
                                   </div>

                                   <div>
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Data do Evento</label>
                                      <input
                                        type="date"
                                        value={editGaleriaForm.dataEvento}
                                        onChange={(e) => setEditGaleriaForm({ ...editGaleriaForm, dataEvento: e.target.value })}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-retratt focus:ring-1 focus:ring-retratt/50 transition-all"
                                      />
                                   </div>

                                   <div>
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Preço Padrão (R$)</label>
                                      <input
                                        inputMode="decimal"
                                        value={editGaleriaForm.preco}
                                        onChange={(e) => setEditGaleriaForm({ ...editGaleriaForm, preco: e.target.value })}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-retratt focus:ring-1 focus:ring-retratt/50 transition-all"
                                      />
                                   </div>

                                   <div>
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Combo: a partir de (mídias)</label>
                                      <input
                                        type="number"
                                        min={2}
                                        value={editGaleriaForm.comboQtd}
                                        onChange={(e) => setEditGaleriaForm({ ...editGaleriaForm, comboQtd: e.target.value })}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-retratt focus:ring-1 focus:ring-retratt/50 transition-all"
                                      />
                                   </div>

                                   <div>
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Desconto do combo (%)</label>
                                      <input
                                        inputMode="decimal"
                                        value={editGaleriaForm.comboPercentual}
                                        onChange={(e) => setEditGaleriaForm({ ...editGaleriaForm, comboPercentual: e.target.value })}
                                        className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-retratt focus:ring-1 focus:ring-retratt/50 transition-all"
                                      />
                                      <p className="mt-1 ml-1 text-[8px] text-zinc-600">Use 0 para desativar. Máximo de 90%.</p>
                                   </div>

                                   <div className="sm:col-span-2">
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Foto de Capa</label>
                                      <label className="flex h-11 sm:h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black hover:border-retratt/50 hover:bg-retratt/5 transition-all text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-retratt">
                                         <CloudUpload size={14} className="shrink-0" /> <span className="truncate max-w-[200px] sm:max-w-none">{editCapaGaleria ? `Selecionada: ${editCapaGaleria.name}` : "Alterar Imagem de Capa"}</span>
                                         <input
                                           type="file"
                                           accept="image/jpeg,image/png,image/webp"
                                           className="hidden"
                                           onChange={(e) => setEditCapaGaleria(e.target.files?.[0] || null)}
                                         />
                                      </label>
                                   </div>

                                   {editandoGaleria.capa_url && !editCapaGaleria && (
                                      <div className="sm:col-span-2 mt-1">
                                         <img src={editandoGaleria.capa_url} alt="Prévia da capa" className="h-32 sm:h-40 w-full rounded-xl object-cover border border-white/5 shadow-md" />
                                      </div>
                                   )}

                                   <div className="sm:col-span-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between mt-3 sm:mt-4 pt-4 sm:pt-5 border-t border-white/5 gap-3 sm:gap-4">
                                      <button
                                        type="button"
                                        onClick={() => void excluirGaleria(galeria.id)}
                                        disabled={excluindoGaleria}
                                        className="h-11 w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-retratt/20 bg-retratt/5 px-5 text-[10px] font-black uppercase tracking-widest text-retratt hover:bg-retratt hover:text-white transition-colors order-2 sm:order-1 disabled:cursor-wait disabled:opacity-50"
                                      >
                                         {excluindoGaleria ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Trash2 size={14} className="shrink-0" />} {excluindoGaleria ? "Excluindo..." : "Excluir Galeria"}
                                      </button>

                                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 order-1 sm:order-2">
                                         <button
                                           type="button"
                                           onClick={() => setEditandoGaleria(null)}
                                           className="h-11 w-full sm:w-auto cursor-pointer rounded-xl border border-white/10 bg-transparent px-6 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 transition-colors"
                                         >
                                            Cancelar
                                         </button>
                                         <button
                                           type="button"
                                           onClick={salvarEdicaoGaleria}
                                           disabled={salvandoEdicao || !editGaleriaForm.nome.trim()}
                                           className="h-11 w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-retratt px-8 text-[10px] font-black uppercase tracking-widest text-black hover:bg-retratt disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_15px_rgba(255,90,31,0.2)]"
                                         >
                                            {salvandoEdicao ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Check size={14} className="shrink-0" />}
                                            {salvandoEdicao ? "Salvando..." : "Salvar Alterações"}
                                         </button>
                                      </div>
                                   </div>
                                </div>
                              </div>
                            )}

                         </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 🔥 CRIAR GALERIA */}
                <div id="criar-galeria" ref={criarGaleriaRef} className="scroll-mt-24 rounded-3xl border border-retratt/20 bg-retratt/[0.02] overflow-hidden shadow-xl transition-all duration-300 mt-6">
                  <div
                    onClick={() => mostrarCriarGaleria ? setMostrarCriarGaleria(false) : abrirCriacaoGaleria()}
                    className="flex items-center justify-between p-5 md:p-8 cursor-pointer hover:bg-retratt/[0.05] transition-colors gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-retratt truncate">Trabalho freelancer</p>
                      <h2 className="mt-1 text-base sm:text-lg font-black uppercase tracking-tight text-white truncate">Criar minha própria galeria</h2>
                    </div>
                    <div className={`w-10 h-10 shrink-0 rounded-full bg-retratt/10 border border-retratt/20 flex items-center justify-center text-retratt transition-transform duration-300 ${mostrarCriarGaleria ? "rotate-45" : ""}`}>
                       <Plus size={20} />
                    </div>
                  </div>

                  {mostrarCriarGaleria && (
                    <div className="px-5 pb-5 md:px-8 md:pb-8 border-t border-white/5 pt-5 sm:pt-6 animate-in slide-in-from-top-4 fade-in duration-300 bg-black/20">
                       <p className="mb-2 text-[10px] leading-relaxed text-zinc-400">Use quando o trabalho não estiver vinculado a um organizador. A galeria e o álbum Geral ficarão sob sua conta.</p>
                       <p className="mb-6 rounded-xl border border-retratt/20 bg-retratt/5 p-3 text-[9px] font-bold leading-relaxed text-orange-100">Em galerias freelancer não há comissão de organizador. Em cada venda, a Retratt retém 5%; você recebe 95% menos a tarifa do Mercado Pago, descontada da sua conta.</p>

                       <div className="grid gap-3 sm:grid-cols-2">
                         <div className="sm:col-span-2">
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome do evento ou ensaio</label>
                           <input value={galeriaForm.nome} onChange={(e) => setGaleriaForm({ ...galeriaForm, nome: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-retratt" />
                         </div>
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Cidade</label>
                           <input value={galeriaForm.cidade} onChange={(e) => setGaleriaForm({ ...galeriaForm, cidade: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-retratt" />
                         </div>
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Estado (UF)</label>
                           <input value={galeriaForm.estado} onChange={(e) => setGaleriaForm({ ...galeriaForm, estado: e.target.value })} maxLength={2} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold uppercase text-white outline-none focus:border-retratt" />
                         </div>
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Data do Evento</label>
                           <input type="date" value={galeriaForm.dataEvento} onChange={(e) => setGaleriaForm({ ...galeriaForm, dataEvento: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-retratt" />
                         </div>
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Preço Padrão (R$)</label>
                           <input value={galeriaForm.preco} onChange={(e) => setGaleriaForm({ ...galeriaForm, preco: e.target.value })} inputMode="decimal" className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-retratt" />
                         </div>
                         <div className="sm:col-span-2">
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Foto de Capa</label>
                           <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black hover:border-retratt/50 hover:bg-retratt/5 transition-all text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-retratt">
                             <CloudUpload size={14} className="shrink-0" /> <span className="truncate max-w-[200px]">{capaGaleria ? `Selecionada: ${capaGaleria.name}` : "Adicionar Imagem de Capa"}</span>
                             <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setCapaGaleria(e.target.files?.[0] || null)} />
                           </label>
                         </div>
                       </div>

                       <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-white/5">
                         <button type="button" onClick={() => setMostrarCriarGaleria(false)} className="h-11 w-full sm:w-auto cursor-pointer rounded-xl border border-white/10 bg-transparent px-6 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 transition-colors">
                            Cancelar
                         </button>
                         <button type="button" onClick={criarGaleriaFreelancer} disabled={criandoGaleria || !galeriaForm.nome.trim()} className="cursor-pointer h-11 w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-retratt px-8 text-[10px] font-black uppercase tracking-widest text-black hover:bg-retratt disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(255,90,31,0.2)]">
                           {criandoGaleria ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Plus size={14} className="shrink-0" />}
                           {criandoGaleria ? "Criando..." : "Criar Galeria"}
                         </button>
                       </div>
                       {mensagemGaleria && <p className="mt-3 text-xs font-bold text-retratt text-center sm:text-right">{mensagemGaleria}</p>}
                    </div>
                  )}
                </div>

              </>
            )}
          </div>

          <div className="w-full min-w-0 space-y-6 xl:sticky xl:top-24 xl:self-start">
            {userId && (
               <div className={`rounded-3xl border bg-[#0a0a0e] shadow-xl ${mercadoPagoConectado ? "border-emerald-500/20 p-4 sm:p-5" : "border-white/5 p-5 sm:p-6"}`}>
                 {mercadoPagoConectado ? (
                   <>
                     <button type="button" onClick={() => setMostrarDetalhesMp((atual) => !atual)} className="flex w-full cursor-pointer items-center gap-3 text-left">
                       <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><CheckCircle2 size={21}/></span>
                       <span className="min-w-0 flex-1">
                         <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500">Recebimentos</span>
                         <span className="mt-0.5 block truncate text-sm font-black text-white">Mercado Pago conectado</span>
                         <span className="mt-1 block text-[9px] font-bold uppercase tracking-wider text-emerald-400">Split direto ativo</span>
                       </span>
                       <span className="hidden text-[8px] font-black uppercase tracking-widest text-zinc-500 sm:block">Gerenciar</span>
                       <ChevronDown size={17} className={`shrink-0 text-zinc-500 transition-transform ${mostrarDetalhesMp ? "rotate-180" : ""}`}/>
                     </button>

                     {mostrarDetalhesMp && (
                       <div className="mt-4 border-t border-white/5 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                         <p className="text-[10px] leading-relaxed text-zinc-500">Sua conta está pronta para receber automaticamente a sua parte de cada venda.</p>
                         <div className="mt-3 flex items-center gap-2 text-[8px] font-black uppercase tracking-wider text-zinc-600"><ShieldCheck size={13}/> Pagamento e Pix protegidos</div>
                         <button onClick={desvincularMercadoPago} className="mt-4 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-retratt/20 bg-retratt/5 text-[8px] font-black uppercase tracking-widest text-retratt transition-colors hover:bg-retratt hover:text-white">Desvincular conta <LogOut size={13}/></button>
                       </div>
                     )}
                   </>
                 ) : (
                   <>
                     <div className="flex items-center gap-3 border-b border-white/5 pb-4"><CreditCard size={19} className="shrink-0 text-retratt"/><div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Recebimentos</p><h2 className="text-base font-black text-white">Conecte sua conta</h2></div></div>
                     <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-retratt">Mercado Pago ainda não conectado</p>
                     <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">A conexão é necessária para receber sua porcentagem automaticamente a cada venda.</p>
                     <MercadoPagoConnectButton conectado={false} perfil="fotografo" returnTo="/fotos/fotografo/dashboard" className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-retratt px-4 text-center text-[9px] font-black uppercase tracking-widest text-black shadow-[0_0_15px_rgba(255,90,31,0.15)]" />
                   </>
                 )}
               </div>
            )}
          </div>
        </section>

      </main>
    </FotosShell>
  );
}
