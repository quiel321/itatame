// Semelhança é um sinal da busca, não uma confirmação de identidade.
export const MIN_SIMILARIDADE_BUSCA = 95;
export const MIN_SIMILARIDADE_COMBO = 99;
export function correspondenciaSegura(similaridade: number) {
  return Number.isFinite(similaridade) && similaridade >= MIN_SIMILARIDADE_COMBO && similaridade <= 100;
}
