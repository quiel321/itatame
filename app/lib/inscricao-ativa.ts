export const FILTRO_INSCRICOES_ATIVAS = 'estorno_status.is.null,estorno_status.neq.estornado';

/** Estornos concluídos permanecem no histórico, mas não participam da competição. */
export function inscricaoAtiva(inscricao: { estorno_status?: unknown }) {
  return inscricao.estorno_status !== 'estornado';
}
