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

export function r2Config() {
  const endpoint = requireEnv("R2_ENDPOINT").replace(/\/$/, "");
  const bucket = requireEnv("R2_BUCKET_NAME");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

function createR2PresignedUrl(key: string, method: "GET" | "PUT", expiresSeconds = 900) {
  const { endpoint, bucket, accessKeyId, secretAccessKey } = r2Config();
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

export function createR2PresignedPutUrl(key: string, expiresSeconds = 900) {
  return createR2PresignedUrl(key, "PUT", expiresSeconds);
}

export function createR2PresignedGetUrl(key: string, expiresSeconds = 300) {
  return createR2PresignedUrl(key, "GET", expiresSeconds);
}

export function r2ObjectUrl(key: string) {
  const { endpoint, bucket } = r2Config();
  return `${endpoint}/${bucket}/${encodeKey(key)}`;
}
