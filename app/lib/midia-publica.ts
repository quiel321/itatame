export type TipoMidiaPublica = 'avatar' | 'banner' | 'capa' | 'documento';
export type EscopoMidiaPublica = 'itatame' | 'retratt';

export const MAX_UPLOAD_PUBLICO = 4 * 1024 * 1024;
export const CACHE_MIDIA_PUBLICA = 'public, max-age=31536000, immutable';
export const ARQUIVO_PUBLICO = /^[a-f0-9]{64}\.(webp|pdf)$/;

export function chaveMidiaPublica(arquivo: string) {
  if (!ARQUIVO_PUBLICO.test(arquivo)) throw new Error('Arquivo público inválido.');
  return `midia-publica/v1/${arquivo}`;
}

export function urlMidiaPublica(arquivo: string, base = 'https://itatame.com.br', escopo: EscopoMidiaPublica = 'itatame') {
  chaveMidiaPublica(arquivo);
  return new URL(`/api/midia-publica/${escopo}/${arquivo}`, base).href;
}

/** Somente os dois buckets públicos existentes, no projeto configurado. */
export function origemPublicaSupabase(valor: string, supabaseUrl: string) {
  try {
    const url = new URL(valor);
    if (url.origin !== new URL(supabaseUrl).origin || url.username || url.password) return null;
    const partes = decodeURIComponent(url.pathname).match(/^\/storage\/v1\/object\/public\/(avatars|eventos)\/(.+)$/);
    if (!partes || partes[2].split('/').some(p => !p || p === '.' || p === '..')) return null;
    return { bucket: partes[1], caminho: partes[2], url: url.href };
  } catch { return null; }
}
