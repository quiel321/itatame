function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  if (valor && typeof valor === 'object') return `{${Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonico(v)}`).join(',')}}`;
  return JSON.stringify(valor) ?? 'undefined';
}
export function edicaoGaleriaConfirmada(atual: Record<string, unknown> | null, campos: Record<string, unknown>) {
  return Boolean(atual && Object.entries(campos).every(([campo, valor]) => canonico(atual[campo]) === canonico(valor)));
}
