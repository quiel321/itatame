import {
  VIDEO_PREVIEW_BITRATE,
  VIDEO_PREVIEW_DURATION_SECONDS,
  VIDEO_PREVIEW_FPS,
  VIDEO_PREVIEW_MAX_BYTES,
  VIDEO_PREVIEW_MAX_WIDTH,
} from "@/app/lib/fotos-video";

export function desenharProtecaoRetratt(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const escala = Math.min(width, height);
  const tamanhoMarca = Math.max(32, Math.round(escala * 0.105));
  const tamanhoSecundario = Math.max(13, Math.round(tamanhoMarca * 0.25));
  const barraAltura = Math.max(32, Math.round(escala * 0.055));
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${tamanhoSecundario}px Arial`;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (const y of [0.2, 0.5, 0.8]) {
    for (const x of [0.25, 0.75]) {
      ctx.fillText("RETRATT", width * x, height * y);
    }
  }
  ctx.font = `900 ${tamanhoMarca}px Arial`;
  ctx.lineWidth = Math.max(2, Math.round(escala * 0.005));
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.fillStyle = "rgba(255,255,255,0.48)";
  ctx.strokeText("RETRATT", width / 2, height / 2);
  ctx.fillText("RETRATT", width / 2, height / 2);
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, height - barraAltura, width, barraAltura);
  ctx.fillStyle = "rgba(255,90,31,0.8)";
  ctx.fillRect(0, height - barraAltura, width, 2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `700 ${Math.max(11, Math.round(escala * 0.019))}px Arial`;
  ctx.fillText("PRÉVIA PROTEGIDA · RETRATT", width / 2, height - barraAltura / 2);
  ctx.restore();
}

function numeroPar(valor: number) {
  return Math.max(2, Math.round(valor / 2) * 2);
}

export function inicioDaAmostra(duracaoTotal: number) {
  const duracaoAmostra = Math.min(VIDEO_PREVIEW_DURATION_SECONDS, duracaoTotal);
  return duracaoTotal > duracaoAmostra ? Math.min(duracaoTotal * 0.1, duracaoTotal - duracaoAmostra) : 0;
}

export function webCodecsDisponivel() {
  return typeof window !== "undefined" && typeof window.VideoEncoder === "function" && typeof window.VideoDecoder === "function";
}

// Converte direto com WebCodecs: não depende de reproduzir o vídeo nem de a aba estar visível.
export async function gerarAmostraVideoRapida(arquivo: Blob, onProgresso?: (percentual: number) => void): Promise<Blob | null> {
  if (!webCodecsDisponivel()) return null;
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(arquivo), formats: mb.ALL_FORMATS });

  try {
    const trilha = await input.getPrimaryVideoTrack();
    if (!trilha || !(await trilha.canDecode())) return null;

    const duracaoTotal = await input.computeDuration();
    if (!Number.isFinite(duracaoTotal) || duracaoTotal <= 0) return null;
    const inicio = inicioDaAmostra(duracaoTotal);
    const fim = Math.min(duracaoTotal, inicio + VIDEO_PREVIEW_DURATION_SECONDS);

    const escala = Math.min(1, VIDEO_PREVIEW_MAX_WIDTH / Math.max(1, trilha.displayWidth));
    const largura = numeroPar(trilha.displayWidth * escala);
    const altura = numeroPar(trilha.displayHeight * escala);
    const qualidade = new mb.Quality({ bitrate: VIDEO_PREVIEW_BITRATE });
    if (!(await mb.canEncodeVideo("avc", { width: largura, height: altura, quality: qualidade }))) return null;

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    const protecao = document.createElement("canvas");
    protecao.width = largura;
    protecao.height = altura;
    const ctxProtecao = protecao.getContext("2d");
    if (!ctx || !ctxProtecao) return null;
    desenharProtecaoRetratt(ctxProtecao, largura, altura);

    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });
    const conversao = await mb.Conversion.init({
      input,
      output,
      tracks: "primary",
      showWarnings: false,
      trim: { start: inicio, end: fim },
      audio: { discard: true },
      // A redução é feita no próprio desenho do quadro: o redimensionamento interno da biblioteca é bem mais lento em vídeos 4K.
      video: {
        codec: "avc",
        frameRate: VIDEO_PREVIEW_FPS,
        quality: qualidade,
        forceTranscode: true,
        process: (quadro) => {
          quadro.draw(ctx, 0, 0, largura, altura);
          ctx.drawImage(protecao, 0, 0);
          return canvas;
        },
        processedWidth: largura,
        processedHeight: altura,
      },
    });
    if (!conversao.isValid) return null;
    if (onProgresso) conversao.onProgress = (progresso) => onProgresso(Math.round(progresso * 100));
    await conversao.execute();

    const buffer = output.target.buffer;
    if (!buffer || !buffer.byteLength || buffer.byteLength > VIDEO_PREVIEW_MAX_BYTES) return null;
    return new Blob([buffer], { type: "video/mp4" });
  } finally {
    input.dispose();
  }
}
