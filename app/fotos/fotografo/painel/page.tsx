"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { FOTO_IA_MAX_BYTES, FOTO_IA_MAX_DIMENSAO } from "@/app/lib/fotos-ai";
import { supabase } from "@/app/lib/supabase";
import { FotoAlbum, FotoEvento, formatarPrecoFotos } from "@/app/lib/fotos";
import {
  formatarDuracaoVideo,
  VIDEO_IA_FRAME_COUNT,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_SECONDS,
  VIDEO_PREVIEW_DURATION_SECONDS,
  VIDEO_PREVIEW_MAX_BYTES,
} from "@/app/lib/fotos-video";
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
  Video,
  Wallet,
} from "lucide-react";

type UploadStatus = "idle" | "preparando" | "enviando" | "confirmando" | "ok" | "erro";

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 🔥 Limite alterado para 3MB
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const MAX_UPLOAD_FILES = 500;
const TIPOS_FOTO = new Set(["image/jpeg", "image/png", "image/webp"]);
const TIPOS_VIDEO = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function arquivoEhVideo(arquivo: File) {
  return TIPOS_VIDEO.has(arquivo.type);
}

async function lerDuracaoVideo(file: File) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = url;
  try {
    return await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => Number.isFinite(video.duration) && video.duration > 0
        ? resolve(video.duration)
        : reject(new Error(`Não foi possível medir a duração de ${file.name}.`));
      video.onerror = () => reject(new Error(`Não foi possível ler o vídeo ${file.name}.`));
    });
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

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

  // 1ª Tentativa: Mantém resolução altíssima (4500px) e qualidade 90%
  let comprimida = criarArquivoJpeg(await imageCompression(file, {
    maxSizeMB: 2.9,
    maxWidthOrHeight: 4500,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.90,
  }));

  // 2ª Tentativa (Garantia): Se a foto tiver muitos detalhes e ainda não bateu 3MB, reduz levemente
  if (comprimida.size > MAX_UPLOAD_BYTES) {
    comprimida = criarArquivoJpeg(await imageCompression(comprimida, {
      maxSizeMB: 2.8,
      maxWidthOrHeight: 3500, // 3500px ainda imprime um A4 perfeito
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.85,
    }));
  }

  if (comprimida.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} não conseguiu ficar abaixo de 3 MB sem perda excessiva.`);
  }

  return { file: comprimida, otimizada: true };
}

function canvasParaJpeg(canvas: HTMLCanvasElement, qualidade: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem."))),
      "image/jpeg",
      qualidade,
    );
  });
}

async function gerarDerivadosFoto(file: File) {
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
  desenharProtecaoRetratt(ctx, width, height);

  const previewBlob = await canvasParaJpeg(canvas, 0.82);

  const dimensoes = [FOTO_IA_MAX_DIMENSAO, 1760, 1600, 1440, 1280, 1120, 960];
  const qualidades = [0.86, 0.78, 0.7, 0.62, 0.54];
  let miniaturaIa: Blob | null = null;

  for (const dimensao of dimensoes) {
    const escalaIa = Math.min(1, dimensao / Math.max(bitmap.width, bitmap.height));
    const canvasIa = document.createElement("canvas");
    canvasIa.width = Math.max(1, Math.round(bitmap.width * escalaIa));
    canvasIa.height = Math.max(1, Math.round(bitmap.height * escalaIa));
    const ctxIa = canvasIa.getContext("2d");
    if (!ctxIa) throw new Error("Não foi possível gerar a miniatura de busca.");
    ctxIa.drawImage(bitmap, 0, 0, canvasIa.width, canvasIa.height);

    for (const qualidade of qualidades) {
      const tentativa = await canvasParaJpeg(canvasIa, qualidade);
      if (!miniaturaIa || tentativa.size < miniaturaIa.size) miniaturaIa = tentativa;
      if (tentativa.size <= FOTO_IA_MAX_BYTES) break;
    }
    if (miniaturaIa && miniaturaIa.size <= FOTO_IA_MAX_BYTES) break;
  }

  bitmap.close();
  if (!miniaturaIa || miniaturaIa.size > FOTO_IA_MAX_BYTES) {
    throw new Error("Não foi possível preparar a miniatura de reconhecimento abaixo de 300 KB.");
  }

  return { previewBlob, miniaturaIa };
}

function posicionarVideo(video: HTMLVideoElement, tempo: number) {
  return new Promise<void>((resolve, reject) => {
    const destino = Math.min(Math.max(0, tempo), Math.max(0, video.duration - 0.05));
    if (Math.abs(video.currentTime - destino) < 0.04) {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => reject(new Error("O vídeo demorou demais para preparar a prévia.")), 8000);
    video.onseeked = () => {
      window.clearTimeout(timeout);
      video.onseeked = null;
      resolve();
    };
    video.currentTime = destino;
  });
}

function desenharVideoPreenchido(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const escala = Math.max(width / video.videoWidth, height / video.videoHeight);
  const largura = video.videoWidth * escala;
  const altura = video.videoHeight * escala;
  ctx.drawImage(video, x + (width - largura) / 2, y + (height - altura) / 2, largura, altura);
}

function escolherTipoPreviewVideo() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["video/webm;codecs=vp8", "video/webm", "video/mp4"]
    .find((tipo) => MediaRecorder.isTypeSupported(tipo)) || "";
}

async function gerarMiniaturaIaVideo(video: HTMLVideoElement) {
  const colunas = 2;
  const linhas = Math.ceil(VIDEO_IA_FRAME_COUNT / colunas);
  const larguraQuadro = 480;
  const alturaQuadro = 270;
  const canvas = document.createElement("canvas");
  canvas.width = larguraQuadro * colunas;
  canvas.height = alturaQuadro * linhas;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar os quadros da busca facial.");

  for (let index = 0; index < VIDEO_IA_FRAME_COUNT; index += 1) {
    const proporcao = (index + 1) / (VIDEO_IA_FRAME_COUNT + 1);
    await posicionarVideo(video, video.duration * proporcao);
    const x = (index % colunas) * larguraQuadro;
    const y = Math.floor(index / colunas) * alturaQuadro;
    desenharVideoPreenchido(ctx, video, x, y, larguraQuadro, alturaQuadro);
  }

  let menor: Blob | null = null;
  for (const qualidade of [0.82, 0.72, 0.62, 0.52, 0.42, 0.32]) {
    const tentativa = await canvasParaJpeg(canvas, qualidade);
    if (!menor || tentativa.size < menor.size) menor = tentativa;
    if (tentativa.size <= FOTO_IA_MAX_BYTES) return tentativa;
  }
  if (!menor || menor.size > FOTO_IA_MAX_BYTES) {
    throw new Error("Não foi possível preparar os quadros do vídeo abaixo de 300 KB.");
  }
  return menor;
}

async function gerarAmostraProtegidaVideo(video: HTMLVideoElement) {
  const contentType = escolherTipoPreviewVideo();
  if (!contentType || typeof MediaRecorder === "undefined") return null;

  const maxWidth = 960;
  const escala = Math.min(1, maxWidth / Math.max(1, video.videoWidth));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * escala));
  canvas.height = Math.max(1, Math.round(video.videoHeight * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof canvas.captureStream !== "function") return null;

  const protecao = document.createElement("canvas");
  protecao.width = canvas.width;
  protecao.height = canvas.height;
  const ctxProtecao = protecao.getContext("2d");
  if (!ctxProtecao) return null;
  desenharProtecaoRetratt(ctxProtecao, protecao.width, protecao.height);

  const duracaoAmostra = Math.min(VIDEO_PREVIEW_DURATION_SECONDS, video.duration);
  const inicio = video.duration > duracaoAmostra
    ? Math.min(video.duration * 0.1, video.duration - duracaoAmostra)
    : 0;
  await posicionarVideo(video, inicio);

  const stream = canvas.captureStream(24);
  const videoComCaptura = video as HTMLVideoElement & {
    captureStream?: () => MediaStream;
    webkitCaptureStream?: () => MediaStream;
  };
  const streamDeAudio = videoComCaptura.captureStream?.() || videoComCaptura.webkitCaptureStream?.() || null;
  streamDeAudio?.getAudioTracks().forEach((track) => stream.addTrack(track));
  const recorder = new MediaRecorder(stream, { mimeType: contentType, videoBitsPerSecond: 1_600_000 });
  const partes: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) partes.push(event.data);
  };

  let frame = 0;
  const desenhar = () => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(protecao, 0, 0);
    frame = window.requestAnimationFrame(desenhar);
  };

  const finalizado = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("Não foi possível gerar a amostra protegida do vídeo."));
  });

  try {
    recorder.start(500);
    desenhar();
    await video.play();
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, duracaoAmostra * 1000);
      video.onended = () => {
        window.clearTimeout(timeout);
        resolve();
      };
    });
    video.pause();
    recorder.stop();
    await finalizado;
  } finally {
    video.pause();
    if (frame) window.cancelAnimationFrame(frame);
    stream.getTracks().forEach((track) => track.stop());
    streamDeAudio?.getTracks().forEach((track) => track.stop());
  }

  const blob = new Blob(partes, { type: recorder.mimeType || contentType });
  if (!blob.size || blob.size > VIDEO_PREVIEW_MAX_BYTES) {
    throw new Error("A amostra protegida do vídeo ficou grande demais. Tente um vídeo menor.");
  }
  return blob;
}

async function gerarDerivadosVideo(file: File) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error(`Não foi possível ler o vídeo ${file.name}.`));
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error(`Não foi possível medir a duração de ${file.name}.`);
    if (video.duration > VIDEO_MAX_DURATION_SECONDS) throw new Error(`${file.name} ultrapassa o limite de 2 minutos.`);

    const miniaturaIa = await gerarMiniaturaIaVideo(video);
    await posicionarVideo(video, Math.min(1, video.duration * 0.1));

    const maxWidth = 1200;
    const escala = Math.min(1, maxWidth / Math.max(1, video.videoWidth));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * escala));
    canvas.height = Math.max(1, Math.round(video.videoHeight * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível criar a miniatura do vídeo.");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    desenharProtecaoRetratt(ctx, canvas.width, canvas.height);
    const previewBlob = await canvasParaJpeg(canvas, 0.82);
    const previewVideoBlob = await gerarAmostraProtegidaVideo(video);
    return {
      duracaoSegundos: video.duration,
      miniaturaIa,
      previewBlob,
      previewVideoBlob,
      previewVideoContentType: previewVideoBlob?.type || "",
    };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

function enviarDiretoAoR2(url: string, arquivo: Blob, onProgress: (percentual: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", arquivo.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("A conexão com o armazenamento foi interrompida durante o envio do vídeo."));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(`O armazenamento recusou o vídeo (${xhr.status}).`));
    xhr.send(arquivo);
  });
}

function desenharProtecaoRetratt(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const passo = Math.max(58, Math.round(width / 13));
  const segmento = Math.max(26, Math.round(passo * 0.62));
  ctx.save();
  ctx.lineWidth = Math.max(1.25, width / 750);
  for (let y = -passo; y < height + passo; y += passo) {
    for (let x = -passo; x < width + passo; x += passo) {
      ctx.strokeStyle = "rgba(255,255,255,0.58)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + segmento, y + segmento);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,90,31,0.48)";
      ctx.beginPath();
      ctx.moveTo(x + segmento, y);
      ctx.lineTo(x, y + segmento);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.font = `900 ${Math.max(14, Math.round(width / 48))}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 9);
  const passoX = Math.max(220, width / 2.4);
  const passoY = Math.max(120, height / 5);
  for (let y = -height; y <= height; y += passoY) {
    for (let x = -width; x <= width; x += passoX) {
      const texto = "RETRATT • REPRODUÇÃO NÃO AUTORIZADA";
      const larguraTexto = ctx.measureText(texto).width + 24;
      ctx.fillRect(x - larguraTexto / 2, y - 17, larguraTexto, 34);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillText(texto, x, y);
      ctx.fillStyle = "rgba(0,0,0,0.58)";
    }
  }
  ctx.restore();

  const barraAltura = Math.min(82, Math.max(58, Math.round(height * 0.1)));
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.84)";
  ctx.fillRect(0, height - barraAltura, width, barraAltura);
  ctx.strokeStyle = "rgba(255,90,31,0.9)";
  ctx.lineWidth = Math.max(2, width / 600);
  ctx.beginPath();
  ctx.moveTo(0, height - barraAltura);
  ctx.lineTo(width, height - barraAltura);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.max(15, Math.round(width / 43))}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("COMPARTILHAR SEM AUTORIZAÇÃO É ILEGAL", width / 2, height - barraAltura * 0.63);
  ctx.fillStyle = "#ff5a1f";
  ctx.font = `800 ${Math.max(11, Math.round(width / 62))}px Arial`;
  ctx.fillText("COMPRE O ARQUIVO ORIGINAL • VALORIZE O FOTÓGRAFO", width / 2, height - barraAltura * 0.28);
  ctx.restore();
}

