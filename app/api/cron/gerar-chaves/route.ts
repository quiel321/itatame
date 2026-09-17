import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { chaveamentoAutomaticoLiberado, gerarChavesAutomaticasEvento, type EventoChaveamento } from '@/app/lib/chaveamento-evento';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function autorizarCron(request: Request) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${esperado}`;
}

export async function GET(request: Request) {
  if (!autorizarCron(request)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const agora = new Date();
  const janela = new Date(agora.getTime() - 48 * 60 * 60 * 1000);
  const db = createSupabaseServerClient();
  const { data: eventos, error } = await db
    .from('eventos')
    .select('id,organizador_id,data_fim_inscricoes,lote1_data_fim,lote2_data_fim,lote3_data_fim,data_fim_checagem,data_divulgacao_chaves')
    .not('data_divulgacao_chaves', 'is', null)
    .lte('data_divulgacao_chaves', agora.toISOString())
    .gte('data_divulgacao_chaves', janela.toISOString());

  if (error) return NextResponse.json({ error: 'Não foi possível ler os eventos.' }, { status: 500 });

  const gerados: { eventoId: string; tipos: { tipo: string; total: number }[] }[] = [];
  const pulados: { eventoId: string; motivo: string }[] = [];

  for (const evento of (eventos || []) as EventoChaveamento[]) {
    if (!chaveamentoAutomaticoLiberado(evento, agora)) {
      pulados.push({ eventoId: evento.id, motivo: 'Aguardando fim da checagem ou das inscrições.' });
      continue;
    }
    try {
      const tipos = await gerarChavesAutomaticasEvento(db, evento);
      if (tipos.length) gerados.push({ eventoId: evento.id, tipos });
      else pulados.push({ eventoId: evento.id, motivo: 'Chaves já existentes ou sem inscritos aptos.' });
    } catch (falha) {
      pulados.push({ eventoId: evento.id, motivo: falha instanceof Error ? falha.message : 'Falha ao gerar.' });
    }
  }

  return NextResponse.json({ ok: true, gerados, pulados });
}
