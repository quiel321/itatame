type LutaVisual = {
  id_visual?: string | number | null;
  proxima_luta?: string | number | null;
};

function idsPrimeiraFase(lutas: LutaVisual[]) {
  return lutas
    .map(luta => Number(luta.id_visual))
    .filter(id => Number.isFinite(id) && id > 0 && id < 100)
    .sort((a, b) => a - b);
}

function idsNoIntervalo(lutas: LutaVisual[], min: number, max: number) {
  return lutas
    .map(luta => Number(luta.id_visual))
    .filter(id => Number.isFinite(id) && id >= min && id < max)
    .sort((a, b) => a - b)
    .map(String);
}

function completar(lista: string[], tamanho: number) {
  const copia = lista.slice(0, tamanho);
  while (copia.length < tamanho) copia.push('');
  return copia;
}

export function primeiraFasePorLado(
  lutas: LutaVisual[],
  abaAtual = 1,
) {
  const primeira = idsPrimeiraFase(lutas);
  const metade = Math.ceil(primeira.length / 2);
  const offset = (Math.max(1, abaAtual) - 1) * 4;
  const esquerda: number[] = [];
  const direita: number[] = [];
  for (let i = 0; i < 4; i++) {
    const indice = offset + i;
    if (indice >= 0 && indice < metade) esquerda.push(primeira[indice]);
  }
  for (let i = 0; i < 4; i++) {
    const indice = metade + offset + i;
    if (indice >= 0 && indice < primeira.length) direita.push(primeira[indice]);
  }
  return { esquerda, direita };
}

export function tamanhoVisualChave(lutas: LutaVisual[], abaAtual = 1) {
  const { esquerda, direita } = primeiraFasePorLado(lutas, abaAtual);
  const n = esquerda.length + direita.length;
  if (n <= 1) return 2;
  if (n <= 2) return 4;
  if (n <= 4) return 8;
  return 16;
}

export function estruturaVisualChave(lutas: LutaVisual[], abaAtual = 1) {
  const { esquerda, direita } = primeiraFasePorLado(lutas, abaAtual);
  const tamanho = tamanhoVisualChave(lutas, abaAtual);
  const ids = new Set(lutas.map(luta => String(luta.id_visual)));
  const final = ids.has('999')
    ? '999'
    : (esquerda[0] && !direita.length ? String(esquerda[0]) : '999');

  if (tamanho <= 2) {
    return {
      tamanho,
      esquerda: [] as string[][],
      direita: [] as string[][],
      final,
    };
  }

  const matchesLado = tamanho / 4;
  const colunasEsquerda = [completar(esquerda.map(String), matchesLado)];
  const colunasDireita = [completar(direita.map(String), matchesLado)];

  const intermediarias: string[][] = [];
  if (tamanho >= 16) intermediarias.push(idsNoIntervalo(lutas, 100, 200));
  if (tamanho >= 8) {
    intermediarias.push(tamanho >= 16 ? idsNoIntervalo(lutas, 200, 300) : idsNoIntervalo(lutas, 100, 200));
  }

  intermediarias.forEach((idsRodada, indice) => {
    const esperados = matchesLado / (2 ** (indice + 1));
    const metadeRodada = Math.ceil(idsRodada.length / 2);
    colunasEsquerda.push(completar(idsRodada.slice(0, metadeRodada), esperados));
    colunasDireita.push(completar(idsRodada.slice(metadeRodada), esperados));
  });

  return {
    tamanho,
    esquerda: colunasEsquerda,
    direita: colunasDireita,
    final,
  };
}

export function rotulosColunasArvore(tamanho: number) {
  if (tamanho <= 2) return { lados: [] as string[], centro: 'Final' };
  if (tamanho === 4) return { lados: ['Semifinal'], centro: 'Final' };
  if (tamanho === 8) return { lados: ['Quartas', 'Semifinal'], centro: 'Final' };
  return { lados: ['Oitavas', 'Quartas', 'Semifinal'], centro: 'Final' };
}

export function idsPrimeiraFasePorLado(
  lutas: LutaVisual[],
  abaAtual = 1,
) {
  const { esquerda, direita } = primeiraFasePorLado(lutas, abaAtual);
  return {
    esquerda(posicaoColuna: number) {
      return esquerda[posicaoColuna - 1] ?? null;
    },
    direita(posicaoColuna: number) {
      return direita[posicaoColuna - 1] ?? null;
    },
  };
}
