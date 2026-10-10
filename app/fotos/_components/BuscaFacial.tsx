"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/app/lib/supabase";
import { chaveLocalidade, type Localidade } from "@/app/lib/localidades";
import CameraSelfie from "./CameraSelfie";
import ProgressoDesconto from "./ProgressoDesconto";
import { faixasDoEvento } from "@/app/lib/fotos-descontos";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, ImagePlus, Loader2, Play, ScanFace, ShieldCheck, ShoppingCart, Download, X } from "lucide-react";

type ResultadoFace = {
  id: string;
  eventoId: string;
  titulo: string | null;
  precoCentavos: number;
  mimeType: string | null;
  fotografoId: string | null;
  similaridade: number;
  nivel: "forte" | "provavel" | "possivel";
  evento: { id: string; nome: string; data_evento: string | null; cidade: string | null; estado: string | null; permite_download_gratis: boolean; desconto_combo_qtd?: number | null; desconto_combo_percentual?: number | null; descontos_progressivos?: unknown } | null;
};

const MAX_BUSCA_BYTES = 300 * 1024;
const CARRINHO_FOTOS_KEY = "carrinho_fotos";

type BuscaFacialProps = {
  eventoId?: string;
  triggerLabel?: string;
  triggerClassName?: string;
};

function MarcaBuscaFacial({ ampliada = false }: { ampliada?: boolean }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 overflow-hidden ${ampliada ? "opacity-55" : "opacity-45"}`}>
      {Array.from({ length: 9 }, (_, indice) => (
        <span key={indice} className={`flex rotate-[-20deg] items-center justify-center whitespace-nowrap font-black uppercase tracking-widest text-white [text-shadow:0_1px_3px_#000,0_0_2px_#000] ${ampliada ? "text-xs sm:text-base" : "text-[7px] sm:text-[9px]"}`}>
          RETRATT
        </span>
      ))}
    </div>
  );
}

function canvasParaBlob(canvas: HTMLCanvasElement, qualidade: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Nao foi possivel preparar a selfie."))),
      "image/jpeg",
      qualidade,
    );
  });
}

async function prepararSelfie(file: File) {
  const bitmap = await createImageBitmap(file);
  const dimensoes = [1600, 1400, 1200, 1000, 800];
  const qualidades = [0.88, 0.78, 0.68, 0.58];
  let menor: Blob | null = null;

  for (const dimensao of dimensoes) {
    const escala = Math.min(1, dimensao / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Nao foi possivel preparar a selfie.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const qualidade of qualidades) {
      const blob = await canvasParaBlob(canvas, qualidade);
      if (!menor || blob.size < menor.size) menor = blob;
      if (blob.size <= MAX_BUSCA_BYTES) break;
    }
    if (menor && menor.size <= MAX_BUSCA_BYTES) break;
  }

  bitmap.close();
  if (!menor || menor.size > MAX_BUSCA_BYTES) throw new Error("A selfie ficou grande demais. Tente enquadrar apenas o rosto.");
  return menor;
}

