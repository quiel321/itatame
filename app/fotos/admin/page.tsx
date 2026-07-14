"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import FotosShell from "../_components/FotosShell";
import { ArrowRight, BarChart3, Camera, CheckCircle2, FolderPlus, ImagePlus, Pencil, Store, Trophy, Wallet, LogOut, Check, AlertCircle, ShieldCheck, UploadCloud, Loader2, X, Trash2, Plus } from "lucide-react";

type Totais = { eventos: number; albuns: number; fotos: number; pedidos: number };
type EventoBase = { id: string; nome: string; local?: string | null; cidade?: string | null; estado?: string | null; data_evento?: string | null; banner_url?: string | null };
type FotoEventoAdmin = {
  id: string; nome: string; evento_id?: string | null; status: string | null; capa_url?: string | null; preco_padrao_centavos: number | null; desconto_combo_qtd?: number | null; desconto_combo_percentual?: number | null;
};
type OrganizadorFinanceiro = {
  nome?: string | null; email?: string | null; telefone?: string | null; documento?: string | null; tipo_entidade?: string | null; academia?: string | null; perfil_completo?: boolean | null; mp_connected_at?: string | null; mp_user_id?: string | null;
};
type FotografoCredenciado = {
  id: string;
  nome: string | null;
  email: string | null;
  foto_url: string | null;
  comissao_organizador_percentual: number;
};

function chaveRoyalty(eventoId: string, fotografoId: string) {
  return `${eventoId}:${fotografoId}`;
}

