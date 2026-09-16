export type ModeloPesoIBJJF = {
  id: string;
  titulo: string;
  descricao: string;
  sexo?: 'Masculino' | 'Feminino';
  idade_min?: number;
  idade_max?: number;
  tempo_minutos?: number;
  faixasPermitidas?: readonly string[];
  fonte?: string;
  pesos: readonly { nome: string; peso_min: number; peso_max: number | null }[];
};

const nomesPesosKids = ['Galo', 'Pluma', 'Pena', 'Leve', 'Médio', 'Meio-pesado', 'Pesado', 'Super-pesado', 'Pesadíssimo'] as const;

function pesosKids(maximos: readonly number[]) {
  return nomesPesosKids.map((nome, indice) => ({
    nome,
    peso_min: indice === 0 ? 0 : maximos[indice - 1],
    peso_max: indice === nomesPesosKids.length - 1 ? null : maximos[indice],
  }));
}

const fonteKids2026 = 'https://ibjjf.com/events/brasilia-kids-international-open-ibjjf-jiu-jitsu-championship-2026';
const faixasMightyMite = ['Cinza'] as const;
const faixasPeeWee = ['Cinza', 'Amarela'] as const;
const faixasJunior = ['Cinza', 'Amarela', 'Laranja'] as const;
const faixasTeen = ['Cinza', 'Amarela', 'Laranja', 'Verde'] as const;

function modeloKids(
  id: string,
  titulo: string,
  idade: number,
  tempo_minutos: number,
  faixasPermitidas: readonly string[],
  maximos: readonly number[],
): ModeloPesoIBJJF {
  return {
    id,
    titulo: `IBJJF Kids ${idade} anos · ${titulo}`,
    descricao: `9 divisões infantis em kg, com kimono. Faixas permitidas: ${faixasPermitidas.join(', ')}. Sexo escolhido pelo organizador.`,
    idade_min: idade,
    idade_max: idade,
    tempo_minutos,
    faixasPermitidas,
    fonte: fonteKids2026,
    pesos: pesosKids(maximos),
  };
}

/**
 * Limites de peso Adult Gi usados nos eventos oficiais da IBJJF em 2026.
 * A pesagem inclui o kimono. Idade, faixa e tempo continuam editáveis porque
 * o regulamento do campeonato local pode ser diferente.
 */
export const modelosPesoIBJJF: readonly ModeloPesoIBJJF[] = [
  {
    id: 'adulto_masculino_gi',
    titulo: 'IBJJF Adulto Masculino - com kimono',
    descricao: '9 divisões: Galo até Pesadíssimo. Peso conferido com kimono.',
    sexo: 'Masculino',
    idade_min: 18,
    idade_max: 29,
    faixasPermitidas: ['Branca', 'Azul', 'Roxa', 'Marrom', 'Preta'],
    pesos: [
      { nome: 'Galo', peso_min: 0, peso_max: 57.5 },
      { nome: 'Pluma', peso_min: 57.5, peso_max: 64 },
      { nome: 'Pena', peso_min: 64, peso_max: 70 },
      { nome: 'Leve', peso_min: 70, peso_max: 76 },
      { nome: 'Médio', peso_min: 76, peso_max: 82.3 },
      { nome: 'Meio-pesado', peso_min: 82.3, peso_max: 88.3 },
      { nome: 'Pesado', peso_min: 88.3, peso_max: 94.3 },
      { nome: 'Super-pesado', peso_min: 94.3, peso_max: 100.5 },
      { nome: 'Pesadíssimo', peso_min: 100.5, peso_max: null },
    ],
  },
  {
    id: 'adulto_feminino_gi',
    titulo: 'IBJJF Adulto Feminino - com kimono',
    descricao: '8 divisões: Galo até Super-pesado. Peso conferido com kimono.',
    sexo: 'Feminino',
    idade_min: 18,
    idade_max: 29,
    faixasPermitidas: ['Branca', 'Azul', 'Roxa', 'Marrom', 'Preta'],
    pesos: [
      { nome: 'Galo', peso_min: 0, peso_max: 48.5 },
      { nome: 'Pluma', peso_min: 48.5, peso_max: 53.5 },
      { nome: 'Pena', peso_min: 53.5, peso_max: 58.5 },
      { nome: 'Leve', peso_min: 58.5, peso_max: 64 },
      { nome: 'Médio', peso_min: 64, peso_max: 69 },
      { nome: 'Meio-pesado', peso_min: 69, peso_max: 74 },
      { nome: 'Pesado', peso_min: 74, peso_max: 79.3 },
      { nome: 'Super-pesado', peso_min: 79.3, peso_max: null },
    ],
  },
  modeloKids('kids_4_mighty_mite_1', 'Mighty-Mite 1 / Pré-Mirim', 4, 2, faixasMightyMite, [12, 14.7, 18, 21, 24, 27, 30, 33]),
  modeloKids('kids_5_mighty_mite_2', 'Mighty-Mite 2 / Pré-Mirim', 5, 2, faixasMightyMite, [14.7, 17.9, 20, 24, 26, 29, 32, 35]),
  modeloKids('kids_6_mighty_mite_3', 'Mighty-Mite 3 / Pré-Mirim', 6, 2, faixasMightyMite, [17.9, 18.9, 22, 25, 28, 31.2, 34.2, 37.2]),
  modeloKids('kids_7_pee_wee_1', 'Pee-Wee 1 / Mirim', 7, 3, faixasPeeWee, [18.2, 21, 24, 27, 30.2, 33.2, 36.2, 39.3]),
  modeloKids('kids_8_pee_wee_2', 'Pee-Wee 2 / Mirim', 8, 3, faixasPeeWee, [21, 24, 27, 30.2, 33.2, 36.2, 39.3, 42.3]),
  modeloKids('kids_9_pee_wee_3', 'Pee-Wee 3 / Mirim', 9, 3, faixasPeeWee, [24, 27, 30.2, 33.2, 36.2, 39.3, 42.3, 45.3]),
  modeloKids('kids_10_junior_1', 'Junior 1 / Infantil', 10, 4, faixasJunior, [27, 30.2, 33.2, 36.2, 39.3, 42.3, 45.3, 48.3]),
  modeloKids('kids_11_junior_2', 'Junior 2 / Infantil', 11, 4, faixasJunior, [30.2, 33.2, 36.2, 39.3, 42.3, 45.3, 48.3, 51.5]),
  modeloKids('kids_12_junior_3', 'Junior 3 / Infantil', 12, 4, faixasJunior, [32.2, 36.2, 40.3, 44.3, 48.3, 52.5, 56.5, 60.5]),
  modeloKids('kids_13_teen_1', 'Teen 1 / Infanto-Juvenil', 13, 4, faixasTeen, [36.2, 40.3, 44.3, 48.3, 52.5, 56.5, 60.5, 65]),
  modeloKids('kids_14_teen_2', 'Teen 2 / Infanto-Juvenil', 14, 4, faixasTeen, [40.3, 44.3, 48.3, 52.5, 56.5, 60.5, 65, 69]),
  modeloKids('kids_15_teen_3', 'Teen 3 / Infanto-Juvenil', 15, 4, faixasTeen, [44.3, 48.3, 52.5, 56.5, 60.5, 65, 69, 73]),
] as const;

export const fonteCategoriasIBJJF = 'https://ibjjf.com/books-videos';
