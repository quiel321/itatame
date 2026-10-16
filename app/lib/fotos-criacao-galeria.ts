export type OpcoesPublicacaoGaleria = { emBreve: boolean; acessoPorLink: boolean; downloadGratuito: boolean };

export function precoGaleriaCentavos(valor: string): number {
  if (!/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(valor.trim())) return NaN;
  return Math.round(Number(valor.trim().replace(/\./g, "").replace(",", ".")) * 100);
}

export function precosGaleriaValidos(foto: number, video: number, gratuito: boolean) {
  return [foto, video].every((valor) => Number.isInteger(valor) && valor >= (gratuito ? 0 : 1) && valor <= 1_000_000);
}
