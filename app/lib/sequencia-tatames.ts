import { ordemOperacionalChaveTriangular } from './chave-de-tres';
import { normalizarCompeticao, type CategoriaCompeticao } from './categorias-competicao';

export type LutaSequencia = {
  id: string | number; categoria: string; faixa?: string | null; tatame?: string | null;
  categoria_id?: string | null; ordem_tatame?: number | null; ordem?: number | null;
  fase?: string | null; id_visual?: string | number | null; horario_estimado?: string | null;
  status_luta?: string | null; iniciada_em?: string | null; vencedor?: string | null;
  atleta_1?: string | null; atleta_2?: string | null;
};

export function chaveCategoriaSequencia(luta: Pick<LutaSequencia, 'categoria' | 'faixa'>) {
  return `${luta.categoria}__${luta.faixa || ''}`;
}
export const normalizarTatameSequencia = normalizarCompeticao;
export function atletaRealSequencia(nome?: string | null) {
  const n = normalizarCompeticao(nome);
  return Boolean(n) && !['BYE', 'TBD'].includes(n) && !n.includes('SEM OPONENTE');
}
export function lutaIniciadaSequencia(luta: LutaSequencia) {
  return Boolean(luta.iniciada_em) || luta.status_luta === 'em_andamento'
    || ((luta.status_luta === 'concluida' || Boolean(luta.vencedor))
      && atletaRealSequencia(luta.atleta_1) && atletaRealSequencia(luta.atleta_2));
}
const fases: Record<string, number> = {
  '32-AVOS': 1, '16-AVOS': 2, OITAVAS: 3, 'OITAVAS DE FINAL': 3,
  QUARTAS: 4, 'QUARTAS DE FINAL': 4, SEMIFINAL: 5, FINAL: 6,
};
export function compararLutasDaCategoria(a: LutaSequencia, b: LutaSequencia) {
  const ta = ordemOperacionalChaveTriangular(a), tb = ordemOperacionalChaveTriangular(b);
  if (ta != null || tb != null) return (ta ?? 99) - (tb ?? 99);
  if (a.ordem_tatame != null && b.ordem_tatame != null && a.ordem_tatame !== b.ordem_tatame)
    return a.ordem_tatame - b.ordem_tatame;
  return (fases[normalizarCompeticao(a.fase)] ?? 99) - (fases[normalizarCompeticao(b.fase)] ?? 99)
    || (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.id).localeCompare(String(b.id), 'pt-BR', { numeric: true });
}

export function filaCategoriasTatame<T extends LutaSequencia>(lutas: T[]) {
  const grupos = new Map<string, { chave: string; luta: T; lutas: T[]; ordem: number }>();
  for (const luta of lutas) {
    const chave = chaveCategoriaSequencia(luta);
    const grupo = grupos.get(chave) || { chave, luta, lutas: [], ordem: Infinity };
    grupo.lutas.push(luta);
    const ordem = luta.ordem_tatame ?? Infinity;
    if (ordem < grupo.ordem) { grupo.ordem = ordem; grupo.luta = luta; }
    grupos.set(chave, grupo);
  }
  return [...grupos.values()].sort((a, b) => a.ordem - b.ordem
    || a.luta.categoria.localeCompare(b.luta.categoria, 'pt-BR', { numeric: true }));
}

export function compararCategoriasIdadePeso(
  a: { idadeMin?: number; pesoMin?: number; nome: string; faixa: string },
  b: { idadeMin?: number; pesoMin?: number; nome: string; faixa: string },
) {
  return (a.idadeMin ?? Infinity) - (b.idadeMin ?? Infinity)
    || (a.pesoMin ?? Infinity) - (b.pesoMin ?? Infinity)
    || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }) || a.faixa.localeCompare(b.faixa, 'pt-BR');
}

export function metadadosCategoriaSequencia(luta: LutaSequencia, categorias: CategoriaCompeticao[]) {
  const c = categorias.find(c => c.id === luta.categoria_id);
  // Chaves antigas podem não ter o ID; seus rótulos estruturados trazem idade e peso.
  const idade = luta.categoria.match(/(\d+)\s*-\s*\d+\s*anos/i);
  const peso = luta.categoria.match(/(?:acima de\s*|(?:^|·)\s*)(\d+(?:[.,]\d+)?)\s*(?:a\s*\d+(?:[.,]\d+)?\s*kg|kg)/i);
  return { idadeMin: c?.idade_min ?? (idade ? Number(idade[1]) : undefined),
    pesoMin: c?.peso_min ?? (peso ? Number(peso[1].replace(',', '.')) : undefined) };
}

export type PosicaoCategoria = { idUnico: string; tatameAtual: string };
export function planejarSequenciaTatames(lutas: LutaSequencia[], categorias: PosicaoCategoria[]) {
  const posicoes = new Map(categorias.map(c => [c.idUnico, c.tatameAtual === 'Não definido' ? null : c.tatameAtual]));
  const contadores = new Map<string, number>();
  const desejadas = categorias.flatMap(categoria => {
    const tatame = posicoes.get(categoria.idUnico) ?? null;
    return lutas.filter(l => chaveCategoriaSequencia(l) === categoria.idUnico).sort(compararLutasDaCategoria).map(luta => {
      const ordem = tatame ? (contadores.get(tatame) ?? 0) + 1 : null;
      if (tatame && ordem) contadores.set(tatame, ordem);
      return { luta, tatame, ordem_tatame: ordem };
    });
  });
  const afetados = new Set<string>();
  for (const p of desejadas) if ((p.luta.tatame || null) !== p.tatame || (p.luta.ordem_tatame ?? null) !== p.ordem_tatame) {
    afetados.add(normalizarCompeticao(p.luta.tatame)); afetados.add(normalizarCompeticao(p.tatame));
  }
  if (lutas.some(l => afetados.has(normalizarCompeticao(l.tatame)) && lutaIniciadaSequencia(l)))
    throw new Error('Um dos tatames já tem chamadas ou lutas iniciadas. A sequência foi preservada.');
  return desejadas.filter(p => afetados.has(normalizarCompeticao(p.luta.tatame)) || afetados.has(normalizarCompeticao(p.tatame)))
    .map(p => ({ id: p.luta.id, tatame: p.tatame, ordem_tatame: p.ordem_tatame, horario_estimado: null,
      tatame_anterior: p.luta.tatame ?? null, ordem_anterior: p.luta.ordem_tatame ?? null,
      horario_anterior: p.luta.horario_estimado ?? null }));
}
