import { NextResponse } from 'next/server';
import { autenticarRequest } from '@/app/lib/api-auth';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { podeVerAlunoDoCT } from '@/app/lib/alunos-ct';

// Compartilha apenas leitura. Vínculos e permissões de inscrição não são alterados.
export async function GET(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: 'Entre na sua conta de professor.' }, { status: 401 });
  const db = createSupabaseServerClient();
  const { data: professor, error } = await db.from('atletas')
    .select('user_id,equipe,academia,role').eq('user_id', usuario.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Não foi possível conferir seu cadastro.' }, { status: 500 });
  if (professor?.role !== 'professor') return NextResponse.json({ error: 'Este recurso é exclusivo para professores.' }, { status: 403 });
  const alunos = new Map<string, Record<string, unknown>>();
  for (let inicio = 0; ; inicio += 500) {
    const { data, error: erroAlunos } = await db.from('atletas')
      .select('id,user_id,nome,faixa,peso,nascimento,foto_url,ouro,prata,bronze,professor,professor_id,equipe,academia,role')
      .eq('role', 'atleta').order('id').range(inicio, inicio + 499);
    if (erroAlunos) return NextResponse.json({ error: 'Não foi possível carregar os alunos da academia.' }, { status: 500 });
    for (const aluno of data || []) {
      if (podeVerAlunoDoCT(aluno, professor)) alunos.set(aluno.user_id, aluno);
    }
    if ((data || []).length < 500) break;
  }
  return NextResponse.json({ alunos: [...alunos.values()] }, { headers: { 'Cache-Control': 'no-store' } });
}
