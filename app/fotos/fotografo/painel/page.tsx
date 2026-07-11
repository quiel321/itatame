"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { supabase } from "@/app/lib/supabase";
import { FotoAlbum, FotoEvento, formatarPrecoFotos } from "@/app/lib/fotos";
import FotosShell from "../../_components/FotosShell";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  CloudUpload,
  FolderPlus,
  ImagePlus,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";

type UploadStatus = "idle" | "preparando" | "enviando" | "confirmando" | "ok" | "erro";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const MAX_UPLOAD_FILES = 80;
const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);

function formatarTamanho(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2).replace(".", ",")} MB`;
}

async function otimizarFotoParaUpload(file: File) {
  if (file.size <= MAX_UPLOAD_BYTES) {
    return { file, otimizada: false };
  }

  const nomeBase = file.name.replace(/\.[^/.]+$/, "") || "foto";
  const criarArquivoJpeg = (blob: Blob) =>
    new File([blob], `${nomeBase}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });

  let comprimida = criarArquivoJpeg(await imageCompression(file, {
    maxSizeMB: 4.8,
    maxWidthOrHeight: 6000,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.92,
  }));

  if (comprimida.size > MAX_UPLOAD_BYTES) {
    comprimida = criarArquivoJpeg(await imageCompression(comprimida, {
      maxSizeMB: 4.7,
      maxWidthOrHeight: 4500,
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.9,
    }));
  }

  if (comprimida.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} não conseguiu ficar abaixo de 5 MB sem perda excessiva.`);
  }

  return { file: comprimida, otimizada: true };
}

async function gerarPreviewComMarcaDagua(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1200;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar preview.");

  ctx.drawImage(bitmap, 0, 0, width, height);
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.max(22, Math.round(width / 18))}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 7);
  const passoX = Math.max(260, width / 2.2);
  const passoY = Math.max(150, height / 4.5);
  for (let y = -height; y <= height; y += passoY) {
    for (let x = -width; x <= width; x += passoX) {
      ctx.fillText("iTATAME FOTOS", x, y);
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = "rgba(0,0,0,0.66)";
  ctx.fillRect(0, height - 58, width, 58);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.max(18, Math.round(width / 32))}px Arial`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("iTATAME FOTOS - PRÉVIA PROTEGIDA", 22, height - 29);
  ctx.restore();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar preview."))), "image/jpeg", 0.82);
  });
}

