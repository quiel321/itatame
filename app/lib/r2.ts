import crypto from "crypto";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} nao configurado.`);
  return value;
}

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function amzDates(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function encodeKey(key: string) {
  return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function canonicalQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");
}

export type R2Escopo = 'itatame' | 'retratt';

export function r2Config(escopo: R2Escopo = 'retratt') {
  const prefixo = escopo === 'itatame' ? 'R2_ITATAME_' : 'R2_RETRATT_';
  const endpoint = (process.env[`${prefixo}ENDPOINT`] || requireEnv("R2_ENDPOINT")).replace(/\/$/, "");
  // O bucket legado pertence ao Retratt. iTatame exige destino próprio.
  const bucket = process.env[`${prefixo}BUCKET_NAME`] || (escopo === 'retratt' ? requireEnv("R2_BUCKET_NAME") : requireEnv('R2_ITATAME_BUCKET_NAME'));
  const accessKeyId = process.env[`${prefixo}ACCESS_KEY_ID`] || requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = process.env[`${prefixo}SECRET_ACCESS_KEY`] || requireEnv("R2_SECRET_ACCESS_KEY");
  if (escopo === 'itatame' && bucket === (process.env.R2_RETRATT_BUCKET_NAME || process.env.R2_BUCKET_NAME)) {
    throw new Error('iTatame e Retratt precisam usar buckets diferentes.');
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

function createR2PresignedUrl(key: string, method: "GET" | "PUT" | "DELETE", expiresSeconds = 900, responseHeaders: Record<string, string> = {}, escopo: R2Escopo = 'retratt') {
  const { endpoint, bucket, accessKeyId, secretAccessKey } = r2Config(escopo);
  const url = new URL(endpoint);
  const host = url.host;
  const region = "auto";
  const service = "s3";
  const { amzDate, dateStamp } = amzDates();
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${bucket}/${encodeKey(key)}`;

  const queryParams = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": "host",
    ...responseHeaders,
  };

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery(queryParams),
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  return `${endpoint}${canonicalUri}?${canonicalQuery({ ...queryParams, "X-Amz-Signature": signature })}`;
}

export function createR2PresignedPutUrl(key: string, expiresSeconds = 900, escopo: R2Escopo = 'retratt') {
  return createR2PresignedUrl(key, "PUT", expiresSeconds, {}, escopo);
}

export function createR2PresignedGetUrl(key: string, expiresSeconds = 300, escopo: R2Escopo = 'retratt') {
  return createR2PresignedUrl(key, "GET", expiresSeconds, {}, escopo);
}

export function createR2PresignedDownloadUrl(key: string, nome: string, expiresSeconds = 120) {
  const nomeSeguro = nome.replace(/[\r\n"\\/]/g, "-").slice(0, 160);
  return createR2PresignedUrl(key, "GET", expiresSeconds, {
    "response-content-disposition": `attachment; filename="${nomeSeguro}"`,
  });
}

export function createR2PresignedDeleteUrl(key: string, expiresSeconds = 120) {
  return createR2PresignedUrl(key, "DELETE", expiresSeconds);
}

export async function deleteR2Object(key: string) {
  const response = await fetch(createR2PresignedDeleteUrl(key), {
    method: "DELETE",
    cache: "no-store",
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Falha ao excluir objeto do R2 (${response.status}).`);
  }
}

export async function getR2ObjectBytes(key: string, maxBytes = 10 * 1024 * 1024, escopo: R2Escopo = 'retratt') {
  const response = await fetch(createR2PresignedGetUrl(key, 300, escopo), { cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const error = new Error(`Falha ao ler objeto do R2 (${response.status}).`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const tamanhoInformado = Number(response.headers.get("content-length") || 0);
  if (tamanhoInformado > maxBytes) throw new Error(`Objeto do R2 excede o limite de ${maxBytes} bytes.`);

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > maxBytes) throw new Error(`Objeto do R2 invalido ou acima de ${maxBytes} bytes.`);
  return bytes;
}

export async function tryGetR2ObjectBytes(key: string, maxBytes = 10 * 1024 * 1024) {
  try {
    return await getR2ObjectBytes(key, maxBytes);
  } catch (error: unknown) {
    if (error instanceof Error && "status" in error && (error as Error & { status?: number }).status === 404) return null;
    throw error;
  }
}

export async function putR2Object(key: string, body: Buffer | Uint8Array, contentType: string, cacheControl?: string, escopo: R2Escopo = 'retratt') {
  const payload = new ArrayBuffer(body.byteLength);
  new Uint8Array(payload).set(body);
  const response = await fetch(createR2PresignedPutUrl(key, 300, escopo), {
    method: "PUT",
    headers: { "Content-Type": contentType, ...(cacheControl ? { "Cache-Control": cacheControl } : {}) },
    body: payload,
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) throw new Error(`Falha ao gravar objeto no R2 (${response.status}).`);
}

export function r2ObjectUrl(key: string) {
  const { endpoint, bucket } = r2Config();
  return `${endpoint}/${bucket}/${encodeKey(key)}`;
}
