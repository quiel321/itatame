import {
  CreateCollectionCommand,
  DeleteFacesCommand,
  DescribeCollectionCommand,
  IndexFacesCommand,
  RekognitionClient,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} nao configurado.`);
  return value;
}

function awsErrorName(error: unknown) {
  if (typeof error === "object" && error && "name" in error) return String(error.name);
  return "";
}

function criarCliente() {
  return new RekognitionClient({
    region: requireEnv("AWS_REGION"),
    credentials: {
      accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
    },
  });
}

export function rekognitionCollectionId() {
  const configurado = process.env.REKOGNITION_COLLECTION_ID?.trim();
  if (configurado) return configurado;

  const prefixo = (process.env.REKOGNITION_COLLECTION_PREFIX || "itatame")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "itatame";

  return `${prefixo.replace(/-faces(?:-v\d+)?$/i, "")}-faces-v1`.slice(0, 255);
}

let colecaoPromise: Promise<{ collectionId: string; modelVersion?: string; faceCount?: number }> | null = null;

export async function garantirColecaoRostos() {
  if (colecaoPromise) return colecaoPromise;

  colecaoPromise = (async () => {
    const client = criarCliente();
    const collectionId = rekognitionCollectionId();

    try {
      const atual = await client.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
      return { collectionId, modelVersion: atual.FaceModelVersion, faceCount: atual.FaceCount };
    } catch (error: unknown) {
      if (awsErrorName(error) !== "ResourceNotFoundException") throw error;
    }

    try {
      const criada = await client.send(new CreateCollectionCommand({ CollectionId: collectionId }));
      return { collectionId, modelVersion: criada.FaceModelVersion, faceCount: 0 };
    } catch (error: unknown) {
      if (awsErrorName(error) !== "ResourceAlreadyExistsException") throw error;
      const atual = await client.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
      return { collectionId, modelVersion: atual.FaceModelVersion, faceCount: atual.FaceCount };
    }
  })().catch((error) => {
    colecaoPromise = null;
    throw error;
  });

  return colecaoPromise;
}

export async function cadastrarRostosDaFoto(fotoId: string, imageBytes: Buffer | Uint8Array) {
  const { collectionId } = await garantirColecaoRostos();
  const response = await criarCliente().send(new IndexFacesCommand({
    CollectionId: collectionId,
    Image: { Bytes: imageBytes },
    ExternalImageId: fotoId,
    MaxFaces: 100,
    QualityFilter: "LOW",
    DetectionAttributes: ["DEFAULT"],
  }));

  const faceIds = (response.FaceRecords || [])
    .map((record) => record.Face?.FaceId)
    .filter((id): id is string => Boolean(id));

  return {
    collectionId,
    modelVersion: response.FaceModelVersion,
    faceIds,
    indexedFaces: faceIds.length,
    unindexedFaces: (response.UnindexedFaces || []).map((face) => face.Reasons || []).flat(),
  };
}

export async function buscarFotosPorRosto(imageBytes: Buffer | Uint8Array) {
  const { collectionId } = await garantirColecaoRostos();
  const response = await criarCliente().send(new SearchFacesByImageCommand({
    CollectionId: collectionId,
    Image: { Bytes: imageBytes },
    FaceMatchThreshold: 75,
    MaxFaces: 4096,
    QualityFilter: "LOW",
  }));

  return {
    collectionId,
    searchedFaceConfidence: response.SearchedFaceConfidence,
    matches: (response.FaceMatches || []).flatMap((match) => {
      const fotoId = match.Face?.ExternalImageId;
      if (!fotoId) return [];
      return [{ fotoId, similarity: Number(match.Similarity || 0) }];
    }),
  };
}

export async function excluirRostos(faceIds: string[]) {
  if (!faceIds.length) return 0;
  const { collectionId } = await garantirColecaoRostos();
  let removidos = 0;

  for (let inicio = 0; inicio < faceIds.length; inicio += 4096) {
    const lote = faceIds.slice(inicio, inicio + 4096);
    const response = await criarCliente().send(new DeleteFacesCommand({ CollectionId: collectionId, FaceIds: lote }));
    removidos += response.DeletedFaces?.length || 0;
  }

  return removidos;
}
