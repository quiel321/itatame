import { NextResponse } from 'next/server';
import { autenticarRequest } from '@/app/lib/api-auth';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { conferirCancelamentoInscricao } from '@/app/lib/cancelamento-inscricao';

export async function DELETE(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: 'Entre na sua conta para cancelar a inscrição.' }, { status: 401 });
  const inscricaoId = new URL(request.url).searchParams.get('id');
  if (!inscricaoId) return NextResponse.json({ error: 'Inscrição não informada.' }, { status: 400 });
  const supabase = createSupabaseServerClient();
  const { data: inscricao, error } = await supabase.from('inscricoes').select('id,user_id,evento_id,pagamento_ok,mp_payment_id,cortesia,estorno_status').eq('id', inscricaoId).maybeSingle();
  if (error || !inscricao) return NextResponse.json({ error: 'Inscrição não encontrada.' }, { status: 404 });
  const impedimento = await conferirCancelamentoInscricao(supabase, usuario.id, inscricao);
  if (impedimento) return NextResponse.json({ error: impedimento }, { status: 409 });
  if ((inscricao.pagamento_ok && !inscricao.cortesia) || inscricao.mp_payment_id || inscricao.estorno_status) {
    return NextResponse.json({ error: 'Esta inscrição possui pagamento. Solicite o cancelamento com estorno.' }, { status: 409 });
  }
  const impedimentoAtual = await conferirCancelamentoInscricao(supabase, usuario.id, inscricao);
  if (impedimentoAtual) return NextResponse.json({ error: impedimentoAtual }, { status: 409 });
  let exclusao = supabase.from('inscricoes').delete().eq('id', inscricao.id).eq('user_id', inscricao.user_id)
    .is('mp_payment_id', null).is('estorno_status', null);
  exclusao = inscricao.cortesia ? exclusao.eq('cortesia', true) : exclusao.eq('pagamento_ok', false);
  const { data: excluidas, error: erroExclusao } = await exclusao.select('id');
  if (erroExclusao) return NextResponse.json({ error: erroExclusao.message }, { status: 500 });
  if (!excluidas?.length) return NextResponse.json({ error: 'O pagamento ou o estado da inscrição mudou. Atualize a página antes de tentar novamente.' }, { status: 409 });
  return NextResponse.json({ success: true });
}
