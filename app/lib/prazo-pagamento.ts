import { dataOperacionalEvento } from './evento-datas';

export function pagamentoEventoEncerrado(
  evento: { data_fim_pagamento?: string | null; estado?: string | null },
  agora = new Date(),
) {
  if (!evento.data_fim_pagamento) return false;
  try {
    const fim = dataOperacionalEvento(evento.data_fim_pagamento, true, evento.estado);
    return !fim || agora > fim;
  } catch {
    // Uma data inválida não autoriza a abertura de uma cobrança.
    return true;
  }
}
