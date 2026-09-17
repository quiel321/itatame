import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { fimInscricoesEvento, gravarChavesEvento, prepararChavesEvento } from '@/app/lib/chaveamento-evento';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
    if (!token) return NextResponse.json({ error: 'Faça login novamente.' }, { status: 401 });
    const db = createSupabaseServerClient();
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
    const { eventoId, tipo, ignorarPagamento, confirmar } = await request.json();
    if (!eventoId || !['peso', 'absoluto'].includes(tipo)) return NextResponse.json({ error: 'Evento ou tipo inválido.' }, { status: 400 });
    const { data: evento, error: eventoError } = await db.from('eventos').select('*').eq('id', eventoId).eq('organizador_id', auth.user.id).maybeSingle();
    if (eventoError || !evento) return NextResponse.json({ error: 'Evento não autorizado.' }, { status: 403 });
    const fim = fimInscricoesEvento(evento);
    if (!fim || fim > new Date()) throw new Error('Encerre as inscrições antes de gerar as chaves.');
    const preparado = await prepararChavesEvento(db, evento.id, tipo, Boolean(ignorarPagamento));
    const assinatura = createHash('sha256').update(JSON.stringify({
      inscritos: preparado.inscritos,
      categorias: preparado.categorias,
      existentes: preparado.existentes,
      tipo,
      ignorarPagamento,
    })).digest('hex');
    if (!confirmar) return NextResponse.json({ previa: { assinatura, grupos: preparado.grupos } });
    if (confirmar !== assinatura) throw new Error('Os dados mudaram desde a conferência. Gere uma nova prévia.');
    const total = await gravarChavesEvento(db, evento, tipo, preparado.lutas);
    return NextResponse.json({ total });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível gerar as chaves.' }, { status: 409 });
  }
}
