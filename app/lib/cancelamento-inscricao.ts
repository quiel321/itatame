import { dataOperacionalEvento } from '@/app/lib/evento-datas';
import { usuarioGerenciaInscricao } from '@/app/lib/inscricao-autorizacao';

type Supabase = Parameters<typeof usuarioGerenciaInscricao>[0];

export async function conferirCancelamentoInscricao(supabase: Supabase, usuarioId: string, inscricao: { user_id: string; evento_id: string }) {
  if (!(await usuarioGerenciaInscricao(supabase, usuarioId, inscricao.user_id))) {
    return 'Você não pode cancelar esta inscrição.';
  }
  const [{ data: evento, error: erroEvento }, { count: chaves, error: erroChaves }] = await Promise.all([
    supabase.from('eventos').select('data_fim_inscricoes,lote1_data_fim,lote2_data_fim,lote3_data_fim,estado').eq('id', inscricao.evento_id).maybeSingle(),
    supabase.from('chaves').select('id', { count: 'exact', head: true }).eq('evento_id', inscricao.evento_id),
  ]);
  if (erroEvento || erroChaves || !evento) return 'Não foi possível conferir o prazo do campeonato.';
  const fim = evento.data_fim_inscricoes || evento.lote3_data_fim || evento.lote2_data_fim || evento.lote1_data_fim;
  const limite = dataOperacionalEvento(fim, true, evento.estado);
  if (!limite || Date.now() > limite.getTime()) return 'O prazo de inscrição terminou. Entre em contato com o organizador.';
  if (chaves) return 'As chaves já foram geradas. Entre em contato com o organizador.';
  return null;
}
