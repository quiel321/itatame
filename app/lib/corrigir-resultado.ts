import { idBaiaDaPrimeiraChaveDeTres } from '@/app/lib/chave-de-tres';
import { processarAvancosAutomaticosChaves, propagarResultadoChave, type ChaveLutaAuto } from '@/app/lib/chaves-auto-avanco';

type SupabaseLike = {
  from: (table: string) => any;
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
  const novaEquipe = ladoVencedor === 1 ? luta.equipe_1 : luta.equipe_2;
  const novoId = ladoVencedor === 1 ? luta.atleta_1_id : luta.atleta_2_id;
  const nomePerdedor = ladoVencedor === 1 ? luta.atleta_2 : luta.atleta_1;
  const equipePerdedor = ladoVencedor === 1 ? luta.equipe_2 : luta.equipe_1;
  const novoPerdedorId = ladoVencedor === 1 ? luta.atleta_2_id : luta.atleta_1_id;

  if (fantasma(novoNome)) throw new Error('Escolha um atleta válido como vencedor.');

  const metodoFinal = metodo === 'decisao_arbitro' ? 'pontos' : metodo;
  const antigoVencedorId = luta.vencedor_id;
  const antigoPerdedorId = String(antigoVencedorId) === String(luta.atleta_1_id) ? luta.atleta_2_id : luta.atleta_1_id;
  const mudouVencedor = String(antigoVencedorId || '') !== String(novoId || '');
  const metodoAntigo = luta.metodo_vitoria || 'pontos';
  const perdedorEhReal = !fantasma(nomePerdedor);
  const ignoraAntigo = (metodoAntigo === 'wo' || metodoAntigo === 'ausencia') && perdedorEhReal;
  const ignoraNovo = metodoFinal === 'wo' && perdedorEhReal;
  const isFinal = String(luta.fase || '').toLowerCase().startsWith('final') || String(luta.id_visual) === '999';
  const primeiraDaChaveDeTres = Boolean(idBaiaDaPrimeiraChaveDeTres(luta.id_visual, luta.fase));
  const isSemifinal = String(luta.proxima_luta) === '999' && !primeiraDaChaveDeTres;

  const ajustar = async (id: number | null | undefined, coluna: string, delta: number) => {
    if (!id || delta === 0) return;
    const { data } = await supabase.from('atletas_publico').select(`id, ${coluna}`).eq('id', id).maybeSingle();
    if (!data) return;
    await supabase.from('atletas').update({ [coluna]: Math.max(0, Number((data as any)[coluna] || 0) + delta) }).eq('id', id);
  };

  if (mudouVencedor) {
    if (isFinal) {
      if (!ignoraAntigo) {
        await ajustar(antigoVencedorId, 'ouro', -1);
        await ajustar(antigoPerdedorId, 'prata', -1);
      }
      if (!ignoraNovo) {
        await ajustar(novoId, 'ouro', 1);
        await ajustar(novoPerdedorId, 'prata', 1);
      }
    }
    if (isSemifinal) {
      if (!ignoraAntigo) await ajustar(antigoPerdedorId, 'bronze', -1);
      if (!ignoraNovo) await ajustar(novoPerdedorId, 'bronze', 1);
    }
  }
  if (!ignoraAntigo && metodoAntigo === 'wo' && (mudouVencedor || metodoFinal !== 'wo')) await ajustar(antigoVencedorId, 'vitorias_wo', -1);
  if (!ignoraNovo && metodoFinal === 'wo' && (mudouVencedor || metodoAntigo !== 'wo')) await ajustar(novoId, 'vitorias_wo', 1);

  const { error } = await supabase.from('chaves').update({
    vencedor: novoNome,
    vencedor_id: novoId,
    metodo_vitoria: metodoFinal,
    status_luta: 'concluida',
    finalizada_em: new Date().toISOString(),
  }).eq('id', luta.id);
  if (error) throw error;

  await propagarResultadoChave(supabase, todas, luta, {
    vencedorNome: String(novoNome),
    vencedorEquipe: novaEquipe,
    vencedorId: novoId,
    perdedorNome: nomePerdedor,
    perdedorEquipe: equipePerdedor,
    perdedorId: novoPerdedorId,
    propagarPerdedor: metodoFinal !== 'wo',
  });
  await processarAvancosAutomaticosChaves(supabase, luta.evento_id);

  return alertaProximaLuta(todas, luta);
}
