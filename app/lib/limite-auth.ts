const solicitacoes = new Map<string, { inicio: number; quantidade: number }>();

/** Limite simples por instância para reduzir uso indevido dos envios públicos. */
export function consumirLimiteAuth(chave: string, maximo: number, janelaMs: number) {
  const agora = Date.now();
  if (solicitacoes.size > 2000) {
    for (const [item, valor] of solicitacoes) if (agora - valor.inicio > 60 * 60_000) solicitacoes.delete(item);
  }
  const anterior = solicitacoes.get(chave);
  if (!anterior || agora - anterior.inicio >= janelaMs) {
    solicitacoes.set(chave, { inicio: agora, quantidade: 1 });
    return true;
  }
  if (anterior.quantidade >= maximo) return false;
  anterior.quantidade++;
  return true;
}

export function ipDaRequisicao(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip') || 'desconhecido';
}
