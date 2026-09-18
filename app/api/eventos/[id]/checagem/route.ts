import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, contexto: { params: Promise<{ id: string }> }) {
  const { id: eventoId } = await contexto.params;
  if (!eventoId) return NextResponse.json({ error: 'Evento não informado.' }, { status: 400 });
  const db = createSupabaseServerClient();
  const [{ data: categorias, error: erroCategorias }, { data: equipes, error: erroEquipes }] = await Promise.all([
    db.from('categorias_evento').select('*').eq('evento_id', eventoId),
    db.from('equipes_evento').select('id,nome,academia,professor').eq('evento_id', eventoId).eq('ativa', true),
  ]);
  if (erroCategorias || erroEquipes) {
    return NextResponse.json({ error: 'Não foi possível carregar as categorias e equipes oficiais.' }, { status: 500 });
  }
  return NextResponse.json({ categorias: categorias || [], equipes: equipes || [] });
}
