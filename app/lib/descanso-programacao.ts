import { ehFaseChaveDeTres } from './chave-de-tres';
import { normalizarCompeticao } from './categorias-competicao';

type LutaDescanso = {
 id: string | number; categoria: string; faixa?: string | null; fase?: string | null;
 id_visual?: string | number | null; proxima_luta?: string | number | null;
 atleta_1_id?: number | null; atleta_2_id?: number | null;
 atleta_1?: string | null; atleta_2?: string | null;
};
const grupo = (l: LutaDescanso) => `${l.categoria}__${l.faixa || ''}`;
const identidade = (id?: number | null, nome?: string | null) => {
 if (id) return `id:${id}`;
 const n = normalizarCompeticao(nome);
 return n && !['BYE', 'TBD'].includes(n) && !n.includes('SEM OPONENTE') ? `nome:${n}` : null;
};

/** Origens possíveis; não escolhe vencedores nem modifica a chave. */
export function ladosParaDescanso(lutas: LutaDescanso[]) {
 const grupos = new Map<string, LutaDescanso[]>();
 for (const l of lutas) grupos.set(grupo(l), [...(grupos.get(grupo(l)) || []), l]);
 const cache = new Map<string | number, [Set<string>, Set<string>]>(), visitando = new Set<string | number>();
 const resolver = (l: LutaDescanso): [Set<string>, Set<string>] => {
  if (cache.has(l.id)) return cache.get(l.id)!;
  if (visitando.has(l.id)) throw new Error('A chave tem dependências circulares. Atualize antes de calcular os horários.');
  visitando.add(l.id);
  const candidatos: [Set<string>, Set<string>] = [new Set(), new Set()];
  const diretos = [[l.atleta_1_id, l.atleta_1], [l.atleta_2_id, l.atleta_2]] as const;
  diretos.forEach(([id, nome], lado) => {
   const valor = identidade(id, nome); if (valor) candidatos[lado].add(valor);
  });
  const mesmas = grupos.get(grupo(l)) || [];
  const pais = l.id_visual == null ? [] : mesmas.filter(p => p.proxima_luta != null && String(p.proxima_luta) === String(l.id_visual));
  // A baia recebe o perdedor da primeira luta.
  if (ehFaseChaveDeTres(l.fase) && ['2', '4'].includes(String(l.id_visual))) {
   const primeira = mesmas.find(p => String(p.id_visual) === (String(l.id_visual) === '2' ? '1' : '3'));
   if (primeira) for (const lado of resolver(primeira)) for (const atleta of lado) candidatos[0].add(atleta);
  }
  for (const pai of pais) for (const lado of resolver(pai)) for (const candidato of lado) candidatos[Number(pai.id_visual) % 2 ? 0 : 1].add(candidato);
  visitando.delete(l.id); cache.set(l.id, candidatos); return candidatos;
 };
 for (const luta of lutas) resolver(luta);
 return cache;
}

export function origensParaDescanso(lutas: LutaDescanso[]) {
 return new Map([...ladosParaDescanso(lutas)].map(([id, lados]) => [id, new Set([...lados[0], ...lados[1]])]));
}

export function ehFinalProgramacao(luta: Pick<LutaDescanso, 'id_visual' | 'fase'>) {
 return String(luta.id_visual) === '999' || normalizarCompeticao(luta.fase).startsWith('FINAL');
}
