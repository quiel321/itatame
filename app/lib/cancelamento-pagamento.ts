export type AcaoPagamentoPendente = "cancelar-no-provedor" | "remover-inscricao" | "preservar-inscricao";

export function acaoParaPagamentoPendente(status: string): AcaoPagamentoPendente {
  if (["pending", "in_process", "authorized"].includes(status)) return "cancelar-no-provedor";
  if (["cancelled", "rejected"].includes(status)) return "remover-inscricao";
  return "preservar-inscricao";
}

export function pagamentoPertenceAInscricao(referencia: unknown, inscricaoId: string | number) {
  return referencia === `inscricao:${inscricaoId}`;
}
