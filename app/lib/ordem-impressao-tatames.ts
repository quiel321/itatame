type PosicaoImpressao = { tatame?: string | null; ordem_tatame?: number | null; categoria?: string | null };

const nomeTatame = (v?: string | null) => {
  const nome = (v || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return ['NAO DEFINIDO', 'SEM TATAME', 'SEM TATAME DEFINIDO'].includes(nome) ? '' : nome;
};
const ordem = (v?: number | null) => typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : Infinity;

/** Mesma fila salva na zona de tatame. Horários estimados não reordenam categorias. */
export function compararOrdemImpressao(a: PosicaoImpressao, b: PosicaoImpressao) {
  const ta = nomeTatame(a.tatame), tb = nomeTatame(b.tatame);
  if (Boolean(ta) !== Boolean(tb)) return ta ? -1 : 1;
  const tatame = ta.localeCompare(tb, 'pt-BR', { numeric: true });
  if (tatame) return tatame;
  const oa = ta ? ordem(a.ordem_tatame) : Infinity, ob = tb ? ordem(b.ordem_tatame) : Infinity;
  if (oa !== ob) return oa < ob ? -1 : 1;
  return (a.categoria || '').localeCompare(b.categoria || '', 'pt-BR', { numeric: true });
}

export function ordenarLutasImpressao<T extends PosicaoImpressao>(lutas: T[]) {
  return [...lutas].sort(compararOrdemImpressao);
}
