type LutaVisual = {
  id_visual?: string | number | null;
  proxima_luta?: string | number | null;
  lado?: string | null;
  fase?: string | null;
};

function idsPrimeiraFase(lutas: LutaVisual[]) {
  return lutas
    .map(luta => Number(luta.id_visual))
    .filter(id => Number.isFinite(id) && id > 0 && id < 100)
    .sort((a, b) => a - b);
}

function completar(lista: string[], tamanho: number) {
  const copia = lista.slice(0, tamanho);
  while (copia.length < tamanho) copia.push('');
  return copia;
}

function lutaPorId(lutas: LutaVisual[], id: string | number) {
  return lutas.find(luta => String(luta.id_visual) === String(id));
}

function tamanhoPorQuantidade(n: number) {
  if (n <= 1) return 2;
  if (n <= 2) return 4;
  if (n <= 4) return 8;
  if (n <= 8) return 16;
  if (n <= 16) return 32;
  return 64;
}

function proximaInferida(id: number, lutas: LutaVisual[]) {
  if (!Number.isFinite(id) || id === 999) return null;
  const ids = new Set(lutas.map(luta => Number(luta.id_visual)).filter(Number.isFinite));
  if (id < 100) {
    const tamanho = tamanhoPorQuantidade(idsPrimeiraFase(lutas).length);
    if (tamanho <= 2) return null;
    if (tamanho === 4) return '999';
    return String(101 + Math.floor((id - 1) / 2));
  }
  const fase = Math.floor(id / 100);
  const indice = id % 100;
  const seguinte = (fase + 1) * 100 + Math.floor((indice - 1) / 2) + 1;
  if (ids.has(seguinte)) return String(seguinte);
  if (ids.has(999)) return '999';
  return null;
}

function proximaDaLuta(luta: LutaVisual | undefined, id: number, lutas: LutaVisual[]) {
  if (luta?.proxima_luta != null && String(luta.proxima_luta) !== '') {
    return String(luta.proxima_luta);
  }
  return proximaInferida(id, lutas);
}

function rotuloFase(fase?: string | null) {
  const texto = String(fase || '');
  if (/32/i.test(texto)) return '32-avos';
  if (/16/i.test(texto)) return '16-avos';
  if (/oitava/i.test(texto)) return 'Oitavas';
  if (/quarta/i.test(texto)) return 'Quartas';
  if (/semi/i.test(texto)) return 'Semifinal';
  if (/final/i.test(texto)) return 'Final';
  return '';
}

function idsQueApontam(lutas: LutaVisual[], destino: string) {
  return lutas.flatMap(luta => {
    const id = Number(luta.id_visual);
    if (!Number.isFinite(id)) return [];
    return proximaDaLuta(luta, id, lutas) === destino ? [String(luta.id_visual)] : [];
  });
}

function colunasAteEncontro(ids: number[], lutas: LutaVisual[]) {
  const dentro = new Set(ids.map(String));
  const colunas: string[][] = [];
  let atual = ids.map(String).filter(Boolean);
  let encontro = '';

  while (atual.length) {
    colunas.push(atual);
    const proximo: string[] = [];
    const visto = new Set<string>();
    for (const id of atual) {
      const next = proximaDaLuta(lutaPorId(lutas, id), Number(id), lutas);
      if (!next || next === '999' || visto.has(next)) continue;
      visto.add(next);
      proximo.push(next);
    }
    if (!proximo.length) break;
    const saida = proximo.find(id => idsQueApontam(lutas, id).some(origem => !dentro.has(origem)));
    if (saida) {
      encontro = saida;
      break;
    }
    proximo.forEach(id => dentro.add(id));
    atual = proximo;
  }

  if (!colunas.length) return { colunas, encontro };
  const base = colunas[0].length;
  return {
    colunas: colunas.map((coluna, indice) => completar(coluna, Math.max(1, Math.ceil(base / 2 ** indice)))),
    encontro,
  };
}

function caminhoAteFinal(id: string, lutas: LutaVisual[]) {
  const caminho: string[] = [];
  let cursor = id;
  while (cursor && cursor !== '999' && !caminho.includes(cursor)) {
    caminho.push(cursor);
    const next = proximaDaLuta(lutaPorId(lutas, cursor), Number(cursor), lutas);
    if (!next) break;
    cursor = next;
  }
  return caminho;
}

function colunasDoLado(ids: number[], lutas: LutaVisual[]) {
  const colunas: string[][] = [];
  let atual = ids.map(String).filter(Boolean);
  while (atual.length) {
    const coluna: string[] = [];
    const naColuna = new Set<string>();
    for (const id of atual) {
      if (!id || id === '999' || naColuna.has(id)) continue;
      naColuna.add(id);
      coluna.push(id);
    }
    if (!coluna.length) break;
    colunas.push(coluna);

    const proximo: string[] = [];
    const visto = new Set<string>();
    for (const id of coluna) {
      const next = proximaDaLuta(lutaPorId(lutas, id), Number(id), lutas);
      if (!next || next === '999' || visto.has(next)) continue;
      visto.add(next);
      proximo.push(next);
    }
    atual = proximo;
  }

  if (!colunas.length) return colunas;
  const base = colunas[0].length;
  return colunas.map((coluna, indice) => completar(coluna, Math.max(1, Math.ceil(base / 2 ** indice))));
}

