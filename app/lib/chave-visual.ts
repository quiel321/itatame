export function idsPrimeiraFasePorLado(
  lutas: Array<{ id_visual?: string | number | null }>,
  abaAtual = 1,
) {
  const primeira = lutas
    .map(luta => Number(luta.id_visual))
    .filter(id => Number.isFinite(id) && id > 0 && id < 100)
    .sort((a, b) => a - b);
  const metade = Math.ceil(primeira.length / 2);
  const offset = (Math.max(1, abaAtual) - 1) * 4;

  return {
    esquerda(posicaoColuna: number) {
      const indice = offset + posicaoColuna - 1;
      return indice >= 0 && indice < metade ? primeira[indice] : null;
    },
    direita(posicaoColuna: number) {
      const indice = metade + offset + posicaoColuna - 1;
      return indice >= 0 && indice < primeira.length ? primeira[indice] : null;
    },
  };
}
