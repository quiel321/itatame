export type TipoOperacao = 'checkin' | 'recepcao' | 'wo' | 'controle' | 'chamar' | 'iniciar' | 'pontuacao' | 'relogio' | 'finalizar' | 'corrigir';
export type ContextoOperacao = { evento: string; posto: string };
export type PedidoOperacao = ContextoOperacao & { id: string; tipo: TipoOperacao; alvo: string; dados: Record<string, unknown>; base: Record<string, unknown>; criada: string; estado: 'pendente' | 'confirmada'; resposta?: Record<string, any> };
export type ArmazenamentoOperacao = Pick<Storage, 'getItem' | 'setItem' | 'key' | 'length'>;
const PREFIXO = 'itatame:operacao:v1:';
const chave = (c: ContextoOperacao, tipo: string, alvo: string) => `${PREFIXO}${c.evento}:${c.posto}:${tipo}:${alvo}`;
function gravar(storage: ArmazenamentoOperacao, key: string, valor: unknown) {
  try { storage.setItem(key, JSON.stringify(valor)); }
  catch { throw new Error('Não foi possível proteger esta ação no aparelho. Não feche a tela; use o kit impresso e peça apoio ao organizador.'); }
}
export function pendenciasOperacao(storage: ArmazenamentoOperacao, contexto: ContextoOperacao): PedidoOperacao[] {
  const prefixo = `${PREFIXO}${contexto.evento}:${contexto.posto}:`;
  const lista: PedidoOperacao[] = [];
  for (let n = 0; n < storage.length; n++) {
    const key = storage.key(n);
    if (!key?.startsWith(prefixo)) continue;
    const bruto = storage.getItem(key);
    if (!bruto) continue;
    // Dados ilegíveis são um erro explícito; não descartamos a pendência.
    let item: PedidoOperacao;
    try { item = JSON.parse(bruto); } catch { throw new Error('Pendência local ilegível. Preserve este navegador e procure o organizador.'); }
    if (item.estado === 'pendente') lista.push(item);
  }
  return lista.sort((a,b) => a.criada.localeCompare(b.criada));
}
export function prepararOperacao(storage: ArmazenamentoOperacao, contexto: ContextoOperacao, tipo: TipoOperacao, alvo: string, dados: Record<string, unknown>, base: Record<string, unknown> = {}): PedidoOperacao {
  const key = chave(contexto, tipo, alvo);
  const bruto = storage.getItem(key);
  if (bruto) {
    const anterior: PedidoOperacao = JSON.parse(bruto);
    if (anterior.estado === 'pendente') {
      if (JSON.stringify(anterior.dados) !== JSON.stringify(dados) || JSON.stringify(anterior.base) !== JSON.stringify(base)) {
        throw new Error('Existe uma ação sem confirmação neste confronto. Use “Conferir ação pendente” antes de continuar.');
      }
      return anterior;
    }
  }
  const pedido: PedidoOperacao = { ...contexto, tipo, alvo, dados, base, id: crypto.randomUUID(), criada: new Date().toISOString(), estado: 'pendente' };
  gravar(storage, key, pedido);
  return pedido;
}
export async function enviarOperacao(storage: ArmazenamentoOperacao, pedido: PedidoOperacao, enviar: (p: PedidoOperacao) => Promise<Record<string, any>>) {
  const resposta = await enviar(pedido);
  if (resposta?.confirmada !== true || resposta.operacao_id !== pedido.id) throw new Error('O servidor não confirmou esta ação. A pendência continua protegida neste aparelho.');
  // O pedido completo fica auditado no servidor. Mantemos o último recibo local
  // de cada ação/inscrição, sem acumular milhares de cópias do mesmo placar.
  gravar(storage, chave(pedido, pedido.tipo, pedido.alvo), { ...pedido, estado: 'confirmada', dados: {}, base: {}, resposta: { operacao_id: pedido.id, confirmada: true } });
  return resposta;
}
export function guardarRascunho(storage: ArmazenamentoOperacao, contexto: ContextoOperacao, tipo: string, alvo: string, valor: unknown) {
  gravar(storage, `itatame:rascunho:v1:${contexto.evento}:${contexto.posto}:${tipo}:${alvo}`, valor);
}
// Apenas uma recusa explícita do banco permite encerrar a pendência sem recibo.
// A cópia completa é salva antes de liberar uma nova intenção; falha de quota bloqueia.
export function arquivarConflito(storage: ArmazenamentoOperacao, pedido: PedidoOperacao, recusa: string) {
  if (!recusa.startsWith('Conflito:')) throw new Error('Confira a ação no servidor antes de arquivar.');
  const registro = { ...pedido, estado: 'arquivada', recusa, conferidaEm: new Date().toISOString() };
  gravar(storage, `itatame:arquivo-operacao:v1:${pedido.evento}:${pedido.posto}:${pedido.id}`, registro);
  gravar(storage, chave(pedido,pedido.tipo,pedido.alvo), registro);
}
export function lerRascunho<T>(storage: ArmazenamentoOperacao, contexto: ContextoOperacao, tipo: string, alvo: string): T | null {
  const bruto = storage.getItem(`itatame:rascunho:v1:${contexto.evento}:${contexto.posto}:${tipo}:${alvo}`);
  if (!bruto) return null;
  try { return JSON.parse(bruto); } catch { throw new Error('Rascunho local ilegível. Não limpe os dados deste aparelho.'); }
}
