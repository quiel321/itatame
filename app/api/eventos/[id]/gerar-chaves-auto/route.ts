import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { chaveamentoAutomaticoLiberado, gerarChavesAutomaticasEvento, type EventoChaveamento } from '@/app/lib/chaveamento-evento';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_request: Request, contexto: { params: Promise<{ id: string }> }) {
  const { id: eventoId } = await contexto.params;
  const db = createSupabaseServerClient();
  const { data: evento, error } = await db
    .from('eventos')
    .select('id,organizador_id,data_fim_inscricoes,lote1_data_fim,lote2_data_fim,lote3_data_fim,data_fim_checagem,data_divulgacao_chaves')
    .eq('id', eventoId)
    .maybeSingle();
  if (error || !evento) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
  if (!chaveamentoAutomaticoLiberado(evento as EventoChaveamento)) {
    return NextResponse.json({ ok: true, gerados: [] });
  }
  try {
    const gerados = await gerarChavesAutomaticasEvento(db, evento as EventoChaveamento);
    return NextResponse.json({ ok: true, gerados });
  } catch (falha) {
    return NextResponse.json({ error: falha instanceof Error ? falha.message : 'Não foi possível gerar as chaves.' }, { status: 409 });
  }
}