export default function PainelFotografoPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [eventos, setEventos] = useState<FotoEvento[]>([]);
  const [albuns, setAlbuns] = useState<FotoAlbum[]>([]);
  const [eventoId, setEventoId] = useState("");
  const [albumId, setAlbumId] = useState("");
  const [novoAlbum, setNovoAlbum] = useState("Geral");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [preco, setPreco] = useState("15,00");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [otimizando, setOtimizando] = useState(false);
  const [uploadAtual, setUploadAtual] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function precoCentavos() {
    const normalizado = preco.replace(/\./g, "").replace(",", ".");
    const valor = Number(normalizado);
    return Number.isFinite(valor) ? Math.max(0, Math.round(valor * 100)) : 1500;
  }

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data: auth } = await supabase.auth.getUser();
      setEmail(auth.user?.email || null);
      if (!auth.user) {
        router.replace("/fotos/login?perfil=fotografo&next=/fotos/fotografo/painel");
        setCarregando(false);
        return;
      }

      const { data } = await supabase
        .from("foto_eventos")
        .select("id, nome, slug, local, cidade, estado, data_evento, capa_url, status")
        .eq("status", "publicado")
        .order("data_evento", { ascending: false });

      const lista = (data || []) as FotoEvento[];
      setEventos(lista);
      if (lista[0]?.id) setEventoId(lista[0].id);
      setCarregando(false);
    }

    void carregar();
  }, [router]);

  useEffect(() => {
    async function carregarAlbuns() {
      if (!eventoId) {
        setAlbuns([]);
        setAlbumId("");
        return;
      }

      const { data } = await supabase
        .from("foto_albuns")
        .select("id, evento_id, fotografo_id, titulo, descricao, capa_url, status")
        .eq("evento_id", eventoId)
        .order("ordem", { ascending: true });

      const lista = (data || []) as FotoAlbum[];
      setAlbuns(lista);
      setAlbumId(lista[0]?.id || "");
    }

    void carregarAlbuns();
  }, [eventoId]);

  const eventoSelecionado = useMemo(() => eventos.find((evento) => evento.id === eventoId), [eventos, eventoId]);
  const valorAtual = formatarPrecoFotos(precoCentavos());
  const enviando = ["preparando", "enviando", "confirmando"].includes(status);
  const uploadBloqueado = arquivos.length === 0 || !eventoId || !albumId || enviando || otimizando;
  const totalBytes = arquivos.reduce((total, arquivo) => total + arquivo.size, 0);

  async function selecionarArquivos(lista: FileList | null) {
    if (!lista) return;
    const recebidos = Array.from(lista);
    const lote = recebidos.slice(0, MAX_UPLOAD_FILES);
    const aceitos: File[] = [];
    let otimizadas = 0;
    let recusados = recebidos.length - lote.length;

    setOtimizando(true);
    setStatus("idle");
    setUploadAtual(0);
    setMensagem(`Otimizando ${lote.length} foto(s) antes do envio...`);

    for (const arquivo of lote) {
      if (!TIPOS_PERMITIDOS.has(arquivo.type) || arquivo.size > MAX_SOURCE_BYTES) {
        recusados += 1;
        continue;
      }

      try {
        const resultado = await otimizarFotoParaUpload(arquivo);
        aceitos.push(resultado.file);
        if (resultado.otimizada) otimizadas += 1;
      } catch {
        recusados += 1;
      }
    }

    setArquivos(aceitos);
    setStatus("idle");
    setUploadAtual(0);
    setOtimizando(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (recusados > 0) {
      setMensagem(`${aceitos.length} foto(s) pronta(s). ${otimizadas} foram otimizadas automaticamente e ${recusados} ficaram fora por formato inválido, arquivo muito pesado ou lote acima de ${MAX_UPLOAD_FILES} fotos.`);
    } else if (otimizadas > 0) {
      setMensagem(`${aceitos.length} foto(s) pronta(s). ${otimizadas} foram otimizadas automaticamente para até 5MB.`);
    } else {
      setMensagem(`${aceitos.length} foto(s) pronta(s) para envio.`);
    }
  }

  function removerArquivo(nome: string, index: number) {
    setArquivos((atuais) => atuais.filter((arquivo, arquivoIndex) => arquivo.name !== nome || arquivoIndex !== index));
  }

  async function criarAlbum() {
    if (!eventoId || !novoAlbum.trim()) return;
    setMensagem("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMensagem("Sua sessão expirou. Faça login novamente.");
      return;
    }

    const response = await fetch("/api/fotos/criar-album", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventoId, titulo: novoAlbum.trim() }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMensagem(payload.error || "Não foi possível criar álbum.");
      return;
    }

    const album = payload.album as FotoAlbum;
    setAlbuns((atual) => [...atual, album]);
    setAlbumId(album.id);
    setNovoAlbum("Geral");
  }

  async function enviarUmaFoto(arquivo: File, token: string) {
    const uploadResponse = await fetch("/api/fotos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        eventoId,
        albumId,
        fileName: arquivo.name,
        contentType: arquivo.type,
        size: arquivo.size,
        titulo: arquivo.name.replace(/\.[^.]+$/, ""),
        precoCentavos: precoCentavos(),
      }),
    });

    const uploadData = await uploadResponse.json();
    if (!uploadResponse.ok) throw new Error(uploadData.error || "Erro ao preparar os links de upload.");

    const previewBlob = await gerarPreviewComMarcaDagua(arquivo);
    const previewResponse = await fetch(uploadData.previewUploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: previewBlob,
    });
    if (!previewResponse.ok) throw new Error("Falha ao enviar a prévia para a nuvem (CORS/R2).");

    const putResponse = await fetch(uploadData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": arquivo.type },
      body: arquivo,
    });
    if (!putResponse.ok) throw new Error("Falha ao enviar a foto original para a nuvem (CORS/R2).");

    const confirmarResponse = await fetch("/api/fotos/confirmar-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fotoId: uploadData.fotoId }),
    });
    const confirmarData = await confirmarResponse.json();
    if (!confirmarResponse.ok) throw new Error(confirmarData.error || "Upload feito, mas não confirmado no banco.");
  }

  async function enviarFotos() {
    if (!arquivos.length || !eventoId || !albumId) {
      setMensagem("Selecione o evento, o álbum e pelo menos uma foto antes de enviar.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMensagem("Sua sessão expirou. Faça login novamente.");
      return;
    }

    try {
      setMensagem("");
      for (let index = 0; index < arquivos.length; index++) {
        setUploadAtual(index + 1);
        setStatus("preparando");
        setMensagem(`Preparando ${index + 1}/${arquivos.length}: ${arquivos[index].name}`);
        setStatus("enviando");
        await enviarUmaFoto(arquivos[index], token);
        setStatus("confirmando");
      }

      setArquivos([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus("ok");
      setMensagem("Todas as fotos foram publicadas com sucesso.");
    } catch (error: any) {
      setStatus("erro");
      setMensagem(error?.message || "Erro desconhecido ao enviar fotos.");
    }
  }

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] pb-12 text-white">
        <section className="border-b border-white/10 bg-[radial-gradient(circle_at_85%_0%,rgba(6,182,212,0.16),transparent_32%),linear-gradient(180deg,#0c0c0f,#050505)]">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
                  <Camera size={13} /> Área do fotógrafo
                </p>
                <h1 className="mt-4 text-3xl font-black uppercase leading-none md:text-5xl">Carregar fotos</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                  Publique várias fotos por evento e álbum. Fotos acima de 5MB são otimizadas automaticamente antes do envio.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/fotos/fotografo/dashboard" className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-white/10 px-4 text-[10px] font-black uppercase tracking-wider text-zinc-300 hover:bg-white hover:text-black">
                  Dashboard
                </Link>
                <Link href="/fotos" className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-white/10 px-4 text-[10px] font-black uppercase tracking-wider text-zinc-300 hover:bg-white hover:text-black">
                  Ver loja
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-black/50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Conta</p>
                <p className="mt-1 truncate text-sm font-bold text-white">{email || "Entrar para enviar"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Eventos liberados</p>
                <p className="mt-1 text-2xl font-black text-cyan-300">{eventos.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Selecionadas</p>
                <p className="mt-1 text-2xl font-black text-white">{arquivos.length}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-emerald-300"><Wallet size={14} /> Valor por foto</p>
                <p className="mt-1 text-2xl font-black text-emerald-300">{valorAtual}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 md:grid-cols-[360px_1fr] md:px-6 md:py-6">
          {!email && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-100 md:col-span-2">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-amber-400" size={18} />
                <div>
                  <p className="font-bold">Faça login para enviar fotos.</p>
                  <p className="mt-1 text-xs text-amber-100/75">Você pode navegar pelo painel, mas o upload exige uma sessão ativa.</p>
                  <Link href="/fotos/login?perfil=fotografo&next=/fotos/fotografo/dashboard" className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-wider text-white">
                    Entrar agora <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {!eventoSelecionado && !carregando && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-100 md:col-span-2">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-amber-400" size={18} />
                <div>
                  <p className="font-bold">Nenhum evento ativo encontrado.</p>
                  <p className="mt-1 text-xs text-amber-100/75">Peça para a organização liberar uma galeria antes de enviar fotos.</p>
                </div>
              </div>
            </div>
          )}

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
              <div className="mb-4 flex items-center gap-2">
                <FolderPlus size={18} className="text-cyan-300" />
                <h2 className="text-sm font-black uppercase tracking-wider">Publicação</h2>
              </div>

              <label className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Evento</label>
              <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className="mt-2 h-11 w-full cursor-pointer rounded-lg border border-white/10 bg-black px-3 text-xs font-bold outline-none focus:border-cyan-400">
                <option value="">Selecione o evento</option>
                {eventos.map((evento) => <option key={evento.id} value={evento.id}>{evento.nome}</option>)}
              </select>

              <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Álbum</label>
              <select value={albumId} onChange={(e) => setAlbumId(e.target.value)} className="mt-2 h-11 w-full cursor-pointer rounded-lg border border-white/10 bg-black px-3 text-xs font-bold outline-none focus:border-cyan-400">
                <option value="">Selecione o álbum</option>
                {albuns.map((album) => <option key={album.id} value={album.id}>{album.titulo}</option>)}
              </select>

              <div className="mt-4 rounded-xl border border-white/10 bg-black p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Criar álbum rápido</p>
                <div className="mt-2 flex gap-2">
                  <input value={novoAlbum} onChange={(e) => setNovoAlbum(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3 text-xs outline-none focus:border-cyan-400" placeholder="Ex: Pódio, Tatame 1" />
                  <button type="button" onClick={criarAlbum} disabled={!eventoId || !novoAlbum.trim()} className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40" aria-label="Criar álbum">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white"><ShieldCheck size={16} className="text-emerald-400" /> Regras do envio</p>
              <div className="mt-3 space-y-2 text-xs text-zinc-400">
                <p>1. Fotos grandes são comprimidas automaticamente até 5MB.</p>
                <p>2. JPG, PNG ou WebP, com qualidade alta para venda.</p>
                <p>3. A versão otimizada fica privada no Cloudflare R2.</p>
                <p>4. A loja mostra apenas a prévia com marca d'água.</p>
              </div>
            </div>
          </aside>

          <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black uppercase">Enviar fotos</h2>
                <p className="mt-1 text-xs text-zinc-500">Selecione várias fotos de uma vez. Arquivos grandes serão otimizados antes do upload.</p>
              </div>
              {eventoSelecionado && <p className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-200">{eventoSelecionado.nome}</p>}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_250px]">
              <div className="relative flex min-h-[250px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-black p-5 text-center transition hover:border-cyan-400/60 hover:bg-cyan-500/5">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => void selecionarArquivos(e.target.files)} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-zinc-500"><CloudUpload size={30} /></div>
                <p className="text-sm font-black uppercase tracking-wider text-white">Clique ou arraste as fotos</p>
                <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-500">O sistema aceita lote com várias imagens e gera prévia protegida automaticamente.</p>
                <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-cyan-300">JPG, PNG ou WebP · otimização automática até 5MB</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black p-4">
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Preço de venda</label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">R$</span>
                  <input value={preco} onChange={(e) => setPreco(e.target.value)} className="h-12 w-full rounded-lg border border-white/10 bg-zinc-950 pl-9 pr-3 text-lg font-black outline-none focus:border-cyan-400" />
                </div>
                <p className="mt-2 text-xs text-zinc-500">Valor atual: <span className="font-bold text-emerald-300">{valorAtual}</span></p>
                <p className="mt-3 text-xs text-zinc-500">Lote: <span className="font-bold text-white">{arquivos.length}</span> foto(s) · {formatarTamanho(totalBytes)}</p>

                <button type="button" onClick={enviarFotos} disabled={uploadBloqueado} className="mt-4 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-cyan-400 text-xs font-black uppercase tracking-wider text-black shadow-[0_0_24px_rgba(34,211,238,0.18)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
                  {otimizando ? <><Loader2 size={16} className="animate-spin" /> Otimizando fotos</> : enviando ? <><Loader2 size={16} className="animate-spin" /> Enviando {uploadAtual}/{arquivos.length}</> : <>Enviar lote</>}
                </button>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[9px] font-black uppercase tracking-wider text-zinc-500">
                  <span className={status === "preparando" ? "text-cyan-300" : ""}>Preview</span>
                  <span className={status === "enviando" ? "text-cyan-300" : ""}>R2</span>
                  <span className={status === "confirmando" ? "text-cyan-300" : status === "ok" ? "text-emerald-300" : ""}>Banco</span>
                </div>
              </div>
            </div>

            {arquivos.length > 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Fotos selecionadas</p>
                  <button type="button" onClick={() => setArquivos([])} className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-red-400 hover:text-red-300">Limpar</button>
                </div>
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {arquivos.map((arquivo, index) => (
                    <div key={`${arquivo.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2">
                      <div className="min-w-0 flex items-center gap-3">
                        <ImagePlus size={16} className="shrink-0 text-cyan-300" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-white">{arquivo.name}</p>
                          <p className="text-[10px] text-zinc-500">{formatarTamanho(arquivo.size)}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => removerArquivo(arquivo.name, index)} className="cursor-pointer rounded-lg border border-white/10 p-2 text-zinc-500 hover:border-red-500/40 hover:text-red-300" aria-label="Remover foto">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mensagem && (
              <div className={`mt-4 flex items-start gap-3 rounded-xl border p-4 text-xs font-bold ${status === "erro" ? "border-red-500/30 bg-red-500/10 text-red-200" : status === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"}`}>
                {status === "erro" ? <AlertTriangle size={18} /> : status === "ok" ? <CheckCircle2 size={18} /> : enviando ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                <span>{mensagem}</span>
              </div>
            )}
          </div>
        </section>
      </main>
    </FotosShell>
  );
}
