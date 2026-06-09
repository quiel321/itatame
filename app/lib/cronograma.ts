function normalizarTexto(valor: string): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export function obterTempoRegulamentar(categoria: string, faixa: string): number {
  const cat = normalizarTexto(categoria);
  const fx = normalizarTexto(faixa);

  if (cat.includes('PRE-MIRIM')) return 2;
  if (cat.includes('MIRIM') && !cat.includes('PRE')) return 3;
  if (cat.includes('INFANTIL')) return 4;
  if (cat.includes('INFANTO')) return 4;
  if (cat.includes('JUVENIL') && !cat.includes('INFANTO')) return 5;

  if (
    cat.includes('MASTER 2') ||
    cat.includes('MASTER 3') ||
    cat.includes('MASTER 4') ||
    cat.includes('MASTER 5') ||
    cat.includes('MASTER 6') ||
    cat.includes('MASTER 7')
  ) {
    return 5;
  }

  if (cat.includes('MASTER 1')) {
    if (fx.includes('BRANCA') || fx.includes('AZUL')) return 5;
    return 6;
  }

  if (fx.includes('BRANCA')) return 5;
  if (fx.includes('AZUL')) return 6;
  if (fx.includes('ROXA')) return 7;
  if (fx.includes('MARROM')) return 8;
  if (fx.includes('PRETA')) return 10;

  return 5;
}