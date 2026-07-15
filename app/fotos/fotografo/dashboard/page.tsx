"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import FotosShell from "../../_components/FotosShell";
import { ArrowRight, Camera, CheckCircle2, CloudUpload, CreditCard, FolderOpen, ImagePlus, ShieldCheck, Wallet, LogOut, AlertCircle, Store, X, Edit, Calendar, MapPin, Image as ImageIcon, Trash2, Loader2, Check, Plus, Images, Trophy, ChartNoAxesCombined } from "lucide-react";

type FotografoPerfil = { id: string; nome: string | null; email: string | null; foto_url?: string | null; telefone?: string | null; documento?: string | null; cep?: string | null; endereco?: string | null; cidade?: string | null; estado?: string | null; bio?: string | null; perfil_completo?: boolean | null; status: string | null; mp_connected_at?: string | null; mp_user_id?: string | null; };
type Totais = { fotos: number; albuns: number; eventos: number; vendas: number };
type PerfilForm = { nome: string; telefone: string; documento: string; cep: string; endereco: string; cidade: string; estado: string; bio: string; };

type GaleriaFreelancer = { id: string; nome: string; cidade?: string | null; estado?: string | null; data_evento?: string | null; preco_padrao_centavos?: number | null; capa_url?: string | null; comissao_organizador_percentual?: number | null; };
type FotoArquivo = {
  id: string;
  evento_id: string;
  fotografo_id: string | null;
  titulo: string | null;
  status: string;
  situacao_pedido: "vendida" | "reservada" | "vinculada" | null;
  quantidade_vendas: number;
  quantidade_reservas: number;
  created_at: string;
  miniatura_url: string | null;
};

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
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  
  const [mostrarCriarGaleria, setMostrarCriarGaleria] = useState(false);
  const [galeriaForm, setGaleriaForm] = useState({ nome: "", cidade: "", estado: "", dataEvento: "", preco: "15,00" });
  const [capaGaleria, setCapaGaleria] = useState<File | null>(null);
  const [criandoGaleria, setCriandoGaleria] = useState(false);
  const [mensagemGaleria, setMensagemGaleria] = useState("");

  const [minhasGalerias, setMinhasGalerias] = useState<GaleriaFreelancer[]>([]);
  const [galeriasOficiais, setGaleriasOficiais] = useState<GaleriaFreelancer[]>([]);
  const [editandoGaleria, setEditandoGaleria] = useState<GaleriaFreelancer | null>(null);
  const [editGaleriaForm, setEditGaleriaForm] = useState({ nome: "", cidade: "", estado: "", dataEvento: "", preco: "15,00" });
  const [editCapaGaleria, setEditCapaGaleria] = useState<File | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const [gerenciandoGaleria, setGerenciandoGaleria] = useState<string | null>(null);
  const [fotosGaleria, setFotosGaleria] = useState<FotoArquivo[]>([]);
  const [fotosSelecionadas, setFotosSelecionadas] = useState<string[]>([]);
  const [carregandoFotos, setCarregandoFotos] = useState(false);
  const [excluindoFotos, setExcluindoFotos] = useState(false);

  const nomeExibicao = useMemo(() => perfil?.nome || email?.split("@")[0] || "Fotógrafo", [perfil?.nome, email]);
  const mercadoPagoConectado = useMemo(() => Boolean(perfil?.mp_connected_at), [perfil?.mp_connected_at]);
  const perfilPendente = useMemo(() => Boolean(userId && (!perfil?.perfil_completo || !perfil?.telefone || !perfil?.documento)), [userId, perfil]);
  const exibirFormularioPerfil = useMemo(() => Boolean(userId && (perfilPendente || mostrarFormularioPerfil)), [userId, perfilPendente, mostrarFormularioPerfil]);
  const mpConnectUrl = useMemo(() => userId ? `/api/mercado-pago/connect?perfil=fotografo&user_id=${encodeURIComponent(userId)}&return_to=${encodeURIComponent("/fotos/fotografo/dashboard")}` : "/fotos/login?perfil=fotografo&next=/fotos/fotografo/dashboard", [userId]);
  const primeiroNome = useMemo(() => nomeExibicao.split(' ')[0], [nomeExibicao]);

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
          supabase.from("foto_eventos").select("id, nome, cidade, estado, data_evento, preco_padrao_centavos, capa_url").eq("created_by", user.id).order("created_at", { ascending: false }),
          supabase.from("foto_evento_fotografos").select("evento_id, comissao_organizador_percentual").eq("fotografo_id", perfilAtual.id).eq("status", "ativo")
        ]);
        
        setMinhasGalerias(galeriasDb.data || []);

        const eventosPermitidos = (credenciais.data || []).map((item) => item.evento_id);
        let oficiaisDb: GaleriaFreelancer[] = [];
        
        if (eventosPermitidos.length > 0) {
           const { data } = await supabase
              .from("foto_eventos")
              .select("id, nome, cidade, estado, data_evento, preco_padrao_centavos, capa_url")
              .in("id", eventosPermitidos)
              .neq("created_by", user.id)
              .order("created_at", { ascending: false });
           
           const royaltyPorEvento = new Map(
             (credenciais.data || []).map((item) => [
               String(item.evento_id),
               Number(item.comissao_organizador_percentual || 0),
             ] as const),
           );
           oficiaisDb = (data || []).map((galeria) => ({
             ...galeria,
             comissao_organizador_percentual: royaltyPorEvento.get(String(galeria.id)) || 0,
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
    const payloadCompleto = { nome: perfilForm.nome.trim(), telefone: perfilForm.telefone.trim(), documento: perfilForm.documento.trim(), cep: perfilForm.cep.trim(), endereco: perfilForm.endereco.trim(), cidade: perfilForm.cidade.trim(), estado: perfilForm.estado.trim().toUpperCase(), bio: perfilForm.bio.trim(), perfil_completo: true, status: "ativo" };

    let resultado = await supabase.from("fotografos").update(payloadCompleto).eq("id", perfil.id).select("*").single();

    if (resultado.error) {
      resultado = await supabase.from("fotografos").update({ nome: payloadCompleto.nome, telefone: payloadCompleto.telefone, documento: payloadCompleto.documento, bio: payloadCompleto.bio, status: "ativo" }).eq("id", perfil.id).select("*").single();
    }

    setSalvandoPerfil(false);
    if (!resultado.error) {
      setPerfil({ ...(perfil || {}), ...payloadCompleto, ...(resultado.data ? (resultado.data as FotografoPerfil) : {}) });
      setMostrarFormularioPerfil(false);
    }
  }

  async function enviarFotoPerfil(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !perfil?.id || !userId) return;
    setEnviandoFoto(true);
    try {
      const extensao = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const caminho = `fotos-fotografos/${userId}/perfil-${Date.now()}.${extensao}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(caminho, file, { upsert: false });
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
    const { error } = await supabase.from("fotografos").update({ mp_access_token: null, mp_refresh_token: null, mp_public_key: null, mp_user_id: null, mp_connected_at: null, mp_token_expires_at: null }).eq("id", perfil.id);
    if (!error) { setPerfil({ ...perfil, mp_connected_at: null, mp_user_id: null }); alert("Conta desvinculada com sucesso."); }
  }

  function abrirEdicaoGaleria(galeria: GaleriaFreelancer) {
    setGerenciandoGaleria(null);
    setEditandoGaleria(galeria);
    setEditGaleriaForm({
      nome: galeria.nome || "",
      cidade: galeria.cidade || "",
      estado: galeria.estado || "",
      dataEvento: galeria.data_evento || "",
      preco: ((galeria.preco_padrao_centavos || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

    const { error } = await supabase.from("foto_eventos").update({
      nome: editGaleriaForm.nome.trim(),
      cidade: editGaleriaForm.cidade.trim(),
      estado: editGaleriaForm.estado.trim().toUpperCase(),
      data_evento: editGaleriaForm.dataEvento || null,
      preco_padrao_centavos: precoCentavos,
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
    if (!confirm("Tem certeza que deseja excluir esta galeria? Atenção: Se houverem fotos vendidas nela, esta ação pode causar erros no sistema. Prossiga apenas se tiver certeza.")) return;
    const { error } = await supabase.from("foto_eventos").delete().eq("id", galeriaId);
    if (error) alert("Erro ao excluir galeria. Pode haver fotos vinculadas a ela.");
    else window.location.reload();
  }

  async function abrirGerenciadorFotos(galeriaId: string) {
    setEditandoGaleria(null);
    if (gerenciandoGaleria === galeriaId) {
       setGerenciandoGaleria(null);
       return;
    }
    
    setGerenciandoGaleria(galeriaId);
    setCarregandoFotos(true);
    setFotosSelecionadas([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessao expirada. Entre novamente.");

      const response = await fetch(`/api/fotos/fotografo/gerenciar-fotos?eventoId=${encodeURIComponent(galeriaId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) throw new Error(resultado?.error || "Nao foi possivel carregar as fotos.");

      setFotosGaleria(resultado?.fotos || []);
    } catch (error) {
      setFotosGaleria([]);
      alert(error instanceof Error ? error.message : "Nao foi possivel carregar as fotos.");
    } finally {
      setCarregandoFotos(false);
    }
  }

  function toggleSelecaoFoto(foto: FotoArquivo) {
    if (foto.situacao_pedido) return;
    setFotosSelecionadas(atuais => 
       atuais.includes(foto.id) ? atuais.filter(id => id !== foto.id) : [...atuais, foto.id]
    );
  }

  async function excluirFotosSelecionadas() {
    if (fotosSelecionadas.length === 0) return;
    if (!confirm(`Tem certeza que deseja excluir ${fotosSelecionadas.length} foto(s)? Essa ação apagará as fotos do sistema e da nuvem.`)) return;

    setExcluindoFotos(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("Sessao expirada. Entre novamente.");

      const response = await fetch("/api/fotos/fotografo/excluir-fotos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fotoIds: fotosSelecionadas }),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) throw new Error(resultado?.error || "Nao foi possivel excluir as fotos.");

      const idsExcluidos = Array.isArray(resultado?.excluidas) ? resultado.excluidas : [];
      setFotosGaleria(atuais => atuais.filter(f => !idsExcluidos.includes(f.id)));
      setFotosSelecionadas([]);
      setTotais(t => ({ ...t, fotos: Math.max(0, t.fotos - idsExcluidos.length) }));
      if (resultado?.aviso) alert(resultado.aviso);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Houve um erro ao excluir as fotos.");
    } finally {
      setExcluindoFotos(false);
    }
  }

  // 🔥 COMPONENTE FOTOCARD BLINDADO COM RASTREADOR DE ERROS
  const FotoCard = ({ foto, isSelected, onToggle }: { foto: FotoArquivo, isSelected: boolean, onToggle: () => void }) => {
    const [imgError, setImgError] = useState(false);

    // Buscador universal: tenta puxar a imagem de qualquer nome de coluna provável
    const urlImagem = foto.miniatura_url;
    const protegida = Boolean(foto.situacao_pedido);
    const rotuloProtecao = foto.situacao_pedido === "vendida"
      ? `Vendida${foto.quantidade_vendas > 1 ? ` ${foto.quantidade_vendas}x` : ""}`
      : foto.situacao_pedido === "reservada"
        ? `Reservada${foto.quantidade_reservas > 1 ? ` ${foto.quantidade_reservas}x` : ""}`
        : "Vinculada";
    const corProtecao = foto.situacao_pedido === "vendida"
      ? "border-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.38)]"
      : foto.situacao_pedido === "reservada"
        ? "border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.32)]"
        : "border-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.28)]";
    const fundoProtecao = foto.situacao_pedido === "vendida"
      ? "bg-emerald-400 text-emerald-950"
      : foto.situacao_pedido === "reservada"
        ? "bg-amber-400 text-amber-950"
        : "bg-cyan-400 text-cyan-950";
    
    // Se não achou pelos nomes, procura qualquer string no objeto que comece com "http"
    return (
       <div onClick={onToggle} title={protegida ? `${rotuloProtecao}: foto protegida contra exclusao` : "Selecionar foto"} className={`relative aspect-square rounded-xl overflow-hidden border-2 bg-zinc-900 transition-all ${protegida ? `cursor-not-allowed ${corProtecao}` : isSelected ? 'cursor-pointer border-red-500' : 'cursor-pointer border-transparent hover:border-white/20'}`}>
          
          {urlImagem && !imgError ? (
             <img 
                src={urlImagem} 
                alt="Foto" 
                loading="lazy" 
                onError={() => setImgError(true)}
                className={`w-full h-full object-cover transition-opacity ${isSelected ? 'opacity-40' : protegida ? 'opacity-65' : 'opacity-100'}`} 
             />
          ) : (
             <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center bg-[#0a0a0e]">
                <ImageIcon size={20} className="text-zinc-700 mb-1" />
                <span className="text-[7px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                   {imgError ? "Erro no Link" : "Link Ausente"}
                </span>
                {/* 🔎 RASTREADOR VISUAL: Se der erro, ele vai imprimir aqui na tela quais colunas vieram do banco para o desenvolvedor ver */}
                <span className="text-[6px] text-zinc-600 leading-tight opacity-70">Miniatura indisponivel</span>
             </div>
          )}

          {protegida && (
             <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 px-1">
                <span className={`rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] shadow-lg ${fundoProtecao}`}>
                   {rotuloProtecao}
                </span>
             </div>
          )}

          <div className={`absolute top-2 right-2 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${protegida ? 'bg-black/75 border-white/30' : isSelected ? 'bg-red-500 border-red-500' : 'bg-black/50 border-white/50'}`}>
             {protegida ? <ShieldCheck size={11} className="text-white" /> : isSelected && <Check size={12} className="text-white" />}
          </div>
       </div>
    );
  };

  const PainelGerenciadorFotos = ({ galeriaId }: { galeriaId: string }) => {
    if (gerenciandoGaleria !== galeriaId) return null;
    const fotosExcluiveis = fotosGaleria.filter((foto) => !foto.situacao_pedido);
    const fotosProtegidas = fotosGaleria.length - fotosExcluiveis.length;
    const totalVendas = fotosGaleria.reduce((total, foto) => total + foto.quantidade_vendas, 0);
    const fotosVendidas = fotosGaleria.filter((foto) => foto.quantidade_vendas > 0).length;
    const todasExcluiveisSelecionadas = fotosExcluiveis.length > 0 && fotosSelecionadas.length === fotosExcluiveis.length;
    return (
      <div className="mt-4 sm:mt-6 mb-2 rounded-2xl border border-cyan-500/30 bg-[#050505] overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.05)] animate-in slide-in-from-top-2 fade-in duration-200">
        <div className="flex items-center justify-between border-b border-white/5 bg-cyan-500/[0.02] px-4 sm:px-5 py-3 sm:py-4">
           <div className="flex items-center gap-2">
              <Images size={16} className="text-cyan-500 shrink-0" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-white">Gerenciar Fotos</h3>
           </div>
           <button type="button" onClick={() => setGerenciandoGaleria(null)} className="cursor-pointer text-zinc-500 hover:text-white transition-colors p-1">
              <X size={16} className="shrink-0" />
           </button>
        </div>
        
        <div className="p-3 sm:p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0a0a0e]">
           <p className="text-[9px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
               {fotosGaleria.length} fotos • {fotosSelecionadas.length} selecionadas {totalVendas > 0 && `• ${totalVendas} vendas em ${fotosVendidas} fotos`} {fotosProtegidas > 0 && `• ${fotosProtegidas} protegidas`}
           </p>
           <div className="flex items-center gap-2 w-full sm:w-auto">
               <button disabled={fotosExcluiveis.length === 0} onClick={() => todasExcluiveisSelecionadas ? setFotosSelecionadas([]) : setFotosSelecionadas(fotosExcluiveis.map(f => f.id))} className="cursor-pointer flex-1 sm:flex-none h-8 px-3 rounded-lg bg-white/5 text-[8px] sm:text-[9px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-colors disabled:cursor-not-allowed disabled:opacity-40">
                  {todasExcluiveisSelecionadas ? "Desmarcar" : "Selecionar Todas"}
              </button>
              <button disabled={fotosSelecionadas.length === 0 || excluindoFotos} onClick={excluirFotosSelecionadas} className="cursor-pointer flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[8px] sm:text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                 {excluindoFotos ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                 {excluindoFotos ? "Excluindo..." : "Excluir"}
              </button>
           </div>
        </div>

        <div className="p-3 sm:p-5 max-h-[400px] overflow-y-auto custom-scrollbar">
           {carregandoFotos ? (
              <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-cyan-500" /></div>
           ) : fotosGaleria.length === 0 ? (
              <p className="text-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest py-10">Nenhuma foto encontrada nesta galeria.</p>
           ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                 {fotosGaleria.map(foto => (
                    <FotoCard 
                       key={foto.id} 
                       foto={foto} 
                       isSelected={fotosSelecionadas.includes(foto.id)} 
                       onToggle={() => toggleSelecaoFoto(foto)} 
                    />
                 ))}
              </div>
           )}
        </div>
      </div>
    );
  };

  if (carregando) return <FotosShell><main className="min-h-screen bg-[#050505] flex items-center justify-center"><Camera size={32} className="text-cyan-500 animate-pulse"/></main></FotosShell>;

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans relative overflow-x-hidden w-full">
        
        <section className="border-b border-white/5 bg-[radial-gradient(circle_at_85%_0%,rgba(6,182,212,0.18),transparent_32%),linear-gradient(180deg,#101014,#050505)] w-full">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-10">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.24em] text-cyan-400 mb-4 shadow-[0_0_15px_rgba(6,182,212,0.1)]"><Camera size={12} /> Dashboard do Fotógrafo</p>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight leading-none drop-shadow-md break-words">Olá, {primeiroNome}!</h1>
                <p className="mt-3 max-w-xl text-xs md:text-sm leading-relaxed text-zinc-400 font-medium">Acompanhe suas galerias, conecte sua conta de recebimento e envie fotos oficiais para os eventos liberados.</p>
              </div>
              <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-3">
                <Link href="/fotos/fotografo/financeiro" className="cursor-pointer inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 text-[10px] font-black uppercase tracking-widest text-emerald-300 hover:bg-emerald-400 hover:text-black transition-colors shadow-sm">Financeiro <ChartNoAxesCombined size={14} className="shrink-0" /></Link>
                <Link href="/fotos/fotografo/painel" className="cursor-pointer inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 text-[10px] font-black uppercase tracking-widest text-black hover:bg-cyan-400 transition-colors shadow-sm">Upload de Fotos <CloudUpload size={14} className="shrink-0" /></Link>
                {userId && <button onClick={deslogar} className="cursor-pointer inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-6 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm">Sair <LogOut size={14} className="shrink-0" /></button>}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[[ImagePlus, "Fotos Publicadas", totais.fotos, "text-cyan-400"], [FolderOpen, "Álbuns Criados", totais.albuns, "text-white"], [Store, "Eventos", totais.eventos, "text-amber-400"], [Wallet, "Vendas", totais.vendas, "text-emerald-400"]].map(([Icon, label, valor, cor], index) => {
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

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1fr_0.8fr] md:px-8 w-full">
          <div className="space-y-6 w-full min-w-0">
            {!userId ? null : (
              <>
                {(!exibirFormularioPerfil && !perfilPendente) ? (
                   <div className="bg-[#0a0a0e] rounded-3xl p-4 sm:p-5 border border-white/5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0"><CheckCircle2 size={20} /></div>
                        <div><p className="text-sm font-black text-white uppercase tracking-tight">Cadastro Concluído</p><p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Apto a faturar</p></div>
                      </div>
                      <button onClick={() => setMostrarFormularioPerfil(true)} className="cursor-pointer w-full sm:w-auto px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-colors border border-white/10 text-center">Editar Perfil</button>
                   </div>
                ) : (
                   <div className="rounded-3xl border border-cyan-500/30 bg-cyan-500/5 shadow-[0_0_30px_rgba(6,182,212,0.05)] p-5 sm:p-6 md:p-8">
                     <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                        <div><h2 className="text-base font-black uppercase tracking-tight text-white md:text-lg">Dados do Fotógrafo</h2><p className="text-[10px] font-bold text-cyan-500/80 uppercase tracking-widest mt-1">{perfilPendente ? "Necessário para repasses" : "Atualizar Informações"}</p></div>
                        {!perfilPendente && (<button onClick={() => setMostrarFormularioPerfil(false)} className="cursor-pointer w-full sm:w-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white/5 px-4 text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors">Cancelar</button>)}
                     </div>

                     <div className="space-y-4">
                       {perfilPendente && (<div className="flex items-start gap-3 bg-black/40 p-4 rounded-xl border border-cyan-500/20 mb-4"><AlertCircle size={16} className="text-cyan-500 shrink-0 mt-0.5" /><p className="text-[10px] font-bold text-cyan-100 leading-relaxed uppercase tracking-wider">Preencha os campos abaixo para que as suas fotos possam ser exibidas nas galerias oficiais.</p></div>)}

                       <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-white/5 bg-black/40 p-4 sm:p-5">
                         <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-500/30 bg-cyan-500/10">
                           {perfil?.foto_url ? <img src={perfil.foto_url} alt="Foto do fotógrafo" className="h-full w-full object-cover" /> : <Camera size={24} className="text-cyan-400" />}
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-xs font-black uppercase text-white">Foto de perfil</p>
                           <p className="mt-1 text-[10px] text-zinc-500">Esta imagem identifica você nas galerias e no painel.</p>
                           <input ref={fotoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={enviarFotoPerfil} />
                           <button type="button" onClick={() => fotoInputRef.current?.click()} disabled={enviandoFoto} className="mt-3 w-full sm:w-auto h-9 cursor-pointer rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 text-[9px] font-black uppercase tracking-widest text-cyan-300 disabled:opacity-50 text-center">{enviandoFoto ? "Enviando..." : "Adicionar foto"}</button>
                         </div>
                       </div>

                       <div className="grid gap-3 sm:grid-cols-2">
                         <div className="sm:col-span-2"><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome Completo</label><input value={perfilForm.nome} onChange={(e) => setPerfilForm({ ...perfilForm, nome: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="Seu nome" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">WhatsApp</label><input value={perfilForm.telefone} onChange={(e) => setPerfilForm({ ...perfilForm, telefone: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="(00) 00000-0000" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">CPF</label><input value={perfilForm.documento} onChange={(e) => setPerfilForm({ ...perfilForm, documento: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="000.000.000-00" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">CEP</label><input value={perfilForm.cep} onChange={(e) => setPerfilForm({ ...perfilForm, cep: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="00000-000" /></div>
                         <div className="sm:col-span-2"><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Endereço Completo</label><input value={perfilForm.endereco} onChange={(e) => setPerfilForm({ ...perfilForm, endereco: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="Rua, Número, Bairro" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Cidade</label><input value={perfilForm.cidade} onChange={(e) => setPerfilForm({ ...perfilForm, cidade: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="Sua cidade" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Estado (UF)</label><input value={perfilForm.estado} onChange={(e) => setPerfilForm({ ...perfilForm, estado: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="Ex: SP" maxLength={2} /></div>
                         <div className="sm:col-span-2"><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Bio (Equipamento / Foco)</label><textarea value={perfilForm.bio} onChange={(e) => setPerfilForm({ ...perfilForm, bio: e.target.value })} className="cursor-text min-h-20 w-full rounded-xl border border-white/10 bg-[#050505] p-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="Ex: Especialista em desporto. Utilizo Sony A7IV com lente 70-200mm." /></div>
                       </div>
                       <div className="mt-6"><button type="button" onClick={salvarPerfilFotografo} disabled={salvandoPerfil || !perfilForm.nome.trim() || !perfilForm.telefone.trim() || !perfilForm.documento.trim()} className="cursor-pointer h-12 w-full flex items-center justify-center rounded-xl bg-cyan-500 text-[11px] font-black uppercase tracking-widest text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]">{salvandoPerfil ? "A Processar..." : "Salvar Perfil Seguro"}</button></div>
                     </div>
                   </div>
                )}

                {/* 🔥 EVENTOS OFICIAIS */}
                {galeriasOficiais.length > 0 && (
                  <div className="rounded-3xl border border-emerald-500/10 bg-[#0a0a0e] p-5 sm:p-6 md:p-8 shadow-xl mt-6">
                    <h2 className="text-lg font-black uppercase tracking-tight text-white mb-6 flex items-center gap-2">
                       <ShieldCheck size={20} className="text-emerald-500 shrink-0"/> Eventos Oficiais
                    </h2>
                    <p className="text-[10px] text-zinc-400 mb-6 font-medium leading-relaxed">Você foi credenciado para fotografar nestes campeonatos. Envie suas fotos e gerencie-as através do botão abaixo.</p>
                    
                    <div className="space-y-4">
                      {galeriasOficiais.map((galeria) => (
                         <div key={galeria.id} className="rounded-2xl border border-white/5 bg-[#050505] p-4 sm:p-5 hover:border-emerald-500/20 transition-colors">
                            <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between mb-2">
                               <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-zinc-900 shrink-0 overflow-hidden border border-white/5 flex items-center justify-center">
                                     {galeria.capa_url ? <img src={galeria.capa_url} className="w-full h-full object-cover" alt="Capa" /> : <Trophy className="text-emerald-500/50" size={24}/>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                     <h3 className="text-xs sm:text-sm font-black uppercase text-white truncate">{galeria.nome}</h3>
                                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 sm:gap-3 mt-1 sm:mt-1.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                         <span className="flex items-center gap-1 shrink-0"><Calendar size={10} className="shrink-0"/> {galeria.data_evento ? new Date(galeria.data_evento).toLocaleDateString('pt-BR') : "Sem data"}</span>
                                         <span className="hidden sm:inline-block text-zinc-700">•</span>
                                         <span className="flex items-center gap-1 truncate"><MapPin size={10} className="shrink-0"/> <span className="truncate">{galeria.cidade || "Local"} / {galeria.estado || "UF"}</span></span>
                                      </div>
                                      <p className="mt-2 text-[8px] font-black uppercase tracking-wider text-emerald-400">
                                        Itatame 9,5% • Organizador {Number(galeria.comissao_organizador_percentual || 0).toLocaleString("pt-BR")}% • Você recebe {(90.5 - Number(galeria.comissao_organizador_percentual || 0)).toLocaleString("pt-BR")}% antes da tarifa do pagamento
                                      </p>
                                  </div>
                               </div>
                               
                               <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 mt-3 sm:mt-0 w-full sm:w-auto">
                                  <button onClick={() => abrirGerenciadorFotos(galeria.id)} className="cursor-pointer flex-1 sm:flex-none inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 sm:px-4 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-cyan-400 hover:bg-cyan-500 hover:text-black transition-colors">
                                    <Images size={12} className="shrink-0"/> Minhas Fotos
                                  </button>
                                  <Link href={`/fotos/evento/${galeria.id}`} className="cursor-pointer flex-1 sm:flex-none inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 sm:px-4 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-black transition-colors">
                                    Loja Oficial
                                  </Link>
                               </div>
                            </div>
                            
                            <PainelGerenciadorFotos galeriaId={galeria.id} />
                         </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 🔥 GALERIAS FREELANCER DO FOTOGRAFO */}
                {minhasGalerias.length > 0 && (
                  <div className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-5 sm:p-6 md:p-8 shadow-xl mt-6">
                    <h2 className="text-lg font-black uppercase tracking-tight text-white mb-6 flex items-center gap-2">
                       <ImagePlus size={20} className="text-cyan-500 shrink-0"/> Trabalho Freelancer
                    </h2>
                    
                    <div className="space-y-4">
                      {minhasGalerias.map((galeria) => (
                         <div key={galeria.id} className="rounded-2xl border border-white/5 bg-[#050505] p-4 sm:p-5 hover:border-white/10 transition-colors">
                            
                            <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between mb-2">
                               <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-zinc-900 shrink-0 overflow-hidden border border-white/5 flex items-center justify-center">
                                     {galeria.capa_url ? <img src={galeria.capa_url} className="w-full h-full object-cover" alt="Capa" /> : <Camera className="text-zinc-700" size={24}/>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                     <h3 className="text-xs sm:text-sm font-black uppercase text-white truncate">{galeria.nome}</h3>
                                     <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 sm:gap-3 mt-1 sm:mt-1.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                        <span className="flex items-center gap-1 shrink-0"><Calendar size={10} className="shrink-0"/> {galeria.data_evento ? new Date(galeria.data_evento).toLocaleDateString('pt-BR') : "Sem data"}</span>
                                        <span className="hidden sm:inline-block text-zinc-700">•</span>
                                        <span className="flex items-center gap-1 truncate"><MapPin size={10} className="shrink-0"/> <span className="truncate">{galeria.cidade || "Local"} / {galeria.estado || "UF"}</span></span>
                                     </div>
                                      <p className="mt-1 sm:mt-1.5 text-[9px] sm:text-[10px] font-black text-cyan-400 tracking-wider">
                                         R$ {((galeria.preco_padrao_centavos || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                      </p>
                                      <p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-zinc-500">Itatame 9,5% • Você recebe 90,5% antes da tarifa do pagamento</p>
                                  </div>
                               </div>
                               
                               <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 mt-3 sm:mt-0 w-full sm:w-auto">
                                  <button onClick={() => abrirGerenciadorFotos(galeria.id)} className="cursor-pointer flex-1 sm:flex-none inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 sm:px-4 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-cyan-400 hover:bg-cyan-500 hover:text-black transition-colors">
                                    <Images size={12} className="shrink-0"/> Fotos
                                  </button>
                                  <button onClick={() => abrirEdicaoGaleria(galeria)} className="cursor-pointer flex-1 sm:flex-none inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-zinc-500/30 bg-zinc-500/10 px-3 sm:px-4 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-500 hover:text-white transition-colors">
                                    <Edit size={12} className="shrink-0"/> Editar
                                  </button>
                                  <Link href={`/fotos/evento/${galeria.id}`} className="cursor-pointer flex-1 sm:flex-none inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 sm:px-4 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-black transition-colors">
                                    Loja
                                  </Link>
                               </div>
                            </div>

                            <PainelGerenciadorFotos galeriaId={galeria.id} />

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
                                        className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all" 
                                      />
                                   </div>

                                   <div>
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Cidade</label>
                                      <input 
                                        value={editGaleriaForm.cidade} 
                                        onChange={(e) => setEditGaleriaForm({ ...editGaleriaForm, cidade: e.target.value })} 
                                        className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all" 
                                      />
                                   </div>
                                   
                                   <div>
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Estado (UF)</label>
                                      <input 
                                        value={editGaleriaForm.estado} 
                                        onChange={(e) => setEditGaleriaForm({ ...editGaleriaForm, estado: e.target.value })} 
                                        maxLength={2} 
                                        className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white uppercase outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all" 
                                      />
                                   </div>

                                   <div>
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Data do Evento</label>
                                      <input 
                                        type="date"
                                        value={editGaleriaForm.dataEvento} 
                                        onChange={(e) => setEditGaleriaForm({ ...editGaleriaForm, dataEvento: e.target.value })} 
                                        className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all" 
                                      />
                                   </div>

                                   <div>
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Preço Padrão (R$)</label>
                                      <input 
                                        inputMode="decimal"
                                        value={editGaleriaForm.preco} 
                                        onChange={(e) => setEditGaleriaForm({ ...editGaleriaForm, preco: e.target.value })} 
                                        className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all" 
                                      />
                                   </div>

                                   <div className="sm:col-span-2">
                                      <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Foto de Capa</label>
                                      <label className="flex h-11 sm:h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-cyan-400">
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
                                        onClick={() => excluirGaleria(galeria.id)} 
                                        className="h-11 w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-colors order-2 sm:order-1"
                                      >
                                         <Trash2 size={14} className="shrink-0" /> Excluir Galeria
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
                                           className="h-11 w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-8 text-[10px] font-black uppercase tracking-widest text-black hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_15px_rgba(6,182,212,0.2)]"
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
                <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/[0.02] overflow-hidden shadow-xl transition-all duration-300 mt-6">
                  <div 
                    onClick={() => setMostrarCriarGaleria(!mostrarCriarGaleria)}
                    className="flex items-center justify-between p-5 md:p-8 cursor-pointer hover:bg-cyan-500/[0.05] transition-colors gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400 truncate">Trabalho freelancer</p>
                      <h2 className="mt-1 text-base sm:text-lg font-black uppercase tracking-tight text-white truncate">Criar minha própria galeria</h2>
                    </div>
                    <div className={`w-10 h-10 shrink-0 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 transition-transform duration-300 ${mostrarCriarGaleria ? "rotate-45" : ""}`}>
                       <Plus size={20} />
                    </div>
                  </div>

                  {mostrarCriarGaleria && (
                    <div className="px-5 pb-5 md:px-8 md:pb-8 border-t border-white/5 pt-5 sm:pt-6 animate-in slide-in-from-top-4 fade-in duration-300 bg-black/20">
                       <p className="mb-2 text-[10px] leading-relaxed text-zinc-400">Use quando o trabalho não estiver vinculado a um organizador. A galeria e o álbum Geral ficarão sob sua conta.</p>
                       <p className="mb-6 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-[9px] font-bold leading-relaxed text-cyan-100">Em cada venda, o Itatame Fotos retém 9,5%. Você recebe 90,5% antes da tarifa do meio de pagamento.</p>
                       
                       <div className="grid gap-3 sm:grid-cols-2">
                         <div className="sm:col-span-2">
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome do evento ou ensaio</label>
                           <input value={galeriaForm.nome} onChange={(e) => setGaleriaForm({ ...galeriaForm, nome: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" />
                         </div>
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Cidade</label>
                           <input value={galeriaForm.cidade} onChange={(e) => setGaleriaForm({ ...galeriaForm, cidade: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" />
                         </div>
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Estado (UF)</label>
                           <input value={galeriaForm.estado} onChange={(e) => setGaleriaForm({ ...galeriaForm, estado: e.target.value })} maxLength={2} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold uppercase text-white outline-none focus:border-cyan-500" />
                         </div>
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Data do Evento</label>
                           <input type="date" value={galeriaForm.dataEvento} onChange={(e) => setGaleriaForm({ ...galeriaForm, dataEvento: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" />
                         </div>
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Preço Padrão (R$)</label>
                           <input value={galeriaForm.preco} onChange={(e) => setGaleriaForm({ ...galeriaForm, preco: e.target.value })} inputMode="decimal" className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" />
                         </div>
                         <div className="sm:col-span-2">
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Foto de Capa</label>
                           <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-cyan-400">
                             <CloudUpload size={14} className="shrink-0" /> <span className="truncate max-w-[200px]">{capaGaleria ? `Selecionada: ${capaGaleria.name}` : "Adicionar Imagem de Capa"}</span>
                             <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setCapaGaleria(e.target.files?.[0] || null)} />
                           </label>
                         </div>
                       </div>

                       <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-white/5">
                         <button type="button" onClick={() => setMostrarCriarGaleria(false)} className="h-11 w-full sm:w-auto cursor-pointer rounded-xl border border-white/10 bg-transparent px-6 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 transition-colors">
                            Cancelar
                         </button>
                         <button type="button" onClick={criarGaleriaFreelancer} disabled={criandoGaleria || !galeriaForm.nome.trim()} className="cursor-pointer h-11 w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-8 text-[10px] font-black uppercase tracking-widest text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                           {criandoGaleria ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Plus size={14} className="shrink-0" />}
                           {criandoGaleria ? "Criando..." : "Criar Galeria"}
                         </button>
                       </div>
                       {mensagemGaleria && <p className="mt-3 text-xs font-bold text-red-400 text-center sm:text-right">{mensagemGaleria}</p>}
                    </div>
                  )}
                </div>

              </>
            )}
          </div>

          <div className="space-y-6 w-full min-w-0">
            {userId && (
               <div className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-5 sm:p-6 md:p-8 shadow-xl">
                 <div className="flex items-center gap-3 mb-5 sm:mb-6 border-b border-white/5 pb-4"><CreditCard size={20} className="text-amber-500 shrink-0" /><h2 className="text-lg font-black uppercase tracking-tight text-white truncate">Recebimentos</h2></div>
                 <div className="space-y-4">
                   <div className={`rounded-2xl border p-4 sm:p-5 ${mercadoPagoConectado ? "bg-emerald-500/5 border-emerald-500/20" : "bg-[#050505] border-white/5"}`}>
                     <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                        <div className="min-w-0">
                           <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 truncate">Gateway de Pagamento</p>
                           <img src="https://logospng.org/download/mercado-pago/logo-mercado-pago-icone-1024.png" alt="MP" className="h-4 sm:h-5 opacity-80 mt-1" />
                        </div>
                     </div>
                     <h3 className="text-base font-black text-white mb-1">Mercado Pago</h3>
                     <p className={`text-[10px] font-black uppercase tracking-widest ${mercadoPagoConectado ? "text-emerald-400" : "text-amber-500"}`}>{mercadoPagoConectado ? "● Conta Ativa (Split Direto)" : "● Requer Conexão Urgente"}</p>
                     <p className="text-[9px] font-medium text-zinc-500 mt-4 leading-relaxed">Conecte a sua carteira para receber automaticamente a sua % de cada foto vendida. O iTatame faz o Split (divisão) na hora.</p>
                     {mercadoPagoConectado ? (
                       <button onClick={desvincularMercadoPago} className="cursor-pointer mt-5 flex w-full h-11 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-colors">Desvincular Conta MP <LogOut size={14} className="shrink-0" /></button>
                     ) : (
                       <a href={mpConnectUrl} className="cursor-pointer mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)] text-center">Ligar Carteira Digital <ArrowRight size={14} className="shrink-0" /></a>
                     )}
                   </div>
                   <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-6 pt-4 border-t border-white/5"><ShieldCheck size={14} className="shrink-0" /> <span className="truncate">Pix Automático e Seguro</span></div>
                 </div>
               </div>
            )}
          </div>
        </section>

      </main>
    </FotosShell>
  );
}
