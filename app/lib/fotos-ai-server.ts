import sharp from "sharp";
import { FOTO_IA_MAX_BYTES, FOTO_IA_MAX_DIMENSAO, fotoIaIndiceStorageKey, fotoIaStorageKey } from "@/app/lib/fotos-ai";
import { cadastrarRostosDaFoto, excluirRostos } from "@/app/lib/rekognition";
import { deleteR2Object, getR2ObjectBytes, putR2Object, tryGetR2ObjectBytes } from "@/app/lib/r2";

type FotoIndiceIa = {
  fotoId: string;
  sourceKey: string;
  collectionId: string;
  modelVersion?: string;
  faceIds: string[];
  indexedFaces: number;
  unindexedFaces: string[];
  strategy?: "full" | "full+tiles";
  indexedAt: string;
};

function parseIndice(bytes: Buffer | null): FotoIndiceIa | null {
  if (!bytes) return null;
  try {
    const value = JSON.parse(bytes.toString("utf8")) as Partial<FotoIndiceIa>;
    if (!value.fotoId || !Array.isArray(value.faceIds)) return null;
    return value as FotoIndiceIa;
  } catch {
    return null;
  }
}

export async function criarMiniaturaIa(source: Buffer) {
  const dimensoes = [FOTO_IA_MAX_DIMENSAO, 1760, 1600, 1440, 1280, 1120, 960];
  const qualidades = [86, 78, 70, 62, 54];
  let menor: Buffer | null = null;

  for (const dimensao of dimensoes) {
    for (const qualidade of qualidades) {
      const output = await sharp(source, { failOn: "none" })
        .rotate()
        .resize(dimensao, dimensao, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: qualidade, mozjpeg: true, chromaSubsampling: "4:2:0" })
        .toBuffer();

      if (!menor || output.length < menor.length) menor = output;
      if (output.length <= FOTO_IA_MAX_BYTES) return output;
    }
  }

  if (!menor || menor.length > FOTO_IA_MAX_BYTES) {
    throw new Error("Nao foi possivel gerar a miniatura de IA abaixo de 300 KB.");
  }
  return menor;
}

export async function obterIndiceIa(fotoId: string) {
  return parseIndice(await tryGetR2ObjectBytes(fotoIaIndiceStorageKey(fotoId), 128 * 1024));
}

async function salvarIndice(indice: FotoIndiceIa) {
  await putR2Object(
    fotoIaIndiceStorageKey(indice.fotoId),
    Buffer.from(JSON.stringify(indice)),
    "application/json; charset=utf-8",
  );
}

async function criarTilesIa(source: Buffer) {
  const orientada = await sharp(source, { failOn: "none" }).rotate().toBuffer();
  const metadata = await sharp(orientada).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (width < 320 || height < 320) return [];

  const tileWidth = Math.min(width, Math.max(320, Math.round(width * 0.52)));
  const tileHeight = Math.min(height, Math.max(320, Math.round(height * 0.68)));
  const lefts = [0, Math.round((width - tileWidth) / 2), width - tileWidth];
  const tops = [0, height - tileHeight];
  const tiles: Buffer[] = [];

  for (const top of tops) {
    for (const left of lefts) {
      const recorte = await sharp(orientada)
        .extract({ left: Math.max(0, left), top: Math.max(0, top), width: tileWidth, height: tileHeight })
        .toBuffer();
      tiles.push(await criarMiniaturaIa(recorte));
    }
  }
  return tiles;
}

async function indexarTilesComplementares(fotoId: string, source: Buffer, indiceBase: FotoIndiceIa) {
  const tiles = await criarTilesIa(source);
  const faceIds = [...indiceBase.faceIds];
  const unindexedFaces = [...indiceBase.unindexedFaces];
  let modelVersion = indiceBase.modelVersion;

  try {
    for (const tile of tiles) {
      const resultado = await cadastrarRostosDaFoto(fotoId, tile);
      faceIds.push(...resultado.faceIds);
      unindexedFaces.push(...resultado.unindexedFaces);
      modelVersion = resultado.modelVersion || modelVersion;
    }
  } catch (error) {
    await deleteR2Object(fotoIaIndiceStorageKey(fotoId)).catch(() => undefined);
    throw error;
  }

  const indice: FotoIndiceIa = {
    ...indiceBase,
    modelVersion,
    faceIds: [...new Set(faceIds)],
    indexedFaces: [...new Set(faceIds)].length,
    unindexedFaces,
    strategy: "full+tiles",
    indexedAt: new Date().toISOString(),
  };
  await salvarIndice(indice);
  return indice;
}

export async function indexarMiniaturaIaDoR2(
  fotoId: string,
  options: { force?: boolean; fallbackOriginalKey?: string; fallbackSource?: Buffer } = {},
) {
  const existente = await obterIndiceIa(fotoId);
  if (existente && !options.force) return { ...existente, skipped: true as const };

  if (existente?.faceIds.length) await excluirRostos(existente.faceIds);

  const sourceKey = fotoIaStorageKey(fotoId);
  const imageBytes = await getR2ObjectBytes(sourceKey, FOTO_IA_MAX_BYTES);
  const resultado = await cadastrarRostosDaFoto(fotoId, imageBytes);
  const indice: FotoIndiceIa = {
    fotoId,
    sourceKey,
    collectionId: resultado.collectionId,
    modelVersion: resultado.modelVersion,
    faceIds: resultado.faceIds,
    indexedFaces: resultado.indexedFaces,
    unindexedFaces: resultado.unindexedFaces,
    strategy: "full",
    indexedAt: new Date().toISOString(),
  };

  await salvarIndice(indice);

  if (!indice.indexedFaces && (options.fallbackSource || options.fallbackOriginalKey)) {
    const source = options.fallbackSource || await getR2ObjectBytes(options.fallbackOriginalKey!, 6 * 1024 * 1024);
    const complementado = await indexarTilesComplementares(fotoId, source, indice);
    return { ...complementado, skipped: false as const };
  }

  return { ...indice, skipped: false as const };
}

export async function prepararEIndexarFotoExistente(
  foto: { id: string; r2_original_key: string },
  options: { force?: boolean } = {},
) {
  const existente = await obterIndiceIa(foto.id);
  if (existente && !options.force) return { ...existente, skipped: true as const, thumbnailBytes: null };

  const original = await getR2ObjectBytes(foto.r2_original_key, 6 * 1024 * 1024);
  const miniatura = await criarMiniaturaIa(original);
  await putR2Object(fotoIaStorageKey(foto.id), miniatura, "image/jpeg");
  const resultado = await indexarMiniaturaIaDoR2(foto.id, { ...options, fallbackSource: original });
  return { ...resultado, thumbnailBytes: miniatura.length };
}

export async function removerIaDaFoto(fotoId: string) {
  const indice = await obterIndiceIa(fotoId);
  const facesRemovidas = indice?.faceIds.length ? await excluirRostos(indice.faceIds) : 0;
  const resultados = await Promise.allSettled([
    deleteR2Object(fotoIaStorageKey(fotoId)),
    deleteR2Object(fotoIaIndiceStorageKey(fotoId)),
  ]);
  const falhasR2 = resultados.filter((resultado) => resultado.status === "rejected").length;
  if (falhasR2) throw new Error(`Falha ao remover ${falhasR2} arquivo(s) de IA do R2.`);
  return { facesRemovidas };
}
