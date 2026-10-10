import { NextResponse } from 'next/server';
import { autenticarRequest } from '@/app/lib/api-auth';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { academiaPreenchida, equipePreenchida, motivoSugestaoAluno, podeSugerirAluno, type ProfessorVinculo, type AlunoSemVinculo } from '@/app/lib/alunos-sugeridos';

async function contexto(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return { erro: NextResponse.json({ error: 'Entre na sua conta de professor.' }, { status: 401 }) };
  const db = createSupabaseServerClient();
  const { data: professor, error } = await db.from('atletas')
    .select('user_id,nome,equipe,academia,role').eq('user_id', usuario.id).maybeSingle();
  if (error) return { erro: NextResponse.json({ error: 'Não foi possível conferir seu cadastro.' }, { status: 500 }) };
  if (professor?.role !== 'professor') return { erro: NextResponse.json({ error: 'Este recurso é exclusivo para professores.' }, { status: 403 }) };
  if (!professor.nome?.trim() || !equipePreenchida(professor.equipe) || !academiaPreenchida(professor.academia)) {
    return { erro: NextResponse.json({ error: 'Salve seu nome, equipe e academia em Dados da Academia antes de buscar alunos.' }, { status: 400 }) };
  }
  const professores: ProfessorVinculo[] = [];
  for (let inicio = 0; ; inicio += 500) {
    const { data, error: erroProfessores } = await db.from('atletas')
      .select('user_id,nome,equipe,academia').eq('role', 'professor').order('id').range(inicio, inicio + 499);
    if (erroProfessores) return { erro: NextResponse.json({ error: 'Não foi possível conferir os professores das academias.' }, { status: 500 }) };
    professores.push(...(data || []));
    if ((data || []).length < 500) break;
  }
  return { db, professor, professores };
}

function termoValido(termo: string) {
  return termo.length <= 120 && (!termo || termo.trim().length >= 4);
}

export async function GET(request: Request) {
  const ctx = await contexto(request);
  if (ctx.erro) return ctx.erro;
  const busca = (new URL(request.url).searchParams.get('busca') || '').trim();
  if (!termoValido(busca)) return NextResponse.json({ error: 'Digite pelo menos 4 caracteres do nome informado pelos alunos (máximo 120).' }, { status: 400 });
  const alunos: AlunoSemVinculo[] = [];
  // Paginação evita perder cadastros quando a base ultrapassa o limite do PostgREST.
  for (let inicio = 0; ; inicio += 500) {
    const { data, error } = await ctx.db.from('atletas')
      .select('id,user_id,nome,professor,professor_id,equipe,academia,role')
      .eq('role', 'atleta').or('professor_id.is.null,professor_id.eq.')
      .order('id').range(inicio, inicio + 499);
    if (error) return NextResponse.json({ error: 'Não foi possível buscar os possíveis alunos.' }, { status: 500 });
    for (const aluno of data || []) {
      const motivo = motivoSugestaoAluno(aluno, ctx.professor, busca, ctx.professores);
      if (motivo) alunos.push({ ...aluno, motivo_sugestao: motivo });
    }
    if ((data || []).length < 500) break;
  }
  return NextResponse.json({ professor: ctx.professor, alunos }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const ctx = await contexto(request);
  if (ctx.erro) return ctx.erro;
  const body = await request.json().catch(() => null);
  const id = Number(body?.aluno?.id);
  const busca = typeof body?.busca === 'string' ? body.busca.trim() : '';
  if (!Number.isSafeInteger(id) || id <= 0 || body?.confirmado !== true || !termoValido(busca)) {
    return NextResponse.json({ error: 'Confirme individualmente o aluno que deseja vincular.' }, { status: 400 });
  }
  // A tela deve confirmar os dados efetivamente salvos, nunca campos ainda em edição.
  if (['nome', 'equipe', 'academia'].some(campo => body?.professor?.[campo] !== ctx.professor[campo as 'nome' | 'equipe' | 'academia'])) {
    return NextResponse.json({ error: 'Seu cadastro mudou. Atualize a busca e confirme novamente.' }, { status: 409 });
  }
  const { data: aluno, error: erroBusca } = await ctx.db.from('atletas')
    .select('id,user_id,nome,professor,professor_id,equipe,academia,role').eq('id', id).maybeSingle();
  if (erroBusca) return NextResponse.json({ error: 'Não foi possível conferir o aluno.' }, { status: 500 });
  if (!aluno || !podeSugerirAluno(aluno, ctx.professor, busca, ctx.professores)) {
    return NextResponse.json({ error: 'Este aluno não está disponível para vínculo. Atualize a busca.' }, { status: 409 });
  }
  const campos = ['nome', 'professor', 'equipe', 'academia', 'professor_id'] as const;
  if (campos.some(campo => body.aluno[campo] !== aluno[campo])) {
    return NextResponse.json({ error: 'O cadastro do aluno mudou. Atualize a busca antes de confirmar.' }, { status: 409 });
  }
  let atualizar = ctx.db.from('atletas').update({
    professor_id: ctx.professor.user_id, professor: ctx.professor.nome,
    equipe: ctx.professor.equipe, academia: ctx.professor.academia,
  }).eq('id', aluno.id).eq('role', 'atleta');
  // Condições também protegem contra outro professor vincular o aluno durante a confirmação.
  for (const campo of campos) {
    atualizar = aluno[campo] === null ? atualizar.is(campo, null) : atualizar.eq(campo, aluno[campo]);
  }
  const { data: salvo, error } = await atualizar.select('id').maybeSingle();
  if (error) return NextResponse.json({ error: 'Não foi possível vincular o aluno.' }, { status: 500 });
  if (!salvo) return NextResponse.json({ error: 'O cadastro mudou durante a confirmação. Atualize a busca.' }, { status: 409 });
  return NextResponse.json({ success: true });
}
