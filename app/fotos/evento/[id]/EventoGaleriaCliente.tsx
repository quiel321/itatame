"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { FOTO_IA_NUMERO_TAG_PREFIX } from "@/app/lib/fotos-ai";
import { eventoPermiteBuscaPorNumero } from "@/app/lib/fotos-busca-numero";
import { arquivoFotoEhVideo, FotoAlbum, FotoArquivo, FotoEvento, formatarPrecoFotos } from "@/app/lib/fotos";
import FotosShell from "../../_components/FotosShell";
import BuscaFacial from "../../_components/BuscaFacial";
import BuscaPorNumero from "../../_components/BuscaPorNumero";
import PreviewProtectionOverlay from "../../_components/PreviewProtectionOverlay";
import ProgressoDesconto from "../../_components/ProgressoDesconto";
import { faixasDoEvento } from "@/app/lib/fotos-descontos";
import { Camera, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Filter, Image as ImageIcon, MapPin, Play, ScanFace, Search, Share2, ShieldCheck, ShoppingCart, Video, X, Building2, Percent } from "lucide-react";

const CARRINHO_FOTOS_KEY = "carrinho_fotos";

function fotoPreviewSrc(foto: FotoArquivo, acesso?: string | null) {
  return `/api/fotos/arquivo/${foto.id}?tipo=preview${acesso ? `&acesso=${encodeURIComponent(acesso)}` : ""}`;
}

function fotoThumbSrc(foto: FotoArquivo, acesso?: string | null) {
  return `/api/fotos/arquivo/${foto.id}?tipo=thumb${acesso ? `&acesso=${encodeURIComponent(acesso)}` : ""}`;
}

function videoPreviewSrc(foto: FotoArquivo, acesso?: string | null) {
  return `/api/fotos/arquivo/${foto.id}?tipo=video-preview${acesso ? `&acesso=${encodeURIComponent(acesso)}` : ""}`;
}

type DadosFotografo = { nome?: string | null; foto_url?: string | null };

type EventoGaleria = FotoEvento & {
  descricao?: string | null;
  autor_nome?: string;
  autor_slug?: string;
  tipo_autor?: string;
};

export type GaleriaInicial = {
  evento: EventoGaleria;
  albuns: FotoAlbum[];
  fotos: FotoArquivo[];
  totalMidias: number | null;
  totalVideos: number | null;
};

function dadosFotografo(foto: FotoArquivo) {
  const dados = (foto as FotoArquivo & { fotografo_dados?: DadosFotografo | DadosFotografo[] | null }).fotografo_dados;
  return Array.isArray(dados) ? dados[0] : dados;
}

