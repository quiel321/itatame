/** Estornos concluídos permanecem no histórico, mas não participam da competição. */
export function inscricaoAtiva(inscricao: { estorno_status?: unknown }) {
  return inscricao.estorno_status !== 'estornado';
}
