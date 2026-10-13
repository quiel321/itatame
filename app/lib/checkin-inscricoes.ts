import type { SupabaseClient } from '@supabase/supabase-js';
import { FILTRO_INSCRICOES_ATIVAS } from './inscricao-ativa';

/** Confere o estado atual na própria gravação, mesmo com a tela aberta antes do estorno. */
export async function salvarCheckinInscricoes(
  db: Pick<SupabaseClient, 'from'>,
  eventoId: string,
  userId: string,
  atualizacao: Record<string, unknown>,
) {
  const { data, error } = await db.from('inscricoes').update(atualizacao)
    .eq('evento_id', eventoId).eq('user_id', userId)
    .eq('pagamento_ok', true).or(FILTRO_INSCRICOES_ATIVAS).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Check-in bloqueado: a inscrição foi cancelada, estornada ou não possui pagamento confirmado. Atualize a leitura e procure o organizador.');
  return data.length;
}
