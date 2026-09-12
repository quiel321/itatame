const CHAVE = 'itatame:evento-organizador';
export function guardarEventoOrganizador(id: string) {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('evento', id); else url.searchParams.delete('evento');
    window.history.replaceState(null, '', url);
    try { window.sessionStorage.setItem(CHAVE, id); } catch { /* Armazenamento pode estar indisponível. */ }
  }
}
export function obterEventoOrganizador(eventos: { id: string | number }[]) {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href).searchParams.get('evento');
  let salvo = '';
  try { salvo = window.sessionStorage.getItem(CHAVE) || ''; } catch { /* A seleção via URL continua disponível. */ }
  return [url, salvo].find(id => eventos.some(e => String(e.id) === id)) || '';
}
