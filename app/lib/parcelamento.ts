export function limiteParcelas(compradorConfirmado: unknown) { return compradorConfirmado === true ? 12 : 1; }
export function validarParcelas(valor: unknown, limite: number) {
  const parcelas = valor == null ? 1 : Number(valor);
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > limite) throw new Error(`Escolha entre 1 e ${limite} parcelas.`);
  return parcelas;
}
