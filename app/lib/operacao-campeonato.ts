type Resultado = { atleta_1?: string | null; atleta_2?: string | null; status_luta?: string | null; metodo_vitoria?: string | null };
export function atletaOperacional(nome?: string | null) {
  const n = String(nome || '').trim().toUpperCase();
  return Boolean(n) && !['BYE', 'TBD'].includes(n) && !n.includes('SEM OPONENTE');
}
export function resultadoOperacional(luta: Resultado) {
  if (luta.status_luta !== 'concluida') return 'pendente';
  const reais = [luta.atleta_1, luta.atleta_2].filter(atletaOperacional).length;
  if (reais === 0) return 'vazio';
  if (reais === 1) return 'bye';
  return luta.metodo_vitoria === 'wo' ? 'wo' : 'combate';
}

