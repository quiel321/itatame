// Limita também a leitura do corpo: uma conexão pode entregar os cabeçalhos
// e parar depois. Não repete gravações, pois o servidor pode já tê-las aplicado.
export function criarFetchComPrazo(fetchOriginal: typeof fetch, prazoMs = 20000): typeof fetch {
  return async (input, init) => {
    const url = String(typeof input === 'string' || input instanceof URL ? input : input.url);
    // Uploads e downloads de fotografias têm duração variável.
    if (!/\/(auth|rest)\/v1(?:\/|\?|$)/.test(url)) return fetchOriginal(input, init);
    const controller = new AbortController();
    const origem = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const cancelar = () => controller.abort(origem?.reason);
    if (origem?.aborted) cancelar();
    else origem?.addEventListener('abort', cancelar, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const limite = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const erro = new DOMException('O servidor não respondeu a tempo. Confira a conexão e consulte os dados antes de repetir uma gravação.', 'TimeoutError');
          controller.abort(erro);
          reject(erro);
        }, prazoMs);
      });
      return await Promise.race([
        (async () => {
          const resposta = await fetchOriginal(input, { ...init, signal: controller.signal });
          if (!resposta.body) return resposta;
          const corpo = await resposta.arrayBuffer();
          return new Response(corpo, { status: resposta.status, statusText: resposta.statusText, headers: resposta.headers });
        })(),
        limite,
      ]);
    } finally {
      clearTimeout(timer);
      origem?.removeEventListener('abort', cancelar);
    }
  };
}