export default function BuscaFacial({ eventoId, triggerLabel, triggerClassName }: BuscaFacialProps = {}) {
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [cidadeEvento, setCidadeEvento] = useState("");
  const [cidades, setCidades] = useState<{ cidade: string; estado: string }[]>([]);
  const [preview, setPreview] = useState("");
  const [cameraAberta, setCameraAberta] = useState(false);
  const cidadeSelect = useRef<HTMLSelectElement>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultados, setResultados] = useState<ResultadoFace[] | null>(null);
  const [fotosNoCarrinho, setFotosNoCarrinho] = useState<string[]>([]);
  const [midiasCarrinho, setMidiasCarrinho] = useState<{ id: string; evento_id: string; fotografo_id: string | null; mime_type: string | null }[]>([]);
  const [indiceAberto, setIndiceAberto] = useState<number | null>(null);
  const toqueInicial = useRef<number | null>(null);
  const previewsEmCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const inputGaleria = useRef<HTMLInputElement>(null);
  const inputCamera = useRef<HTMLInputElement>(null);
  const conteudoModal = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (indiceAberto === null || !resultados) return;
    const vizinhas = [-1, 1].map((delta) => resultados[indiceAberto + delta]).filter((foto): foto is ResultadoFace => Boolean(foto && !foto.mimeType?.startsWith("video/")));
    for (const foto of vizinhas) {
      if (previewsEmCache.current.has(foto.id)) continue;
      const imagem = new Image();
      imagem.src = `/api/fotos/arquivo/${foto.id}?tipo=preview`;
      previewsEmCache.current.set(foto.id, imagem);
    }
    for (const id of previewsEmCache.current.keys()) if (!vizinhas.some((foto) => foto.id === id)) previewsEmCache.current.delete(id);
  }, [indiceAberto, resultados]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    if (!aberto) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    conteudoModal.current?.scrollTo({ top: 0 });
    if (!eventoId) cidadeSelect.current?.focus();
    return () => { document.body.style.overflow = overflowAnterior; };
  }, [aberto, eventoId]);

  useEffect(() => {
    if (!aberto || eventoId) return;
    let ativo = true;
    void (async () => {
      const unicas = new Map<string, { cidade: string; estado: string }>();
      for (let inicio = 0; ativo; inicio += 1000) {
        const { data, error } = await supabase.from("foto_eventos").select("cidade, estado")
          .eq("status", "publicado").eq("acesso_por_link", false)
          .not("cidade", "is", null).order("id").range(inicio, inicio + 999);
        if (error || !data) break;
        for (const evento of data) {
          const cidade = String(evento.cidade || "").trim();
          const estado = String(evento.estado || "").trim().toUpperCase();
          if (cidade) unicas.set(chaveLocalidade(cidade, estado), { cidade, estado });
        }
        if (data.length < 1000) break;
      }
      if (ativo) setCidades([...unicas.values()].sort((a, b) => a.cidade.localeCompare(b.cidade, "pt-BR")));
      try {
        const resposta = await fetch("/api/localidades");
        if (resposta.ok) {
          const oficiais = await resposta.json() as Localidade[];
          const nomes = new Map(oficiais.map((item) => [chaveLocalidade(item.cidade, item.estado), item]));
          for (const [chave, localidade] of unicas) unicas.set(chave, nomes.get(chave) || localidade);
        }
      } catch { /* Cidades das galerias seguem disponíveis se o IBGE estiver indisponível. */ }
      if (ativo) setCidades([...unicas.values()].sort((a, b) => a.cidade.localeCompare(b.cidade, "pt-BR")));
    })();
    return () => { ativo = false; };
  }, [aberto, eventoId]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (cameraAberta) setCameraAberta(false);
        else if (indiceAberto !== null) setIndiceAberto(null);
        else { setCameraAberta(false); setAberto(false); }
      }
      if (indiceAberto !== null && event.key === "ArrowRight") setIndiceAberto((atual) => Math.min((resultados?.length || 1) - 1, (atual ?? 0) + 1));
      if (indiceAberto !== null && event.key === "ArrowLeft") setIndiceAberto((atual) => Math.max(0, (atual ?? 0) - 1));
    };
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto, cameraAberta, indiceAberto, resultados?.length]);

  useEffect(() => {
    if (!aberto || !fotosNoCarrinho.length) return;
    let ativo = true;
    void (async () => {
      const midias = [];
      for (let inicio = 0; inicio < fotosNoCarrinho.length; inicio += 100) {
        const { data } = await supabase.from("foto_arquivos")
          .select("id, evento_id, fotografo_id, mime_type")
          .in("id", fotosNoCarrinho.slice(inicio, inicio + 100)).eq("status", "publicada");
        midias.push(...(data || []));
      }
      if (ativo) setMidiasCarrinho(midias);
    })();
    return () => { ativo = false; };
  }, [aberto, fotosNoCarrinho]);

  function selecionar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) usarSelfie(file);
  }

  function usarSelfie(file: File) {
    if (preview) URL.revokeObjectURL(preview);
    setArquivo(file);
    setPreview(URL.createObjectURL(file));
    setResultados(null);
    setIndiceAberto(null);
    setErro("");
  }

  async function buscar() {
    if (!arquivo || (!eventoId && !cidadeEvento)) return;
    setBuscando(true);
    setErro("");
    setResultados(null);
    try {
      const selfie = await prepararSelfie(arquivo);
      const form = new FormData();
      form.append("imagem", selfie, "selfie-busca.jpg");
      if (eventoId) form.append("eventoId", eventoId);
      else form.append("cidade", cidadeEvento);
      const response = await fetch("/api/fotos/buscar-por-face", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nao foi possivel buscar suas fotos.");
      setResultados((data.resultados || []) as ResultadoFace[]);
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Nao foi possivel buscar suas fotos.");
    } finally {
      setBuscando(false);
    }
  }

  function abrirCamera() {
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      inputCamera.current?.click();
    } else if (typeof navigator.mediaDevices?.getUserMedia === "function") {
      setCameraAberta(true);
    } else {
      inputGaleria.current?.click();
    }
  }

  function abrirBusca() {
    try {
      const salvas = JSON.parse(localStorage.getItem(CARRINHO_FOTOS_KEY) || "[]");
      setFotosNoCarrinho(Array.isArray(salvas) ? salvas.map(String) : []);
    } catch {
      setFotosNoCarrinho([]);
    }
    setAberto(true);
  }

  function salvarCarrinho(ids: string[]) {
    const idsUnicos = Array.from(new Set(ids.map(String)));
    localStorage.setItem(CARRINHO_FOTOS_KEY, JSON.stringify(idsUnicos));
    setFotosNoCarrinho(idsUnicos);
    window.dispatchEvent(new CustomEvent("carrinho-fotos-atualizado", { detail: idsUnicos }));
  }

  function alternarFotoNoCarrinho(fotoId: string) {
    salvarCarrinho(
      fotosNoCarrinho.includes(fotoId)
        ? fotosNoCarrinho.filter((id) => id !== fotoId)
        : [...fotosNoCarrinho, fotoId],
    );
  }

  const idsResultados = resultados?.filter((foto) => !foto.evento?.permite_download_gratis).map((foto) => String(foto.id)) || [];
  const quantidadeSelecionada = idsResultados.filter((id) => fotosNoCarrinho.includes(id)).length;
  const todosResultadosSelecionados = idsResultados.length > 0 && quantidadeSelecionada === idsResultados.length;

  function quantidadeParaDesconto(foto: ResultadoFace) {
    const midias = new Map(midiasCarrinho.map((item) => [String(item.id), { eventoId: item.evento_id, fotografoId: item.fotografo_id, mimeType: item.mime_type }]));
    for (const item of resultados || []) midias.set(String(item.id), item);
    return fotosNoCarrinho.filter((id) => {
      const item = midias.get(id);
      return item?.eventoId === foto.eventoId && (item.fotografoId ?? null) === (foto.fotografoId ?? null) && !item.mimeType?.startsWith("video/");
    }).length;
  }
  const gruposDesconto = new Map<string, ResultadoFace>();
  for (const foto of resultados || []) {
    if (foto.evento && !foto.evento.permite_download_gratis && !foto.mimeType?.startsWith("video/") && faixasDoEvento(foto.evento).length && quantidadeParaDesconto(foto) > 0) {
      gruposDesconto.set(`${foto.eventoId}|${foto.fotografoId ?? ""}`, foto);
    }
  }

  function alternarTodosResultados() {
    const idsAtuais = new Set(fotosNoCarrinho);
    if (todosResultadosSelecionados) {
      idsResultados.forEach((id) => idsAtuais.delete(id));
    } else {
      idsResultados.forEach((id) => idsAtuais.add(id));
    }
    salvarCarrinho(Array.from(idsAtuais));
  }

  return (
    <>
      <button
        type="button"
        onClick={abrirBusca}
        className={triggerClassName || "flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-retratt px-6 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(255,90,31,0.3)] transition-all hover:bg-retratt md:h-14 md:text-[11px]"}
      >
        <ScanFace size={16} /> {triggerLabel || "Buscar por face"}
      </button>

      {aberto && typeof document !== "undefined" && createPortal(
        <div data-fotos-face-portal className="contents">
          <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/90 p-2 backdrop-blur-md sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Busca facial">
            <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#09090b] shadow-2xl sm:max-h-[calc(100dvh-2rem)] md:rounded-3xl">
            <div className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#09090b] px-4 py-3 md:px-5 md:py-4">
              <div>
                <p className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-retratt md:text-[9px]"><ScanFace size={13} /> Busca facial inteligente</p>
                <h2 className="mt-1 text-base font-black uppercase leading-tight sm:text-lg md:text-xl">Encontre todas as suas fotos</h2>
              </div>
              <button type="button" onClick={() => { setCameraAberta(false); setAberto(false); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-400 hover:bg-white hover:text-black" aria-label="Fechar"><X size={18} /></button>
            </div>

            <div ref={conteudoModal} className="grid flex-1 gap-4 overflow-y-auto p-3 md:grid-cols-[260px_minmax(0,1fr)] md:p-5">
              <div className="space-y-3">
                {!eventoId && <label className="block text-[10px] font-bold text-zinc-300">1. Selecione a cidade do evento
                  <select ref={cidadeSelect} value={cidadeEvento} onChange={(event) => setCidadeEvento(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-[#18181b] px-3 text-xs text-white">
                    <option value="">Selecione a cidade</option>
                    {cidades.map(({ cidade, estado }) => <option key={`${cidade}|${estado}`} value={`${cidade}|${estado}`}>{cidade}{estado ? ` / ${estado}` : ""}</option>)}
                  </select>
                </label>}
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                  {preview ? (
                    <img src={preview} alt="Selfie selecionada" className="h-[180px] w-full object-cover sm:h-[210px] md:h-[240px]" />
                  ) : (
                    <div className="flex h-[180px] flex-col items-center justify-center p-4 text-center text-zinc-500 sm:h-[210px] md:h-[240px]">
                      <ScanFace size={44} className="mb-3 text-retratt/60" />
                      <p className="text-[10px] font-black uppercase tracking-wider text-white">Use uma foto nítida e de frente</p>
                      <p className="mt-2 max-w-[230px] text-[10px] leading-4">Boa iluminação, sem óculos escuros e somente o seu rosto em destaque.</p>
                    </div>
                  )}
                </div>

                <input ref={inputCamera} type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={selecionar} className="hidden" />
                <input ref={inputGaleria} type="file" accept="image/jpeg,image/png,image/webp" onChange={selecionar} className="hidden" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={abrirCamera} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-retratt text-[8px] font-black uppercase tracking-wider hover:bg-retratt"><Camera size={14} /> Tirar selfie</button>
                  <button type="button" onClick={() => inputGaleria.current?.click()} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-[8px] font-black uppercase tracking-wider hover:bg-white/10"><ImagePlus size={14} /> Galeria</button>
                </div>

                <p className="flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-[10px] leading-4 text-zinc-300">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                  A imagem é usada somente para localizar suas fotos. A selfie não será armazenada.
                </p>

                <button type="button" onClick={() => void buscar()} disabled={!arquivo || (!eventoId && !cidadeEvento) || buscando} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-retratt text-[9px] font-black uppercase tracking-widest text-black disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
                  {buscando ? <><Loader2 size={17} className="animate-spin" /> Comparando rostos</> : <><ScanFace size={17} /> Encontrar minhas fotos</>}
                </button>
                <p className="flex items-start gap-2 text-[10px] leading-4 text-zinc-500"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" /> A busca inclui resultados fortes, prováveis e possíveis para reduzir a chance de alguma foto ficar de fora.</p>
              </div>

              <div className={`${!buscando && resultados === null && !erro ? "hidden md:block" : "block"} min-h-0`}>
                {erro && <div className="rounded-2xl border border-retratt/30 bg-retratt/10 p-4 text-sm text-red-200">{erro}</div>}
                {buscando && (
                  <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                    <Loader2 size={42} className="animate-spin text-retratt" />
                    <p className="mt-4 text-sm font-black uppercase tracking-wider">{eventoId ? "Procurando nesta galeria" : "Procurando na cidade selecionada"}</p>
                    <p className="mt-2 text-xs text-zinc-500">Isso costuma levar apenas alguns segundos.</p>
                  </div>
                )}
                {!buscando && resultados === null && !erro && (
                  <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center text-zinc-500">
                    <ScanFace size={42} className="mb-3" />
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-300">Os resultados aparecerão aqui</p>
                  </div>
                )}
                {!buscando && resultados?.length === 0 && (
                  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-6 text-center">
                    <ScanFace size={42} className="mb-3 text-zinc-600" />
                    <p className="text-sm font-black uppercase">Nenhuma correspondência encontrada</p>
                    <p className="mt-2 max-w-md text-xs leading-5 text-zinc-500">Tente outra selfie, preferencialmente de frente e bem iluminada. Novas fotos também podem estar em processamento.</p>
                  </div>
                )}
                {!buscando && resultados && resultados.length > 0 && (
                  <div>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-black uppercase"><CheckCircle2 size={17} className="text-emerald-400" /> {resultados.length} mídia(s) encontrada(s)</p>
                        <p className="mt-1 text-[10px] text-zinc-500">Ordenadas pela maior semelhança facial.</p>
                      </div>
                      {idsResultados.length > 0 && <button type="button" onClick={alternarTodosResultados} className={`rounded-xl border px-3 py-2 text-[8px] font-black uppercase tracking-wider transition-colors ${todosResultadosSelecionados ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"}`}>
                        {todosResultadosSelecionados ? "Desmarcar todas" : "Selecionar todas as pagas"}
                      </button>}
                    </div>
                    {gruposDesconto.size > 0 && <div className="mb-4 space-y-2">
                      {[...gruposDesconto].map(([chave, foto]) => <div key={chave}>
                        <p className="mb-1 text-[10px] font-bold text-zinc-300">{foto.evento?.nome}</p>
                        <ProgressoDesconto faixas={faixasDoEvento(foto.evento!)} quantidade={quantidadeParaDesconto(foto)} />
                      </div>)}
                    </div>}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {resultados.map((foto) => {
                        const fotoId = String(foto.id);
                        const gratuita = Boolean(foto.evento?.permite_download_gratis);
                        const noCarrinho = !gratuita && fotosNoCarrinho.includes(fotoId);
                        const ehVideo = Boolean(foto.mimeType?.startsWith("video/"));
                        return (
                          <article key={foto.id} className={`relative flex flex-col overflow-hidden rounded-xl border bg-black transition-colors ${noCarrinho ? "border-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.15)]" : "border-white/10 hover:border-retratt/50"}`}>
                            {!gratuita && <label className={`absolute right-2 top-2 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border backdrop-blur-md ${noCarrinho ? "border-emerald-300 bg-emerald-400 text-black" : "border-white/20 bg-black/70 text-white"}`}>
                              <input
                                type="checkbox"
                                checked={noCarrinho}
                                onChange={() => alternarFotoNoCarrinho(fotoId)}
                                className="h-5 w-5 cursor-pointer accent-emerald-500"
                                aria-label={`${noCarrinho ? "Remover" : "Adicionar"} ${foto.titulo || "foto"} ${noCarrinho ? "do" : "ao"} carrinho`}
                              />
                            </label>}
                            <button type="button" onClick={() => setIndiceAberto(resultados.indexOf(foto))} className="group block w-full flex-1 text-left">
                              <div className="relative aspect-[4/5] overflow-hidden bg-zinc-950">
                                <img data-foto-protegida-imagem src={`/api/fotos/arquivo/${foto.id}?tipo=thumb`} alt={foto.titulo || "Foto encontrada"} loading="lazy" className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${noCarrinho ? "opacity-70" : ""}`} />
                                <MarcaBuscaFacial />
                                {ehVideo && <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/80 px-2 py-1 text-[7px] font-black uppercase tracking-wider text-white"><Play size={9} className="fill-retratt text-retratt" /> Vídeo</span>}
                                <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider ${foto.nivel === "forte" ? "bg-emerald-400 text-black" : foto.nivel === "provavel" ? "bg-retratt text-black" : "bg-retratt text-black"}`}>{foto.nivel} · {foto.similaridade.toFixed(0)}%</span>
                              </div>
                              <div className="p-2.5">
                                <p className="line-clamp-2 text-[9px] font-black uppercase leading-4 text-white">{foto.evento?.nome || "Galeria Retratt"}</p>

                              </div>
                            </button>
                            {!gratuita && <button type="button" onClick={() => setIndiceAberto(resultados.indexOf(foto))} className="flex w-full items-center justify-center gap-1 border-t border-retratt/30 bg-retratt/15 px-2 py-3 text-[10px] font-black uppercase text-orange-300">Abrir {ehVideo ? "vídeo" : "foto"}</button>}
                            {gratuita && <a href={`/api/fotos/evento/${foto.eventoId}/download-gratuito/${foto.id}`} className="flex items-center justify-center gap-1 border-t border-emerald-400/20 bg-emerald-400/10 px-2 py-3 text-[10px] font-black text-emerald-300"><Download size={13} /> Baixar grátis</a>}
                          </article>
                        );
                      })}
                    </div>
                    {quantidadeSelecionada > 0 && (
                      <div className="sticky bottom-0 z-30 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/30 bg-[#101512]/95 p-3 shadow-2xl backdrop-blur-xl">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase text-white">{quantidadeSelecionada} {quantidadeSelecionada === 1 ? "foto selecionada" : "fotos selecionadas"}</p>
                          <p className="mt-0.5 text-[8px] uppercase tracking-wider text-emerald-300">Já adicionada{quantidadeSelecionada === 1 ? "" : "s"} ao carrinho</p>
                        </div>
                        <Link href="/fotos/carrinho" className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-[8px] font-black uppercase tracking-wider text-black hover:bg-emerald-300">
                          <ShoppingCart size={14} /> Concluir compra
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
          {cameraAberta && <CameraSelfie onCapture={(file) => { usarSelfie(file); setCameraAberta(false); }} onClose={() => setCameraAberta(false)} onUnavailable={() => { setCameraAberta(false); inputGaleria.current?.click(); }} />}
          {indiceAberto !== null && resultados?.[indiceAberto] && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-3" onClick={() => setIndiceAberto(null)} role="dialog" aria-modal="true" aria-label="Foto encontrada">
              <div className="relative flex h-full w-full max-w-5xl flex-col items-center justify-center gap-3 md:grid md:grid-rows-[minmax(0,1fr)_auto] md:pt-12" onClick={(event) => event.stopPropagation()}
                onTouchStart={(event) => { toqueInicial.current = event.touches[0]?.clientX ?? null; }}
                onTouchEnd={(event) => {
                  if (toqueInicial.current === null) return;
                  const distancia = event.changedTouches[0].clientX - toqueInicial.current;
                  if (Math.abs(distancia) > 50) setIndiceAberto((atual) => Math.max(0, Math.min(resultados.length - 1, (atual ?? 0) + (distancia < 0 ? 1 : -1))));
                  toqueInicial.current = null;
                }}>
                <button type="button" onClick={() => setIndiceAberto(null)} aria-label="Fechar foto" className="absolute right-0 top-0 z-20 rounded-full bg-zinc-900 p-3 text-white"><X size={20} /></button>
                <div className="flex min-h-0 flex-1 items-center justify-center pt-12 md:h-full md:w-full md:overflow-hidden md:pt-0">
                  {resultados[indiceAberto].mimeType?.startsWith("video/") ? (
                    <video key={resultados[indiceAberto].id} src={`/api/fotos/arquivo/${resultados[indiceAberto].id}?tipo=video-preview`} poster={`/api/fotos/arquivo/${resultados[indiceAberto].id}?tipo=thumb`} controls playsInline preload="metadata" className="max-h-full max-w-full" />
                  ) : (
                    <div className="relative inline-flex max-h-full max-w-full items-center justify-center overflow-hidden md:h-full md:w-full">
                      <img data-foto-protegida-imagem src={`/api/fotos/arquivo/${resultados[indiceAberto].id}?tipo=preview`} alt={resultados[indiceAberto].titulo || "Foto encontrada"} className="max-h-full max-w-full object-contain md:h-full md:w-full" />
                      <MarcaBuscaFacial ampliada />
                    </div>
                  )}
                </div>
                <div className="flex w-full items-center justify-between gap-3 pb-4">
                  <button type="button" onClick={() => setIndiceAberto((atual) => Math.max(0, (atual ?? 0) - 1))} disabled={indiceAberto === 0} aria-label="Foto anterior" className="rounded-full bg-zinc-800 p-3 text-white disabled:opacity-30"><ChevronLeft /></button>
                  <div className="min-w-0 flex-1 text-center text-xs text-white">
                    <p>{indiceAberto + 1} de {resultados.length} · {resultados[indiceAberto].evento?.nome || "Galeria Retratt"}</p>
                    {resultados[indiceAberto].evento && !resultados[indiceAberto].evento?.permite_download_gratis && !resultados[indiceAberto].mimeType?.startsWith("video/") && <div className="mx-auto mt-2 max-w-sm text-left"><ProgressoDesconto faixas={faixasDoEvento(resultados[indiceAberto].evento!)} quantidade={quantidadeParaDesconto(resultados[indiceAberto])} /></div>}
                    {resultados[indiceAberto].evento?.permite_download_gratis ? (
                      <a href={`/api/fotos/evento/${resultados[indiceAberto].eventoId}/download-gratuito/${resultados[indiceAberto].id}`} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 font-bold text-black"><Download size={16} /> Baixar original grátis</a>
                    ) : (
                      <div className="mt-2 flex flex-wrap justify-center gap-2">
                        <button type="button" onClick={() => alternarFotoNoCarrinho(String(resultados[indiceAberto].id))} className="rounded-lg border border-white/20 px-3 py-2 font-bold text-white">
                          {fotosNoCarrinho.includes(String(resultados[indiceAberto].id)) ? "Remover do carrinho" : "Adicionar ao carrinho"}
                        </button>
                        <Link href="/fotos/carrinho" onClick={() => salvarCarrinho([...fotosNoCarrinho, String(resultados[indiceAberto].id)])} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 font-bold text-black"><ShoppingCart size={15} /> Concluir compra</Link>
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setIndiceAberto((atual) => Math.min(resultados.length - 1, (atual ?? 0) + 1))} disabled={indiceAberto === resultados.length - 1} aria-label="Próxima foto" className="rounded-full bg-zinc-800 p-3 text-white disabled:opacity-30"><ChevronRight /></button>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
