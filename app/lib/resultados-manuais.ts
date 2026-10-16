import { idBaiaDaPrimeiraChaveDeTres } from './chave-de-tres';

export type LutaResultadoManual = {
  id: string; id_visual: string; categoria: string; categoria_id?: string | null; faixa: string;
  fase: string; ordem?: number | null; proxima_luta?: string | number | null;
  atleta_1: string; atleta_2: string; atleta_1_id: number | null; atleta_2_id: number | null;
  vencedor: string | null; vencedor_id?: number | null; status_luta: string | null; iniciada_em?: string | null;
};

export function bloqueioResultadoManual(todas: LutaResultadoManual[], luta: LutaResultadoManual, contingencia = false): string {
  if (luta.status_luta === 'concluida' || luta.vencedor || luta.vencedor_id) return 'Resultado já registrado. Não será sobrescrito.';
  if (!contingencia && (luta.status_luta === 'em_andamento' || luta.iniciada_em)) return 'Esta luta já iniciou no placar. Finalize a operação no placar.';
  const grupo = todas.filter(l => l.categoria === luta.categoria && l.faixa === luta.faixa);
  if (grupo.filter(l => String(l.id_visual) === String(luta.id_visual)).length !== 1) return 'Identificação de luta ambígua. Procure a organização.';
  const anteriores = grupo.filter(l => l.id !== luta.id && (
    (l.proxima_luta != null && String(l.proxima_luta) === String(luta.id_visual))
    || idBaiaDaPrimeiraChaveDeTres(l.id_visual, l.fase) === String(luta.id_visual)
  ));
  if (anteriores.some(l => l.status_luta !== 'concluida')) return 'Aguarde a conclusão das lutas anteriores desta chave.';
  for (const anterior of anteriores) {
    const repescagem = idBaiaDaPrimeiraChaveDeTres(anterior.id_visual, anterior.fase) === String(luta.id_visual);
    const esperado = repescagem
      ? anterior.vencedor_id === anterior.atleta_1_id ? anterior.atleta_2_id : anterior.atleta_1_id
      : anterior.vencedor_id;
    const atual = repescagem || Number(anterior.id_visual) % 2 ? luta.atleta_1_id : luta.atleta_2_id;
    if (!esperado || esperado !== atual) return 'Os avanços anteriores ainda não foram conferidos. Atualize as chaves antes de registrar.';
  }
  const destinos = grupo.filter(l => (luta.proxima_luta != null && String(l.id_visual) === String(luta.proxima_luta))
    || idBaiaDaPrimeiraChaveDeTres(luta.id_visual, luta.fase) === String(l.id_visual));
  if (luta.proxima_luta != null && !destinos.some(l => String(l.id_visual) === String(luta.proxima_luta))) return 'Próxima luta não encontrada. Confira a chave.';
  if (destinos.some(l => l.status_luta === 'em_andamento' || l.status_luta === 'concluida' || l.vencedor || l.vencedor_id || l.iniciada_em)) return 'Uma luta seguinte já iniciou ou tem resultado. O lançamento foi bloqueado.';
  if (!luta.atleta_1_id && !luta.atleta_2_id) return 'Aguarde a definição dos atletas desta luta.';
  if (luta.atleta_1_id && luta.atleta_1_id === luta.atleta_2_id) return 'A chave contém o mesmo atleta nos dois lados. Confira antes de registrar.';
  return '';
}
