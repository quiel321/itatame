export const LIMITE_COMISSOES_PERCENTUAL = 90;
export const COMISSAO_ITATAME_FOTOS_PERCENTUAL = 9.5;
export const LIMITE_ROYALTY_ORGANIZADOR_PERCENTUAL = 15;

function percentualSeguro(valor: unknown) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.min(LIMITE_COMISSOES_PERCENTUAL, Math.max(0, numero));
}

export function calcularDistribuicaoFotos({
  totalCentavos,
  percentualItatame,
  percentualOrganizador,
}: {
  totalCentavos: number;
  percentualItatame: unknown;
  percentualOrganizador: unknown;
}) {
  const total = Math.max(0, Math.round(Number(totalCentavos) || 0));
  const itatame = percentualSeguro(percentualItatame);
  const organizador = percentualSeguro(percentualOrganizador);

  if (itatame + organizador > LIMITE_COMISSOES_PERCENTUAL) {
    throw new Error(
      `A soma da comissão do Itatame (${itatame}%) e do royalty do organizador (${organizador}%) não pode ultrapassar ${LIMITE_COMISSOES_PERCENTUAL}%.`,
    );
  }

  const comissaoItatameCentavos = Math.round(total * itatame / 100);
  const comissaoOrganizadorCentavos = Math.round(total * organizador / 100);
  const comissaoMarketplaceCentavos = comissaoItatameCentavos + comissaoOrganizadorCentavos;

  return {
    percentualItatame: itatame,
    percentualOrganizador: organizador,
    comissaoItatameCentavos,
    comissaoOrganizadorCentavos,
    comissaoMarketplaceCentavos,
    fotografoAntesDaTarifaCentavos: total - comissaoMarketplaceCentavos,
  };
}
