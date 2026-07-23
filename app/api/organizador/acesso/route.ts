import 'server-only';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7) : null;
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ destino: 'negado' }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return NextResponse.json({ destino: 'negado' }, { status: 401 });

  const { data: organizador, error: organizadorError } = await supabase
    .from('organizadores')
    .select('status, email, plano_comercial')
    .eq('user_id', user.id)
    .maybeSingle();

  if (organizadorError) {
    return NextResponse.json({ destino: 'erro' }, { status: 500 });
  }

  if (organizador) {
    if (organizador.status === 'super-admin') {
      return NextResponse.json({ destino: 'super-admin' });
    }
    if (organizador.status === 'aprovado') {
      return NextResponse.json({ destino: 'admin', plano: organizador.plano_comercial || 'essencial' });
    }

    if (organizador.status === 'ativo') {
      const email = String(organizador.email || user.email || '').trim();
      if (email) {
        const { data: homologacao } = await supabase
          .from('organizadores')
          .select('id, plano_comercial')
          .ilike('email', email)
          .eq('status', 'aprovado')
          .limit(1)
          .maybeSingle();
        if (homologacao) return NextResponse.json({ destino: 'admin', plano: homologacao.plano_comercial || organizador.plano_comercial || 'essencial' });
      }
    }

    return NextResponse.json({ destino: 'pendente' });
  }

  const { data: atleta } = await supabase
    .from('atletas')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (atleta?.role === 'super-admin') return NextResponse.json({ destino: 'super-admin' });
  if (atleta?.role === 'organizador') return NextResponse.json({ destino: 'admin', plano: 'essencial' });
  return NextResponse.json({ destino: 'negado' });
}
