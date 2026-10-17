export const PAGAMENTOS_FOTOS_KEY = 'retratt_pagamentos_pendentes';
export type PagamentoFotosPendente = { pedidoId: string; acesso: string | null; fotoIds: string[] };
export function lerCarrinhoFotos() {
  try { const ids = JSON.parse(localStorage.getItem('carrinho_fotos') || '[]'); return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string'))] : []; } catch { return []; }
}
export function pagamentosFotosPendentes(): PagamentoFotosPendente[] {
  try {
    const dados = JSON.parse(localStorage.getItem(PAGAMENTOS_FOTOS_KEY) || '[]');
    return Array.isArray(dados) ? dados.filter(p => p && typeof p.pedidoId === 'string' && (p.acesso === null || typeof p.acesso === 'string') && Array.isArray(p.fotoIds) && p.fotoIds.every((id: unknown) => typeof id === 'string')) : [];
  } catch { return []; }
}
export function registrarPagamentoFotos(pagamento: PagamentoFotosPendente) {
  localStorage.setItem(PAGAMENTOS_FOTOS_KEY, JSON.stringify([...pagamentosFotosPendentes().filter(p => p.pedidoId !== pagamento.pedidoId), pagamento]));
  window.dispatchEvent(new Event('retratt-pagamentos-atualizados'));
}
export function retirarPagamentoFotos(pedidoId: string) {
  localStorage.setItem(PAGAMENTOS_FOTOS_KEY, JSON.stringify(pagamentosFotosPendentes().filter(p => p.pedidoId !== pedidoId)));
  window.dispatchEvent(new Event('retratt-pagamentos-atualizados'));
}
/** Sempre lê o carrinho atual: fotos adicionadas depois da compra são preservadas. */
export function retirarFotosCompradas(fotoIds: string[]) {
  const remover = new Set(fotoIds), atuais = lerCarrinhoFotos();
  const restantes = atuais.filter(id => !remover.has(id));
  if (restantes.length !== atuais.length) {
    localStorage.setItem('carrinho_fotos', JSON.stringify(restantes));
    window.dispatchEvent(new CustomEvent('carrinho-fotos-atualizado', { detail: restantes }));
  }
  return restantes;
}
