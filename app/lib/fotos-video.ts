export const VIDEO_MAX_BYTES = 250 * 1024 * 1024;
export const VIDEO_MAX_DURATION_SECONDS = 120;
export const VIDEO_PREVIEW_DURATION_SECONDS = 10;
export const VIDEO_PREVIEW_MAX_BYTES = 16 * 1024 * 1024;
export const VIDEO_IA_FRAME_COUNT = 6;

export const VIDEO_PREVIEW_CONTENT_TYPES = new Set([
  "video/webm",
  "video/webm;codecs=vp8",
  "video/webm;codecs=vp9",
  "video/mp4",
]);

export function videoPreviewContentTypePermitido(contentType: string) {
  const normalizado = contentType.toLowerCase();
  return normalizado.startsWith("video/webm") || normalizado.startsWith("video/mp4");
}

export function extensaoPreviewVideo(contentType: string) {
  return contentType.toLowerCase().startsWith("video/mp4") ? "mp4" : "webm";
}

export function formatarDuracaoVideo(segundos: number) {
  const total = Math.max(0, Math.round(segundos));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return `${minutos}:${String(resto).padStart(2, "0")}`;
}
