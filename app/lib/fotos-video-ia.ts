export const VIDEO_IA_COLUNAS = 2;
export const VIDEO_IA_LARGURA_QUADRO = 640;
export const VIDEO_IA_ALTURA_QUADRO = 640;

// Enquadramento inteiro: vídeos verticais não perdem cabeça e pés no recorte.
export function enquadramentoQuadroIa(largura: number, altura: number, indice: number) {
  const escala = Math.min(VIDEO_IA_LARGURA_QUADRO / largura, VIDEO_IA_ALTURA_QUADRO / altura);
  const width = largura * escala, height = altura * escala;
  const left = indice % VIDEO_IA_COLUNAS * VIDEO_IA_LARGURA_QUADRO;
  const top = Math.floor(indice / VIDEO_IA_COLUNAS) * VIDEO_IA_ALTURA_QUADRO;
  return { x: left + (VIDEO_IA_LARGURA_QUADRO - width) / 2, y: top + (VIDEO_IA_ALTURA_QUADRO - height) / 2, width, height };
}

// Reconhece o mosaico antigo e o novo. Uma capa avulsa não é cortada em seis.
export function recortesMosaicoVideo(largura: number, altura: number) {
  if (!((largura === 960 && altura === 810) || (largura === 1280 && altura === 1920))) return [];
  const width = largura / 2, height = altura / 3;
  return Array.from({ length: 6 }, (_, i) => ({ left: i % 2 * width, top: Math.floor(i / 2) * height, width, height }));
}
