export type ModeloPesoIBJJF = {
  id: 'adulto_masculino_gi' | 'adulto_feminino_gi';
  titulo: string;
  descricao: string;
  sexo: 'Masculino' | 'Feminino';
  pesos: readonly { nome: string; peso_min: number; peso_max: number | null }[];
};

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
] as const;

export const fonteCategoriasIBJJF = 'https://ibjjf.com/books-videos';