export function primeiraFasePorLado(
  lutas: LutaVisual[],
  _abaAtual = 1,
) {
  const primeira = idsPrimeiraFase(lutas);
  const lutasPrimeira = primeira.map(id => lutaPorId(lutas, id));
  const todosComLado = lutasPrimeira.length > 0 && lutasPrimeira.every(
    luta => luta?.lado === 'esquerda' || luta?.lado === 'direita',
  );
  if (todosComLado) {
    return {
      esquerda: primeira.filter((_, indice) => lutasPrimeira[indice]?.lado === 'esquerda'),
      direita: primeira.filter((_, indice) => lutasPrimeira[indice]?.lado === 'direita'),
    };
  }
  const metade = Math.ceil(primeira.length / 2);
  return {
    esquerda: primeira.slice(0, metade),
    direita: primeira.slice(metade),
  };
}

export function tamanhoVisualChave(lutas: LutaVisual[], _abaAtual = 1) {
  return tamanhoPorQuantidade(idsPrimeiraFase(lutas).length);
}

function estruturaPainel(lutas: LutaVisual[], abaAtual: number, tamanho: number) {
  const primeira = idsPrimeiraFase(lutas);
  const abas = totalAbasArvore(lutas);
  const aba = Math.min(abas, Math.max(1, abaAtual || 1));
  const fatia = primeira.slice((aba - 1) * 8, aba * 8);
  const corte = Math.ceil(fatia.length / 2);
  const ladoEsquerdo = colunasAteEncontro(fatia.slice(0, corte), lutas);
  const ladoDireito = colunasAteEncontro(fatia.slice(corte), lutas);
  const encontro = ladoEsquerdo.encontro || ladoDireito.encontro;
  const rotulosLados = (ladoEsquerdo.colunas.length ? ladoEsquerdo.colunas : ladoDireito.colunas)
    .map((coluna, indice) => rotuloFase(lutaPorId(lutas, coluna.find(Boolean) || '')?.fase) || ['32-avos', '16-avos', 'Oitavas', 'Quartas'][indice] || '');

  return {
    tamanho,
    esquerda: ladoEsquerdo.colunas,
    direita: ladoDireito.colunas,
    final: '999',
    caminho: encontro ? caminhoAteFinal(encontro, lutas) : [],
    rotulos: { lados: rotulosLados, centro: 'Final' },
  };
}

export function estruturaVisualChave(lutas: LutaVisual[], abaAtual = 1) {
  const { esquerda, direita } = primeiraFasePorLado(lutas, abaAtual);
  const tamanho = tamanhoVisualChave(lutas, abaAtual);
  const ids = new Set(lutas.map(luta => String(luta.id_visual)));
  const final = ids.has('999')
    ? '999'
    : (esquerda[0] && !direita.length ? String(esquerda[0]) : '999');
  const rotulos = rotulosColunasArvore(tamanho);

  if (totalAbasArvore(lutas) > 1) return estruturaPainel(lutas, abaAtual, tamanho);

  if (tamanho <= 2) {
    return {
      tamanho,
      esquerda: [] as string[][],
      direita: [] as string[][],
      final,
      caminho: [] as string[],
      rotulos,
    };
  }

  return {
    tamanho,
    esquerda: colunasDoLado(esquerda, lutas),
    direita: colunasDoLado(direita, lutas),
    final,
    caminho: [] as string[],
    rotulos,
  };
}

export function rotulosColunasArvore(tamanho: number) {
  if (tamanho <= 2) return { lados: [] as string[], centro: 'Final' };
  if (tamanho === 4) return { lados: ['Semifinal'], centro: 'Final' };
  if (tamanho === 8) return { lados: ['Quartas', 'Semifinal'], centro: 'Final' };
  if (tamanho === 16) return { lados: ['Oitavas', 'Quartas', 'Semifinal'], centro: 'Final' };
  if (tamanho === 32) return { lados: ['16-avos', 'Oitavas', 'Quartas', 'Semifinal'], centro: 'Final' };
  return { lados: ['32-avos', '16-avos', 'Oitavas', 'Quartas', 'Semifinal'], centro: 'Final' };
}

export function rotulosLadoArvore(rotulos: string[], reverso = false) {
  return reverso ? [...rotulos].reverse() : rotulos;
}

export function totalAbasArvore(lutas: LutaVisual[] = []) {
  const quantidade = idsPrimeiraFase(lutas).length;
  if (quantidade <= 16) return 1;
  return Math.max(1, Math.ceil(quantidade / 8));
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
