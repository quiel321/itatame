import { ehFaseChaveDeTres } from './chave-de-tres';
import { rotuloLuta } from './lutas-rotulos';

export type LutaPrevista = {
  id_visual?: string | number | null; proxima_luta?: string | number | null;
  fase?: string | null; ordem?: number | null;
  atleta_1?: string | null; atleta_2?: string | null;
  atleta_1_id?: number | null; atleta_2_id?: number | null;
  equipe_1?: string | null; equipe_2?: string | null;
};
export type OrigemPrevista<T> = { luta?: T; atleta?: { nome: string; id?: number | null; equipe?: string | null }; registro?: T; lado?: 1 | 2 };
export const nomeRealPrevisto = (nome?: string | null) => {
  const n = String(nome || '').trim();
  return n && !['BYE', 'TBD'].includes(n.toUpperCase()) && !n.toUpperCase().includes('SEM OPONENTE') ? n : '';
};

/** Modelo somente de leitura: contrai vagas vazias e avanços, sem escolher vencedores. */
export function combatesPrevistos<T extends LutaPrevista>(lutas: T[]) {
  // A chave de três tem repescagem própria; mantém sua apresentação existente.
  if (lutas.some(l => ehFaseChaveDeTres(l.fase))) return null;
  const porId = new Map(lutas.map(l => [String(l.id_visual), l]));
  if (porId.size !== lutas.length || lutas.some(l => l.id_visual == null)) return null;
  const cache = new Map<T, OrigemPrevista<T> | null>();
  const lados = new Map<T, [OrigemPrevista<T> | null, OrigemPrevista<T> | null]>();
  const visitando = new Set<T>(), reais = new Set<T>();
  const resolver = (l: T): OrigemPrevista<T> | null => {
    if (cache.has(l)) return cache.get(l)!;
    if (visitando.has(l)) throw new Error('Dependência circular na chave.');
    visitando.add(l);
    const par: [OrigemPrevista<T> | null, OrigemPrevista<T> | null] = [null, null];
    for (const lado of [1, 2] as const) {
      const pai = lutas.find(p => p.proxima_luta != null && String(p.proxima_luta) === String(l.id_visual) && (Number(p.id_visual) % 2 ? 1 : 2) === lado);
      // A estrutura continua válida depois que os vencedores são preenchidos.
      if (pai) par[lado - 1] = resolver(pai);
      else {
        const nome = nomeRealPrevisto(lado === 1 ? l.atleta_1 : l.atleta_2);
        if (nome) par[lado - 1] = { registro: l, lado, atleta: { nome, id: lado === 1 ? l.atleta_1_id : l.atleta_2_id, equipe: lado === 1 ? l.equipe_1 : l.equipe_2 } };
      }
    }
    lados.set(l, par);
    const combate = Boolean(par[0] && par[1]);
    if (combate) reais.add(l);
    const origem = combate ? { luta: l } : par[0] || par[1];
    cache.set(l, origem); visitando.delete(l); return origem;
  };
  try { for (const luta of lutas) resolver(luta); } catch { return null; }
  const finalOriginal = porId.get('999') || lutas.find(l => !l.proxima_luta);
  // Estruturas antigas sem ligações suficientes usam a apresentação existente.
  if (!finalOriginal || (reais.size > 0 && !cache.get(finalOriginal)?.luta)) return null;
  return {
    lutas: lutas.filter(l => reais.has(l)), lados,
    final: finalOriginal ? cache.get(finalOriginal)?.luta : undefined,
    origem(luta: T, lado: 1 | 2) { return lados.get(luta)?.[lado - 1] || null; },
  };
}

export function nomeOrigemPrevista<T extends LutaPrevista>(origem?: OrigemPrevista<T> | null) {
  return origem?.atleta?.nome || (origem?.luta ? `Vencedor: ${rotuloLuta(origem.luta)}` : 'A definir');
}
