import { NextResponse } from 'next/server';
import { autenticarRequest } from '@/app/lib/api-auth';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { identificarResponsavel, type AtletaResponsavel } from '@/app/lib/inscricao-identificacao';

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const db = createSupabaseServerClient();
  const { data: perfil, error: erroPerfil } = await db.from('atletas').select('role').eq('user_id', usuario.id).maybeSingle();
  if (erroPerfil) return NextResponse.json({ error: 'Não foi possível validar seu acesso.' }, { status: 500 });
  if (perfil?.role !== 'super-admin') return NextResponse.json({ error: 'Acesso restrito ao suporte.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const ids: unknown = body?.inscricaoIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || ids.some(id => !/^\d+$/.test(String(id)))) {
    return NextResponse.json({ error: 'Informe até 200 inscrições válidas.' }, { status: 400 });
  }
  const { data: inscricoes, error } = await db.from('inscricoes').select('id,atleta_id,user_id,idade').in('id', ids);
  if (error) return NextResponse.json({ error: 'Não foi possível consultar as inscrições.' }, { status: 500 });
  const atletaIds = [...new Set((inscricoes || []).map(item => item.atleta_id).filter(id => id != null))];
  const userIds = [...new Set((inscricoes || []).filter(item => item.atleta_id == null).map(item => item.user_id).filter(Boolean))];
  const campos = 'id,user_id,responsavel_id,nascimento';
  const [porId, porUsuario] = await Promise.all([
    atletaIds.length ? db.from('atletas').select(campos).in('id', atletaIds) : Promise.resolve({ data: [], error: null }),
    userIds.length ? db.from('atletas').select(campos).in('user_id', userIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (porId.error || porUsuario.error) return NextResponse.json({ error: 'Não foi possível consultar os atletas.' }, { status: 500 });
  const atletas = [...(porId.data || []), ...(porUsuario.data || [])] as AtletaResponsavel[];
  const responsavelIds = [...new Set(atletas.map(item => item.responsavel_id).filter((id): id is string => Boolean(id)))];
  const { data: responsaveis, error: erroResponsaveis } = responsavelIds.length
    ? await db.from('atletas').select('id,user_id,nome,nascimento,telefone,email').in('user_id', responsavelIds)
    : { data: [], error: null };
  if (erroResponsaveis) return NextResponse.json({ error: 'Não foi possível consultar os responsáveis.' }, { status: 500 });
  const atletasPorId = new Map(atletas.map(item => [String(item.id), item]));
  const atletasPorUsuario = new Map(atletas.map(item => [item.user_id, item]));
  const adultos = new Map((responsaveis || []).map(item => [item.user_id, item as AtletaResponsavel]));
  const dados = (inscricoes || []).map(item => {
    const atleta = item.atleta_id == null ? atletasPorUsuario.get(item.user_id) : atletasPorId.get(String(item.atleta_id));
    return { id: item.id, ...identificarResponsavel(item, atleta, adultos.get(atleta?.responsavel_id || '')) };
  });
  return NextResponse.json({ inscricoes: dados }, { headers: { 'Cache-Control': 'no-store' } });
}
