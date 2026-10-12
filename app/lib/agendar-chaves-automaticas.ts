// O servidor continua validando as datas. Esta função apenas dispara a consulta
// quando a página já estava aberta antes da divulgação, e tenta novamente se falhar.
export function agendarChavesAutomaticas(
  eventoId: string,
  divulgacao: Date | null,
  concluir: () => void | Promise<void> = () => {},
  ambiente = {
    agora: () => Date.now(),
    agendar: (acao: () => void, atraso: number) => setTimeout(acao, atraso),
    cancelar: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
    consultar: (url: string) => fetch(url, { cache: 'no-store' }),
  },
) {
  let cancelado = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let tentativas = 0;
  const executar = async () => {
    if (cancelado) return;
    const atraso = divulgacao ? divulgacao.getTime() - ambiente.agora() : 0;
    if (!Number.isFinite(atraso)) return;
    if (atraso > 0) {
      timer = ambiente.agendar(() => { void executar(); }, Math.min(atraso, 2_147_483_647));
      return;
    }
    try {
      const resposta = await ambiente.consultar(`/api/eventos/${encodeURIComponent(eventoId)}/gerar-chaves-auto`);
      if (!resposta.ok) throw new Error('Geração indisponível.');
      if (!cancelado) await concluir();
    } catch {
      if (!cancelado && ++tentativas < 4) timer = ambiente.agendar(() => { void executar(); }, 15_000);
    }
  };
  void executar();
  return () => { cancelado = true; if (timer !== undefined) ambiente.cancelar(timer); };
}
