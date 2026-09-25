import {
  VIDEO_PREVIEW_BITRATE,
  VIDEO_PREVIEW_DURATION_SECONDS,
  VIDEO_PREVIEW_FPS,
  VIDEO_PREVIEW_MAX_BYTES,
  VIDEO_PREVIEW_MAX_WIDTH,
} from "@/app/lib/fotos-video";

export function desenharProtecaoRetratt(ctx: CanvasRenderingContext2D, width: number, height: number) {
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
