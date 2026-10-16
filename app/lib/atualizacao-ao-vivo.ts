/** Agrupa avisos de atualização sem executar leituras concorrentes ou aplicar
 * respostas depois de sair da tela. Uma falha será tentada no próximo aviso. */
export function criarAtualizacaoAoVivo(
  atualizar: (estaAtivo: () => boolean) => Promise<void>,
  aoFalhar?: (erro: unknown) => void,
) {
  let ativo = true;
  let pendente = false;
  let tarefa: Promise<void> | null = null;
  const estaAtivo = () => ativo;

  function solicitar(): Promise<void> {
    if (!ativo) return Promise.resolve();
    pendente = true;
    if (tarefa) return tarefa;
    tarefa = Promise.resolve().then(async () => {
      while (ativo && pendente) {
        pendente = false;
        try { await atualizar(estaAtivo); }
        catch (erro) { if (ativo) aoFalhar?.(erro); }
      }
    }).finally(() => { tarefa = null; });
    return tarefa;
  }

  return { solicitar, cancelar: () => { ativo = false; pendente = false; } };
}
