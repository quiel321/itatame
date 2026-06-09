export type PlanoComercialId = "essencial" | "completo";

export type PlanoComercial = {
  id: PlanoComercialId;
  nome: string;
  resumo: string;
  comissaoPercentual: number;
  recursos: string[];
};

export const PLANOS_COMERCIAIS: PlanoComercial[] = [
  {
    id: "essencial",
    nome: "Essencial",
    resumo: "Chaveamento, check-in e inscrições online.",
    comissaoPercentual: 5,
    recursos: ["Chaveamento", "Check-in", "Controle de inscrições"],
  },
  {
    id: "completo",
    nome: "Completo",
    resumo: "Operação inteira do evento com tatames, mesário e painel ao vivo.",
    comissaoPercentual: 10,
    recursos: ["Painel do mesário", "Gestão de tatames", "Ao vivo e chamadas"],
  },
];

export const PLANO_COMERCIAL_PADRAO: PlanoComercialId = "essencial";

export function normalizarPlanoComercial(plano?: string | null): PlanoComercialId {
  return PLANOS_COMERCIAIS.some((item) => item.id === plano)
    ? (plano as PlanoComercialId)
    : PLANO_COMERCIAL_PADRAO;
}

export function getPlanoComercial(plano?: string | null): PlanoComercial {
  const planoId = normalizarPlanoComercial(plano);
  return PLANOS_COMERCIAIS.find((item) => item.id === planoId) || PLANOS_COMERCIAIS[0];
}

export function calcularComissaoMarketplace(valorTotal: number, plano?: string | null) {
  const planoComercial = getPlanoComercial(plano);
  const valor = Number.isFinite(valorTotal) ? Math.max(0, valorTotal) : 0;
  const comissao = Number(((valor * planoComercial.comissaoPercentual) / 100).toFixed(2));

  return {
    plano: planoComercial,
    valorTotal: valor,
    comissao,
    valorOrganizador: Number((valor - comissao).toFixed(2)),
  };
}