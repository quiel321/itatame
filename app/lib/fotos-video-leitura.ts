import { VIDEO_MAX_DURATION_SECONDS } from './fotos-video';

export function validarMetadadosVideo(duracao: number, largura: number, altura: number, nome: string) {
  if (!Number.isFinite(duracao) || duracao <= 0 || !Number.isFinite(largura) || !Number.isFinite(altura) || largura <= 0 || altura <= 0) {
    throw new Error(`Não foi possível validar o vídeo ${nome}. Confira se o arquivo está completo.`);
  }
  if (duracao > VIDEO_MAX_DURATION_SECONDS) throw new Error(`${nome} ultrapassa o limite de 2 minutos.`);
}

async function comPrazo<T>(tarefa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([tarefa, new Promise<never>((_, rejeitar) => { timer = setTimeout(() => rejeitar(new Error('A leitura do vídeo demorou demais.')), ms); })]);
  } finally { clearTimeout(timer); }
}

// Lê o contêiner sem precisar reproduzir ou converter o vídeo inteiro.
// Mesmo sem um decodificador HEVC no aparelho, a duração continua sendo validada.
export async function abrirLeituraVideo(arquivo: File) {
  const mb = await import('mediabunny');
  const input = new mb.Input({ source: new mb.BlobSource(arquivo), formats: mb.ALL_FORMATS });
  let fechado = false;
  const fechar = () => { if (!fechado) { fechado = true; input.dispose(); } };
  try {
    const trilha = await comPrazo(input.getPrimaryVideoTrack(), 10000);
    if (!trilha) throw new Error(`${arquivo.name} não contém uma trilha de vídeo válida.`);
    const [duracao, largura, altura] = await comPrazo(Promise.all([input.computeDuration(), trilha.getDisplayWidth(), trilha.getDisplayHeight()]), 10000);
    validarMetadadosVideo(duracao, largura, altura, arquivo.name);
    let sink: InstanceType<typeof mb.CanvasSink> | null = null;
    let consultouCodec = false;
    let podeDecodificar = false;
    return {
      duracao, largura, altura, fechar,
      async quadro(tempo: number) {
        if (fechado) return null;
        try {
          if (!consultouCodec) {
            consultouCodec = true;
            podeDecodificar = await comPrazo(trilha.canDecode(), 3000);
          }
          if (!podeDecodificar) return null;
          sink ??= new mb.CanvasSink(trilha, { width: Math.min(1200, largura), poolSize: 1 });
          const frame = await comPrazo(sink.getCanvas(Math.min(Math.max(0, tempo), Math.max(0, duracao - 0.05))), 4000);
          return frame?.canvas || null;
        } catch {
          fechar();
          return null;
        }
      },
    };
  } catch (error) {
    fechar();
    throw error;
  }
}
