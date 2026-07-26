export const FOTO_IA_MAX_BYTES = 300 * 1024;
export const FOTO_IA_MAX_DIMENSAO = 1920;
export const FOTO_IA_NUMERO_TAG_PREFIX = "ia-numero:";

export function fotoIaNumeroTag(numero: string) {
  return `${FOTO_IA_NUMERO_TAG_PREFIX}${numero}`;
}

export function mesclarTagsNumerosIa(tags: string[] | null | undefined, numeros: string[]) {
  return [
    ...(tags || []).filter((tag) => !tag.startsWith(FOTO_IA_NUMERO_TAG_PREFIX)),
    ...numeros.map(fotoIaNumeroTag),
  ];
}

export function fotoIaStorageKey(fotoId: string) {
  return `ia/miniaturas/${fotoId}.jpg`;
}

export function fotoIaIndiceStorageKey(fotoId: string) {
  return `ia/indices/${fotoId}.json`;
}
