// lib/cronograma.ts

// Função inteligente que descobre o tempo baseado no nome da categoria e faixa
export function obterTempoRegulamentar(categoria: string, faixa: string): number {
  const cat = categoria.toUpperCase();
  const fx = faixa.toUpperCase();

  // CATEGORIAS INFANTIS
  if (cat.includes('PRÉ-MIRIM')) return 2;
  if (cat.includes('MIRIM') && !cat.includes('PRÉ')) return 3;
  if (cat.includes('INFANTIL')) return 4;
  if (cat.includes('INFANTO')) return 4;
  if (cat.includes('JUVENIL') && !cat.includes('INFANTO')) return 5;

  // MASTER 2 AO 7 (Todas as faixas são 5 minutos)
  if (cat.includes('MASTER 2') || cat.includes('MASTER 3') || cat.includes('MASTER 4') || 
      cat.includes('MASTER 5') || cat.includes('MASTER 6') || cat.includes('MASTER 7')) {
    return 5;
  }

  // MASTER 1
  if (cat.includes('MASTER 1')) {
    if (fx.includes('BRANCA') || fx.includes('AZUL')) return 5;
    return 6; // Roxa, Marrom, Preta
  }

  // ADULTO (Se não caiu nos de cima, assumimos Adulto como padrão)
  if (fx.includes('BRANCA')) return 5;
  if (fx.includes('AZUL')) return 6;
  if (fx.includes('ROXA')) return 7;
  if (fx.includes('MARROM')) return 8;
  if (fx.includes('PRETA')) return 10;

  // Padrão de segurança caso a categoria tenha um nome muito fora do comum
  return 5; 
}