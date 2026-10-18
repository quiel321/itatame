import { calcularDescontoFotos, type FaixaDesconto } from './fotos-descontos';
import { ratearCentavos } from './fotos-vendas-diaria';

export const COMBOS_IA_STORAGE_KEY = 'retratt_combos_ia_v1';
export const MAX_ITENS_COMBO_IA = 500;
export const FAIXAS_COMBO_IA = [{ quantidade: 10, percentual: 50 }, { quantidade: 15, percentual: 60 }, { quantidade: 25, percentual: 70 }, { quantidade: 35, percentual: 80 }] as const;
export type ComboIaAssinado = { versao: 2; eventoId: string; fotoIds: string[]; percentual: number; expira: number };
export type OfertaComboIa = { token: string; eventoId: string; eventoNome: string; fotoIds: string[]; quantidade: number; percentual: number; subtotalCentavos: number; descontoCentavos: number; totalCentavos: number; expira: number };
export type ItemComboIa = { id: string; precoCentavos: number; mimeType?: string | null };

export function percentualComboIa(quantidade: number) {
  return [...FAIXAS_COMBO_IA].reverse().find(f => quantidade >= f.quantidade)?.percentual || 0;
}

export function calcularCompraComCombosIa(itens: ItemComboIa[], faixas: FaixaDesconto[], combos: ComboIaAssinado[]) {
  const base = calcularDescontoFotos(faixas, itens);
  const descontoPorItem = itens.map(() => 0), usados = new Set<string>();
  const grupos = new Map<number, number[]>();
  for (const combo of combos) {
    if (!combo.fotoIds.every(id => itens.some(i => i.id === id && !i.mimeType?.startsWith('video/')))) throw new Error('O pacote de IA precisa conter todas as suas fotos. Refaça a busca para montar outro pacote.');
    for (const id of combo.fotoIds) {
      if (usados.has(id)) throw new Error('Uma foto não pode fazer parte de dois pacotes.');
      usados.add(id);
    }
  }
  itens.forEach((item, i) => {
    if (item.mimeType?.startsWith('video/')) return;
    const combo = combos.find(c => c.fotoIds.includes(item.id));
    const percentual = Math.max(base.faixa?.percentual || 0, combo?.percentual || 0);
    grupos.set(percentual, [...(grupos.get(percentual) || []), i]);
  });
  for (const [percentual, indices] of grupos) {
    const pesos = indices.map(i => Math.max(0, itens[i].precoCentavos));
    const partes = ratearCentavos(Math.round(pesos.reduce((a, b) => a + b, 0) * percentual / 100), pesos);
    indices.forEach((i, n) => { descontoPorItem[i] = partes[n]; });
  }
  const subtotalCentavos = itens.reduce((s, i) => s + Math.max(0, i.precoCentavos), 0);
  const descontoCentavos = descontoPorItem.reduce((s, n) => s + n, 0);
  return { subtotalCentavos, descontoCentavos, totalCentavos: subtotalCentavos - descontoCentavos, descontoPorItem };
}

export function lerOfertasComboIa(): OfertaComboIa[] {
  try {
    const dados = JSON.parse(localStorage.getItem(COMBOS_IA_STORAGE_KEY) || '[]');
    return Array.isArray(dados) ? dados.filter(c => c && typeof c.token === 'string' && Array.isArray(c.fotoIds)) : [];
  } catch { return []; }
}
export function guardarOfertasComboIa(combos: OfertaComboIa[]) {
  localStorage.setItem(COMBOS_IA_STORAGE_KEY, JSON.stringify(combos));
}
