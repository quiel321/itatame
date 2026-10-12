export function versaoDaCapa(url: string) {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) hash = (hash * 31 + url.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

export function linkCompartilhamentoGaleria(href: string, capaUrl?: string | null) {
  const url = new URL(href);
  url.searchParams.delete('foto');
  url.searchParams.delete('origem');
  // Uma capa nova gera um link diferente para renovar a prévia nos mensageiros.
  if (capaUrl) url.searchParams.set('capa', versaoDaCapa(capaUrl));
  else url.searchParams.delete('capa');
  return url.toString();
}
