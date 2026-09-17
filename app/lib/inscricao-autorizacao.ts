import { createSupabaseServerClient } from './supabase-server';

export async function usuarioGerenciaInscricao(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  usuarioId: string,
  inscricaoUserId?: string | null,
) {
  if (!inscricaoUserId) return false;
  if (inscricaoUserId === usuarioId) return true;
  const { data } = await supabase.from('atletas').select('responsavel_id').eq('user_id', inscricaoUserId).maybeSingle();
  return data?.responsavel_id === usuarioId;
}
