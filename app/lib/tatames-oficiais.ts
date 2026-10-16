import { normalizarCompeticao } from './categorias-competicao';

export function tatamesOficiais(nomes: (string | null | undefined)[]) {
  const oficiais = new Map<string, string>();
  for (const nome of nomes) {
    const chave = normalizarCompeticao(nome);
    if (!chave || ['NAO DEFINIDO', 'SEM TATAME'].includes(chave)) continue;
    if (!oficiais.has(chave)) oficiais.set(chave, nome!.trim());
  }
  return [...oficiais.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
}

export function tatameOficial(nome: string | null | undefined, oficiais: string[]) {
  const chave = normalizarCompeticao(nome);
  return chave ? oficiais.find(o => normalizarCompeticao(o) === chave) || null : null;
}
