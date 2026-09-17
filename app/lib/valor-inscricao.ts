export type EventoValoresInscricao = {
  lote1_valor?: number | string | null;
  lote1_data_fim?: string | null;
  lote2_valor?: number | string | null;
  lote2_data_fim?: string | null;
  lote3_valor?: number | string | null;
  lote3_data_fim?: string | null;
  valor_absoluto?: number | string | null;
  regras_pontuacao_equipes?: {
    valor_absoluto?: number | string | null;
  } | null;
};

function numeroValor(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dataFimLote(valor?: string | null) {
  if (!valor) return null;
  return new Date(valor.includes("T") ? valor : `${valor}T23:59:59`);
}

function primeiroNumeroDefinido(...valores: unknown[]) {
  for (const valor of valores) {
    if (valor === null || valor === undefined || valor === "") continue;
    const parsed = Number(valor);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

export function valorAddonAbsoluto(evento: EventoValoresInscricao) {
  return primeiroNumeroDefinido(evento.valor_absoluto, evento.regras_pontuacao_equipes?.valor_absoluto);
}

export function formatarValorInscricao(valor: number) {
  return `R$ ${numeroValor(valor).toFixed(2).replace('.', ',')}`;
}

export function valorComboPesoAbsoluto(valorLote: number, evento: EventoValoresInscricao) {
  return numeroValor(valorLote) + valorAddonAbsoluto(evento);
}

export function valorLoteVigente(evento: EventoValoresInscricao, agora = new Date()) {
  const lote1Fim = dataFimLote(evento.lote1_data_fim);
  const lote2Fim = dataFimLote(evento.lote2_data_fim);
  const lote3Fim = dataFimLote(evento.lote3_data_fim);

  if (lote1Fim && agora <= lote1Fim) return numeroValor(evento.lote1_valor);
  if (lote2Fim && agora <= lote2Fim) return numeroValor(evento.lote2_valor);
  if (lote3Fim && agora <= lote3Fim) return numeroValor(evento.lote3_valor);
  return numeroValor(evento.lote3_valor) || numeroValor(evento.lote2_valor) || numeroValor(evento.lote1_valor);
}

export function calcularValorInscricao(
  inscricao: { absoluto?: boolean | null; categoria?: string | null },
  evento: EventoValoresInscricao,
  agora = new Date(),
) {
  const valor = valorLoteVigente(evento, agora);
  const lutaPesoEAbsoluto = inscricao.absoluto === true && inscricao.categoria !== "Absoluto";
  return lutaPesoEAbsoluto ? valor + valorAddonAbsoluto(evento) : valor;
}
