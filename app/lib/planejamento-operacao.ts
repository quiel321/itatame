import { normalizarCompeticao } from './categorias-competicao';

type LutaPlanejada = { categoria_id?: string | null; tatame?: string | null; ordem_tatame?: number | null };
export const AVISO_TATAMES = 'O organizador precisa distribuir esta categoria e salvar a sequência em Organizar tatames antes de liberar para a área de luta.';

export function categoriasComTatamesProntos(lutas: LutaPlanejada[], mesarios: { identificacao?: string | null }[]) {
 const oficiais = new Set(mesarios.map(m => normalizarCompeticao(m.identificacao)).filter(Boolean));
 const posicoes = new Map<string, number>();
 const categorias = new Map<string, boolean>();
 for (const l of lutas) {
  if (!l.categoria_id) continue;
  const tatame = normalizarCompeticao(l.tatame);
  const ordem = l.ordem_tatame;
  const valida = Boolean(tatame && !['SEM TATAME', 'NAO DEFINIDO'].includes(tatame) && oficiais.has(tatame)
   && ordem != null && Number.isInteger(ordem) && ordem > 0);
  categorias.set(l.categoria_id, (categorias.get(l.categoria_id) ?? true) && valida);
  const chave = `${tatame}:${ordem}`;
  posicoes.set(chave, (posicoes.get(chave) || 0) + 1);
 }
 for (const l of lutas) if (l.categoria_id && (posicoes.get(`${normalizarCompeticao(l.tatame)}:${l.ordem_tatame}`) || 0) > 1)
  categorias.set(l.categoria_id, false);
 return [...categorias].filter(([, pronta]) => pronta).map(([id]) => id);
}
