"use client";

import ControleComboIaGaleria from '@/app/fotos/_components/ControleComboIaGaleria';
import { caminhoPortfolioOrganizador } from '@/app/lib/fotos-portfolio-url';
import Link from "next/link";
import LinkGaleria from "@/app/fotos/_components/LinkGaleria";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { comprimirAvatarRetratt as comprimirAvatar, comprimirCapaRetratt as comprimirCapa } from "@/app/lib/fotos-preparar";
import FotosShell from "@/app/fotos/_components/FotosShell";
import PainelOrganizador from "./PainelOrganizador";
import ResumoOrganizador from "./ResumoOrganizador";
import EquipeGaleriaOrganizador from "./EquipeGaleriaOrganizador";
import g from "@/app/fotos/fotografo/_components/gestao.module.css";
import s from "./organizador.module.css";
import MercadoPagoConnectButton from "@/app/admin/_components/MercadoPagoConnectButton";
import ConexaoMercadoPagoObrigatoria, { type EstadoConexaoMP } from '@/app/fotos/_components/ConexaoMercadoPagoObrigatoria';
import { ArrowRight, BarChart3, Camera, CheckCircle2, FolderPlus, Pencil, Trophy, Check, AlertCircle, UploadCloud, Loader2, X, Trash2, Plus } from "lucide-react";
import { formatarDocumento } from '@/app/lib/formatar-documento';
import { formatarTelefone } from '@/app/lib/formatar-telefone';
import { CATEGORIAS_FOTOS } from "@/app/lib/fotos-categorias";
import LocalidadeFotosInput from "@/app/fotos/_components/LocalidadeFotosInput";
import OpcoesPublicacaoGaleria from "@/app/fotos/_components/OpcoesPublicacaoGaleria";
import { ACCEPT_FOTOS_RETRATT } from "@/app/lib/fotos-formatos";
import DataGaleriaInput from "@/app/fotos/_components/DataGaleriaInput";
import { dataGaleriaValida } from "@/app/lib/fotos-data";
import CapaGaleriaInput from "@/app/fotos/_components/CapaGaleriaInput";
import EditorFaixasDesconto from "@/app/fotos/_components/EditorFaixasDesconto";
import VendasDiariaFotografos from "@/app/fotos/_components/VendasDiariaFotografos";
import SecaoOrganizador from '@/app/fotos/_components/SecaoOrganizador';
import ControleEmBreveGaleria from '@/app/fotos/_components/ControleEmBreveGaleria';
import { faixasDoEvento, validarFaixasDesconto, type FaixaDesconto } from "@/app/lib/fotos-descontos";
import { precoGaleriaCentavos, precosGaleriaValidos } from "@/app/lib/fotos-criacao-galeria";

type Totais = { eventos: number; albuns: number; fotos: number; pedidos: number };
type EventoBase = { id: string; nome: string; local?: string | null; cidade?: string | null; estado?: string | null; data_evento?: string | null; banner_url?: string | null };
type FotoEventoAdmin = {
  descontos_progressivos?: FaixaDesconto[] | null; em_breve?: boolean; acesso_por_link?: boolean; acesso_token?: string; permite_download_gratis?: boolean;
  id: string; nome: string; categoria?: string | null; evento_id?: string | null; status: string | null; capa_url?: string | null; preco_padrao_centavos: number | null; preco_video_centavos: number | null; preco_bloqueado: boolean; desconto_combo_qtd?: number | null; desconto_combo_percentual?: number | null;
};
type OrganizadorFinanceiro = {
  nome?: string | null; email?: string | null; telefone?: string | null; documento?: string | null; tipo_entidade?: string | null; academia?: string | null; perfil_completo?: boolean | null;
};
type FotografoCredenciado = {
  id: string;
  nome: string | null;
  email: string | null;
  foto_url: string | null;
  comissao_organizador_percentual: number;
  modelo_recebimento: "royalty" | "diaria_organizador";
};

function chaveRoyalty(eventoId: string, fotografoId: string) {
  return `${eventoId}:${fotografoId}`;
}

