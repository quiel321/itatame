import { NextResponse } from 'next/server';
import { autenticarRequest } from '@/app/lib/api-auth';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { calcularResultadosChaves, lerRegrasPontuacao } from '@/app/lib/ranking-eventos';

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) {
    return NextResponse.json({ error: 'Entre com a conta do organizador.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const eventoId = String(body.eventoId || '').trim();
  if (!eventoId) return NextResponse.json({ error: 'Informe o campeonato.' }, { status: 400 });

  const db = createSupabaseServerClient();
  const { data: evento, error: eventoError } = await db
    .from('eventos')
    .select('id, status, regras_pontuacao_equipes, organizador_id')
    .eq('id', eventoId)
    .eq('organizador_id', usuario.id)
    .maybeSingle();
  if (eventoError || !evento) {
    return NextResponse.json({ error: 'Campeonato não autorizado.' }, { status: 403 });
  }

  const { data: lutas, error: lutasError } = await db
    .from('chaves')
    .select('*')
    .eq('evento_id', eventoId)
    .eq('status_luta', 'concluida');
  if (lutasError) {
    return NextResponse.json({ error: 'Não foi possível ler as lutas concluídas.' }, { status: 500 });
  }

  const regras = lerRegrasPontuacao(evento.regras_pontuacao_equipes);
  const resultado = calcularResultadosChaves(lutas || [], { [eventoId]: regras });
  // O placar registra as medalhas. O ranking é calculado das chaves;
  // publicar apenas libera o resultado, sem somar novamente nos cadastros.
  regras.ranking_publicado = true;
  const { error: salvarError } = await db.from('eventos').update({
    status: 'ENCERRADO',
    regras_pontuacao_equipes: regras,
  }).eq('id', eventoId).eq('organizador_id', usuario.id);
  if (salvarError) {
    return NextResponse.json({ error: 'Não foi possível publicar o ranking.' }, { status: 500 });
  }

  return NextResponse.json({
    publicado: true,
    aplicados: 0,
    pontuaram: resultado.atletas.length,
    lutas: (lutas || []).length,
  });
}