function formatarMoeda(valorCentavos?: number | null) {
  return ((valorCentavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FotosAdminPage() {
  const router = useRouter();
  
  // 🔥 HOOKS NO TOPO ABSOLUTO
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [totais, setTotais] = useState<Totais>({ eventos: 0, albuns: 0, fotos: 0, pedidos: 0 });
  const [eventosBase, setEventosBase] = useState<EventoBase[]>([]);
  const [fotoEventos, setFotoEventos] = useState<FotoEventoAdmin[]>([]);
  
  const [organizador, setOrganizador] = useState<OrganizadorFinanceiro | null>(null);
  const [slugPublico, setSlugPublico] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState({ nome: "", email: "", telefone: "", documento: "", tipo_entidade: "empresa", academia: "", cidade: "", estado: "" });
  
  const [mostrarCriarGaleria, setMostrarCriarGaleria] = useState(false);
  const [isManual, setIsManual] = useState(false); // Alterna entre Vincular Evento ou Galeria Avulsa
  const [manualForm, setManualForm] = useState({ nome: "", cidade: "", estado: "", dataEvento: "" });
  const [manualCapa, setManualCapa] = useState<File | null>(null);
  const [criandoGaleria, setCriandoGaleria] = useState(false);

  const [eventoSelecionado, setEventoSelecionado] = useState("");
  const [preco, setPreco] = useState("15,00");
  const [comboQtd, setComboQtd] = useState("3");
  const [comboPercentual, setComboPercentual] = useState("20");
  
  const [regrasCombo, setRegrasCombo] = useState<Record<string, { qtd: string; percentual: string }>>({});
  const [emailFotografo, setEmailFotografo] = useState<Record<string, string>>({});
  const [credenciandoEvento, setCredenciandoEvento] = useState<string | null>(null);
  const [editandoGaleria, setEditandoGaleria] = useState<string | null>(null);
  const [edicaoGaleria, setEdicaoGaleria] = useState({ nome: "", capa_url: "", status: "publicado" });
  const [salvandoGaleria, setSalvandoGaleria] = useState(false);
  const [vendasPorGaleria, setVendasPorGaleria] = useState<Record<string, number>>({});
  const [royaltiesPorGaleria, setRoyaltiesPorGaleria] = useState<Record<string, number>>({});
  const [royaltiesTotalCentavos, setRoyaltiesTotalCentavos] = useState(0);
  const [fotografosPorGaleria, setFotografosPorGaleria] = useState<Record<string, FotografoCredenciado[]>>({});
  const [royaltyForm, setRoyaltyForm] = useState<Record<string, string>>({});
  const [salvandoRoyalty, setSalvandoRoyalty] = useState<string | null>(null);
  
  const [mensagem, setMensagem] = useState("");
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [mostrarFormularioPerfil, setMostrarFormularioPerfil] = useState(false);
  const [carregando, setCarregando] = useState(true);
  
  const [perfilInvalido, setPerfilInvalido] = useState<'fotógrafo' | null>(null);
  const [contaNaoExiste, setContaNaoExiste] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const capaInputRef = useRef<HTMLInputElement>(null);
  const [fazendoUpload, setFazendoUpload] = useState<"avatar" | "capa" | null>(null);

  const contaSistemaConectada = Boolean(organizador?.mp_connected_at);
  const perfilPendente = Boolean(userId && (!organizador?.perfil_completo || !organizador?.telefone || !organizador?.documento));
  const exibirFormularioPerfil = Boolean(userId && (perfilPendente || mostrarFormularioPerfil));
  const primeiroNome = orgForm.nome ? orgForm.nome.split(' ')[0] : "Organizador";

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        router.replace("/fotos/login?perfil=organizador&next=/fotos/admin");
        return;
      }

      const { data: isFoto } = await supabase.from("fotografos").select("id").eq("user_id", user.id).maybeSingle();
      if (isFoto) {
        setPerfilInvalido('fotógrafo');
        setCarregando(false);
        return;
      }

      setUserId(user.id);
      setEmail(user.email || null);

      const org = await supabase.from("organizadores").select("nome, email, telefone, documento, tipo_entidade, academia, perfil_completo, mp_connected_at, mp_user_id").eq("user_id", user.id).maybeSingle();
      
      if (!org.data) {
        setContaNaoExiste(true);
        setCarregando(false);
        return;
      }

      const orgData = org.data as OrganizadorFinanceiro;
      const fotoOrg = await supabase.from("foto_organizadores").select("slug, localizacao, avatar_url, capa_url").eq("id", user.id).maybeSingle();
      const locParts = (fotoOrg.data?.localizacao || "").split(",");
      const cid = locParts[0]?.trim() || "";
      const est = locParts[1]?.trim() || "";

      setOrganizador(orgData);
      setSlugPublico(fotoOrg.data?.slug || null);
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

      const base = await supabase.from("eventos").select("id, nome, local, cidade, estado, data_evento, banner_url").eq("organizador_id", user.id).order("data_evento", { ascending: false }).limit(50);
      const fotoEvt = await supabase.from("foto_eventos").select("id, nome, evento_id, status, capa_url, preco_padrao_centavos, desconto_combo_qtd, desconto_combo_percentual").eq("organizador_user_id", user.id).order("created_at", { ascending: false });

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
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const resumoResponse = await fetch("/api/fotos/admin/resumo-galerias", { headers: { Authorization: `Bearer ${session.access_token}` } });
          if (resumoResponse.ok) {
            const resumo = await resumoResponse.json();
            setVendasPorGaleria(resumo.vendasPorGaleria || {});
            setRoyaltiesPorGaleria(resumo.royaltiesPorGaleria || {});
            setRoyaltiesTotalCentavos(Number(resumo.royaltiesTotalCentavos || 0));
            const fotografosResumo = (resumo.fotografosPorGaleria || {}) as Record<string, FotografoCredenciado[]>;
            setFotografosPorGaleria(fotografosResumo);
            setRoyaltyForm(Object.fromEntries(
              Object.entries(fotografosResumo).flatMap(([eventoId, fotografos]) =>
                fotografos.map((fotografo) => [
                  chaveRoyalty(eventoId, fotografo.id),
                  String(fotografo.comissao_organizador_percentual || 0),
                ]),
              ),
            ));
            setTotais((atual) => ({ ...atual, pedidos: Number(resumo.vendasTotal || 0) }));
          }
      }
      if (!eventoSelecionado && listaBase[0]?.id) setEventoSelecionado(String(listaBase[0].id));
      
      setCarregando(false);
    }

    void carregar();
  }, [router]);

  async function deslogar() {
    await supabase.auth.signOut();
    router.push("/fotos/login?perfil=organizador");
  }

  async function criarContaOrganizador() {
    setCarregando(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const nomeMetadata = auth.user.user_metadata?.nome_completo || auth.user.user_metadata?.nome || auth.user.email?.split("@")[0] || "Organizador";
    await supabase.from("organizadores").insert({ user_id: auth.user.id, nome: nomeMetadata, email: auth.user.email, status: "ativo" });
    
    const slugFormatado = nomeMetadata.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.floor(Math.random() * 1000);
    await supabase.from("foto_organizadores").insert({ id: auth.user.id, nome: nomeMetadata, slug: slugFormatado });

    window.location.reload(); 
  }

  function precoCentavos() {
    const normalizado = preco.replace(/\./g, "").replace(",", ".");
    const valor = Number(normalizado);
    return Number.isFinite(valor) ? Math.max(0, Math.round(valor * 100)) : 1500;
  }

  function comboQtdNumero() { return Number.isFinite(Number(comboQtd)) ? Math.max(2, Math.round(Number(comboQtd))) : 3; }
  function comboPercentualNumero() { const valor = Number(comboPercentual.replace(",", ".")); return Number.isFinite(valor) ? Math.min(90, Math.max(0, valor)) : 20; }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, tipo: "avatar" | "capa") => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    try {
      setFazendoUpload(tipo);
      const extensao = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const caminho = `fotos-organizadores/${userId}/${tipo}-${Date.now()}.${extensao}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(caminho, file, { upsert: false });
      if (uploadError) throw uploadError;
      const url = supabase.storage.from("avatars").getPublicUrl(caminho).data.publicUrl;
      const coluna = tipo === "avatar" ? "avatar_url" : "capa_url";
      const { error: updateError } = await supabase.from("foto_organizadores").update({ [coluna]: url }).eq("id", userId);
      if (updateError) throw updateError;
      setMensagem(tipo === "avatar" ? "Foto de perfil atualizada." : "Capa pública atualizada.");
    } catch (error) {
      console.error("Upload do perfil do organizador:", error);
      setMensagem("Não foi possível enviar a imagem.");
    } finally {
      setFazendoUpload(null);
      event.target.value = "";
    }
  };

  async function enviarCapaGaleria(file: File) {
    if (!userId || !editandoGaleria) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/fotos/capa-upload", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
    const resultado = await response.json().catch(() => null);
    if (!response.ok || !resultado?.publicUrl) { setMensagem(resultado?.error || "Não foi possível enviar a capa da galeria."); return; }
    setEdicaoGaleria((atual) => ({ ...atual, capa_url: resultado.publicUrl }));
  }

  async function salvarEdicaoGaleria() {
    if (!userId || !editandoGaleria || !edicaoGaleria.nome.trim()) return;
    setSalvandoGaleria(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSalvandoGaleria(false); setMensagem("Sessão expirada."); return; }
    const response = await fetch("/api/fotos/admin/editar-galeria", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ galeriaId: editandoGaleria, nome: edicaoGaleria.nome, capaUrl: edicaoGaleria.capa_url, status: edicaoGaleria.status }) });
    const resultado = await response.json().catch(() => null);
    setSalvandoGaleria(false);
    if (!response.ok || !resultado?.galeria) { setMensagem(resultado?.error || "Não foi possível editar esta galeria ou ela não pertence à sua conta."); return; }
    const data = resultado.galeria as FotoEventoAdmin;
    setFotoEventos((atuais) => atuais.map((item) => item.id === data.id ? data : item));
    setEditandoGaleria(null);
    setMensagem("Galeria atualizada com sucesso.");
  }

  // 🔥 PUBLICAR GALERIA (SISTEMA OU AVULSA)
  async function publicarGaleria() {
    setMensagem("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setMensagem("Sessão expirada. Faça login novamente."); return; }

    setCriandoGaleria(true);

    if (isManual) {
      if (!manualForm.nome.trim()) { setMensagem("Digite o nome da galeria avulsa."); setCriandoGaleria(false); return; }
      
      let capaUrl: string | null = null;
      if (manualCapa) {
        const form = new FormData();
        form.append("file", manualCapa);
        const uploadResponse = await fetch("/api/fotos/capa-upload", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
        const upload = await uploadResponse.json().catch(() => null);
        if (upload?.publicUrl) capaUrl = upload.publicUrl;
      }

      const slugFormatado = manualForm.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.floor(Math.random() * 1000);

      const { error } = await supabase.from("foto_eventos").insert({
        organizador_user_id: userId,
        nome: manualForm.nome.trim(),
        cidade: manualForm.cidade.trim() || null,
        estado: manualForm.estado.trim().toUpperCase() || null,
        data_evento: manualForm.dataEvento || null,
        capa_url: capaUrl,
        preco_padrao_centavos: precoCentavos(),
        desconto_combo_qtd: comboQtdNumero(),
        desconto_combo_percentual: comboPercentualNumero(),
        status: 'publicado',
        slug: slugFormatado
      });

      if (error) {
        setMensagem("Erro ao criar galeria avulsa.");
        setCriandoGaleria(false);
        return;
      }
      
      window.location.reload();
      return;
    }

    // Fluxo normal (Evento Cadastrado)
    const evento = eventosBase.find((item) => String(item.id) === eventoSelecionado);
    if (!evento) { setMensagem("Selecione um evento da lista."); setCriandoGaleria(false); return; }

    const jaExiste = fotoEventos.find((item) => String(item.evento_id) === String(evento.id));
    if (jaExiste) { setMensagem("Este evento já possui uma galeria criada."); setCriandoGaleria(false); return; }

    const response = await fetch("/api/fotos/admin/criar-galeria", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ eventoId: evento.id, precoCentavos: precoCentavos(), descontoComboQtd: comboQtdNumero(), descontoComboPercentual: comboPercentualNumero(), }),
    });
    
    if (!response.ok) { setMensagem("Falha ao criar a galeria. Tente novamente."); setCriandoGaleria(false); return; }
    
    window.location.reload();
  }

  async function salvarRegraCombo(eventoId: string) {
    if (!userId) return;
    const regra = regrasCombo[eventoId] || { qtd: "3", percentual: "20" };
    const qtd = Number.isFinite(Number(regra.qtd)) ? Math.max(2, Math.round(Number(regra.qtd))) : 3;
    const percentual = Number.isFinite(Number(regra.percentual.replace(",", "."))) ? Math.min(90, Math.max(0, Number(regra.percentual.replace(",", ".")))) : 20;

    await supabase.from("foto_eventos").update({ desconto_combo_qtd: qtd, desconto_combo_percentual: percentual }).eq("id", eventoId).eq("organizador_user_id", userId);
    window.location.reload();
  }

  async function credenciarFotografo(eventoId: string) {
    const emailCred = (emailFotografo[eventoId] || "").trim();
    if (!emailCred) { setMensagem("Informe o e-mail do fotógrafo."); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMensagem("Sessão expirada. Faça login novamente."); return; }

    setCredenciandoEvento(eventoId);
    setMensagem("");
    const response = await fetch("/api/fotos/admin/credenciar-fotografo", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ eventoId, email: emailCred }),
    });
    const resultado = await response.json();
    setCredenciandoEvento(null);

    if (!response.ok) { setMensagem(resultado.error || "Não foi possível credenciar o fotógrafo."); return; }
    setEmailFotografo((atual) => ({ ...atual, [eventoId]: "" }));
    setMensagem(`${resultado.fotografo.nome} foi credenciado com sucesso.`);
    window.location.reload();
  }

  async function salvarRoyaltyFotografo(eventoId: string, fotografoId: string) {
    const chave = chaveRoyalty(eventoId, fotografoId);
    const percentual = Number(String(royaltyForm[chave] || "0").replace(",", "."));
    if (!Number.isFinite(percentual) || percentual < 0) {
      setMensagem("Informe um percentual de royalty válido.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setMensagem("Sessão expirada. Faça login novamente.");
      return;
    }

    setSalvandoRoyalty(chave);
    setMensagem("");
    const response = await fetch("/api/fotos/admin/royalty-fotografo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ eventoId, fotografoId, percentual }),
    });
    const resultado = await response.json();
    setSalvandoRoyalty(null);

    if (!response.ok) {
      setMensagem(resultado.error || "Não foi possível salvar o royalty.");
      return;
    }

    const salvo = Number(resultado.vinculo.comissao_organizador_percentual || 0);
    setRoyaltyForm((atual) => ({ ...atual, [chave]: String(salvo) }));
    setFotografosPorGaleria((atual) => ({
      ...atual,
      [eventoId]: (atual[eventoId] || []).map((fotografo) =>
        fotografo.id === fotografoId
          ? { ...fotografo, comissao_organizador_percentual: salvo }
          : fotografo,
      ),
    }));
    setMensagem(`Royalty de ${salvo}% salvo. A nova taxa vale somente para as próximas vendas.`);
  }

  async function salvarPerfilOrganizador() {
    if (!userId) return;
    setSalvandoPerfil(true);

    const payloadFinanceiro = { nome: orgForm.nome.trim(), email: orgForm.email.trim(), telefone: orgForm.telefone.trim(), documento: orgForm.documento.trim(), tipo_entidade: orgForm.tipo_entidade, academia: orgForm.academia.trim(), perfil_completo: true, };

    try {
      const { data, error } = await supabase.from("organizadores").update(payloadFinanceiro).eq("user_id", userId).select("*").maybeSingle();
      if (!data && !error) { await supabase.from("organizadores").insert({ user_id: userId, status: "ativo", ...payloadFinanceiro }); }

      const slugFormatado = orgForm.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const { data: existeSlug } = await supabase.from('foto_organizadores').select('id').eq('slug', slugFormatado).maybeSingle();
      let slugFinal = slugFormatado;
      if(existeSlug && existeSlug.id !== userId) { slugFinal = `${slugFormatado}-${Math.floor(Math.random() * 1000)}`; }

      await supabase.from("foto_organizadores").upsert({ id: userId, nome: payloadFinanceiro.nome, slug: slugFinal, localizacao: `${orgForm.cidade.trim()}, ${orgForm.estado.trim()}` });

      setOrganizador({ ...(organizador || {}), ...payloadFinanceiro });
      setSlugPublico(slugFinal);
      setMostrarFormularioPerfil(false);
    } catch (err) { console.error("Erro interno ao salvar:", err); } finally { setSalvandoPerfil(false); }
  }

  async function excluirGaleria(galeriaId: string) {
    if (!confirm("Tem certeza que deseja excluir esta galeria? Atenção: Se houverem fotos vendidas nela, esta ação pode causar erros no sistema. Prossiga apenas se tiver certeza.")) return;
    
    const { error } = await supabase.from("foto_eventos").delete().eq("id", galeriaId);
    
    if (error) {
       alert("Erro ao excluir galeria. Pode haver fotos vinculadas a ela.");
    } else {
       window.location.reload();
    }
  }

  if (carregando) {
     return <FotosShell><main className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 size={32} className="text-amber-500 animate-spin"/></main></FotosShell>;
  }

  if (perfilInvalido === 'fotógrafo') {
    return (
      <FotosShell>
        <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
           <div className="max-w-md w-full bg-[#0a0a0e] border border-white/5 p-8 md:p-10 rounded-3xl text-center shadow-2xl">
              <AlertCircle size={48} className="mx-auto text-red-500 mb-6 opacity-80" />
              <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-3">Acesso Negado</h2>
              <p className="text-xs text-zinc-400 mb-8 leading-relaxed">
                 Esta é uma conta de <strong className="text-white uppercase">Fotógrafo</strong>. Painéis organizadores são restritos aos donos dos eventos.
              </p>
              <Link href="/fotos/fotografo/dashboard" className="flex justify-center w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] mb-3">
                 Ir para meu Painel de Fotógrafo
              </Link>
              <button onClick={deslogar} className="w-full cursor-pointer bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all border border-white/10">
                 Sair da Conta
              </button>
           </div>
        </main>
      </FotosShell>
    );
  }

  if (contaNaoExiste) {
     return (
       <FotosShell>
         <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-[#0a0a0e] border border-white/5 p-8 md:p-10 rounded-3xl text-center shadow-2xl">
               <Trophy size={48} className="mx-auto text-amber-500 mb-6 opacity-80" />
               <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-3">Painel Organizador</h2>
               <p className="text-xs text-zinc-400 mb-8 leading-relaxed">
                  Não encontramos um perfil de Organizador vinculado ao e-mail <strong className="text-white">{email}</strong>. Deseja registrar-se como Organizador agora para gerenciar seus eventos?
               </p>
               <button onClick={criarContaOrganizador} className="w-full cursor-pointer bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] mb-3">
                  Sim, Quero Criar Galerias
               </button>
               <Link href="/fotos/comprador" className="flex justify-center w-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all border border-white/10">
                  Não, Voltar para Minhas Compras
               </Link>
            </div>
         </main>
       </FotosShell>
     )
  }

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans relative overflow-x-hidden w-full">
        
        <section className="border-b border-white/5 bg-[radial-gradient(circle_at_85%_0%,rgba(245,158,11,0.15),transparent_40%),linear-gradient(180deg,#0a0a0e,#050505)] w-full">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
            
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-10">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.24em] text-amber-500 mb-4 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <Trophy size={12} /> Painel Administrativo
                </p>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight leading-none drop-shadow-md break-words">
                  Bem-vindo(a), {primeiroNome}!
                </h1>
                <p className="mt-3 max-w-xl text-xs md:text-sm leading-relaxed text-zinc-400 font-medium">
                  Ative as suas galerias, defina os royalties dos fotógrafos credenciados e acompanhe cada venda.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-3">
                {slugPublico && (
                  <Link href={`/fotos/organizador/${slugPublico}`} className="inline-flex h-11 w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 text-[10px] font-black uppercase tracking-widest text-amber-400 transition-colors hover:bg-amber-500 hover:text-black">
                    Minha página pública <ArrowRight size={14} className="shrink-0" />
                  </Link>
                )}
                {userId && (
                   <button onClick={deslogar} className="inline-flex h-11 w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-6 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                     Sair <LogOut size={14} className="shrink-0" />
                   </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                [Store, "Galerias", totais.eventos, "text-amber-400"],
                [FolderPlus, "Álbuns", totais.albuns, "text-white"],
                [ImagePlus, "Fotos", totais.fotos, "text-cyan-400"],
                [Wallet, "Vendas", totais.pedidos, "text-emerald-400"],
              ].map(([Icon, label, valor, cor]) => {
                const IconComponent = Icon as typeof Camera;
                return (
                  <div key={String(label)} className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0e]/80 backdrop-blur-md p-4 sm:p-5 shadow-lg group hover:border-white/10 transition-colors">
                    <p className="flex items-center gap-2 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2 relative z-10 truncate">
                      <IconComponent size={14} className="shrink-0" /> <span className="truncate">{label as string}</span>
                    </p>
                    <p className={`text-2xl sm:text-3xl md:text-4xl font-black relative z-10 drop-shadow-md ${cor as string}`}>{valor as number}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1fr_400px] md:px-8 w-full">
          
          <div className="space-y-6 w-full min-w-0">
            {/* 🔥 NOVO: PUBLICAR GALERIA EXPANSÍVEL E RESPONSIVO COM OPÇÃO MANUAL */}
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.02] overflow-hidden shadow-xl transition-all duration-300">
              <div 
                onClick={() => setMostrarCriarGaleria(!mostrarCriarGaleria)}
                className="flex items-center justify-between p-5 md:p-8 cursor-pointer hover:bg-amber-500/[0.05] transition-colors gap-4"
              >
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                   <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                      <FolderPlus size={20} />
                   </div>
                   <div className="min-w-0 flex-1">
                      <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-white truncate">Publicar Galeria</h2>
                      <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5 truncate">Ative a loja de fotos do seu evento</p>
                   </div>
                </div>
                <div className={`w-10 h-10 shrink-0 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 transition-transform duration-300 ${mostrarCriarGaleria ? "rotate-45" : ""}`}>
                   <Plus size={20} />
                </div>
              </div>

              {mostrarCriarGaleria && (
                <div className="px-5 pb-5 md:px-8 md:pb-8 border-t border-white/5 pt-5 sm:pt-6 animate-in slide-in-from-top-4 fade-in duration-300 bg-black/20">
                  
                  {/* Toggle: Evento do Sistema vs Evento Manual */}
                  <div className="flex gap-2 mb-6 bg-black/50 p-1.5 rounded-xl border border-white/5 w-fit">
                    <button 
                      type="button"
                      onClick={() => setIsManual(false)} 
                      className={`px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!isManual ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}
                    >
                      Vincular Evento Oficial
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsManual(true)} 
                      className={`px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isManual ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}
                    >
                      Criar Galeria Avulsa
                    </button>
                  </div>

                  <div className="space-y-5">
                    {!isManual ? (
                      <div>
                        <label className="ml-1 mb-1.5 block text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">Evento Cadastrado</label>
                        <select value={eventoSelecionado} onChange={(e) => setEventoSelecionado(e.target.value)} className="h-12 sm:h-14 w-full cursor-pointer rounded-2xl border border-white/5 bg-[#050505] px-4 text-xs font-bold text-white outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50">
                          <option value="">Escolha um evento do sistema...</option>
                          {eventosBase.map((evento) => <option key={evento.id} value={evento.id}>{evento.nome}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                         <div className="sm:col-span-2">
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome da Galeria Avulsa</label>
                           <input value={manualForm.nome} onChange={(e) => setManualForm({ ...manualForm, nome: e.target.value })} className="h-12 w-full rounded-xl border border-white/10 bg-[#050505] px-4 text-xs font-bold text-white outline-none focus:border-amber-500/50" placeholder="Ex: Open de Verão" />
                         </div>
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Cidade</label>
                           <input value={manualForm.cidade} onChange={(e) => setManualForm({ ...manualForm, cidade: e.target.value })} className="h-12 w-full rounded-xl border border-white/10 bg-[#050505] px-4 text-xs font-bold text-white outline-none focus:border-amber-500/50" placeholder="Sua cidade" />
                         </div>
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Estado (UF)</label>
                           <input value={manualForm.estado} onChange={(e) => setManualForm({ ...manualForm, estado: e.target.value })} maxLength={2} className="h-12 w-full rounded-xl border border-white/10 bg-[#050505] px-4 text-xs font-bold text-white uppercase outline-none focus:border-amber-500/50" placeholder="Ex: SP" />
                         </div>
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Data do Evento</label>
                           <input type="date" value={manualForm.dataEvento} onChange={(e) => setManualForm({ ...manualForm, dataEvento: e.target.value })} className="h-12 w-full rounded-xl border border-white/10 bg-[#050505] px-4 text-xs font-bold text-white outline-none focus:border-amber-500/50" />
                         </div>
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Foto de Capa</label>
                           <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-[#050505] hover:border-amber-500/50 transition-all text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-400">
                             <UploadCloud size={14} className="shrink-0" /> <span className="truncate max-w-[150px]">{manualCapa ? manualCapa.name : "Adicionar Capa"}</span>
                             <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setManualCapa(e.target.files?.[0] || null)} />
                           </label>
                         </div>
                      </div>
                    )}

                    <div>
                      <label className="ml-1 mb-1.5 block text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">Preço Padrão (Por Foto)</label>
                      <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-xs">R$</span>
                         <input value={preco} onChange={(e) => setPreco(e.target.value)} className="h-12 sm:h-14 w-full rounded-2xl border border-white/5 bg-[#050505] pl-10 pr-4 text-xs font-bold text-white outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50" />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div>
                        <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Combo a partir de</label>
                        <input value={comboQtd} onChange={(e) => setComboQtd(e.target.value)} inputMode="numeric" className="h-11 sm:h-12 w-full rounded-xl border border-white/5 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-amber-500/50" placeholder="3 fotos" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Desconto do Combo (%)</label>
                        <input value={comboPercentual} onChange={(e) => setComboPercentual(e.target.value)} inputMode="decimal" className="h-11 sm:h-12 w-full rounded-xl border border-white/5 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-amber-500/50" placeholder="20" />
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-white/5">
                      <button type="button" onClick={() => setMostrarCriarGaleria(false)} className="h-11 w-full sm:w-auto cursor-pointer rounded-xl border border-white/10 bg-transparent px-6 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 transition-colors">
                         Cancelar
                      </button>
                      <button onClick={publicarGaleria} disabled={criandoGaleria} className="h-11 w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-8 text-[10px] font-black uppercase tracking-widest text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        {criandoGaleria ? <Loader2 size={14} className="animate-spin shrink-0"/> : <Check size={14} className="shrink-0" />} 
                        {criandoGaleria ? "Criando..." : "Criar Galeria"}
                      </button>
                    </div>
                    
                    {mensagem && (
                       <div className="mt-4 text-[11px] font-bold text-emerald-400 text-center sm:text-right flex items-center justify-center sm:justify-end gap-1.5">
                         <CheckCircle2 size={14}/> {mensagem}
                       </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-5 sm:p-6 md:p-8 shadow-xl">
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
                  <div key={evento.id} className="rounded-2xl border border-white/5 bg-[#050505] p-4 sm:p-5 hover:border-white/10 transition-colors">
                    
                    {/* 🔥 Informações Principais (Protegido contra textos grandes) */}
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between mb-5">
                       <div className="flex-1 min-w-0">
                          <h3 className="text-sm sm:text-base font-black uppercase text-white truncate mb-2">{evento.nome}</h3>
                          <div className="flex flex-wrap gap-2">
                             <span className="inline-flex items-center gap-1 bg-white/5 text-zinc-400 border border-white/10 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0">{formatarMoeda(evento.preco_padrao_centavos)} / foto</span>
                             <span className="inline-flex items-center gap-1 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-400 shrink-0">{vendasPorGaleria[evento.id] || 0} fotos vendidas</span>
                             <span className="inline-flex items-center gap-1 border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-400 shrink-0">{formatarMoeda(royaltiesPorGaleria[evento.id])} em royalties</span>
                          </div>
                       </div>
                       
                       {/* Botões Responsivos */}
                       <div className="flex flex-row items-center gap-2 shrink-0 mt-1 sm:mt-0">
                          <button type="button" onClick={() => { setEditandoGaleria(evento.id); setEdicaoGaleria({ nome: evento.nome, capa_url: evento.capa_url || "", status: evento.status || "publicado" }); }} className="cursor-pointer flex-1 sm:flex-none inline-flex h-9 sm:h-9 items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 sm:px-4 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-amber-400 hover:bg-amber-500 hover:text-black transition-colors">
                            <Pencil size={12} className="shrink-0"/> Editar
                          </button>
                          <Link href={`/fotos/evento/${evento.id}`} className="cursor-pointer flex-1 sm:flex-none inline-flex h-9 sm:h-9 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 sm:px-4 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-black transition-colors">
                            Ver Loja
                          </Link>
                       </div>
                    </div>

                      {editandoGaleria === evento.id && (
                      <div className="mt-4 sm:mt-6 mb-2 rounded-2xl border border-amber-500/30 bg-[#050505] overflow-hidden shadow-[0_0_30px_rgba(245,158,11,0.05)] animate-in slide-in-from-top-2 fade-in duration-200">
                        {/* Header do Container */}
                        <div className="flex items-center justify-between border-b border-white/5 bg-amber-500/[0.02] px-4 sm:px-5 py-3 sm:py-4">
                           <div className="flex items-center gap-2">
                              <Pencil size={16} className="text-amber-500 shrink-0" />
                              <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-white">Editar Galeria</h3>
                           </div>
                           <button type="button" onClick={() => setEditandoGaleria(null)} className="cursor-pointer text-zinc-500 hover:text-white transition-colors p-1">
                              <X size={16} className="shrink-0" />
                           </button>
                        </div>
                        
                        {/* Corpo do Formulário */}
                        <div className="p-4 sm:p-5 grid gap-3 sm:gap-4 sm:grid-cols-2">
                           <div className="sm:col-span-2">
                              <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome da Galeria</label>
                              <input 
                                value={edicaoGaleria.nome} 
                                onChange={(e) => setEdicaoGaleria({ ...edicaoGaleria, nome: e.target.value })} 
                                className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all" 
                              />
                           </div>

                           <div>
                              <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Visibilidade</label>
                              <select 
                                value={edicaoGaleria.status} 
                                onChange={(e) => setEdicaoGaleria({ ...edicaoGaleria, status: e.target.value })} 
                                className="h-11 sm:h-12 w-full cursor-pointer rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
                              >
                                 <option value="publicado">🟢 Publicada (Visível)</option>
                                 <option value="rascunho">🟠 Rascunho (Oculta)</option>
                                 <option value="arquivado">⚫ Arquivada</option>
                              </select>
                           </div>

                           <div>
                              <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Foto de Capa</label>
                              <label className="flex h-11 sm:h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-400">
                                 <UploadCloud size={14} className="shrink-0" /> <span className="truncate max-w-[200px] sm:max-w-none">Alterar Imagem</span>
                                 <input 
                                   type="file" 
                                   accept="image/jpeg,image/png,image/webp" 
                                   className="hidden" 
                                   onChange={(e) => { const file = e.target.files?.[0]; if (file) void enviarCapaGaleria(file); }} 
                                 />
                              </label>
                           </div>

                           {edicaoGaleria.capa_url && (
                              <div className="sm:col-span-2 mt-1">
                                 <img src={edicaoGaleria.capa_url} alt="Prévia da capa" className="h-32 sm:h-40 w-full rounded-xl object-cover border border-white/5 shadow-md" />
                              </div>
                           )}

                           {/* Botões de Ação */}
                           <div className="sm:col-span-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between mt-3 sm:mt-4 pt-4 sm:pt-5 border-t border-white/5 gap-3 sm:gap-4">
                              {/* Botão Excluir na Esquerda */}
                              <button 
                                type="button" 
                                onClick={() => excluirGaleria(evento.id)} 
                                className="h-11 w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-colors order-2 sm:order-1"
                              >
                                 <Trash2 size={14} className="shrink-0" /> Excluir
                              </button>

                              {/* Salvar e Cancelar na Direita */}
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
                                   disabled={salvandoGaleria || !edicaoGaleria.nome.trim()} 
                                   className="h-11 w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-8 text-[10px] font-black uppercase tracking-widest text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                 >
                                    {salvandoGaleria ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Check size={14} className="shrink-0" />}
                                    {salvandoGaleria ? "Salvando..." : "Salvar Alterações"}
                                 </button>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}
                    
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
                    <div className="mt-2 grid gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div className="sm:col-span-2">
                        <p className="mb-2 text-[8px] font-black uppercase tracking-widest text-zinc-500">Fotógrafos credenciados ({fotografosPorGaleria[evento.id]?.length || 0})</p>
                        {(fotografosPorGaleria[evento.id] || []).length ? (
                          <div className="grid gap-2">
                            {fotografosPorGaleria[evento.id].map((fotografo) => {
                              const chave = chaveRoyalty(evento.id, fotografo.id);
                              return (
                                <div key={fotografo.id} className="grid min-h-[104px] gap-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-center sm:p-5">
                                  <div className="flex min-w-0 items-center gap-3">
                                    {fotografo.foto_url ? (
                                      <img src={fotografo.foto_url} alt={`Perfil de ${fotografo.nome || "fotógrafo"}`} className="h-12 w-12 shrink-0 rounded-full border border-cyan-500/20 object-cover shadow-[0_0_18px_rgba(6,182,212,0.12)]" />
                                    ) : (
                                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10">
                                        <Camera size={18} className="text-cyan-400" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="truncate text-[11px] font-black text-white md:text-xs">{fotografo.nome || "Fotógrafo"}</p>
                                      <p className="mt-1 truncate text-[9px] text-zinc-500">{fotografo.email || "E-mail não informado"}</p>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="mb-1.5 block text-[8px] font-black uppercase tracking-widest text-amber-400">Seu royalty nas próximas vendas (0% a 15%)</label>
                                    <div className="flex gap-2">
                                      <div className="relative min-w-0 flex-1">
                                        <input
                                          type="number"
                                          min="0"
                                          max="15"
                                          step="0.1"
                                          value={royaltyForm[chave] ?? String(fotografo.comissao_organizador_percentual || 0)}
                                          onChange={(e) => setRoyaltyForm((atual) => ({ ...atual, [chave]: e.target.value }))}
                                          inputMode="decimal"
                                          aria-label={`Royalty do fotógrafo ${fotografo.nome || "credenciado"}`}
                                          className="h-11 w-full rounded-xl border border-amber-500/20 bg-black px-3 pr-7 text-[11px] font-black text-white outline-none focus:border-amber-500"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-zinc-500">%</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => salvarRoyaltyFotografo(evento.id, fotografo.id)}
                                        disabled={salvandoRoyalty === chave}
                                        className="h-11 cursor-pointer rounded-xl bg-amber-500 px-5 text-[8px] font-black uppercase tracking-widest text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {salvandoRoyalty === chave ? "Salvando" : "Salvar"}
                                      </button>
                                    </div>
                                    <p className="mt-1.5 text-[7px] leading-relaxed text-zinc-500">O Itatame retém 9,5% em toda venda. Este royalty é adicional e será mostrado ao fotógrafo.</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="rounded-lg border border-dashed border-white/10 p-3 text-[9px] text-zinc-500">Nenhum fotógrafo credenciado nesta galeria.</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Credenciar fotógrafo por e-mail</label>
                        <input
                          type="email"
                          value={emailFotografo[evento.id] || ""}
                          onChange={(e) => setEmailFotografo((atual) => ({ ...atual, [evento.id]: e.target.value }))}
                          placeholder="fotografo@email.com"
                          className="h-10 w-full rounded-lg border border-white/5 bg-black px-3 text-[11px] font-bold text-white outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={credenciandoEvento === evento.id}
                        onClick={() => credenciarFotografo(evento.id)}
                        className="h-10 w-full sm:w-auto cursor-pointer rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 text-[9px] font-black uppercase tracking-widest text-amber-400 transition-colors hover:bg-amber-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {credenciandoEvento === evento.id ? "Credenciando..." : "Credenciar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6 w-full min-w-0">
            {(!exibirFormularioPerfil && !perfilPendente) ? (
               <div className="bg-[#0a0a0e] rounded-3xl p-4 sm:p-5 border border-white/5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                        <CheckCircle2 size={20} />
                     </div>
                     <div>
                        <p className="text-sm font-black text-white uppercase tracking-tight">Cadastro Concluído</p>
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Pronto para faturar</p>
                     </div>
                  </div>
                  <button onClick={() => setMostrarFormularioPerfil(true)} className="cursor-pointer w-full sm:w-auto px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-colors border border-white/10 text-center">
                     Editar Perfil
                  </button>
               </div>
            ) : (
               <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 shadow-[0_0_30px_rgba(245,158,11,0.05)] p-5 sm:p-6 md:p-8">
                 <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                    <div>
                       <h2 className="text-base font-black uppercase tracking-tight text-white md:text-lg">Dados do Organizador</h2>
                       <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest mt-1">
                         {perfilPendente ? "Precisamos dos dados para repasse" : "Atualizar Informações"}
                       </p>
                    </div>
                    {!perfilPendente && (
                      <button onClick={() => setMostrarFormularioPerfil(false)} className="cursor-pointer w-full sm:w-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white/5 px-4 text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors">
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
            <div className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-5 sm:p-6 md:p-8 shadow-xl mt-6">
              <div className="flex items-center gap-3 mb-5 sm:mb-6 border-b border-white/5 pb-4">
                 <Wallet size={20} className="text-amber-400 shrink-0" />
                 <h2 className="text-lg font-black uppercase tracking-tight text-white truncate">Royalties</h2>
              </div>
               
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Royalties gerados nas vendas pagas</p>
                  <p className="mt-2 text-3xl font-black text-amber-400">{formatarMoeda(royaltiesTotalCentavos)}</p>
                  <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">
                    Cada venda continua sendo processada na conta do fotógrafo. Seu royalty é separado junto da comissão do Itatame e fica registrado para repasse após a liberação financeira.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/5 bg-black/40 p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Controle por galeria</p>
                    <span className="text-[8px] font-black uppercase tracking-widest text-amber-400">Somente vendas pagas</span>
                  </div>
                  {fotoEventos.length ? (
                    <div className="space-y-2">
                      {fotoEventos.map((evento) => (
                        <div key={evento.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-[10px] font-black text-white">{evento.nome}</p>
                            <p className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-zinc-600">Royalty acumulado</p>
                          </div>
                          <span className="shrink-0 text-xs font-black text-amber-400">{formatarMoeda(royaltiesPorGaleria[evento.id] || 0)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[9px] leading-relaxed text-zinc-600">Crie uma galeria para iniciar o acompanhamento financeiro.</p>
                  )}
                  <p className="mt-3 text-[8px] leading-relaxed text-zinc-600">A alteração do percentual vale para as próximas compras. Vendas anteriores preservam o royalty registrado no momento do pedido.</p>
                </div>

                {contaSistemaConectada && (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-[9px] leading-relaxed text-cyan-100/70">
                    <strong className="block font-black uppercase tracking-widest text-cyan-400">Conta do sistema de campeonatos preservada</strong>
                    O Mercado Pago já vinculado continua exclusivo para inscrições e não é usado como recebedor nas vendas do Itatame Fotos.
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-6 pt-4 border-t border-white/5">
                   <ShieldCheck size={14} className="shrink-0" /> <span className="truncate">Fotógrafo permanece como recebedor</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </FotosShell>
  );
}