function formatarMoeda(valorCentavos?: number | null) {
  return ((valorCentavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AreaTrabalhoOrganizador({ tela = "visao-geral" }: { tela?: "visao-geral" | "galerias" | "fotografos" | "financeiro" | "perfil" }) {
  const router = useRouter();
  const [galeriaReferencia, setGaleriaReferencia] = useState(''), [buscaGaleria, setBuscaGaleria] = useState(''), [filtroGaleria, setFiltroGaleria] = useState('todas');
  const [resumoConferido, setResumoConferido] = useState(false);

  // 🔥 HOOKS NO TOPO ABSOLUTO
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [totais, setTotais] = useState<Totais>({ eventos: 0, albuns: 0, fotos: 0, pedidos: 0 });
  const [eventosBase, setEventosBase] = useState<EventoBase[]>([]);
  const [fotoEventos, setFotoEventos] = useState<FotoEventoAdmin[]>([]);

  const [organizador, setOrganizador] = useState<OrganizadorFinanceiro | null>(null);
  const [temOrganizadorItatame, setTemOrganizadorItatame] = useState(false);
  const [avatarOrganizador, setAvatarOrganizador] = useState<string | null>(null);
  const [slugPublico, setSlugPublico] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState({ nome: "", email: "", telefone: "", documento: "", tipo_entidade: "empresa", academia: "", cidade: "", estado: "" });

  const [mostrarCriarGaleria, setMostrarCriarGaleria] = useState(false);
  const [isManual, setIsManual] = useState(false); // Alterna entre Vincular Evento ou Galeria Avulsa
  const [manualForm, setManualForm] = useState({ nome: "", categoria: "outros-eventos", cidade: "", estado: "", dataEvento: "" });
  const [categoriaEvento, setCategoriaEvento] = useState("jiu-jitsu");
  const [manualCapa, setManualCapa] = useState<File | null>(null);
  const [criandoGaleria, setCriandoGaleria] = useState(false);
  const [preparandoCapa, setPreparandoCapa] = useState(false);

  const [eventoSelecionado, setEventoSelecionado] = useState("");
  const [preco, setPreco] = useState("15,00");
  const [precoVideo, setPrecoVideo] = useState("25,00");
  const [precoBloqueado, setPrecoBloqueado] = useState(false);
  const [opcoesPublicacao, setOpcoesPublicacao] = useState({ emBreve: false, acessoPorLink: false, downloadGratuito: false });
  const [faixasCriacao, setFaixasCriacao] = useState<FaixaDesconto[]>([{ quantidade: 3, percentual: 20 }]);

  const [regrasCombo, setRegrasCombo] = useState<Record<string, FaixaDesconto[]>>({});
  const [emailFotografo, setEmailFotografo] = useState<Record<string, string>>({});
  const [credenciandoEvento, setCredenciandoEvento] = useState<string | null>(null);
  const [editandoGaleria, setEditandoGaleria] = useState<string | null>(null);
  const [edicaoGaleria, setEdicaoGaleria] = useState({ nome: "", categoria: "outros-eventos", capa_url: "", status: "publicado", precoBloqueado: false, precoFoto: "15,00", precoVideo: "25,00", emBreve: false, acessoPorLink: false, downloadGratuito: false });
  const [salvandoGaleria, setSalvandoGaleria] = useState(false);
  const [vendasPorGaleria, setVendasPorGaleria] = useState<Record<string, number>>({});
  const [royaltiesPorGaleria, setRoyaltiesPorGaleria] = useState<Record<string, number>>({});
  const [royaltiesTotalCentavos, setRoyaltiesTotalCentavos] = useState(0);
  const [receitaDiretaTotalCentavos, setReceitaDiretaTotalCentavos] = useState(0);
  const [receitaDiretaPorGaleria, setReceitaDiretaPorGaleria] = useState<Record<string, number>>({});
  const [mercadoPagoOrganizadorConectado, setMercadoPagoOrganizadorConectado] = useState(false);
  const [estadoConexaoMP, setEstadoConexaoMP] = useState<EstadoConexaoMP>('verificando');
  const [avisosRoyalty, setAvisosRoyalty] = useState<Record<string, { erro: boolean; texto: string }>>({});
  const [fotografosPorGaleria, setFotografosPorGaleria] = useState<Record<string, FotografoCredenciado[]>>({});
  const [royaltyForm, setRoyaltyForm] = useState<Record<string, string>>({});
  const [modeloForm, setModeloForm] = useState<Record<string, "royalty" | "diaria_organizador">>({});
  const [salvandoRoyalty, setSalvandoRoyalty] = useState<string | null>(null);
  const [removendoFotografo, setRemovendoFotografo] = useState<string | null>(null);

  const [mensagem, setMensagem] = useState("");
  const [erroCriacao, setErroCriacao] = useState("");
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null);
  const [salvandoDescontos, setSalvandoDescontos] = useState<string | null>(null);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [mostrarFormularioPerfil, setMostrarFormularioPerfil] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [perfilInvalido, setPerfilInvalido] = useState<'fotógrafo' | null>(null);
  const [contaNaoExiste, setContaNaoExiste] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const capaInputRef = useRef<HTMLInputElement>(null);
  const [fazendoUpload, setFazendoUpload] = useState<"avatar" | "capa" | null>(null);

  const perfilPendente = Boolean(userId && (!organizador?.perfil_completo || !organizador?.telefone || !organizador?.documento));
  const exibirFormularioPerfil = Boolean(userId && (tela === "perfil" || perfilPendente || mostrarFormularioPerfil));
  const primeiroNome = orgForm.nome ? orgForm.nome.split(' ')[0] : "Organizador";

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('galeria');
    const timer = window.setTimeout(() => { if (id && /^[a-f0-9-]{36}$/i.test(id)) setGaleriaReferencia(id); }, 0);
    const abrir = () => { if (window.location.hash === '#nova-galeria' || window.location.hash === '#criar-galeria') { if (tela === 'visao-geral') router.replace('/fotos/admin/galerias#nova-galeria'); else setMostrarCriarGaleria(true); } };
    abrir(); window.addEventListener('hashchange', abrir);
    return () => { window.clearTimeout(timer); window.removeEventListener('hashchange', abrir); };
  }, [tela, router]);
  useEffect(() => {
    if (carregando) return;
    const alvo = window.location.hash.slice(1);
    if (!/^(galeria-[a-f0-9-]+|nova-galeria|recebimentos)$/.test(alvo)) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(alvo)?.scrollIntoView({ block: 'start' }));
    return () => window.cancelAnimationFrame(frame);
  }, [carregando, tela]);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        router.replace(`/fotos/login?perfil=organizador&next=${encodeURIComponent(tela === "visao-geral" ? "/fotos/admin" : `/fotos/admin/${tela}`)}`);
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

      const [org, fotoOrg, dadosPrivados] = await Promise.all([
        supabase.from("organizadores").select("nome, email, telefone, documento, tipo_entidade, academia, perfil_completo").eq("user_id", user.id).maybeSingle(),
        supabase.from("foto_organizadores").select("nome, slug, localizacao, avatar_url, capa_url").eq("id", user.id).maybeSingle(),
        supabase.from("foto_organizadores_privado").select("email, telefone, documento, tipo_entidade, academia, perfil_completo").eq("id", user.id).maybeSingle(),
      ]);

      if (!org.data && !fotoOrg.data) {
        setContaNaoExiste(true);
        setCarregando(false);
        return;
      }

      setTemOrganizadorItatame(Boolean(org.data));
      const orgData = { ...org.data, ...dadosPrivados.data, nome: fotoOrg.data?.nome || org.data?.nome } as OrganizadorFinanceiro;
      const locParts = (fotoOrg.data?.localizacao || "").split(",");
      const cid = locParts[0]?.trim() || "";
      const est = locParts[1]?.trim() || "";

      setOrganizador(orgData);
      setSlugPublico(fotoOrg.data?.slug || null);
      setAvatarOrganizador(fotoOrg.data?.avatar_url || null);
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
      const fotoEvt = await supabase.from("foto_eventos").select("id, nome, categoria, evento_id, status, capa_url, preco_padrao_centavos, preco_video_centavos, preco_bloqueado, desconto_combo_qtd, desconto_combo_percentual, descontos_progressivos, em_breve, acesso_por_link, acesso_token, permite_download_gratis").eq("organizador_user_id", user.id).order("created_at", { ascending: false });
      let galeriasDados: FotoEventoAdmin[] = (fotoEvt.data || []) as FotoEventoAdmin[];
      if (fotoEvt.error?.code === "42703") {
        const fallback = await supabase.from("foto_eventos").select("id, nome, evento_id, status, capa_url, preco_padrao_centavos, preco_video_centavos, preco_bloqueado, desconto_combo_qtd, desconto_combo_percentual, descontos_progressivos, em_breve, acesso_por_link, acesso_token, permite_download_gratis").eq("organizador_user_id", user.id).order("created_at", { ascending: false });
        galeriasDados = (fallback.data || []) as FotoEventoAdmin[];
      }

      const galeriasIds = galeriasDados.map((item) => item.id);
      const [albuns, fotos, pedidos] = await Promise.all([
        galeriasIds.length ? supabase.from("foto_albuns").select("id", { count: "exact", head: true }).in("evento_id", galeriasIds) : Promise.resolve({ count: 0 }),
        galeriasIds.length ? supabase.from("foto_arquivos").select("id", { count: "exact", head: true }).in("evento_id", galeriasIds) : Promise.resolve({ count: 0 }),
        galeriasIds.length ? supabase.from("foto_pedidos").select("id", { count: "exact", head: true }).in("evento_id", galeriasIds) : Promise.resolve({ count: 0 }),
      ]);

      const listaBase = (base.data || []) as EventoBase[];
      const listaGalerias = galeriasDados;
      setEventosBase(listaBase);
      if (!listaBase.some((evento) => !listaGalerias.some((galeria) => galeria.evento_id === evento.id))) setIsManual(true);
      setFotoEventos(listaGalerias);
      setRegrasCombo(Object.fromEntries(listaGalerias.map((evento) => [
        evento.id,
        faixasDoEvento(evento),
      ])));
      setTotais({ eventos: listaGalerias.length, albuns: albuns.count || 0, fotos: fotos.count || 0, pedidos: pedidos.count || 0 });
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
        const resumoResponse = await fetch("/api/fotos/admin/resumo-galerias", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(20000) });
          if (resumoResponse.ok) {
            const resumo = await resumoResponse.json();
            setResumoConferido(true);
            setVendasPorGaleria(resumo.vendasPorGaleria || {});
            setRoyaltiesPorGaleria(resumo.royaltiesPorGaleria || {});
             setRoyaltiesTotalCentavos(Number(resumo.royaltiesTotalCentavos || 0));
             setReceitaDiretaTotalCentavos(Number(resumo.receitaDiretaTotalCentavos || 0));
             setReceitaDiretaPorGaleria(resumo.receitaDiretaPorGaleria || {});
             setMercadoPagoOrganizadorConectado(Boolean(resumo.mercadoPagoOrganizadorConectado));
             setEstadoConexaoMP(typeof resumo.mercadoPagoOrganizadorConectado !== 'boolean' ? 'erro' : resumo.mercadoPagoOrganizadorConectado ? 'conectado' : 'pendente');
            const fotografosResumo = (resumo.fotografosPorGaleria || {}) as Record<string, FotografoCredenciado[]>;
             setFotografosPorGaleria(fotografosResumo);
             setModeloForm(Object.fromEntries(Object.entries(fotografosResumo).flatMap(([eventoId, fotografos]) =>
               fotografos.map((fotografo) => [chaveRoyalty(eventoId, fotografo.id), fotografo.modelo_recebimento || "royalty"]),
             )));
            setRoyaltyForm(Object.fromEntries(
              Object.entries(fotografosResumo).flatMap(([eventoId, fotografos]) =>
                fotografos.map((fotografo) => [
                  chaveRoyalty(eventoId, fotografo.id),
                  String(fotografo.comissao_organizador_percentual || 0),
                ]),
              ),
            ));
            setTotais((atual) => ({ ...atual, pedidos: Number(resumo.vendasTotal || 0) }));
          } else { setEstadoConexaoMP('erro'); }
        } catch { setEstadoConexaoMP('erro'); }
      } else { setEstadoConexaoMP('erro'); }
      const disponivel = listaBase.find((evento) => !listaGalerias.some((galeria) => galeria.evento_id === evento.id));
      if (disponivel) setEventoSelecionado(String(disponivel.id));

      setCarregando(false);
    }

    void carregar();
  }, [router, tela]);

  async function deslogar() {
    await supabase.auth.signOut();
    router.push("/fotos/login?perfil=organizador");
  }

  async function conferirConexaoMercadoPago() {
    setEstadoConexaoMP('verificando');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw Error('Sessão expirada');
      const response = await fetch('/api/fotos/admin/resumo-galerias', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(20000) });
      const resumo = await response.json();
      if (!response.ok || typeof resumo.mercadoPagoOrganizadorConectado !== 'boolean') throw Error('Conexão não confirmada');
      setMercadoPagoOrganizadorConectado(resumo.mercadoPagoOrganizadorConectado);
      setEstadoConexaoMP(resumo.mercadoPagoOrganizadorConectado ? 'conectado' : 'pendente');
    } catch { setEstadoConexaoMP('erro'); }
  }

  async function criarContaOrganizador() {
    setCarregando(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const nomeMetadata = auth.user.user_metadata?.nome_completo || auth.user.user_metadata?.nome || auth.user.email?.split("@")[0] || "Organizador";
    const slugFormatado = nomeMetadata.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.floor(Math.random() * 1000);
    const { error } = await supabase.from("foto_organizadores").upsert({ id: auth.user.id, nome: nomeMetadata, slug: slugFormatado }, { onConflict: "id" });
    if (error) {
      setMensagem(`Não foi possível criar o perfil: ${error.message}`);
      setCarregando(false);
      return;
    }
    window.location.reload();
  }

  function converterPrecoCentavos(valor: string) {
    const numero = Number(valor.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) : NaN;
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, tipo: "avatar" | "capa") => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    try {
      setFazendoUpload(tipo);
      const leve = tipo === "avatar" ? await comprimirAvatar(file) : await comprimirCapa(file);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");
      const form = new FormData();
      form.append("file", leve);
      form.append("tipo", tipo);
      const response = await fetch("/api/fotos/admin/imagem-perfil", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok || !resultado?.publicUrl) throw new Error(resultado?.error || "Não foi possível salvar a imagem.");
      if (tipo === 'avatar') setAvatarOrganizador(resultado.publicUrl);
      setMensagem(tipo === "avatar" ? "Foto de perfil atualizada." : "Capa pública atualizada.");
    } catch (error) {
      console.error("Upload do perfil do organizador:", error);
      setMensagem(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setFazendoUpload(null);
      event.target.value = "";
    }
  };

  async function enviarCapaGaleria(file: File) {
    if (!userId || !editandoGaleria) return;
    if(preparandoCapa)return;setPreparandoCapa(true);
    try{
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const form = new FormData();
    form.append("file", await comprimirCapa(file));
    const response = await fetch("/api/fotos/capa-upload", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
    const resultado = await response.json().catch(() => null);
    if (!response.ok || !resultado?.publicUrl) { setMensagem(resultado?.error || "Não foi possível enviar a capa da galeria."); return; }
    setEdicaoGaleria((atual) => ({ ...atual, capa_url: resultado.publicUrl }));
    }finally{setPreparandoCapa(false);}
  }

  async function salvarEdicaoGaleria() {
    if(preparandoCapa)return;
    if (!userId || !editandoGaleria || !edicaoGaleria.nome.trim()) return;
    const precoFotoCentavos = converterPrecoCentavos(edicaoGaleria.precoFoto);
    const precoVideoCentavos = converterPrecoCentavos(edicaoGaleria.precoVideo);
    if (![precoFotoCentavos, precoVideoCentavos].every((valor) => Number.isInteger(valor) && valor >= 0 && valor <= 1_000_000)) {
      setMensagem("Informe preços válidos para foto e vídeo.");
      return;
    }
    setSalvandoGaleria(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSalvandoGaleria(false); setMensagem("Sessão expirada."); return; }
    const response = await fetch("/api/fotos/admin/editar-galeria", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ galeriaId: editandoGaleria, nome: edicaoGaleria.nome, categoria: edicaoGaleria.categoria, capaUrl: edicaoGaleria.capa_url, status: edicaoGaleria.status, precoBloqueado: edicaoGaleria.precoBloqueado, precoFotoCentavos, precoVideoCentavos, emBreve: edicaoGaleria.emBreve, acessoPorLink: edicaoGaleria.acessoPorLink, downloadGratuito: edicaoGaleria.downloadGratuito }) });
    const resultado = await response.json().catch(() => null);
    setSalvandoGaleria(false);
    if (!response.ok || !resultado?.galeria) { setMensagem(resultado?.error || "Não foi possível editar esta galeria ou ela não pertence à sua conta."); return; }
    const data = resultado.galeria as FotoEventoAdmin;
    setFotoEventos((atuais) => atuais.map((item) => item.id === data.id ? data : item));
    setEditandoGaleria(null);
    setMensagem("Galeria atualizada com sucesso.");
  }

  // 🔥 PUBLICAR GALERIA (SISTEMA OU AVULSA)
  async function copiarLinkGaleria(evento: FotoEventoAdmin) {
    const prefixo = window.location.pathname.startsWith("/fotos") ? "/fotos" : "";
    const acesso = evento.acesso_por_link && evento.acesso_token ? `?acesso=${encodeURIComponent(evento.acesso_token)}` : "";
    const link = `${window.location.origin}${prefixo}/evento/${evento.id}${acesso}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopiado(evento.id);
      window.setTimeout(() => setLinkCopiado((atual) => atual === evento.id ? null : atual), 2000);
    } catch { prompt("Copie o link da galeria:", link); }
  }

  async function publicarGaleria() {
    if (criandoGaleria || preparandoCapa) return;
    setErroCriacao("");
    if (isManual && !dataGaleriaValida(manualForm.dataEvento)) { setErroCriacao("Informe uma data válida no formato DD/MM/AAAA."); return; }
    if (isManual && !manualForm.nome.trim()) { setErroCriacao("Informe o nome da galeria."); return; }
    if (isManual && (!manualForm.cidade.trim() || !manualForm.estado)) { setErroCriacao("Selecione a cidade do evento na lista."); return; }
    if (!isManual && !eventoSelecionado) { setErroCriacao("Selecione um evento da lista."); return; }
    const precoCentavos = opcoesPublicacao.downloadGratuito ? 0 : precoGaleriaCentavos(preco);
    const precoVideoCentavos = opcoesPublicacao.downloadGratuito ? 0 : precoGaleriaCentavos(precoVideo);
    if (!precosGaleriaValidos(precoCentavos, precoVideoCentavos, opcoesPublicacao.downloadGratuito)) { setErroCriacao("Informe preços de foto e vídeo maiores que zero e até R$ 10.000,00, ou escolha download gratuito."); return; }
    const descontosProgressivos = validarFaixasDesconto(opcoesPublicacao.downloadGratuito ? [] : faixasCriacao);
    if (!descontosProgressivos) { setErroCriacao("As faixas precisam ter quantidades e descontos crescentes."); return; }
    setCriandoGaleria(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");
      let capaUrl: string | null = null;
      if (manualCapa) {
        const form = new FormData(); form.append("file", manualCapa);
        const response = await fetch("/api/fotos/capa-upload", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
        const upload = await response.json().catch(() => null);
        if (!response.ok || !upload?.publicUrl) throw new Error(upload?.error || "Não foi possível enviar a capa.");
        capaUrl = upload.publicUrl;
      }
      const response = await fetch("/api/fotos/admin/criar-galeria", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...(isManual ? manualForm : { eventoId: eventoSelecionado, categoria: categoriaEvento }), ...opcoesPublicacao, capaUrl, precoCentavos, precoVideoCentavos, precoBloqueado, descontosProgressivos }),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) throw new Error(resultado?.error || "Não foi possível criar a galeria.");
      window.location.reload();
    } catch (error) {
      setErroCriacao(error instanceof Error ? error.message : "Falha de conexão. Tente novamente.");
    } finally { setCriandoGaleria(false); }
  }

  async function salvarRegraCombo(eventoId: string) {
    if (salvandoDescontos) return;
    const descontos = validarFaixasDesconto(regrasCombo[eventoId] || []);
    if (!descontos) { setMensagem("Revise as faixas: quantidades e descontos devem crescer."); return; }
    const evento = fotoEventos.find((item) => item.id === eventoId);
    if (!evento) return;
    setSalvandoDescontos(eventoId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");
      const response = await fetch("/api/fotos/admin/editar-galeria", {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ galeriaId: eventoId, nome: evento.nome, categoria: evento.categoria || "outros-eventos", status: evento.status, capaUrl: evento.capa_url, descontosProgressivos: descontos }),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) throw new Error(resultado?.error || "Não foi possível atualizar os descontos.");
      setFotoEventos((atuais) => atuais.map((item) => item.id === eventoId ? { ...item, ...resultado.galeria } : item));
      setMensagem("Descontos atualizados.");
    } catch (error) { setMensagem(error instanceof Error ? error.message : "Falha de conexão."); }
    finally { setSalvandoDescontos(null); }
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

  async function descredenciarFotografo(eventoId: string, fotografo: FotografoCredenciado) {
    if (!window.confirm(`Remover ${fotografo.nome || "este fotógrafo"} dos credenciados? Novos uploads serão bloqueados. Fotos já publicadas e pedidos anteriores permanecem na galeria.`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMensagem("Sessão expirada. Faça login novamente."); return; }
    const chave = chaveRoyalty(eventoId, fotografo.id);
    setRemovendoFotografo(chave);
    const response = await fetch("/api/fotos/admin/descredenciar-fotografo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ eventoId, fotografoId: fotografo.id }),
    });
    const resultado = await response.json().catch(() => null);
    setRemovendoFotografo(null);
    if (!response.ok) { setMensagem(resultado?.error || "Não foi possível remover o credenciamento."); return; }
    setFotografosPorGaleria((atual) => ({
      ...atual,
      [eventoId]: (atual[eventoId] || []).filter((item) => item.id !== fotografo.id),
    }));
    setMensagem(`${fotografo.nome || "Fotógrafo"} removido dos credenciados. As fotos já publicadas continuam à venda com a divisão configurada.`);
  }

  async function salvarRoyaltyFotografo(eventoId: string, fotografoId: string) {
    const chave = chaveRoyalty(eventoId, fotografoId);
    const modeloRecebimento = modeloForm[chave] || "royalty";
    const percentual = Number(String(royaltyForm[chave] || "0").replace(",", "."));
    if (modeloRecebimento === "royalty" && (!Number.isFinite(percentual) || percentual < 0 || percentual > 50)) {
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
    setAvisosRoyalty(atual => { const proximo = { ...atual }; delete proximo[chave]; return proximo; });
    try {
    const response = await fetch("/api/fotos/admin/royalty-fotografo", {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ eventoId, fotografoId, percentual, modeloRecebimento }),
    });
    const resultado = await response.json().catch(() => null);

    if (!response.ok) {
      if (resultado?.code === 'MP_CONEXAO_NECESSARIA') {
        setMercadoPagoOrganizadorConectado(false);
        setEstadoConexaoMP('pendente');
      }
      throw Error(resultado?.error || 'Não foi possível confirmar o salvamento. Confira a configuração antes de tentar novamente.');
    }
    if (!resultado?.vinculo) throw Error('Não foi possível confirmar a configuração salva.');

    const salvo = Number(resultado.vinculo.comissao_organizador_percentual || 0);
    const modeloSalvo = resultado.vinculo.modelo_recebimento === "diaria_organizador" ? "diaria_organizador" : "royalty";
    setRoyaltyForm((atual) => ({ ...atual, [chave]: String(salvo) }));
    setModeloForm((atual) => ({ ...atual, [chave]: modeloSalvo }));
    setFotografosPorGaleria((atual) => ({
      ...atual,
      [eventoId]: (atual[eventoId] || []).map((fotografo) =>
        fotografo.id === fotografoId
          ? { ...fotografo, comissao_organizador_percentual: salvo, modelo_recebimento: modeloSalvo }
          : fotografo,
      ),
    }));
    const texto = modeloSalvo === "diaria_organizador" ? "Diária salva para este fotógrafo. As próximas vendas entrarão na sua conta Mercado Pago da Retratt." : `Royalty de ${salvo}% salvo. A nova taxa vale somente para as próximas vendas.`;
    setMensagem(texto);
    setAvisosRoyalty(atual => ({ ...atual, [chave]: { erro: false, texto } }));
    } catch (error) {
      const texto = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError') ? 'Não foi possível confirmar o salvamento. Confira a configuração antes de tentar novamente.' : error instanceof Error ? error.message : 'Não foi possível confirmar a configuração.';
      setMensagem(texto);
      setAvisosRoyalty(atual => ({ ...atual, [chave]: { erro: true, texto } }));
    } finally { setSalvandoRoyalty(null); }
  }

  async function salvarPerfilOrganizador() {
    if (!userId) return;
    if (orgForm.cidade.trim() && !orgForm.estado) { setMensagem("Selecione sua cidade na lista."); return; }
    setSalvandoPerfil(true);

    const payloadFinanceiro = { nome: orgForm.nome.trim(), email: orgForm.email.trim(), telefone: orgForm.telefone.trim(), documento: orgForm.documento.trim(), tipo_entidade: orgForm.tipo_entidade, academia: orgForm.academia.trim(), perfil_completo: true, };

    try {
      const { error: erroPrivado } = await supabase.from("foto_organizadores_privado").upsert({ id: userId, email: payloadFinanceiro.email, telefone: payloadFinanceiro.telefone, documento: payloadFinanceiro.documento, tipo_entidade: payloadFinanceiro.tipo_entidade, academia: payloadFinanceiro.academia, perfil_completo: true }, { onConflict: "id" });
      if (erroPrivado) throw erroPrivado;
      if (temOrganizadorItatame) {
        const { error } = await supabase.from("organizadores").update(payloadFinanceiro).eq("user_id", userId);
        if (error) throw error;
      }

      const slugFormatado = orgForm.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const { data: existeSlug } = await supabase.from('foto_organizadores').select('id').eq('slug', slugFormatado).maybeSingle();
      let slugFinal = slugFormatado;
      if(existeSlug && existeSlug.id !== userId) { slugFinal = `${slugFormatado}-${Math.floor(Math.random() * 1000)}`; }

      const { error: erroPublico } = await supabase.from("foto_organizadores").upsert({ id: userId, nome: payloadFinanceiro.nome, slug: slugFinal, localizacao: `${orgForm.cidade.trim()}, ${orgForm.estado.trim()}` });
      if (erroPublico) throw erroPublico;

      setOrganizador({ ...(organizador || {}), ...payloadFinanceiro });
      setSlugPublico(slugFinal);
      setMostrarFormularioPerfil(false);
    } catch (err) { console.error("Erro interno ao salvar:", err); setMensagem("Não foi possível salvar o perfil. Tente novamente."); } finally { setSalvandoPerfil(false); }
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
     return <PainelOrganizador tela={tela} titulo="Seu painel"><p role="status" className={g.vazio}>Carregando sua organização…</p></PainelOrganizador>;
  }

  if (perfilInvalido === 'fotógrafo') {
    return (
      <FotosShell>
        <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
           <div className="max-w-md w-full bg-[#0a0a0e] border border-white/5 p-8 md:p-10 rounded-3xl text-center shadow-2xl">
              <AlertCircle size={48} className="mx-auto text-retratt mb-6 opacity-80" />
              <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-3">Acesso Negado</h2>
              <p className="text-xs text-zinc-400 mb-8 leading-relaxed">
                 Esta é uma conta de <strong className="text-white uppercase">Fotógrafo</strong>. Painéis organizadores são restritos aos donos dos eventos.
              </p>
              <Link href="/fotos/fotografo/dashboard" className="flex justify-center w-full bg-retratt hover:bg-retratt text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(255,90,31,0.2)] mb-3">
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
               <Trophy size={48} className="mx-auto text-retratt mb-6 opacity-80" />
               <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-3">Painel Organizador</h2>
               <p className="text-xs text-zinc-400 mb-8 leading-relaxed">
                  Não encontramos um perfil de Organizador vinculado ao e-mail <strong className="text-white">{email}</strong>. Deseja registrar-se como Organizador agora para gerenciar seus eventos?
               </p>
               <button onClick={criarContaOrganizador} className="w-full cursor-pointer bg-retratt hover:bg-retratt text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(255,90,31,0.2)] mb-3">
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

  const portfolio = slugPublico ? `/fotos${caminhoPortfolioOrganizador(slugPublico)}` : null;
  const titulos = { 'visao-geral': `Olá, ${primeiroNome}.`, galerias: 'Suas galerias', fotografos: 'Equipe de fotógrafos', financeiro: 'Financeiro', perfil: 'Sua organização' };
  const equipeTotal = new Set(Object.values(fotografosPorGaleria).flat().map(f => f.id)).size;
  const galeriaEquipe = fotoEventos.some(e => e.id === galeriaReferencia) ? galeriaReferencia : fotoEventos[0]?.id || '';
  const galeriasVisiveis = fotoEventos.filter(e => (filtroGaleria === 'todas' || (filtroGaleria === 'arquivadas' ? e.status === 'arquivado' : e.status !== 'arquivado')) && e.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(buscaGaleria.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()));
  return <PainelOrganizador tela={tela} titulo={titulos[tela]} nome={orgForm.nome} avatar={avatarOrganizador} portfolio={portfolio}
    descricao={tela === 'visao-geral' ? 'Suas galerias, sua equipe e os resultados do seu trabalho em um só lugar.' : tela === 'galerias' ? 'Publique, organize e prepare cada galeria para vender. Preços e descontos ficam dentro do trabalho correspondente.' : tela === 'fotografos' ? 'Escolha uma galeria para credenciar fotógrafos e definir os acordos de recebimento.' : tela === 'financeiro' ? 'Acompanhe receitas por galeria e a participação de cada fotógrafo, com clareza sobre o que cada valor representa.' : 'Cuide da identidade da sua marca, dos dados de cadastro e da conta de recebimento.'}
    acoes={tela === 'visao-geral' ? <Link href="/fotos/admin/galerias#nova-galeria" className={g.primario}><Plus size={15} /> Nova galeria</Link> : tela === 'galerias' ? <button type="button" className={g.primario} onClick={() => { setMostrarCriarGaleria(true); window.setTimeout(() => document.getElementById('nova-galeria')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}><Plus size={15} /> Nova galeria</button> : undefined}>
    {userId && <ConexaoMercadoPagoObrigatoria estado={estadoConexaoMP} onVerificar={() => void conferirConexaoMercadoPago()} onSair={() => void deslogar()} />}
    {tela === 'visao-geral' && <ResumoOrganizador galerias={fotoEventos} totais={totais} vendidos={vendasPorGaleria} receitas={receitaDiretaPorGaleria} royalties={royaltiesPorGaleria} receitaTotal={receitaDiretaTotalCentavos} royaltyTotal={royaltiesTotalCentavos} equipe={equipeTotal} conectado={mercadoPagoOrganizadorConectado} perfilPendente={perfilPendente} resumoDisponivel={resumoConferido} portfolio={portfolio} />}
    {tela === 'galerias' && <><div className={g.secao}><div className={g.filtros}><label>Buscar galeria<input value={buscaGaleria} onChange={e => setBuscaGaleria(e.target.value)} placeholder="Nome da galeria" /></label><label>Situação<select value={filtroGaleria} onChange={e => setFiltroGaleria(e.target.value)}><option value="todas">Todas as galerias</option><option value="ativas">Em operação</option><option value="arquivadas">Arquivadas</option></select></label></div></div><div className={s.formulario}>          <div className="space-y-6 w-full min-w-0">
            {/* 🔥 NOVO: PUBLICAR GALERIA EXPANSÍVEL E RESPONSIVO COM OPÇÃO MANUAL */}
            {mostrarCriarGaleria && <div id="nova-galeria" className="scroll-mt-24 rounded-3xl border border-retratt/20 bg-retratt/[0.02] overflow-hidden shadow-xl transition-all duration-300">
              <div
                role="button" tabIndex={0} aria-expanded={mostrarCriarGaleria}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !criandoGaleria) { e.preventDefault(); setMostrarCriarGaleria(!mostrarCriarGaleria); } }}
                onClick={() => { if (!criandoGaleria) setMostrarCriarGaleria(!mostrarCriarGaleria); }}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-retratt/[0.05] transition-colors gap-4"
              >
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                   <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl bg-retratt/10 border border-retratt/20 flex items-center justify-center text-retratt">
                      <FolderPlus size={20} />
                   </div>
                   <div className="min-w-0 flex-1">
                      <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-white truncate">Nova galeria</h2>
                      <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5 truncate">Ative a loja de fotos do seu evento</p>
                   </div>
                </div>
                <div className={`w-10 h-10 shrink-0 rounded-full bg-retratt/10 border border-retratt/20 flex items-center justify-center text-retratt transition-transform duration-300 ${mostrarCriarGaleria ? "rotate-45" : ""}`}>
                   <Plus size={20} />
                </div>
              </div>

              {mostrarCriarGaleria && (
                <div className="px-5 pb-5 md:px-8 md:pb-8 border-t border-white/5 pt-5 sm:pt-6 animate-in slide-in-from-top-4 fade-in duration-300 bg-black/20">

                  {/* Toggle: Evento do Sistema vs Evento Manual */}
                  <div className="flex flex-wrap gap-2 mb-6 bg-black/50 p-1.5 rounded-xl border border-white/5 w-fit">
                    <button
                      type="button"
                      disabled={criandoGaleria || preparandoCapa} aria-pressed={!isManual} onClick={() => setIsManual(false)}
                      className={`px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!isManual ? 'bg-retratt text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}
                    >
                      Usar evento do iTatame
                    </button>
                    <button
                      type="button"
                      disabled={criandoGaleria || preparandoCapa} aria-pressed={isManual} onClick={() => setIsManual(true)}
                      className={`px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isManual ? 'bg-retratt text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}
                    >
                      Criar do zero
                    </button>
                  </div>

                  <fieldset disabled={criandoGaleria || preparandoCapa} className="space-y-5 disabled:opacity-60">
                    <legend className="mb-4 text-sm font-bold text-white">1. Dados da galeria</legend>
                    <p className="text-xs leading-relaxed text-zinc-400">Use os dados de um evento do iTatame ou crie uma galeria para qualquer evento. Depois, credencie os fotógrafos e defina o acordo de cada um.</p>
                    <div>
                      <label className="ml-1 mb-1.5 block text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">Categoria da galeria</label>
                      <select value={isManual ? manualForm.categoria : categoriaEvento} onChange={(e) => isManual ? setManualForm({ ...manualForm, categoria: e.target.value }) : setCategoriaEvento(e.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-[#050505] px-4 text-xs text-white">{CATEGORIAS_FOTOS.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}</select>
                    </div>
                    {!isManual ? (
                      <div>
                        <label className="ml-1 mb-1.5 block text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">Evento Cadastrado</label>
                        <select value={eventoSelecionado} onChange={(e) => setEventoSelecionado(e.target.value)} className="h-12 sm:h-14 w-full cursor-pointer rounded-2xl border border-white/5 bg-[#050505] px-4 text-xs font-bold text-white outline-none focus:border-retratt/50 focus:ring-1 focus:ring-retratt/50">
                          <option value="">Escolha um evento do sistema...</option>
                          {eventosBase.map((evento) => <option key={evento.id} value={evento.id} disabled={fotoEventos.some((galeria) => galeria.evento_id === evento.id)}>{evento.nome}{fotoEventos.some((galeria) => galeria.evento_id === evento.id) ? " — galeria já criada" : ""}</option>)}
                        </select>
                        {!eventosBase.length && <p className="mt-2 text-xs text-zinc-400">Você ainda não tem eventos no iTatame. Escolha “Criar do zero” para continuar.</p>}
                        {eventoSelecionado && <p className="mt-2 text-xs text-zinc-400">Nome, cidade, data e capa serão importados do evento selecionado. Você pode escolher outra capa abaixo.</p>}
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                         <div className="sm:col-span-2">
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome da Galeria Avulsa</label>
                           <input value={manualForm.nome} onChange={(e) => setManualForm({ ...manualForm, nome: e.target.value })} className="h-12 w-full rounded-xl border border-white/10 bg-[#050505] px-4 text-xs font-bold text-white outline-none focus:border-retratt/50" placeholder="Ex: Open de Verão" />
                         </div>
                         <LocalidadeFotosInput cidade={manualForm.cidade} estado={manualForm.estado} onChange={({ cidade, estado }) => setManualForm({ ...manualForm, cidade, estado })} className="h-12 w-full rounded-xl border border-white/10 bg-[#050505] px-4 text-xs font-bold text-white outline-none focus:border-retratt/50" />
                         <div>
                           <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Data do Evento</label>
                           <DataGaleriaInput value={manualForm.dataEvento} onChange={(dataEvento) => setManualForm({ ...manualForm, dataEvento })} />
                         </div>

                      </div>
                    )}

                    <OpcoesPublicacaoGaleria value={opcoesPublicacao} onChange={setOpcoesPublicacao} />
                    {!opcoesPublicacao.downloadGratuito && <>
                      <h3 className="text-sm font-bold text-white">2. Preços e descontos</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs text-zinc-400">Preço padrão por foto (R$)<input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black px-3 text-xs text-white" /></label>
                        <label className="text-xs text-zinc-400">Preço padrão por vídeo (R$)<input value={precoVideo} onChange={(e) => setPrecoVideo(e.target.value)} inputMode="decimal" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black px-3 text-xs text-white" /></label>
                      </div>
                      <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3 text-xs text-zinc-300">
                        <input type="checkbox" checked={precoBloqueado} onChange={(e) => setPrecoBloqueado(e.target.checked)} className="mt-0.5 accent-orange-500" />
                        <span>Fixar esses preços para todos os fotógrafos<span className="mt-1 block text-zinc-500">Desmarcado, cada fotógrafo pode definir os preços das próprias mídias.</span></span>
                      </label>
                      <EditorFaixasDesconto faixas={faixasCriacao} onChange={setFaixasCriacao} />
                    </>}
                    <CapaGaleriaInput file={manualCapa} onChange={setManualCapa} onPreparandoChange={setPreparandoCapa} fallbackUrl={!isManual ? eventosBase.find((evento) => evento.id === eventoSelecionado)?.banner_url : null} />
                    <p className="rounded-xl border border-white/10 p-3 text-xs leading-relaxed text-zinc-400">Após criar, credencie os fotógrafos pelo e-mail e escolha o modelo de recebimento: royalty por venda ou contratação por diária.</p>
                    <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-white/5">
                      <button type="button" disabled={criandoGaleria || preparandoCapa} onClick={() => setMostrarCriarGaleria(false)} className="h-11 w-full sm:w-auto cursor-pointer rounded-xl border border-white/10 bg-transparent px-6 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 transition-colors">
                         Cancelar
                      </button>
                      <button onClick={publicarGaleria} disabled={criandoGaleria || preparandoCapa} className="h-11 w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-retratt px-8 text-[10px] font-black uppercase tracking-widest text-black hover:bg-retratt disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(255,90,31,0.2)]">
                        {criandoGaleria ? <Loader2 size={14} className="animate-spin shrink-0"/> : <Check size={14} className="shrink-0" />}
                        {criandoGaleria ? "Criando..." : "Criar Galeria"}
                      </button>
                    </div>

                    {erroCriacao && <p role="alert" className="mt-4 text-xs font-bold text-red-400">{erroCriacao}</p>}
                  </fieldset>
                </div>
              )}
            </div>}

            {mensagem && <p role="status" className="rounded-xl border border-retratt/20 p-4 text-xs text-retratt">{mensagem}</p>}
            <div className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-4 sm:p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                 <BarChart3 size={20} className="text-retratt" />
                 <h2 className="text-lg font-black uppercase tracking-tight text-white">Suas galerias</h2>
              </div>

              <div className="space-y-4">
                {galeriasVisiveis.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-[#050505] p-10 text-center">
                     <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Nenhuma galeria encontrada neste filtro</p>
                  </div>
                ) : galeriasVisiveis.map((evento) => (
                  <div id={`galeria-${evento.id}`} key={evento.id} className="scroll-mt-24 rounded-2xl border border-white/5 bg-[#050505] p-4 sm:p-5 hover:border-white/10 transition-colors">

                    {/* 🔥 Informações Principais (Protegido contra textos grandes) */}
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between mb-5">
                       <div className="flex-1 min-w-0">
                          <h3 className="text-sm sm:text-base font-bold text-white break-words mb-2">{evento.nome}</h3>{evento.status === "arquivado" && <p className="mb-2 text-xs text-amber-200">Galeria arquivada</p>}
                          <div className="flex flex-wrap gap-2">
                             {evento.em_breve && <span className="rounded bg-sky-400/10 px-2 py-1 text-[10px] text-sky-300">Em breve</span>}
                             {evento.acesso_por_link && <span className="rounded bg-white/10 px-2 py-1 text-[10px] text-zinc-300">Por link</span>}
                             {evento.permite_download_gratis && <span className="rounded bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300">Gratuita</span>}
                             <span className="inline-flex items-center gap-1 bg-white/5 text-zinc-400 border border-white/10 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0">{formatarMoeda(evento.preco_padrao_centavos)} / foto</span>
                             <span className="inline-flex items-center gap-1 bg-white/5 text-zinc-400 border border-white/10 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0">{formatarMoeda(evento.preco_video_centavos)} / vídeo</span>
                             <span className="inline-flex items-center gap-1 bg-white/5 text-zinc-400 border border-white/10 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0">Preço {evento.preco_bloqueado ? "bloqueado" : "livre"}</span>
                             <span className="inline-flex items-center gap-1 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-400 shrink-0">{resumoConferido ? vendasPorGaleria[evento.id] || 0 : "—"} arquivos vendidos</span>
                             {Boolean(royaltiesPorGaleria[evento.id]) && <span className="text-[9px] text-retratt">{formatarMoeda(royaltiesPorGaleria[evento.id])} em royalties</span>}
                          </div>
                       </div>

                       {/* Botões Responsivos */}
                       <div className="flex flex-wrap items-center gap-2 shrink-0 mt-1 sm:mt-0">
                          <button type="button" onClick={() => { setEditandoGaleria(evento.id); setEdicaoGaleria({ nome: evento.nome, categoria: evento.categoria || "outros-eventos", capa_url: evento.capa_url || "", status: evento.status || "publicado", precoBloqueado: evento.preco_bloqueado, precoFoto: ((evento.preco_padrao_centavos || 0) / 100).toFixed(2).replace(".", ","), precoVideo: ((evento.preco_video_centavos || 0) / 100).toFixed(2).replace(".", ","), emBreve: Boolean(evento.em_breve), acessoPorLink: Boolean(evento.acesso_por_link), downloadGratuito: Boolean(evento.permite_download_gratis) }); }} className="cursor-pointer flex-1 sm:flex-none inline-flex h-9 sm:h-9 items-center justify-center gap-1.5 rounded-xl border border-retratt/30 bg-retratt/10 px-3 sm:px-4 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-retratt hover:bg-retratt hover:text-black transition-colors">
                            <Pencil size={12} className="shrink-0"/> Editar
                          </button>
                          <button type="button" onClick={() => void copiarLinkGaleria(evento)} className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 px-3 text-[10px] font-bold text-zinc-300 hover:bg-white/10">{linkCopiado === evento.id ? "Link copiado" : "Copiar link"}</button>
                          <LinkGaleria href={`/fotos/evento/${evento.id}${evento.acesso_por_link && evento.acesso_token ? `?acesso=${evento.acesso_token}` : ""}`} className="cursor-pointer flex-1 sm:flex-none inline-flex h-9 sm:h-9 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 sm:px-4 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-black transition-colors">
                            Ver Loja
                          </LinkGaleria>
                       </div>
                    </div>

                      {evento.em_breve && <ControleEmBreveGaleria galeriaId={evento.id} ativo={Boolean(evento.em_breve)} onConfirmado={(ativo) => {
                        setFotoEventos(atuais => atuais.map(item => item.id === evento.id ? { ...item, em_breve: ativo } : item));
                        if (editandoGaleria === evento.id) setEdicaoGaleria(atual => ({ ...atual, emBreve: ativo }));
                      }} />}

                      {editandoGaleria === evento.id && (
                      <div className="mt-4 sm:mt-6 mb-2 rounded-2xl border border-retratt/30 bg-[#050505] overflow-hidden shadow-[0_0_30px_rgba(255,90,31,0.05)] animate-in slide-in-from-top-2 fade-in duration-200">
                        {/* Header do Container */}
                        <div className="flex items-center justify-between border-b border-white/5 bg-retratt/[0.02] px-4 sm:px-5 py-3 sm:py-4">
                           <div className="flex items-center gap-2">
                              <Pencil size={16} className="text-retratt shrink-0" />
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
                                className="h-11 sm:h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-retratt focus:ring-1 focus:ring-retratt/50 transition-all"
                              />
                              <label className="mb-1 mt-3 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Categoria</label>
                              <select value={edicaoGaleria.categoria} onChange={(e) => setEdicaoGaleria({ ...edicaoGaleria, categoria: e.target.value })} className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs text-white">{CATEGORIAS_FOTOS.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}</select>
                           </div>

                           <div>
                              <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Visibilidade</label>
                              <select
                                value={edicaoGaleria.status}
                                onChange={(e) => setEdicaoGaleria({ ...edicaoGaleria, status: e.target.value })}
                                className="h-11 sm:h-12 w-full cursor-pointer rounded-xl border border-white/10 bg-black px-4 text-xs font-bold text-white outline-none focus:border-retratt focus:ring-1 focus:ring-retratt/50 transition-all"
                              >
                                 <option value="publicado">🟢 Publicada (Visível)</option>
                                 <option value="rascunho">🟠 Rascunho (Oculta)</option>
                                 <option value="arquivado">⚫ Arquivada</option>
                              </select>
                           </div>

                           <div className="sm:col-span-2"><OpcoesPublicacaoGaleria value={edicaoGaleria} onChange={(opcoes) => setEdicaoGaleria({ ...edicaoGaleria, ...opcoes })} /></div>
                           <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black p-3 text-[10px] font-bold text-zinc-300 sm:col-span-2">
                             <input type="checkbox" checked={edicaoGaleria.precoBloqueado} onChange={(e) => setEdicaoGaleria({ ...edicaoGaleria, precoBloqueado: e.target.checked })} className="accent-orange-500" />
                             Bloquear preço das fotos e vídeos para os fotógrafos
                           </label>
                           {edicaoGaleria.precoBloqueado && !evento.preco_bloqueado && <p className="text-[9px] text-amber-300 sm:col-span-2">Ao salvar, os preços das mídias existentes serão atualizados para os valores definidos abaixo.</p>}

                           <div>
                             <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Preço por foto (R$)</label>
                             <input value={edicaoGaleria.precoFoto} onChange={(e) => setEdicaoGaleria({ ...edicaoGaleria, precoFoto: e.target.value })} inputMode="decimal" className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-retratt" />
                           </div>
                           <div>
                             <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Preço por vídeo (R$)</label>
                             <input value={edicaoGaleria.precoVideo} onChange={(e) => setEdicaoGaleria({ ...edicaoGaleria, precoVideo: e.target.value })} inputMode="decimal" className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none focus:border-retratt" />
                           </div>

                           <div>
                              <label className="mb-1.5 ml-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Foto de Capa</label>
                              <label className="flex h-11 sm:h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black hover:border-retratt/50 hover:bg-retratt/5 transition-all text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-retratt">
                                 <UploadCloud size={14} className="shrink-0" /> <span className="truncate max-w-[200px] sm:max-w-none">Alterar Imagem</span>
                                 <input
                                   type="file"
                                   accept={ACCEPT_FOTOS_RETRATT}
                                   className="hidden"
                                   onChange={(e) => { const file = e.target.files?.[0]; if (file) void enviarCapaGaleria(file).catch(error => setMensagem(error instanceof Error?error.message:'Não foi possível preparar a capa.')); }}
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
                                className="h-11 w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-retratt/20 bg-retratt/5 px-5 text-[10px] font-black uppercase tracking-widest text-retratt hover:bg-retratt hover:text-white transition-colors order-2 sm:order-1"
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
                                   disabled={salvandoGaleria || preparandoCapa || !edicaoGaleria.nome.trim()}
                                   className="h-11 w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-retratt px-8 text-[10px] font-black uppercase tracking-widest text-black hover:bg-retratt disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_15px_rgba(255,90,31,0.2)]"
                                 >
                                    {salvandoGaleria ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Check size={14} className="shrink-0" />}
                                    {salvandoGaleria ? "Salvando..." : "Salvar Alterações"}
                                 </button>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}

                    <ControleComboIaGaleria galeriaId={evento.id} />
                    <SecaoOrganizador titulo="Descontos progressivos" resumo={(regrasCombo[evento.id] || []).length ? `${(regrasCombo[evento.id] || []).length} faixas configuradas · clique para ajustar` : 'Sem desconto configurado'}>
<fieldset disabled={salvandoDescontos === evento.id} className="space-y-2">
                      <EditorFaixasDesconto faixas={regrasCombo[evento.id] || []} onChange={(faixas) => setRegrasCombo((atual) => ({ ...atual, [evento.id]: faixas }))} />
                      <button type="button" onClick={() => void salvarRegraCombo(evento.id)} className="rounded-xl border border-retratt/30 px-4 py-3 text-xs font-bold text-retratt disabled:opacity-50">{salvandoDescontos === evento.id ? "Salvando..." : "Salvar descontos"}</button>
                    </fieldset>
</SecaoOrganizador>
<div className={s.atalhosGaleria}><span>{resumoConferido ? fotografosPorGaleria[evento.id]?.length || 0 : '—'} fotógrafo(s) credenciado(s)</span><div className="flex flex-wrap gap-4"><Link href={`/fotos/admin/fotografos?galeria=${evento.id}`}>Gerenciar equipe →</Link><Link href={`/fotos/admin/vendas?galeria=${evento.id}`}>Ver pedidos →</Link></div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

</div></>}
    {tela === 'fotografos' && <section className={g.secao}><div className={s.equipeCabecalho}><label>Galeria da equipe<select aria-label="Galeria da equipe" value={galeriaEquipe} onChange={e => setGaleriaReferencia(e.target.value)}><option value="" disabled>Escolha uma galeria</option>{fotoEventos.map(e => <option key={e.id} value={e.id}>{e.nome}{e.status === 'arquivado' ? ' · Arquivada' : ''}</option>)}</select></label><Link href="/fotos/admin/financeiro" className={g.botao}>Vendas da equipe <ArrowRight size={14} /></Link></div>{!resumoConferido ? <p className={g.aviso}>Não foi possível conferir os credenciamentos. Atualize a página para tentar novamente.</p> : !fotoEventos.length ? <p className={g.vazio}>Crie uma galeria para credenciar sua equipe.</p> : fotoEventos.filter(e => e.id === galeriaEquipe).map(evento => <div key={evento.id} className={`${s.formulario} ${s.equipeLista}`}><EquipeGaleriaOrganizador eventoId={evento.id} fotografos={fotografosPorGaleria[evento.id] || []} modelos={modeloForm} royalties={royaltyForm} avisos={avisosRoyalty} salvando={salvandoRoyalty} removendo={removendoFotografo} email={emailFotografo[evento.id] || ''} credenciando={credenciandoEvento === evento.id} onModelo={(chave, modelo) => setModeloForm(atual => ({ ...atual, [chave]: modelo }))} onRoyalty={(chave, valor) => setRoyaltyForm(atual => ({ ...atual, [chave]: valor }))} onSalvar={id => void salvarRoyaltyFotografo(evento.id, id)} onRemover={f => void descredenciarFotografo(evento.id, f)} onEmail={valor => setEmailFotografo(atual => ({ ...atual, [evento.id]: valor }))} onCredenciar={() => void credenciarFotografo(evento.id)} />
</div>)}<p className={g.nota}>Alterações do modelo ou percentual valem para as próximas compras. Pedidos anteriores mantêm os valores registrados. Salve cada alteração para confirmar o acordo.</p></section>}
    {tela === 'financeiro' && <><ResumoOrganizador financeiro galeriaInicial={galeriaReferencia} galerias={fotoEventos} totais={totais} vendidos={vendasPorGaleria} receitas={receitaDiretaPorGaleria} royalties={royaltiesPorGaleria} receitaTotal={receitaDiretaTotalCentavos} royaltyTotal={royaltiesTotalCentavos} equipe={equipeTotal} conectado={mercadoPagoOrganizadorConectado} perfilPendente={perfilPendente} resumoDisponivel={resumoConferido} /><div id="vendas-diaria" className="scroll-mt-24"><VendasDiariaFotografos gestao /></div></>}
    {tela === 'perfil' && <div className={s.formulario}><div className={s.perfil}>
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
               <div className="rounded-3xl border border-retratt/30 bg-retratt/5 shadow-[0_0_30px_rgba(255,90,31,0.05)] p-5 sm:p-6 md:p-8">
                 <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                    <div>
                       <h2 className="text-base font-black uppercase tracking-tight text-white md:text-lg">Dados do Organizador</h2>
                       <p className="text-[10px] font-bold text-retratt/80 uppercase tracking-widest mt-1">
                         {perfilPendente ? "Precisamos dos dados para repasse" : "Atualizar Informações"}
                       </p>
                    </div>
                    {tela !== "perfil" && !perfilPendente && (
                      <button onClick={() => setMostrarFormularioPerfil(false)} className="cursor-pointer w-full sm:w-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white/5 px-4 text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors">
                        Cancelar
                      </button>
                    )}
                 </div>

                 <div className="space-y-4">
                   <div className="grid gap-3 sm:grid-cols-2 mb-4 bg-black/40 p-4 rounded-2xl border border-white/5">
                     <div>
                        <input type="file" accept={ACCEPT_FOTOS_RETRATT} className="hidden" ref={avatarInputRef} onChange={(e) => handleImageUpload(e, 'avatar')} />
                        <button onClick={() => avatarInputRef.current?.click()} disabled={fazendoUpload === 'avatar'} className="w-full h-10 rounded-lg border border-dashed border-white/20 hover:border-retratt bg-white/5 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-retratt transition-all cursor-pointer">
                          {fazendoUpload === 'avatar' ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                          {fazendoUpload === 'avatar' ? 'A carregar...' : 'Logo do Organizador'}
                        </button>
                     </div>
                     <div>
                        <input type="file" accept={ACCEPT_FOTOS_RETRATT} className="hidden" ref={capaInputRef} onChange={(e) => handleImageUpload(e, 'capa')} />
                        <button onClick={() => capaInputRef.current?.click()} disabled={fazendoUpload === 'capa'} className="w-full h-10 rounded-lg border border-dashed border-white/20 hover:border-retratt bg-white/5 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-retratt transition-all cursor-pointer">
                          {fazendoUpload === 'capa' ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                          {fazendoUpload === 'capa' ? 'A carregar...' : 'Banner (Vitrine)'}
                        </button>
                     </div>
                   </div>

                   <div className="grid gap-3 sm:grid-cols-2">
                     <div className="sm:col-span-2">
                        <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome ou Razão Social</label>
                        <input value={orgForm.nome} onChange={(e) => setOrgForm({ ...orgForm, nome: e.target.value })} className="h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="Ex: Viva Bem Eventos" />
                     </div>

                     <div className="sm:col-span-2">
                        <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">E-mail</label>
                        <input value={orgForm.email} onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })} type="email" className="h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="seu@email.com" />
                     </div>

                     <div>
                        <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">WhatsApp</label>
                        <input value={formatarTelefone(orgForm.telefone)} onChange={(e) => setOrgForm({ ...orgForm, telefone: formatarTelefone(e.target.value) })} className="h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="(00) 00000-0000" />
                     </div>
                     <div>
                        <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">CPF ou CNPJ</label>
                        <input value={formatarDocumento(orgForm.documento)} onChange={(e) => setOrgForm({ ...orgForm, documento: formatarDocumento(e.target.value) })} className="h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt" placeholder="000.000.000-00" />
                     </div>

                     <LocalidadeFotosInput cidade={orgForm.cidade} estado={orgForm.estado} onChange={({ cidade, estado }) => setOrgForm({ ...orgForm, cidade, estado })} className="h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt" />

                     <div className="sm:col-span-2">
                        <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Tipo de Negócio</label>
                        <select value={orgForm.tipo_entidade} onChange={(e) => setOrgForm({ ...orgForm, tipo_entidade: e.target.value })} className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-retratt">
                          <option value="empresa">Empresa (CNPJ)</option>
                          <option value="associacao">Federação / Associação</option>
                          <option value="academia">Academia</option>
                          <option value="pessoa_fisica">Pessoa Física</option>
                        </select>
                     </div>
                   </div>

                   <div className="mt-6">
                     <button type="button" onClick={salvarPerfilOrganizador} disabled={salvandoPerfil || !orgForm.nome.trim() || !orgForm.telefone.trim()} className="h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-retratt text-[11px] font-black uppercase tracking-widest text-black hover:bg-retratt disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,90,31,0.2)]">
                       {salvandoPerfil ? "A Processar..." : "Salvar Dados"}
                     </button>
                   </div>
                 </div>
               </div>
            )}

<section id="recebimentos" className={g.secao}><header className={g.secaoCabecalho}><div><h2>Conta de recebimento</h2><p>Mercado Pago da sua organização.</p></div></header><div className="space-y-4 p-5"><p className="text-sm text-emerald-200">{estadoConexaoMP === 'conectado' ? 'Mercado Pago conectado' : 'Conferir conexão Mercado Pago'}</p><p className="text-xs leading-6 text-zinc-300">Nas vendas por diária, o pagamento entra nesta conta e você combina o repasse com o fotógrafo. Nas vendas por royalty, o fotógrafo recebe a venda e a sua participação fica registrada para repasse.</p>{estadoConexaoMP === 'conectado' && <MercadoPagoConnectButton conectado={mercadoPagoOrganizadorConectado} perfil="organizador_fotos" returnTo="/fotos/admin/perfil" className="rounded-xl bg-retratt px-4 py-3 text-xs font-bold text-black" />}</div></section></div></div>}
  </PainelOrganizador>;
}
