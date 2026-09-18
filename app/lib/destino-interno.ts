export function destinoInterno(valor?: string | null, fallback = "/perfil") {
  if (!valor) return fallback;
  let destino = valor.trim();
  try {
    destino = decodeURIComponent(destino);
  } catch {
    return fallback;
  }
  if (!destino.startsWith("/") || destino.startsWith("//") || destino.includes("://") || destino.includes("\\")) {
    return fallback;
  }
  return destino;
}

export function urlLoginComRetorno(destino: string) {
  return `/login?redirect=${encodeURIComponent(destinoInterno(destino))}`;
}
