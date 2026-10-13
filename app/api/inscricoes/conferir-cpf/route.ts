import { NextResponse } from 'next/server';
import { autenticarRequest } from '@/app/lib/api-auth';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { FILTRO_INSCRICOES_ATIVAS } from '@/app/lib/inscricao-ativa';

/** Consulta somente leitura; o CPF vem do perfil autorizado, nunca do corpo da requisição. */
export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const eventoId = String(body.eventoId || '');
  const atletaId = Number(body.atletaId);
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventoId) || !Number.isSafeInteger(atletaId) || atletaId <= 0) {
    return NextResponse.json({ error: 'Campeonato ou atleta inválido.' }, { status: 400 });
  }
  const db = createSupabaseServerClient();
  const { data: atleta, error } = await db.from('atletas').select('user_id,responsavel_id,cpf').eq('id', atletaId).maybeSingle();
  if (error) return NextResponse.json({ error: 'Não foi possível conferir o cadastro.' }, { status: 500 });
  if (!atleta || (atleta.user_id !== usuario.id && atleta.responsavel_id !== usuario.id)) {
    return NextResponse.json({ error: 'Atleta não pertence à sua conta.' }, { status: 403 });
  }
  const cpf = String(atleta.cpf || '').replace(/\D/g, '');
  if (cpf.length !== 11) return NextResponse.json({ inscrito: false });
  const formatado = `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`;
  const perfis = await db.from('atletas').select('id').in('cpf', [cpf, formatado]);
  if (perfis.error) return NextResponse.json({ error: 'Não foi possível conferir o CPF.' }, { status: 500 });
  if (!perfis.data?.length) return NextResponse.json({ inscrito: false });
  const inscricoes = await db.from('inscricoes').select('id').eq('evento_id', eventoId)
    .in('atleta_id', perfis.data.map(p => p.id)).or(FILTRO_INSCRICOES_ATIVAS).limit(1);
  if (inscricoes.error) return NextResponse.json({ error: 'Não foi possível conferir as inscrições.' }, { status: 500 });
  return NextResponse.json({ inscrito: Boolean(inscricoes.data?.length) });
}
