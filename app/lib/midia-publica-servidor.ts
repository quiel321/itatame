import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { putR2Object } from './r2';
import { CACHE_MIDIA_PUBLICA, chaveMidiaPublica, urlMidiaPublica, type TipoMidiaPublica, type EscopoMidiaPublica } from './midia-publica';

export function baseMidiaPublica(escopo: EscopoMidiaPublica = 'itatame') {
  return escopo === 'retratt'
    ? process.env.NEXT_PUBLIC_FOTOS_URL || 'https://retratt.com'
    : process.env.MIDIA_PUBLICA_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://itatame.com.br';
}

export function enderecoMidiaPublica(arquivo: string, escopo: EscopoMidiaPublica) {
  const direto = process.env[escopo === 'itatame' ? 'R2_ITATAME_PUBLIC_BASE_URL' : 'R2_RETRATT_PUBLIC_BASE_URL'];
  if (direto) {
    const base = new URL(direto);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('Domínio público do R2 inválido.');
    return new URL(chaveMidiaPublica(arquivo), base.href.replace(/\/$/, '') + '/').href;
  }
  return urlMidiaPublica(arquivo, baseMidiaPublica(escopo), escopo);
}

export async function prepararMidiaPublica(entrada: Buffer, tipo: TipoMidiaPublica) {
  if (!entrada.length || entrada.length > 20 * 1024 * 1024) throw new Error('Arquivo vazio ou muito grande.');
  let bytes: Buffer;
  let extensao: 'pdf' | 'webp';
  if (tipo === 'documento') {
    if (entrada.subarray(0, 5).toString() !== '%PDF-') throw new Error('Envie um documento PDF válido.');
    bytes = entrada;
    extensao = 'pdf';
  } else {
    const imagem = sharp(entrada, { limitInputPixels: 40_000_000, failOn: 'error' });
    const meta = await imagem.metadata();
    if (!meta.format || !['jpeg', 'png', 'webp', 'avif', 'heif', 'gif'].includes(meta.format)) {
      throw new Error('Formato de imagem não permitido.');
    }
    const tamanho = tipo === 'avatar' ? 500 : tipo === 'banner' ? 1280 : 1920;
    bytes = await imagem.rotate().resize(tamanho, tamanho, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: tipo === 'avatar' ? 78 : 80, effort: 5 }).toBuffer();
    extensao = 'webp';
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  const arquivo = `${hash}.${extensao}`;
  return { bytes, arquivo, key: chaveMidiaPublica(arquivo), contentType: extensao === 'pdf' ? 'application/pdf' : 'image/webp' };
}

/** Nunca publica o bucket: apenas este namespace contém arquivos já públicos. */
export async function salvarMidiaPublica(entrada: Buffer, tipo: TipoMidiaPublica, escopo: EscopoMidiaPublica = 'itatame') {
  const midia = await prepararMidiaPublica(entrada, tipo);
  await putR2Object(midia.key, midia.bytes, midia.contentType, CACHE_MIDIA_PUBLICA, escopo);
  return { ...midia, publicUrl: enderecoMidiaPublica(midia.arquivo, escopo) };
}