export default function EventoGaleriaCliente({ initialData, acesso }: { initialData?: GaleriaInicial; acesso?: string | null }) {
  const params = useParams<{ id: string }>();
  const eventoId = params.id;
  const [evento, setEvento] = useState<EventoGaleria | null>(initialData?.evento || null);
  const [albuns, setAlbuns] = useState<FotoAlbum[]>(initialData?.albuns || []);
  const [fotos, setFotos] = useState<FotoArquivo[]>(initialData?.fotos || []);
  const [albumAtivo, setAlbumAtivo] = useState("todos");
  const [tipoAtivo, setTipoAtivo] = useState<"fotos" | "videos">(initialData?.totalMidias && initialData.totalMidias === initialData.totalVideos ? "videos" : "fotos");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(!initialData);
  const [limiteVisivel, setLimiteVisivel] = useState(48);
  const [haMaisNoBanco, setHaMaisNoBanco] = useState((initialData?.fotos.length || 0) === 1000);
  const [buscandoMais, setBuscandoMais] = useState(false);
  const [totalMidiasBanco, setTotalMidiasBanco] = useState<number | null>(initialData?.totalMidias ?? null);
  const [totalVideosBanco, setTotalVideosBanco] = useState<number | null>(initialData?.totalVideos ?? null);

  const [carrinho, setCarrinho] = useState<string[]>([]);
  const [carrinhoCarregado, setCarrinhoCarregado] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState<FotoArquivo | null>(null);
  const [fotoOrigemBusca, setFotoOrigemBusca] = useState<"ia" | "numero" | null>(null);
  const [linkCompartilhado, setLinkCompartilhado] = useState(false);
  const temporizadorProtecaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toqueInicialFoto = useRef<number | null>(null);
  const previewsEmCache = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    const desativarProtecao = () => {
      document.documentElement.classList.remove("fotos-protecao-instantanea");
    };

    const agendarDesativacao = (duracao: number) => {
      if (temporizadorProtecaoRef.current) clearTimeout(temporizadorProtecaoRef.current);
      temporizadorProtecaoRef.current = setTimeout(desativarProtecao, duracao);
    };

    const ativarProtecao = (duracao = 2500) => {
      document.documentElement.classList.add("fotos-protecao-instantanea");
      agendarDesativacao(duracao);
    };

    const teclaPreventiva = (e: KeyboardEvent) =>
      e.key === "Shift" ||
      e.key === "Meta" ||
      e.key === "OS" ||
      e.key === "Super" ||
      e.key === "PrintScreen" ||
      e.code === "ShiftLeft" ||
      e.code === "ShiftRight" ||
      e.code === "MetaLeft" ||
      e.code === "MetaRight" ||
      e.code === "PrintScreen";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!teclaPreventiva(e)) return;
      if (e.key === "PrintScreen" || e.code === "PrintScreen") e.preventDefault();
      ativarProtecao(2500);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (teclaPreventiva(e)) agendarDesativacao(350);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") ativarProtecao(2500);
      else agendarDesativacao(350);
    };
    const handleBeforePrint = () => ativarProtecao(10000);
    const handleAfterPrint = () => agendarDesativacao(350);
    const handlePageHide = () => ativarProtecao(2500);
    const protegerInteracao = (e: Event) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("[data-foto-protegida]")) e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("pagehide", handlePageHide, true);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    document.addEventListener("visibilitychange", handleVisibilityChange, true);
    document.addEventListener("contextmenu", protegerInteracao);
    document.addEventListener("dragstart", protegerInteracao);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("pagehide", handlePageHide, true);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.removeEventListener("visibilitychange", handleVisibilityChange, true);
      document.removeEventListener("contextmenu", protegerInteracao);
      document.removeEventListener("dragstart", protegerInteracao);
      if (temporizadorProtecaoRef.current) clearTimeout(temporizadorProtecaoRef.current);
      document.documentElement.classList.remove("fotos-protecao-instantanea");
    };
  }, []);

  useEffect(() => {
    try {
      const idsSalvos = JSON.parse(localStorage.getItem(CARRINHO_FOTOS_KEY) || "[]");
      setCarrinho(Array.isArray(idsSalvos) ? idsSalvos.map(String) : []);
    } catch {
      setCarrinho([]);
    } finally {
      setCarrinhoCarregado(true);
    }
  }, []);

  useEffect(() => {
    if (!carrinhoCarregado) return;
    localStorage.setItem(CARRINHO_FOTOS_KEY, JSON.stringify(carrinho));
    window.dispatchEvent(new CustomEvent("carrinho-fotos-atualizado", { detail: carrinho }));
  }, [carrinho, carrinhoCarregado]);

  useEffect(() => {
    if (initialData) return;
    async function carregar() {
      if (!eventoId) return;
      setCarregando(true);

      // 1. Busca os dados base do evento (🔥 ADICIONADO: 'created_by' no select)
      const [{ data: eventoData }, { data: albunsData }, { data: fotosData }, { count: totalBanco }, { count: videosBanco }] = await Promise.all([
        supabase.from("foto_eventos").select("id, nome, slug, descricao, local, cidade, estado, data_evento, capa_url, status, vendas_ate, desconto_combo_qtd, desconto_combo_percentual, descontos_progressivos, em_breve, organizador_user_id, created_by, permite_download_gratis, acesso_por_link").eq("id", eventoId).maybeSingle(),
        supabase.from("foto_albuns").select("id, evento_id, fotografo_id, titulo, descricao, capa_url, status").eq("evento_id", eventoId).eq("status", "publicado").order("ordem", { ascending: true }),
        supabase.from("foto_arquivos").select("id, evento_id, album_id, fotografo_id, titulo, mime_type, r2_original_key, r2_preview_key, r2_thumb_key, preview_url, thumb_url, preco_centavos, status, tags, fotografo_dados:fotografos!fotografo_id(nome, foto_url)").eq("evento_id", eventoId).eq("status", "publicada").order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, 999),
        supabase.from("foto_arquivos").select("id", { count: "exact", head: true }).eq("evento_id", eventoId).eq("status", "publicada"),
        supabase.from("foto_arquivos").select("id", { count: "exact", head: true }).eq("evento_id", eventoId).eq("status", "publicada").like("mime_type", "video/%"),
      ]);

      if (!eventoData || eventoData.status !== "publicado") {
        setEvento(null);
        setAlbuns([]);
        setFotos([]);
        setCarregando(false);
        return;
      }

      // 2. 🔥 INTELIGÊNCIA DO BANNER CORRIGIDA
      let autorNome = "Organizador";
      let autorSlug = "";
      let tipoAutor = "organizador";

      if (eventoData?.organizador_user_id) {
         // Se tem organizador_user_id, é uma galeria oficial de Organizador
         const { data: orgData } = await supabase.from("foto_organizadores").select("nome, slug").eq("id", eventoData.organizador_user_id).maybeSingle();
         if (orgData) {
            autorNome = orgData.nome || "Organizador";
            autorSlug = orgData.slug || "";
            tipoAutor = "organizador";
         }
      } else if (eventoData?.created_by) {
         // Se não tem organizador, mas tem created_by, é Fotógrafo Freelancer
         const { data: fotoData } = await supabase.from("fotografos").select("nome").eq("user_id", eventoData.created_by).maybeSingle();
         if (fotoData) {
            autorNome = fotoData.nome || "Fotógrafo Parceiro";
            tipoAutor = "fotografo";
         }
      }

      const eventoCompleto = {
        ...(eventoData || {}),
        autor_nome: autorNome,
        autor_slug: autorSlug,
        tipo_autor: tipoAutor
      };

      setEvento(eventoCompleto);
      setAlbuns((albunsData || []) as FotoAlbum[]);
      const midias = (fotosData || []) as FotoArquivo[];
      setHaMaisNoBanco(midias.length === 1000);
      setTotalMidiasBanco(totalBanco);
      setTotalVideosBanco(videosBanco);
      const tipoDaUrl = new URLSearchParams(window.location.search).get("tipo");
      const temFotos = totalBanco !== null && videosBanco !== null
        ? totalBanco > videosBanco : midias.some((midia) => !arquivoFotoEhVideo(midia));
      const temVideos = videosBanco !== null
        ? videosBanco > 0 : midias.some((midia) => arquivoFotoEhVideo(midia));
      setTipoAtivo(temVideos && (tipoDaUrl === "videos" || !temFotos) ? "videos" : "fotos");
      setFotos(midias);
      setCarregando(false);
    }

    carregar();
  }, [eventoId, initialData]);

  useEffect(() => {
    if (fotos.length === 0) return;
    const parametros = new URLSearchParams(window.location.search);
    const fotoId = parametros.get("foto");
    if (!fotoId) return;

    const fotoEncontrada = fotos.find((foto) => String(foto.id) === fotoId);
    if (!fotoEncontrada) {
      if (acesso) {
        void fetch(`/api/fotos/evento/${eventoId}/midias-privadas?foto=${encodeURIComponent(fotoId)}&acesso=${encodeURIComponent(acesso)}`, { cache: "no-store" })
          .then((resposta) => resposta.ok ? resposta.json() : null)
          .then((resultado) => {
            const foto = resultado?.fotos?.[0];
            if (foto) setFotoSelecionada(foto as FotoArquivo);
          });
        return;
      }
      void supabase.from("foto_arquivos")
        .select("id, evento_id, album_id, fotografo_id, titulo, mime_type, r2_original_key, r2_preview_key, r2_thumb_key, preview_url, thumb_url, preco_centavos, status, tags, fotografo_dados:fotografos!fotografo_id(nome, foto_url)")
        .eq("id", fotoId).eq("evento_id", eventoId).eq("status", "publicada").maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          setFotoSelecionada(data as FotoArquivo);
          const origem = parametros.get("origem");
          setFotoOrigemBusca(origem === "ia" || origem === "numero" ? origem : null);
        });
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setFotoSelecionada(fotoEncontrada);
      const origem = parametros.get("origem");
      setFotoOrigemBusca(origem === "ia" || origem === "numero" ? origem : null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fotos, eventoId, acesso]);

  useEffect(() => {
    if (albuns.length === 0) return;
    const albumDaUrl = new URLSearchParams(window.location.search).get("album");
    if (!albumDaUrl || !albuns.some((album) => album.id === albumDaUrl)) return;
    const frame = window.requestAnimationFrame(() => setAlbumAtivo(albumDaUrl));
    return () => window.cancelAnimationFrame(frame);
  }, [albuns]);

  useEffect(() => {
    if (!initialData || initialData.totalVideos === 0) return;
    if (new URLSearchParams(window.location.search).get("tipo") === "videos") {
      const frame = window.requestAnimationFrame(() => setTipoAtivo("videos"));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [initialData]);

  const selecionarAlbum = (albumId: string) => {
    setAlbumAtivo(albumId);
    setLimiteVisivel(48);
    const url = new URL(window.location.href);
    if (albumId === "todos") url.searchParams.delete("album");
    else url.searchParams.set("album", albumId);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const compartilharGaleria = async () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("foto");
    url.searchParams.delete("origem");
    const link = url.toString();
    const albumAtual = albuns.find((album) => album.id === albumAtivo);
    const titulo = [evento?.nome, albumAtual?.titulo].filter(Boolean).join(" · ") || "Galeria Retratt";

    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: titulo, text: `Veja as fotos de ${titulo} no Retratt`, url: link });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(link);
      setLinkCompartilhado(true);
      window.setTimeout(() => setLinkCompartilhado(false), 2500);
    } catch {
      window.prompt("Copie o link da galeria:", link);
    }
  };

  const selecionarTipo = (tipo: "fotos" | "videos") => {
    setTipoAtivo(tipo);
    setLimiteVisivel(48);
    const url = new URL(window.location.href);
    if (tipo === "fotos") url.searchParams.delete("tipo");
    else url.searchParams.set("tipo", tipo);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const videosCarregados = useMemo(() => fotos.filter((foto) => arquivoFotoEhVideo(foto)).length, [fotos]);
  const totalVideos = totalVideosBanco ?? videosCarregados;
  const totalFotos = totalMidiasBanco !== null ? totalMidiasBanco - totalVideos : fotos.length - videosCarregados;
  const midiasDoTipo = useMemo(
    () => evento?.em_breve ? [] : fotos.filter((foto) => arquivoFotoEhVideo(foto) === (tipoAtivo === "videos")),
    [fotos, tipoAtivo, evento?.em_breve],
  );

  const fotosFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return midiasDoTipo.filter((foto) => {
      const bateAlbum = albumAtivo === "todos" || foto.album_id === albumAtivo;
      const numeros = (foto.tags || [])
        .filter((tag) => tag.startsWith(FOTO_IA_NUMERO_TAG_PREFIX))
        .map((tag) => tag.slice(FOTO_IA_NUMERO_TAG_PREFIX.length));
      const texto = [foto.titulo, foto.id, ...numeros].filter(Boolean).join(" ").toLowerCase();
      const bateBusca = !termo || texto.includes(termo);
      return bateAlbum && bateBusca;
    });
  }, [midiasDoTipo, albumAtivo, busca]);

  const indiceFotoSelecionada = fotoSelecionada
    ? fotosFiltradas.findIndex((foto) => foto.id === fotoSelecionada.id) : -1;

  useEffect(() => {
    if (indiceFotoSelecionada < 0) return;
    const proximas = [-2, -1, 1, 2].map((deslocamento) => fotosFiltradas[indiceFotoSelecionada + deslocamento]).filter((foto): foto is FotoArquivo => Boolean(foto && !arquivoFotoEhVideo(foto)));
    for (const foto of proximas) {
      const chave = String(foto.id);
      if (previewsEmCache.current.has(chave)) continue;
      const imagem = new Image();
      imagem.src = fotoPreviewSrc(foto, acesso);
      previewsEmCache.current.set(chave, imagem);
    }
    for (const chave of previewsEmCache.current.keys()) {
      if (!proximas.some((foto) => String(foto.id) === chave)) previewsEmCache.current.delete(chave);
    }
  }, [indiceFotoSelecionada, fotosFiltradas]);

  function navegarFoto(direcao: -1 | 1) {
    const proxima = fotosFiltradas[indiceFotoSelecionada + direcao];
    if (!proxima) return;
    setFotoSelecionada(proxima);
    setFotoOrigemBusca(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("foto")) {
      url.searchParams.set("foto", String(proxima.id));
      url.searchParams.delete("origem");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  useEffect(() => {
    if (!fotoSelecionada) return;
    const aoPressionar = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && indiceFotoSelecionada > 0) navegarFoto(-1);
      if (event.key === "ArrowRight" && indiceFotoSelecionada < fotosFiltradas.length - 1) navegarFoto(1);
    };
    window.addEventListener("keydown", aoPressionar);
    return () => window.removeEventListener("keydown", aoPressionar);
  });

  async function mostrarMais() {
    if (limiteVisivel < fotosFiltradas.length) {
      setLimiteVisivel((atual) => atual + 48);
      return;
    }
    if (!haMaisNoBanco || buscandoMais) return;
    setBuscandoMais(true);
    const { data, error } = acesso
      ? await fetch(`/api/fotos/evento/${eventoId}/midias-privadas?offset=${fotos.length}&acesso=${encodeURIComponent(acesso)}`, { cache: "no-store" })
        .then(async (resposta) => resposta.ok ? { data: (await resposta.json()).fotos, error: null } : { data: null, error: true })
      : await supabase.from("foto_arquivos")
        .select("id, evento_id, album_id, fotografo_id, titulo, mime_type, r2_original_key, r2_preview_key, r2_thumb_key, preview_url, thumb_url, preco_centavos, status, tags, fotografo_dados:fotografos!fotografo_id(nome, foto_url)")
        .eq("evento_id", eventoId).eq("status", "publicada")
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(fotos.length, fotos.length + 999);
    setBuscandoMais(false);
    if (error) return;
    const recebidas = (data || []) as FotoArquivo[];
    setFotos((atuais) => [...atuais, ...recebidas]);
    setHaMaisNoBanco(recebidas.length === 1000);
    setLimiteVisivel((atual) => atual + 48);
  }

  const toggleCarrinho = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (acesso) {
      localStorage.setItem(`retratt_acesso_album_${eventoId}`, acesso);
      localStorage.setItem(`retratt_evento_foto_${id}`, eventoId);
    }
    setCarrinho(prev => prev.includes(id) ? prev.filter(fotoId => fotoId !== id) : [...prev, id]);
  };

  const fecharFotoSelecionada = () => {
    if (temporizadorProtecaoRef.current) clearTimeout(temporizadorProtecaoRef.current);
    document.documentElement.classList.remove("fotos-protecao-instantanea");
    setFotoSelecionada(null);
    setFotoOrigemBusca(null);

    const url = new URL(window.location.href);
    if (url.searchParams.has("foto")) {
      url.searchParams.delete("foto");
      url.searchParams.delete("origem");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  };

  const valorTotalCarrinho = carrinho.reduce((total, fotoId) => {
    const foto = fotos.find(f => String(f.id) === fotoId);
    return total + (foto ? foto.preco_centavos : 0);
  }, 0);

  const faixasDesconto = evento ? faixasDoEvento(evento) : [];
  const idsCarrinho = new Set(carrinho);
  const fotosPorFotografo = new Map<string, number>();
  fotos.forEach((foto) => {
    if (!idsCarrinho.has(String(foto.id)) || arquivoFotoEhVideo(foto)) return;
    const fotografo = String(foto.fotografo_id ?? "sem-fotografo");
    fotosPorFotografo.set(fotografo, (fotosPorFotografo.get(fotografo) ?? 0) + 1);
  });
  const quantidadeDescontoGaleria = Math.max(0, ...fotosPorFotografo.values());
  const proximaFaixaGaleria = faixasDesconto.find((faixa) => faixa.quantidade > quantidadeDescontoGaleria);
  const metaDescontoGaleria = faixasDesconto.at(-1)?.quantidade ?? 1;
  const progressoDescontoGaleria = Math.min(100, Math.round(quantidadeDescontoGaleria / metaDescontoGaleria * 100));
  const fotosElegiveisNoCarrinho = fotoSelecionada
    ? fotos.filter((foto) => idsCarrinho.has(String(foto.id)) && foto.fotografo_id === fotoSelecionada.fotografo_id && !arquivoFotoEhVideo(foto)).length
    : 0;

  const formatarData = (dataStr?: string | null) => {
    if (!dataStr) return "";
    const [ano, mes, dia] = dataStr.slice(0, 10).split("-");
    return `${dia}/${mes}/${ano}`;
  };

  if (!carregando && !evento) {
    return <FotosShell><main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 bg-[#020202] px-4 text-center text-white"><h1 className="text-2xl font-black">Galeria indisponível</h1><p className="text-sm text-zinc-400">Esta galeria não está mais publicada.</p><Link href="/fotos" className="rounded-xl bg-retratt px-5 py-3 text-xs font-black text-black">Ver galerias</Link></main></FotosShell>;
  }

  return (
    <FotosShell>
      <main data-foto-protegida className="min-h-screen bg-[#020202] text-white font-sans pb-28 relative print:hidden">

        <div className="mx-auto max-w-6xl px-2 md:px-6">

          <section className="mt-3 mb-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0e] shadow-2xl relative">
            <div className="relative min-h-[180px] md:min-h-[190px] px-4 py-5 md:px-8 md:py-6 flex flex-col">
              <div className="absolute inset-0 opacity-40">
                <img
                  src={evento?.capa_url || "https://images.pexels.com/photos/16335196/pexels-photo-16335196.jpeg?auto=compress&cs=tinysrgb&w=1920"}
                  alt={evento?.nome || "Galeria de fotos"}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/30" />
              </div>

              <div className="relative z-10 max-w-4xl flex flex-col h-full justify-center">

                <Link href="/fotos" className="inline-flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white transition-colors mb-3 w-fit">
                  <ChevronLeft size={14} /> Voltar aos eventos
                </Link>

                {/* 🔥 IDENTIFICAÇÃO DO AUTOR DA GALERIA */}
                <div className="mb-2">
                   {evento?.tipo_autor === "organizador" && evento?.autor_slug ? (
                       <Link href={`/fotos/organizador/${evento.autor_slug}`} className="inline-flex items-center gap-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full pr-4 pl-1 py-1 backdrop-blur-md transition-all cursor-pointer group w-fit">
                          <div className="w-6 h-6 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[9px] font-black text-white group-hover:scale-110 transition-transform">
                             <Building2 size={12} className="text-zinc-400 group-hover:text-white" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-300 group-hover:text-white uppercase tracking-widest">
                             Por: {evento.autor_nome}
                          </span>
                       </Link>
                   ) : (
                       <div className="inline-flex items-center gap-2.5 bg-retratt/10 border border-retratt/20 rounded-full pr-4 pl-1 py-1 backdrop-blur-md w-fit">
                          <div className="w-6 h-6 rounded-full bg-retratt/20 border border-retratt/30 flex items-center justify-center text-[9px] font-black text-retratt">
                             <Camera size={12} />
                          </div>
                          <span className="text-[10px] font-bold text-retratt uppercase tracking-widest">
                             Por: {evento?.autor_nome}
                          </span>
                       </div>
                   )}
                </div>

                <h1 className="mt-1 max-w-3xl text-2xl font-black uppercase tracking-tight leading-tight text-white sm:text-3xl md:text-4xl">
                  {evento?.nome || "Evento Retratt"}
                </h1>

                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-200">
                  {evento?.data_evento && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/50 backdrop-blur-md px-2.5 py-1.5">
                      <CalendarDays size={14} className="text-retratt" /> {formatarData(evento.data_evento)}
                    </span>
                  )}
                  {(evento?.cidade || evento?.local) && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/50 backdrop-blur-md px-2.5 py-1.5">
                      <MapPin size={14} className="text-retratt" /> {[evento.local, evento.cidade, evento.estado].filter(Boolean).join(" - ")}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/50 backdrop-blur-md px-2.5 py-1.5">
                    <ImageIcon size={14} className="text-zinc-400" /> {carregando ? "Carregando fotos..." : <>{totalFotos} {totalFotos === 1 ? "foto" : "fotos"}{totalVideos > 0 && ` · ${totalVideos} ${totalVideos === 1 ? "vídeo" : "vídeos"}`} · {albuns.length || 1} álbum</>}
                  </span>
                  <button
                    type="button"
                    onClick={compartilharGaleria}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-retratt/30 bg-retratt/15 px-2.5 py-1.5 text-retratt backdrop-blur-md transition-colors hover:bg-retratt hover:text-black"
                  >
                    {linkCompartilhado ? <CheckCircle2 size={14} /> : <Share2 size={14} />}
                    {linkCompartilhado ? "Link copiado" : albumAtivo === "todos" ? "Compartilhar" : "Compartilhar álbum"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {!evento?.em_breve && <section aria-labelledby="busca-fotos-ia" className="mb-3 rounded-2xl border border-retratt/25 bg-gradient-to-r from-[#211108] via-[#130c09] to-[#0a0a0e] px-4 py-4 shadow-lg shadow-orange-950/10 sm:px-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-retratt/25 bg-retratt/10 text-retratt">
                  <ScanFace size={22} />
                </div>
                <div>
                  <h2 id="busca-fotos-ia" className="text-base font-black text-white sm:text-lg">Encontre suas fotos com IA</h2>
                  <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-zinc-300">Envie uma selfie e veja as fotos em que você aparece nesta galeria.</p>
                </div>
              </div>
              <BuscaFacial
                eventoId={eventoId}
                triggerLabel="Buscar minhas fotos"
                triggerClassName="flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-retratt px-5 py-3 text-xs font-black text-black transition-colors hover:bg-orange-400 sm:w-auto"
              />
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-zinc-500 sm:ml-[52px]">A selfie é usada somente para localizar fotos. A busca solicita seu consentimento antes do envio.</p>
          </section>}

          <div className="sticky top-[60px] md:top-[80px] z-40 mb-3 bg-[#0a0a0e]/90 backdrop-blur-xl border border-white/10 p-2 md:p-3 rounded-2xl flex flex-col md:flex-row gap-3 shadow-2xl">

            {!evento?.em_breve && eventoPermiteBuscaPorNumero(evento) && (
              <BuscaPorNumero
                eventoId={eventoId}
                triggerLabel="Número"
                triggerClassName="flex items-center justify-center gap-2.5 bg-orange-500/10 hover:bg-orange-500 border border-orange-400/20 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-orange-300 hover:text-black shrink-0 cursor-pointer transition-colors"
              />
            )}

            <div className="w-[1px] h-8 bg-white/5 hidden md:block self-center"></div>

            <div className="flex-1 flex items-center bg-black/60 border border-white/5 rounded-xl px-4 py-2.5 focus-within:border-retratt/40 transition-colors cursor-text">
              <Search size={16} className="text-zinc-500 mr-2 shrink-0" />
              <input
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setLimiteVisivel(48); }}
                placeholder={eventoPermiteBuscaPorNumero(evento) ? "Buscar por nome, equipe, referência ou número..." : "Buscar por nome, equipe ou referência..."}
                className="w-full bg-transparent border-none text-xs text-white outline-none placeholder:text-zinc-600 font-medium"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5 items-center">
              <div className="flex items-center gap-1.5 px-3 text-zinc-600 text-[9px] font-black uppercase tracking-widest shrink-0 border-r border-white/10 mr-1">
                <Filter size={14} /> Álbuns
              </div>
              <button
                onClick={() => selecionarAlbum("todos")}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all cursor-pointer shrink-0 ${albumAtivo === "todos" ? 'bg-retratt text-black shadow-md shadow-orange-950/30' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
              >
                Todas ({carregando ? "..." : tipoAtivo === "videos" ? totalVideos : totalFotos})
              </button>
              {albuns.map(album => (
                <button
                  key={album.id}
                  onClick={() => selecionarAlbum(album.id)}
                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all cursor-pointer shrink-0 ${albumAtivo === album.id ? 'bg-retratt text-black shadow-md shadow-orange-950/30' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
                >
                  {album.titulo}
                </button>
              ))}
            </div>
          </div>

          {evento?.em_breve && <div className="mb-4 rounded-2xl border border-sky-400/20 bg-sky-400/[0.08] px-4 py-4 text-center"><p className="text-sm font-black uppercase tracking-wider text-sky-300">Em breve</p><p className="mt-1 text-xs text-zinc-300">Esta galeria ainda vai receber fotos. Volte em breve para encontrar as suas.</p></div>}
          {evento?.permite_download_gratis && !evento.em_breve && <div className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4"><p className="text-sm font-black uppercase text-emerald-300">Downloads gratuitos</p><p className="mt-1 text-xs text-zinc-300">Abra uma foto ou vídeo e baixe o arquivo original sem pagamento.</p></div>}
          {evento && faixasDesconto.length > 0 && !evento.em_breve && !evento.permite_download_gratis && (
            <section className="mx-auto mb-6 max-w-5xl" aria-label="Descontos progressivos nas fotos">
              <div className="grid gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <div className="relative overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-r from-sky-950/80 to-[#071720] px-5 py-4 sm:px-6">
                  <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-9 select-none text-[150px] font-black leading-none text-sky-300/[0.06]">%</span>
                  <div className="relative flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300"><Percent size={26} /></span>
                    <div className="min-w-0">
                      <p className="text-base font-black uppercase leading-tight text-sky-300 sm:text-xl">Ganhe até {faixasDesconto.at(-1)?.percentual}% de desconto</p>
                      <p className="mt-1 text-xs text-zinc-300">{proximaFaixaGaleria ? quantidadeDescontoGaleria > 0 ? `Mais ${proximaFaixaGaleria.quantidade - quantidadeDescontoGaleria} ${proximaFaixaGaleria.quantidade - quantidadeDescontoGaleria === 1 ? "foto" : "fotos"} para liberar ${proximaFaixaGaleria.percentual}%` : "Escolha suas fotos e avance pelas faixas ao lado." : `Meta máxima alcançada com ${quantidadeDescontoGaleria} fotos!`}</p>
                    </div>
                  </div>
                  <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-sky-400/15" role="progressbar" aria-label="Progresso para o desconto máximo" aria-valuenow={Math.min(quantidadeDescontoGaleria, metaDescontoGaleria)} aria-valuemin={0} aria-valuemax={metaDescontoGaleria}>
                    <div className="h-full rounded-full bg-sky-400 transition-[width] duration-300" style={{ width: `${progressoDescontoGaleria}%` }} />
                  </div>
                  <p className="relative mt-2 text-[10px] text-zinc-400">Desconto automático em fotos da mesma galeria e fotógrafo.</p>
                </div>
                <div className="grid auto-cols-[minmax(105px,1fr)] grid-flow-col gap-2 overflow-x-auto pb-1">
                  {faixasDesconto.map((faixa) => {
                    const alcançada = quantidadeDescontoGaleria >= faixa.quantidade;
                    const próxima = proximaFaixaGaleria?.quantidade === faixa.quantidade;
                    return <div key={faixa.quantidade} className={`flex min-h-32 flex-col items-center justify-center rounded-xl border px-2 py-3 text-center transition-colors ${alcançada ? "border-sky-300 bg-sky-400 text-slate-950" : próxima ? "border-sky-400/60 bg-sky-400/20 text-sky-200" : "border-sky-400/15 bg-sky-400/[0.08] text-sky-300"}`}>
                      <span className="text-[9px] font-bold uppercase tracking-widest">{alcançada ? "Liberado" : próxima ? "Próxima meta" : "Ganhe"}</span>
                      <strong className="mt-1 text-2xl font-black leading-none sm:text-3xl">{faixa.percentual}%</strong>
                      <span className="mt-2 text-[10px] font-medium">com {faixa.quantidade} fotos</span>
                    </div>;
                  })}
                </div>
              </div>
            </section>
          )}

          {!carregando && totalFotos > 0 && totalVideos > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#0a0a0e] p-1.5 sm:inline-grid sm:min-w-[360px]" role="tablist" aria-label="Tipo de mídia">
              {([
                { tipo: "fotos", rotulo: "Fotos", total: totalFotos, Icone: ImageIcon },
                { tipo: "videos", rotulo: "Vídeos", total: totalVideos, Icone: Video },
              ] as const).map(({ tipo, rotulo, total, Icone }) => (
                <button
                  key={tipo}
                  type="button"
                  role="tab"
                  aria-selected={tipoAtivo === tipo}
                  onClick={() => selecionarTipo(tipo)}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all ${tipoAtivo === tipo ? "bg-retratt text-black shadow-md shadow-orange-950/30" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <Icone size={15} /> {rotulo}
                  <span className={`rounded-md px-1.5 py-0.5 text-[9px] ${tipoAtivo === tipo ? "bg-black/20" : "bg-white/10"}`}>{total}</span>
                </button>
              ))}
            </div>
          )}

          {carregando ? (
            <div className="mt-12 flex flex-col items-center justify-center gap-4 opacity-50 py-20">
               <ImageIcon size={32} className="text-zinc-700 animate-pulse" />
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Processando galeria...</p>
            </div>
          ) : fotosFiltradas.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-white/10 bg-white/[0.01] p-16 text-center flex flex-col items-center justify-center">
              <Search size={24} className="text-zinc-800 mb-4" />
              <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest">{evento?.em_breve ? "As fotos estarão disponíveis em breve." : tipoAtivo === "videos" ? "Nenhum vídeo encontrado para este filtro." : "Nenhuma foto encontrada para este filtro."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl2:grid-cols-6 gap-2 md:gap-3">
              {fotosFiltradas.slice(0, limiteVisivel).map((foto) => {
                const noCarrinho = carrinho.includes(String(foto.id));
                const ehVideo = arquivoFotoEhVideo(foto);

                return (
                  <article
                    key={foto.id}
                    onClick={() => {
                      setFotoOrigemBusca(null);
                      setFotoSelecionada(foto);
                    }}
                    className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#111] border border-white/5 shadow-md cursor-pointer transition-all duration-300 hover:shadow-orange-950/20 hover:border-retratt/30"
                  >

                    {foto.r2_thumb_key || foto.r2_preview_key ? (
                      <img
                        data-foto-protegida-imagem
                        src={fotoThumbSrc(foto, acesso)}
                        alt={foto.titulo || "Foto do evento"}
                        className={`w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 ${noCarrinho ? 'opacity-40 grayscale-[60%]' : 'opacity-90'}`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700 bg-zinc-950">Retratt</div>
                    )}

                    <PreviewProtectionOverlay compact />

                    {ehVideo && (
                      <div className="absolute left-2 top-2 z-30 inline-flex items-center gap-1 rounded-full border border-retratt/40 bg-black/85 px-2 py-1 text-[7px] font-black uppercase tracking-widest text-white shadow-lg">
                        <Play size={9} className="fill-retratt text-retratt" /> Vídeo
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20"></div>

                    <div className="absolute top-2 right-2 pointer-events-none z-20 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <span className="bg-black/80 backdrop-blur-sm text-white text-[7px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border border-white/10 shadow-sm">
                        REF: {foto.id.toString().substring(0, 5)}
                      </span>
                    </div>

                    <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1.5 z-30 md:opacity-0 md:group-hover:opacity-100 md:group-hover:translate-y-0 md:translate-y-2 transition-all duration-300">
                      <p className="line-clamp-1 text-[9px] font-bold uppercase tracking-tight text-white truncate hidden md:block px-1 mb-1">{foto.titulo || "Foto do evento"}</p>

                      <div className="flex items-center justify-between gap-1.5 backdrop-blur-sm bg-black/60 rounded-xl p-1 border border-white/10 md:bg-white/95 md:text-black md:border-transparent">
                           <span className="text-[10px] md:text-[11px] font-black text-retratt md:text-black md:pl-2 pr-1">{evento?.permite_download_gratis ? "Grátis" : formatarPrecoFotos(foto.preco_centavos)}</span>
                           {evento?.permite_download_gratis ? <a href={`/api/fotos/evento/${eventoId}/download-gratuito/${foto.id}${acesso ? `?acesso=${encodeURIComponent(acesso)}` : ""}`} onClick={(e) => e.stopPropagation()} className="rounded-lg bg-emerald-500 px-3 py-2 text-[9px] font-black uppercase text-black">Baixar</a> : <button
                            onClick={(e) => toggleCarrinho(String(foto.id), e)}
                            className={`cursor-pointer px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all ${noCarrinho ? 'bg-green-500 text-white' : 'bg-retratt text-black hover:bg-retratt md:bg-black/90 md:text-white md:hover:bg-black'}`}
                          >
                            {noCarrinho ? <CheckCircle2 size={12}/> : "Carrinho"}
                           </button>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!carregando && (fotosFiltradas.length > limiteVisivel || haMaisNoBanco) && (
            <div className="mt-8 flex justify-center">
              <button type="button" onClick={() => void mostrarMais()} disabled={buscandoMais} className="rounded-xl border border-white/20 px-6 py-3 text-xs font-black uppercase text-white hover:border-retratt disabled:opacity-50">
                {buscandoMais ? "Carregando..." : "Mostrar mais fotos"}
              </button>
            </div>
          )}

          {!evento?.permite_download_gratis && carrinho.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-sm bg-[#16161e]/95 backdrop-blur-xl border border-retratt/30 p-2.5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(255,90,31,0.2)] flex items-center justify-between z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
              <div className="flex items-center gap-3 pl-2">
                <div className="w-10 h-10 bg-black/40 rounded-xl flex items-center justify-center border border-white/10 text-white shrink-0">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <p className="text-white text-[9px] font-black uppercase tracking-widest">{carrinho.length} {carrinho.length === 1 ? 'Foto' : 'Fotos'}</p>
                  <p className="text-retratt text-xs font-black mt-0.5">{formatarPrecoFotos(valorTotalCarrinho)}</p>
                </div>
              </div>
              <Link href="/fotos/carrinho" className="bg-retratt hover:bg-retratt text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-orange-950/20 hover:scale-105">
                Finalizar compra
              </Link>
            </div>
          )}

        </div>

        {/* MODAL DE FOTO */}
        {fotoSelecionada && (
          <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center md:p-4" onClick={fecharFotoSelecionada}>
            <div className="relative w-full max-w-7xl h-[100dvh] min-h-0 flex flex-col md:flex-row md:gap-4 md:h-full items-center justify-center" onClick={(e) => e.stopPropagation()}
              onTouchStart={(event) => { toqueInicialFoto.current = event.touches[0]?.clientX ?? null; }}
              onTouchEnd={(event) => {
                if (toqueInicialFoto.current === null) return;
                const distancia = event.changedTouches[0].clientX - toqueInicialFoto.current;
                if (Math.abs(distancia) > 50) navegarFoto(distancia < 0 ? 1 : -1);
                toqueInicialFoto.current = null;
              }}>

              <div className="w-full shrink-0 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))] text-white md:hidden"><p className="max-w-[55%] truncate text-sm font-bold">{fotoSelecionada.titulo || "Foto do evento"}</p><p className="text-[10px] text-zinc-400">{indiceFotoSelecionada + 1} de {fotosFiltradas.length}</p></div>
              {carrinho.length > 0 && <Link href="/fotos/carrinho" className="absolute right-16 top-[max(12px,env(safe-area-inset-top))] z-50 flex h-10 items-center gap-1 rounded-full border border-white/20 bg-black/75 px-3 text-[10px] font-bold text-white md:hidden" aria-label={`Ver carrinho com ${carrinho.length} itens`}><ShoppingCart size={15} /> {carrinho.length}</Link>}
              <button onClick={fecharFotoSelecionada} className="absolute top-[max(12px,env(safe-area-inset-top))] right-3 md:top-4 md:right-4 z-50 cursor-pointer text-white bg-black/70 hover:bg-black p-2.5 rounded-full backdrop-blur-sm border border-white/10 transition-colors" aria-label="Fechar foto">
                <X size={20} />
              </button>

              <div className="relative flex-1 min-h-0 md:h-full w-full flex items-center justify-center overflow-hidden bg-[#050505] md:rounded-3xl md:border md:border-white/5 md:shadow-2xl">
                {indiceFotoSelecionada > 0 && <button type="button" onClick={() => navegarFoto(-1)} aria-label="Foto anterior" className="absolute left-2 top-1/2 z-40 -translate-y-1/2 rounded-full bg-black/75 p-3 text-white hover:bg-retratt"><ChevronLeft size={22} /></button>}
                {indiceFotoSelecionada >= 0 && indiceFotoSelecionada < fotosFiltradas.length - 1 && <button type="button" onClick={() => navegarFoto(1)} aria-label="Próxima foto" className="absolute right-2 top-1/2 z-40 -translate-y-1/2 rounded-full bg-black/75 p-3 text-white hover:bg-retratt"><ChevronRight size={22} /></button>}
                {arquivoFotoEhVideo(fotoSelecionada) && fotoSelecionada.r2_thumb_key ? (
                  <video
                    data-foto-protegida-imagem
                    key={fotoSelecionada.id}
                    src={videoPreviewSrc(fotoSelecionada, acesso)}
                    poster={fotoPreviewSrc(fotoSelecionada, acesso)}
                    className="h-auto max-h-full w-auto max-w-full object-contain"
                    controls
                    autoPlay
                    muted
                    playsInline
                    preload="metadata"
                    controlsList="nodownload noplaybackrate"
                    disablePictureInPicture
                  >
                    Seu navegador não conseguiu reproduzir a amostra protegida.
                  </video>
                ) : (
                  <img
                    data-foto-protegida-imagem
                    src={fotoPreviewSrc(fotoSelecionada, acesso)}
                    alt={fotoSelecionada.titulo || "Foto do evento"}
                    className="w-auto h-auto max-w-full max-h-full object-contain select-none pointer-events-none"
                    loading="eager"
                  />
                )}

                <PreviewProtectionOverlay />

                {arquivoFotoEhVideo(fotoSelecionada) && !fotoSelecionada.r2_thumb_key && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center">
                    <div className="max-w-xs rounded-2xl border border-white/20 bg-black/75 px-5 py-4 text-center text-white shadow-2xl backdrop-blur-sm">
                      <Play size={26} className="mx-auto fill-white" />
                      <p className="mt-2 text-[9px] font-black uppercase tracking-widest">Prévia em vídeo indisponível</p>
                      <p className="mt-1 text-[9px] font-medium text-zinc-400">A imagem mostra um quadro do vídeo. O arquivo completo é entregue após a compra.</p>
                    </div>
                  </div>
                )}
              </div>

              {evento?.permite_download_gratis ? <div className="w-full border-t border-white/10 bg-[#0a0a0e] p-4 md:hidden"><a className="flex w-full justify-center rounded-xl bg-emerald-500 py-3 text-xs font-black uppercase text-black" href={`/api/fotos/evento/${eventoId}/download-gratuito/${fotoSelecionada.id}${acesso ? `?acesso=${encodeURIComponent(acesso)}` : ""}`}>Baixar original grátis</a></div> : <div className="w-full shrink-0 border-t border-white/10 bg-[#0a0a0e] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
                <div className="mb-2 flex items-center justify-between"><span className="truncate text-[10px] text-zinc-400">{dadosFotografo(fotoSelecionada)?.nome || "Fotógrafo Parceiro"}</span><strong className="text-lg text-retratt">{formatarPrecoFotos(fotoSelecionada.preco_centavos)}</strong></div>
                {carrinho.includes(String(fotoSelecionada.id)) ? <>
                  {!arquivoFotoEhVideo(fotoSelecionada) && <div className="mb-2"><ProgressoDesconto faixas={faixasDesconto} quantidade={fotosElegiveisNoCarrinho} /></div>}
                  <Link href="/fotos/carrinho" className="flex w-full items-center justify-center gap-2 rounded-xl bg-retratt py-3 text-xs font-black uppercase text-black"><ShoppingCart size={15} /> Ver carrinho · finalizar compra</Link>
                  <button type="button" onClick={(e) => toggleCarrinho(String(fotoSelecionada.id), e)} className="mt-2 w-full py-1 text-[11px] font-semibold text-zinc-400 underline underline-offset-4">Remover {arquivoFotoEhVideo(fotoSelecionada) ? "este vídeo" : "esta foto"}</button>
                </> : <button type="button" onClick={(e) => toggleCarrinho(String(fotoSelecionada.id), e)} className="w-full rounded-xl bg-retratt py-3 text-xs font-black uppercase text-black">Adicionar ao carrinho</button>}
              </div>}
              <div className="hidden w-full md:w-[340px] shrink-0 bg-[#0a0a0e] border border-white/5 rounded-3xl p-5 md:p-6 md:flex flex-col gap-5 shadow-2xl">

                {fotoOrigemBusca && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                    {fotoOrigemBusca === "ia" ? <ScanFace size={14} /> : <Search size={14} />}
                    Encontrada pela busca {fotoOrigemBusca === "ia" ? "facial" : "por número"}
                  </div>
                )}

                <div className="flex items-center gap-3.5">
                    <div className="relative w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-500 border border-retratt/30 shrink-0 overflow-hidden shadow-inner">
                        {arquivoFotoEhVideo(fotoSelecionada) ? <Video size={20}/> : <ImageIcon size={20}/>}
                        {(fotoSelecionada.r2_preview_key || fotoSelecionada.r2_thumb_key) && (
                          <img
                            data-foto-protegida-imagem
                            src={fotoPreviewSrc(fotoSelecionada, acesso)}
                            alt=""
                            onError={(event) => { event.currentTarget.style.display = "none"; }}
                            className="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
                          />
                        )}
                        {arquivoFotoEhVideo(fotoSelecionada) && (
                          <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/80">
                            <Play size={8} className="fill-retratt text-retratt" />
                          </span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white text-sm font-black uppercase tracking-tight truncate">{fotoSelecionada.titulo || "Foto do evento"}</h3>
                        <p className="text-zinc-500 text-[9px] uppercase tracking-widest mt-0.5">REF: {fotoSelecionada.id.toString().substring(0, 8)}</p>
                    </div>
                </div>

                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                <div className="flex flex-col gap-4">

                    <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-2xl p-3 transition-colors hover:bg-white/[0.04]">
                        <div className="relative w-9 h-9 rounded-full bg-retratt/10 flex items-center justify-center text-retratt shrink-0 border border-retratt/30 overflow-hidden">
                            <Camera size={16} />
                            {dadosFotografo(fotoSelecionada)?.foto_url && (
                              <img
                                src={dadosFotografo(fotoSelecionada)!.foto_url!}
                                alt={dadosFotografo(fotoSelecionada)?.nome || "Fotógrafo"}
                                onError={(event) => { event.currentTarget.style.display = "none"; }}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Lentes por</p>
                            <p className="text-[11px] font-black text-white uppercase tracking-wider truncate">
                                {dadosFotografo(fotoSelecionada)?.nome || "Fotógrafo Parceiro"}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-white/5 text-zinc-400 text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5">
                           <ShieldCheck size={12} className="text-emerald-500/70"/> Evento oficial
                        </span>
                        {evento && (
                           <span className="bg-white/5 text-zinc-400 text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5">
                              <CalendarDays size={12} className="text-retratt/70"/> {formatarData(evento.data_evento)}
                           </span>
                        )}
                    </div>
                </div>

                <div className="mt-auto flex flex-col gap-4">
                  {evento?.permite_download_gratis ? <a className="rounded-xl bg-emerald-500 px-4 py-4 text-center text-xs font-black uppercase text-black" href={`/api/fotos/evento/${eventoId}/download-gratuito/${fotoSelecionada.id}${acesso ? `?acesso=${encodeURIComponent(acesso)}` : ""}`}>Baixar original grátis</a> : <>
                  {carrinho.includes(String(fotoSelecionada.id)) && !arquivoFotoEhVideo(fotoSelecionada) && <ProgressoDesconto faixas={faixasDesconto} quantidade={fotosElegiveisNoCarrinho} />}
                  <div className="flex items-end justify-between bg-[#050505] p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Valor {arquivoFotoEhVideo(fotoSelecionada) ? "do vídeo" : "da foto"}</p>
                      <p className="text-3xl font-black text-retratt tracking-tight leading-none pr-1">{formatarPrecoFotos(fotoSelecionada.preco_centavos)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full">

                    {carrinho.includes(String(fotoSelecionada.id)) ? (
                       <button onClick={(e) => toggleCarrinho(String(fotoSelecionada.id), e)} className="w-full cursor-pointer py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                         <CheckCircle2 size={14}/> Na Sacola
                       </button>
                    ) : (
                      <button onClick={(e) => toggleCarrinho(String(fotoSelecionada.id), e)} className="w-full cursor-pointer py-3.5 rounded-xl bg-retratt hover:bg-retratt text-black text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(255,90,31,0.2)]">
                        <ShoppingCart size={14}/> Adicionar
                      </button>
                    )}

                    <Link
                      href="/fotos/carrinho"
                      onClick={(e) => {
                        if (!carrinho.includes(String(fotoSelecionada.id))) {
                          toggleCarrinho(String(fotoSelecionada.id));
                        }
                      }}
                      className="w-full cursor-pointer py-3.5 rounded-xl bg-retratt hover:bg-retratt text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(255,90,31,0.2)] text-center"
                    >
                      Finalizar
                    </Link>
                  </div>
                  </>}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      <div className="fixed inset-0 z-[9999] hidden items-center justify-center bg-white p-10 text-center text-black print:flex">
        <div>
          <p className="text-2xl font-black uppercase">Impressão desativada</p>
          <p className="mt-3 text-sm">Adquira a foto para baixar o arquivo original autorizado.</p>
        </div>
      </div>
    </FotosShell>
  );
}
