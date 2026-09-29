export type FaixaDesconto = { quantidade: number; percentual: number };

export function normalizarFaixasDesconto(valor: unknown): FaixaDesconto[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((faixa) => ({ quantidade: Number(faixa?.quantidade), percentual: Number(faixa?.percentual) }))
    .filter((faixa) => Number.isInteger(faixa.quantidade) && faixa.quantidade >= 2 && faixa.quantidade <= 50 && Number.isFinite(faixa.percentual) && faixa.percentual > 0 && faixa.percentual <= 90)
    .sort((a, b) => a.quantidade - b.quantidade)
    .filter((faixa, indice, faixas) => indice === 0 || faixa.quantidade !== faixas[indice - 1].quantidade)
    .slice(0, 5);
}

export function faixasDoEvento(evento: { descontos_progressivos?: unknown; desconto_combo_qtd?: number | null; desconto_combo_percentual?: number | null }): FaixaDesconto[] {
  if (Array.isArray(evento.descontos_progressivos)) return normalizarFaixasDesconto(evento.descontos_progressivos);
  const quantidade = Number(evento.desconto_combo_qtd ?? 3);
  const percentual = Number(evento.desconto_combo_percentual ?? 20);
  return normalizarFaixasDesconto([{ quantidade, percentual }]);
}

export function faixaAplicavel(faixas: FaixaDesconto[], quantidade: number): FaixaDesconto | null {
  return faixas.filter((faixa) => quantidade >= faixa.quantidade).at(-1) ?? null;
}

export function calcularDescontoFotos(faixas: FaixaDesconto[], itens: { precoCentavos: number; mimeType?: string | null }[]) {
  const fotos = itens.filter((item) => !item.mimeType?.startsWith("video/"));
  const faixa = faixaAplicavel(faixas, fotos.length);
  const valor = faixa ? Math.round(fotos.reduce((total, item) => total + Math.max(0, item.precoCentavos), 0) * faixa.percentual / 100) : 0;
  return { faixa, valor };
}

export function validarFaixasDesconto(valor: unknown): FaixaDesconto[] | null {
  if (!Array.isArray(valor) || valor.length > 5) return null;
  if (valor.length === 0) return [];
  const faixas = normalizarFaixasDesconto(valor);
  if (faixas.length !== valor.length || faixas.some((faixa, indice) => indice > 0 && faixa.percentual <= faixas[indice - 1].percentual)) return null;
  return faixas;
}
