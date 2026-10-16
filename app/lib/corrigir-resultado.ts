import { executarOperacao, baseLuta } from './operacao-segura';
import type { ChaveLutaAuto } from '@/app/lib/chaves-auto-avanco';

type SupabaseLike = {
  from: (table: string) => any;
  rpc: (nome: string, parametros: Record<string, unknown>) => any;
};

export const METODOS_RESULTADO = [
  { id: 'pontos', label: 'Pontos' },
  { id: 'finalizacao', label: 'Finalização' },
  { id: 'decisao_arbitro', label: 'Decisão do árbitro' },
  { id: 'wo', label: 'W.O. / Ausência' },
] as const;

export type MetodoResultado = (typeof METODOS_RESULTADO)[number]['id'];

function fantasma(nome?: string | null) {
  const limpo = String(nome || '').trim().toUpperCase();
  return !limpo || limpo === 'BYE' || limpo === 'TBD' || limpo.includes('SEM OPONENTE');
}

export function rotuloMetodo(metodo?: string | null) {
  const id = String(metodo || '').toLowerCase();
  if (id === 'finalizacao') return 'Finalização';
  if (id === 'wo' || id === 'ausencia') return 'W.O.';
  if (id === 'decisao_arbitro' || id === 'decisao') return 'Decisão';
  if (id === 'desclassificacao') return 'Desclassificação';
  if (id === 'vantagens') return 'Vantagens';
  return 'Pontos';
}

export function alertaProximaLuta(todas: ChaveLutaAuto[], luta: ChaveLutaAuto) {
  if (!luta.proxima_luta) return '';
  const proxima = todas.find((item) =>
    item.categoria === luta.categoria
    && (item.faixa || '') === (luta.faixa || '')
    && String(item.id_visual) === String(luta.proxima_luta)
  );
  if (!proxima) return '';
  if (proxima.status_luta === 'em_andamento') return 'A próxima luta já está em andamento. Depois da correção, confira o placar dela.';
  if (proxima.status_luta === 'concluida' || proxima.vencedor) return 'A próxima luta já foi concluída. Corrija o resultado dela também, se o vencedor mudou.';
  return '';
}

export async function corrigirResultadoLuta(
  supabase: SupabaseLike,
  todas: ChaveLutaAuto[],
  luta: ChaveLutaAuto,
  ladoVencedor: 1 | 2,
  metodo: MetodoResultado,
) {
  const novoNome = ladoVencedor === 1 ? luta.atleta_1 : luta.atleta_2;

  if (fantasma(novoNome)) throw new Error('Escolha um atleta válido como vencedor.');

  await executarOperacao('corrigir',String(luta.id),{tatame:luta.tatame,lado:ladoVencedor,metodo},
    {...baseLuta(luta),vencedor_id:luta.vencedor_id??null,metodo_vitoria:luta.metodo_vitoria??null});
  return alertaProximaLuta(todas,luta);
}