export default function PainelFotografoPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [fotografoId, setFotografoId] = useState("");
  const [eventos, setEventos] = useState<FotoEvento[]>([]);
  const [albuns, setAlbuns] = useState<FotoAlbum[]>([]);
  const [eventoId, setEventoId] = useState("");
  const [albumId, setAlbumId] = useState("");
  const [novoAlbum, setNovoAlbum] = useState("Geral");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [precoFoto, setPrecoFoto] = useState("15,00");
  const [precoVideo, setPrecoVideo] = useState("25,00");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [carregandoAlbuns, setCarregandoAlbuns] = useState(false);
  const [criandoAlbum, setCriandoAlbum] = useState(false);
  const [otimizando, setOtimizando] = useState(false);
  const [otimizacaoAtual, setOtimizacaoAtual] = useState(0);
  const [otimizacaoTotal, setOtimizacaoTotal] = useState(0);
  const [uploadAtual, setUploadAtual] = useState(0);
  const [uploadConcluidas, setUploadConcluidas] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [progressoArquivo, setProgressoArquivo] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function converterPrecoCentavos(valorDigitado: string, padrao: number) {
    const normalizado = valorDigitado.replace(/\./g, "").replace(",", ".");
    const valor = Number(normalizado);
    return Number.isFinite(valor) ? Math.max(0, Math.round(valor * 100)) : padrao;
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

      const { data: fotografo } = await supabase
        .from("fotografos")
        .select("id")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      setFotografoId(fotografo?.id || "");

      const { data: credenciais } = fotografo
        ? await supabase
            .from("foto_evento_fotografos")
            .select("evento_id")
            .eq("fotografo_id", fotografo.id)
            .eq("status", "ativo")
        : { data: [] };
      const eventosPermitidos = (credenciais || []).map((item) => item.evento_id);

      const { data } = eventosPermitidos.length
        ? await supabase
            .from("foto_eventos")
            .select("id, nome, slug, local, cidade, estado, data_evento, capa_url, status")
            .in("id", eventosPermitidos)
            .eq("status", "publicado")
            .order("data_evento", { ascending: false })
        : { data: [] };

      const lista = (data || []) as FotoEvento[];
      setEventos(lista);
      const eventoSolicitado = new URLSearchParams(window.location.search).get("evento");
      const eventoInicial = lista.find((evento) => evento.id === eventoSolicitado) || lista[0];
      if (eventoInicial?.id) setEventoId(eventoInicial.id);
      setCarregando(false);
    }

    void carregar();
  }, [router]);

  useEffect(() => {
    async function carregarAlbuns() {
      if (!eventoId || !fotografoId) {
        setAlbuns([]);
        setAlbumId("");
        setCarregandoAlbuns(false);
        return;
      }

      setCarregandoAlbuns(true);
      try {
        const { data, error } = await supabase
          .from("foto_albuns")
          .select("id, evento_id, fotografo_id, titulo, descricao, capa_url, status")
          .eq("evento_id", eventoId)
          .or(`fotografo_id.eq.${fotografoId},fotografo_id.is.null`)
          .order("ordem", { ascending: true });

        if (error) throw error;
        const lista = (data || []) as FotoAlbum[];
        setAlbuns(lista);
        setAlbumId(lista[0]?.id || "");
      } catch {
        setAlbuns([]);
        setAlbumId("");
        setStatus("erro");
        setMensagem("Não foi possível buscar os álbuns desta galeria. Atualize a página e tente novamente.");
      } finally {
        setCarregandoAlbuns(false);
      }
    }

    void carregarAlbuns();
  }, [eventoId, fotografoId]);

  const eventoSelecionado = useMemo(() => eventos.find((evento) => evento.id === eventoId), [eventos, eventoId]);
  const albumSelecionado = useMemo(() => albuns.find((album) => album.id === albumId), [albuns, albumId]);
  const valorFotoAtual = formatarPrecoFotos(converterPrecoCentavos(precoFoto, 1500));
  const valorVideoAtual = formatarPrecoFotos(converterPrecoCentavos(precoVideo, 2500));
  const enviando = ["preparando", "enviando", "confirmando"].includes(status);
  const uploadBloqueado = !eventoId || carregandoAlbuns || enviando || otimizando || criandoAlbum;
  const totalBytes = arquivos.reduce((total, arquivo) => total + arquivo.size, 0);
  const progressoPercentual = useMemo(() => {
    if (status === "ok") return 100;
    if (otimizando && otimizacaoTotal > 0) {
      return Math.min(100, Math.round((otimizacaoAtual / otimizacaoTotal) * 100));
    }
    if (enviando && uploadTotal > 0) {
      const avancoDaEtapa = status === "preparando" ? 0.2 : status === "enviando" ? 0.25 + (progressoArquivo / 100) * 0.55 : 0.92;
      return Math.min(99, Math.round(((uploadConcluidas + avancoDaEtapa) / uploadTotal) * 100));
    }
    return 0;
  }, [enviando, otimizacaoAtual, otimizacaoTotal, otimizando, progressoArquivo, status, uploadConcluidas, uploadTotal]);

  const orientacaoPrincipal = useMemo(() => {
    if (!eventoId) return "Escolha primeiro onde as fotos serão publicadas.";
    if (carregandoAlbuns) return "Buscando os álbuns desta galeria...";
    if (!albumId) return `O álbum “${novoAlbum.trim() || "Geral"}” será criado automaticamente ao publicar.`;
    if (!arquivos.length) return `Álbum “${albumSelecionado?.titulo || "selecionado"}” pronto. Agora escolha fotos ou vídeos.`;
    return `${arquivos.length} mídia(s) pronta(s) para o álbum “${albumSelecionado?.titulo || novoAlbum.trim() || "Geral"}”.`;
  }, [albumId, albumSelecionado?.titulo, arquivos.length, carregandoAlbuns, eventoId, novoAlbum]);

  async function selecionarArquivos(lista: FileList | null) {
    if (!lista) return;
    const recebidos = Array.from(lista);
    const lote = recebidos.slice(0, MAX_UPLOAD_FILES);
    const aceitos: File[] = [];
    const motivosRecusa: string[] = [];
    let otimizadas = 0;
    let recusados = recebidos.length - lote.length;

    setOtimizando(true);
    setOtimizacaoAtual(0);
    setOtimizacaoTotal(lote.length);
    setStatus("idle");
    setUploadAtual(0);
    setUploadConcluidas(0);
    setUploadTotal(0);
    setMensagem(`Preparando ${lote.length} arquivo(s) antes do envio...`);

    for (let index = 0; index < lote.length; index += 1) {
      const arquivo = lote[index];
      const ehVideo = arquivoEhVideo(arquivo);
      const tipoValido = TIPOS_FOTO.has(arquivo.type) || ehVideo;
      const excedeuLimite = ehVideo ? arquivo.size > VIDEO_MAX_BYTES : arquivo.size > MAX_SOURCE_BYTES;
      if (!tipoValido || excedeuLimite) {
        recusados += 1;
        motivosRecusa.push(!tipoValido
          ? `${arquivo.name}: formato não aceito.`
          : `${arquivo.name}: ultrapassa ${ehVideo ? "250 MB" : "40 MB antes da otimização"}.`);
        setOtimizacaoAtual(index + 1);
        continue;
      }

      try {
        if (ehVideo) {
          const duracao = await lerDuracaoVideo(arquivo);
          if (duracao > VIDEO_MAX_DURATION_SECONDS) {
            throw new Error(`${arquivo.name} ultrapassa o limite de 2 minutos.`);
          }
          aceitos.push(arquivo);
        } else {
          const resultado = await otimizarFotoParaUpload(arquivo);
          aceitos.push(resultado.file);
          if (resultado.otimizada) otimizadas += 1;
        }
      } catch (error: unknown) {
        recusados += 1;
        motivosRecusa.push(error instanceof Error ? error.message : `${arquivo.name}: não foi possível preparar o arquivo.`);
      }
      setOtimizacaoAtual(index + 1);
    }

    setArquivos(aceitos);
    setStatus("idle");
    setUploadAtual(0);
    setOtimizando(false);
    setOtimizacaoAtual(0);
    setOtimizacaoTotal(0);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (recusados > 0) {
      setMensagem(`${aceitos.length} mídia(s) pronta(s). ${otimizadas} foto(s) foram otimizadas e ${recusados} arquivo(s) ficaram fora. ${motivosRecusa[0] || "Revise formato, tamanho e duração."}`);
    } else if (otimizadas > 0) {
      setMensagem(`${aceitos.length} mídia(s) pronta(s). ${otimizadas} foto(s) foram otimizadas automaticamente para até 3MB.`);
    } else {
      setMensagem(`${aceitos.length} mídia(s) pronta(s) para publicação.`);
    }
  }

  function removerArquivo(nome: string, index: number) {
    setArquivos((atuais) => atuais.filter((arquivo, arquivoIndex) => arquivo.name !== nome || arquivoIndex !== index));
  }

  async function criarAlbum(): Promise<FotoAlbum | null> {
    if (!eventoId || !novoAlbum.trim()) return null;
    setCriandoAlbum(true);
    setMensagem("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setStatus("erro");
      setMensagem("Sua sessão expirou. Faça login novamente.");
      setCriandoAlbum(false);
      return null;
    }

    try {
      const response = await fetch("/api/fotos/criar-album", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventoId, titulo: novoAlbum.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus("erro");
        setMensagem(payload.error || "Não foi possível criar álbum.");
        return null;
      }

      const album = payload.album as FotoAlbum;
      setAlbuns((atual) => [...atual, album]);
      setAlbumId(album.id);
      setNovoAlbum("Geral");
      setStatus("idle");
      setMensagem(`Álbum “${album.titulo}” criado. Você já pode enviar as fotos.`);
      return album;
    } catch (error: unknown) {
      setStatus("erro");
      setMensagem(error instanceof Error ? error.message : "Não foi possível criar o álbum. Tente novamente.");
      return null;
    } finally {
      setCriandoAlbum(false);
    }
  }

  async function enviarUmaFoto(arquivo: File, token: string, destinoAlbumId: string) {
    const ehVideo = arquivoEhVideo(arquivo);
    setProgressoArquivo(0);
    setStatus("preparando");
    const derivadosFoto = ehVideo ? null : await gerarDerivadosFoto(arquivo);
    const derivadosVideo = ehVideo ? await gerarDerivadosVideo(arquivo) : null;
    const previewBlob = derivadosVideo?.previewBlob || derivadosFoto!.previewBlob;
    const miniaturaIa = derivadosVideo?.miniaturaIa || derivadosFoto!.miniaturaIa;

    const uploadResponse = await fetch("/api/fotos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        eventoId,
        albumId: destinoAlbumId,
        fileName: arquivo.name,
        contentType: arquivo.type,
        size: arquivo.size,
        titulo: arquivo.name.replace(/\.[^.]+$/, ""),
        precoCentavos: ehVideo
          ? converterPrecoCentavos(precoVideo, 2500)
          : converterPrecoCentavos(precoFoto, 1500),
        duracaoSegundos: derivadosVideo?.duracaoSegundos || null,
        videoPreviewContentType: derivadosVideo?.previewVideoContentType || null,
      }),
    });

    const uploadData = await uploadResponse.json();
    if (!uploadResponse.ok) throw new Error(uploadData.error || "Erro ao preparar os links de upload.");

    try {
    async function enviarArquivo(blob: Blob, tipo: "preview" | "original" | "ia", contentType: string) {
      return fetch("/api/fotos/enviar-arquivo", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": contentType,
          "X-Foto-Id": uploadData.fotoId,
          "X-Arquivo-Tipo": tipo,
        },
        body: blob,
      });
    }

    setStatus("enviando");
    const iaResponse = await enviarArquivo(miniaturaIa, "ia", "image/jpeg");
    if (!iaResponse.ok) {
      const detalhe = await iaResponse.json().catch(() => null);
      throw new Error(detalhe?.error || `Falha ao preparar a busca facial deste ${ehVideo ? "vídeo" : "arquivo"}.`);
    }

    const previewResponse = await enviarArquivo(previewBlob, "preview", "image/jpeg");
    if (!previewResponse.ok) {
      const detalhe = await previewResponse.json().catch(() => null);
      throw new Error(detalhe?.error || "Falha ao enviar a previa para o R2.");
    }

    if (ehVideo) {
      if (derivadosVideo?.previewVideoBlob && uploadData.videoPreviewUploadUrl) {
        await enviarDiretoAoR2(uploadData.videoPreviewUploadUrl, derivadosVideo.previewVideoBlob, () => undefined);
      }
      await enviarDiretoAoR2(uploadData.uploadUrl, arquivo, setProgressoArquivo);
    } else {
      const putResponse = await enviarArquivo(arquivo, "original", arquivo.type);
      if (!putResponse.ok) {
        const detalhe = await putResponse.json().catch(() => null);
        throw new Error(detalhe?.error || "Falha ao enviar a foto original para o armazenamento.");
      }
    }

    setStatus("confirmando");
    const confirmarResponse = await fetch("/api/fotos/confirmar-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fotoId: uploadData.fotoId }),
    });
    const confirmarData = await confirmarResponse.json();
    if (!confirmarResponse.ok) throw new Error(confirmarData.error || "Upload feito, mas não confirmado no banco.");
    } catch (error) {
      await fetch("/api/fotos/upload-url", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fotoId: uploadData.fotoId }),
      }).catch(() => undefined);
      throw error;
    }
  }

  async function enviarFotos(destinoAlbumId: string) {
    if (!arquivos.length || !eventoId || !destinoAlbumId) {
      setStatus("erro");
      setMensagem("Escolha a galeria e pelo menos uma foto antes de enviar.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMensagem("Sua sessão expirou. Faça login novamente.");
      return;
    }

    let concluidas = 0;
    try {
      setMensagem("");
      setUploadTotal(arquivos.length);
      setUploadConcluidas(0);
      for (let index = 0; index < arquivos.length; index++) {
        setUploadAtual(index + 1);
        setMensagem(`Preparando ${index + 1}/${arquivos.length}: ${arquivos[index].name}`);
        await enviarUmaFoto(arquivos[index], token, destinoAlbumId);
        concluidas += 1;
        setUploadConcluidas(concluidas);
      }

      setArquivos([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus("ok");
      setMensagem(`${concluidas} mídia(s) publicada(s) com sucesso. Elas já estão disponíveis na galeria.`);
    } catch (error: unknown) {
      let detalhe = error instanceof Error ? error.message : "Erro desconhecido ao enviar fotos.";
      if (concluidas > 0) {
        setArquivos((atuais) => atuais.slice(concluidas));
        detalhe = `${concluidas} mídia(s) foram publicadas. As restantes ficaram na fila para tentar novamente. ${detalhe}`;
      }
      setStatus("erro");
      setMensagem(detalhe);
    }
  }

  async function iniciarEnvio() {
    if (!eventoId) {
      setStatus("erro");
      setMensagem("Escolha a galeria onde deseja publicar as fotos.");
      return;
    }
    if (!arquivos.length) {
      fileInputRef.current?.click();
      return;
    }

    let destinoAlbumId = albumId;
    if (!destinoAlbumId) {
      const albumCriado = await criarAlbum();
      if (!albumCriado) return;
      destinoAlbumId = albumCriado.id;
    }

    await enviarFotos(destinoAlbumId);
  }

  return (
    <FotosShell area="fotografo">
      <main className="min-h-screen bg-[#050505] pb-12 text-white">
        <section className="border-b border-white/10 bg-[radial-gradient(circle_at_85%_0%,rgba(255,90,31,0.16),transparent_32%),linear-gradient(180deg,#0c0c0f,#050505)]">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-retratt/30 bg-retratt/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-retratt">
                  <Camera size={13} /> Área do fotógrafo
                </p>
                <h1 className="mt-4 text-3xl font-black uppercase leading-none md:text-5xl">Criar álbum</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                  Escolha a galeria, organize um álbum e publique fotos ou vídeos em um fluxo simples. As fotos continuam otimizadas automaticamente até 3MB.
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
                <p className="mt-1 text-2xl font-black text-retratt">{eventos.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Selecionadas</p>
                <p className="mt-1 text-2xl font-black text-white">{arquivos.length}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-emerald-300"><Wallet size={14} /> Foto / vídeo</p>
                <p className="mt-1 text-base font-black text-emerald-300">{valorFotoAtual} / {valorVideoAtual}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 md:grid-cols-[360px_1fr] md:px-6 md:py-6">
          {!email && (
            <div className="rounded-xl border border-retratt/30 bg-orange-950/20 p-4 text-sm text-orange-100 md:col-span-2">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-retratt" size={18} />
                <div>
                  <p className="font-bold">Faça login para enviar fotos.</p>
                  <p className="mt-1 text-xs text-orange-100/75">Você pode navegar pelo painel, mas o upload exige uma sessão ativa.</p>
                  <Link href="/fotos/login?perfil=fotografo&next=/fotos/fotografo/dashboard" className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-wider text-white">
                    Entrar agora <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {!eventoSelecionado && !carregando && (
            <div className="rounded-xl border border-retratt/30 bg-orange-950/20 p-4 text-sm text-orange-100 md:col-span-2">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-retratt" size={18} />
                <div>
                  <p className="font-bold">Nenhum evento ativo encontrado.</p>
                  <p className="mt-1 text-xs text-orange-100/75">Peça para a organização liberar uma galeria antes de enviar fotos.</p>
                </div>
              </div>
            </div>
          )}

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
              <div className="mb-4 flex items-center gap-2">
                <FolderPlus size={18} className="text-retratt" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-retratt">Passo 1</p>
                  <h2 className="text-sm font-black uppercase tracking-wider">Onde publicar?</h2>
                </div>
              </div>

              <label className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Galeria do evento</label>
              <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className="mt-2 h-11 w-full cursor-pointer rounded-lg border border-white/10 bg-black px-3 text-xs font-bold outline-none focus:border-retratt">
                <option value="">Escolha uma galeria</option>
                {eventos.map((evento) => <option key={evento.id} value={evento.id}>{evento.nome}</option>)}
              </select>

              <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Álbum</label>
              <select value={albumId} onChange={(e) => setAlbumId(e.target.value)} disabled={!eventoId || carregandoAlbuns} className="mt-2 h-11 w-full cursor-pointer rounded-lg border border-white/10 bg-black px-3 text-xs font-bold outline-none focus:border-retratt disabled:cursor-wait disabled:text-zinc-600">
                <option value="">{carregandoAlbuns ? "Buscando álbuns..." : albuns.length ? "Escolha um álbum" : "Nenhum álbum criado"}</option>
                {albuns.map((album) => <option key={album.id} value={album.id}>{album.titulo}</option>)}
              </select>

              <div className={`mt-4 rounded-xl border p-3 ${!carregandoAlbuns && eventoId && !albuns.length ? "border-retratt/40 bg-retratt/10" : "border-white/10 bg-black"}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">{albuns.length ? "Criar outro álbum" : "Dê um nome ao primeiro álbum"}</p>
                {!carregandoAlbuns && eventoId && !albuns.length && (
                  <p className="mt-2 text-xs leading-5 text-orange-100/75">Pode continuar tranquilo: se você não criar agora, faremos isso automaticamente ao enviar.</p>
                )}
                <div className="mt-3 flex flex-col gap-2">
                  <input value={novoAlbum} onChange={(e) => setNovoAlbum(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3 text-xs outline-none focus:border-retratt" placeholder="Ex: Pódio, Pista, Cerimônia" />
                  <button type="button" onClick={() => void criarAlbum()} disabled={!eventoId || !novoAlbum.trim() || criandoAlbum || carregandoAlbuns} className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-retratt/30 bg-retratt/10 px-4 text-[10px] font-black uppercase tracking-wider text-retratt hover:bg-retratt hover:text-black disabled:cursor-not-allowed disabled:opacity-40">
                    {criandoAlbum ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    {criandoAlbum ? "Criando álbum..." : "Criar e selecionar álbum"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white"><ShieldCheck size={16} className="text-emerald-400" /> Pode deixar com a gente</p>
              <div className="mt-3 space-y-2 text-xs text-zinc-400">
                <p>✓ Fotos grandes continuam sendo otimizadas automaticamente até 3MB.</p>
                <p>✓ Fotos e vídeos entram na busca facial; o vídeo recebe uma amostra protegida de 10 segundos.</p>
                <p>✓ Vídeos: até {formatarDuracaoVideo(VIDEO_MAX_DURATION_SECONDS)} e 250 MB por arquivo.</p>
                <p>✓ O arquivo original fica reservado para a entrega após a compra.</p>
              </div>
            </div>
          </aside>

          <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-retratt">Passo 2</p>
                <h2 className="mt-1 text-lg font-black uppercase">Adicione suas mídias</h2>
                <p className="mt-1 text-xs text-zinc-500">Você escolhe fotos e vídeos; a Retratt protege e publica o lote.</p>
              </div>
              {eventoSelecionado && <p className="rounded-full border border-retratt/20 bg-retratt/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-orange-200">{eventoSelecionado.nome}</p>}
            </div>

            <div className={`mb-4 flex items-start gap-3 rounded-xl border p-3 ${!albumId && eventoId ? "border-retratt/30 bg-retratt/10" : "border-white/10 bg-black/60"}`}>
              {carregandoAlbuns ? <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-retratt" /> : albumId ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" /> : <FolderPlus size={18} className="mt-0.5 shrink-0 text-retratt" />}
              <div>
                <p className="text-xs font-bold text-white">{orientacaoPrincipal}</p>
                {!albumId && eventoId && !carregandoAlbuns && <p className="mt-1 text-[10px] leading-4 text-orange-100/65">Nada ficará travado: o botão de publicação resolve essa etapa para você.</p>}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_250px]">
              <div className={`relative flex min-h-[250px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-black p-5 text-center transition ${arquivos.length ? "border-emerald-500/30" : "border-white/10 hover:border-retratt/60 hover:bg-retratt/5"}`}>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple disabled={otimizando || enviando} onChange={(e) => void selecionarArquivos(e.target.files)} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait" />
                <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full ${arquivos.length ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-zinc-500"}`}>
                  {otimizando ? <Loader2 size={30} className="animate-spin text-retratt" /> : arquivos.length ? <CheckCircle2 size={30} /> : <CloudUpload size={30} />}
                </div>
                <p className="text-sm font-black uppercase tracking-wider text-white">
                  {otimizando ? `Preparando ${otimizacaoAtual} de ${otimizacaoTotal}` : arquivos.length ? `${arquivos.length} mídia(s) pronta(s)` : "Clique ou arraste fotos e vídeos"}
                </p>
                <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-500">
                  {arquivos.length ? "Clique novamente para trocar o lote ou revise a lista logo abaixo." : "Escolha fotos e vídeos. Você verá o andamento de cada etapa antes da publicação."}
                </p>
                <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-retratt">Fotos: JPG, PNG ou WebP · Vídeos: MP4, WebM ou MOV · Até {formatarDuracaoVideo(VIDEO_MAX_DURATION_SECONDS)} / 250 MB</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black p-4">
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Preços de venda</label>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <label className="block">
                    <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Cada foto</span>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">R$</span>
                      <input value={precoFoto} onChange={(e) => setPrecoFoto(e.target.value)} inputMode="decimal" className="h-12 w-full rounded-lg border border-white/10 bg-zinc-950 pl-9 pr-3 text-lg font-black outline-none focus:border-retratt" />
                    </div>
                    <span className="mt-1 block text-[10px] font-bold text-emerald-300">{valorFotoAtual}</span>
                  </label>
                  <label className="block">
                    <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Cada vídeo</span>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">R$</span>
                      <input value={precoVideo} onChange={(e) => setPrecoVideo(e.target.value)} inputMode="decimal" className="h-12 w-full rounded-lg border border-white/10 bg-zinc-950 pl-9 pr-3 text-lg font-black outline-none focus:border-retratt" />
                    </div>
                    <span className="mt-1 block text-[10px] font-bold text-emerald-300">{valorVideoAtual}</span>
                  </label>
                </div>
                <p className="mt-3 text-xs text-zinc-500">Lote atual: <span className="font-bold text-white">{arquivos.length}</span> mídia(s) · {formatarTamanho(totalBytes)}</p>

                <button type="button" onClick={() => void iniciarEnvio()} disabled={uploadBloqueado} className="mt-4 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-retratt px-3 py-3 text-center text-xs font-black uppercase tracking-wider text-black shadow-[0_0_24px_rgba(255,90,31,0.18)] transition hover:bg-retratt disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
                  {criandoAlbum ? <><Loader2 size={16} className="animate-spin" /> Criando álbum</> : otimizando ? <><Loader2 size={16} className="animate-spin" /> Preparando {otimizacaoAtual}/{otimizacaoTotal}</> : enviando ? <><Loader2 size={16} className="animate-spin" /> Publicando {uploadAtual}/{uploadTotal}</> : !arquivos.length ? <><ImagePlus size={16} /> Escolher mídias</> : !albumId ? <><FolderPlus size={16} /> Criar álbum e publicar</> : <><CloudUpload size={16} /> Publicar {arquivos.length} mídia(s)</>}
                </button>

                {(otimizando || enviando || status === "ok") && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-bold">
                      <span className="text-zinc-400">{otimizando ? "Preparando imagens" : status === "ok" ? "Publicação concluída" : status === "preparando" ? "Criando prévias" : status === "enviando" ? "Enviando com segurança" : "Finalizando publicação"}</span>
                      <span className={status === "ok" ? "text-emerald-300" : "text-retratt"}>{progressoPercentual}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className={`h-full rounded-full transition-[width] duration-300 ${status === "ok" ? "bg-emerald-400" : "bg-retratt"}`} style={{ width: `${progressoPercentual}%` }} />
                    </div>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[8px] font-black uppercase tracking-wider text-zinc-600">
                  <span className={status === "preparando" ? "text-retratt" : uploadConcluidas > 0 || status === "ok" ? "text-emerald-400" : ""}>1. Preparar</span>
                  <span className={status === "enviando" ? "text-retratt" : uploadConcluidas > 0 || status === "ok" ? "text-emerald-400" : ""}>2. Enviar</span>
                  <span className={status === "confirmando" ? "text-retratt" : status === "ok" ? "text-emerald-400" : ""}>3. Publicar</span>
                </div>
              </div>
            </div>

            {arquivos.length > 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Mídias selecionadas</p>
                  <button type="button" onClick={() => setArquivos([])} className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-retratt hover:text-orange-300">Limpar</button>
                </div>
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {arquivos.map((arquivo, index) => (
                    <div key={`${arquivo.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2">
                      <div className="min-w-0 flex items-center gap-3">
                        {arquivoEhVideo(arquivo) ? <Video size={16} className="shrink-0 text-retratt" /> : <ImagePlus size={16} className="shrink-0 text-retratt" />}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-white">{arquivo.name}</p>
                          <p className="text-[10px] text-zinc-500">{formatarTamanho(arquivo.size)}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => removerArquivo(arquivo.name, index)} className="cursor-pointer rounded-lg border border-white/10 p-2 text-zinc-500 hover:border-retratt/40 hover:text-orange-300" aria-label="Remover mídia">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mensagem && (
              <div className={`mt-4 flex items-start gap-3 rounded-xl border p-4 text-xs font-bold ${status === "erro" ? "border-retratt/30 bg-retratt/10 text-red-200" : status === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-retratt/30 bg-retratt/10 text-orange-100"}`}>
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
