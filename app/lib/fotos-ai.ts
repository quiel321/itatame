export const FOTO_IA_MAX_BYTES = 300 * 1024;
export const FOTO_IA_MAX_DIMENSAO = 1920;

export function fotoIaStorageKey(fotoId: string) {
  return `ia/miniaturas/${fotoId}.jpg`;
}

export function fotoIaIndiceStorageKey(fotoId: string) {
  return `ia/indices/${fotoId}.json`;
}
