import { NextResponse } from 'next/server';
import { autenticarRequest } from '@/app/lib/api-auth';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function contextoMensagens(eventoId: string, usuarioId: string) {
  const db = createSupabaseServerClient();
  const { data: evento } = await db.from('eventos').select('id,nome,organizador_id').eq('id', eventoId).maybeSingle();
  if (!evento) return { db, evento: null, papel: null as null | 'organizador' | 'atleta' };

  if (evento.organizador_id === usuarioId) return { db, evento, papel: 'organizador' as const };

  const { data: inscricao } = await db.from('inscricoes').select('id').eq('evento_id', eventoId).eq('user_id', usuarioId).limit(1).maybeSingle();
  if (inscricao) return { db, evento, papel: 'atleta' as const };

  const { data: dependente } = await db.from('atletas').select('user_id')
    .eq('responsavel_id', usuarioId)
    .limit(20);
  const ids = (dependente || []).map(item => item.user_id).filter(Boolean);
  if (ids.length) {
    const { data: inscDep } = await db.from('inscricoes').select('id').eq('evento_id', eventoId).in('user_id', ids).limit(1).maybeSingle();
    if (inscDep) return { db, evento, papel: 'atleta' as const };
  }

  return { db, evento, papel: null };
}

export async function GET(request: Request, contexto: { params: Promise<{ id: string }> }) {
  const usuario = await autenticarRequest(request);
  if (!usuario) return NextResponse.json({ error: 'Entre na sua conta para ver as mensagens.' }, { status: 401 });
  const { id: eventoId } = await contexto.params;
  const acesso = await contextoMensagens(eventoId, usuario.id);
  if (!acesso.evento || !acesso.papel) return NextResponse.json({ error: 'Você não tem acesso a este chat.' }, { status: 403 });

  const atletaFiltro = new URL(request.url).searchParams.get('atleta') || '';
  if (acesso.papel === 'atleta') {
    const { data, error } = await acesso.db.from('mensagens_evento')
      .select('id,evento_id,atleta_user_id,remetente,texto,lida,criado_em')
      .eq('evento_id', eventoId)
      .eq('atleta_user_id', usuario.id)
      .order('criado_em', { ascending: true });
    if (error) return NextResponse.json({ error: 'Chat ainda não está disponível neste campeonato.' }, { status: 409 });
    await acesso.db.from('mensagens_evento').update({ lida: true })
      .eq('evento_id', eventoId).eq('atleta_user_id', usuario.id).eq('remetente', 'organizador').eq('lida', false);
    return NextResponse.json({ papel: acesso.papel, evento: acesso.evento.nome, mensagens: data || [] });
  }

  if (!atletaFiltro) {
    const { data, error } = await acesso.db.from('mensagens_evento')
      .select('id,atleta_user_id,remetente,texto,lida,criado_em')
      .eq('evento_id', eventoId)
      .order('criado_em', { ascending: false });
    if (error) return NextResponse.json({ error: 'Chat ainda não está disponível neste campeonato.' }, { status: 409 });
    const threads = new Map<string, { atleta_user_id: string; ultima: string; texto: string; naoLidas: number }>();
    for (const msg of data || []) {
      const atual = threads.get(msg.atleta_user_id) || { atleta_user_id: msg.atleta_user_id, ultima: msg.criado_em, texto: msg.texto, naoLidas: 0 };
      if (!threads.has(msg.atleta_user_id)) {
        atual.ultima = msg.criado_em;
        atual.texto = msg.texto;
      }
      if (msg.remetente === 'atleta' && !msg.lida) atual.naoLidas += 1;
      threads.set(msg.atleta_user_id, atual);
    }
    const ids = [...threads.keys()];
    const { data: atletas } = ids.length
      ? await acesso.db.from('atletas_publico').select('user_id,nome').in('user_id', ids)
      : { data: [] as { user_id: string; nome: string }[] };
    const lista = [...threads.values()].map(thread => ({
      ...thread,
      nome: (atletas || []).find(item => item.user_id === thread.atleta_user_id)?.nome || 'Atleta',
    }));
    return NextResponse.json({ papel: acesso.papel, evento: acesso.evento.nome, conversas: lista });
  }

  const { data, error } = await acesso.db.from('mensagens_evento')
    .select('id,evento_id,atleta_user_id,remetente,texto,lida,criado_em')
    .eq('evento_id', eventoId)
    .eq('atleta_user_id', atletaFiltro)
    .order('criado_em', { ascending: true });
  if (error) return NextResponse.json({ error: 'Chat ainda não está disponível neste campeonato.' }, { status: 409 });
  await acesso.db.from('mensagens_evento').update({ lida: true })
    .eq('evento_id', eventoId).eq('atleta_user_id', atletaFiltro).eq('remetente', 'atleta').eq('lida', false);
  const { data: atleta } = await acesso.db.from('atletas_publico').select('user_id,nome').eq('user_id', atletaFiltro).maybeSingle();
  return NextResponse.json({ papel: acesso.papel, evento: acesso.evento.nome, atleta: atleta?.nome || 'Atleta', mensagens: data || [] });
}

export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
  const usuario = await autenticarRequest(request);
  if (!usuario) return NextResponse.json({ error: 'Entre na sua conta para enviar mensagem.' }, { status: 401 });
  const { id: eventoId } = await contexto.params;
  const acesso = await contextoMensagens(eventoId, usuario.id);
  if (!acesso.evento || !acesso.papel) return NextResponse.json({ error: 'Você não tem acesso a este chat.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const texto = String(body.texto || '').trim();
  if (texto.length < 1 || texto.length > 2000) {
    return NextResponse.json({ error: 'Escreva uma mensagem de até 2000 caracteres.' }, { status: 400 });
  }
  const atletaUserId = acesso.papel === 'organizador' ? String(body.atletaUserId || '') : usuario.id;
  if (!atletaUserId) return NextResponse.json({ error: 'Escolha a conversa do atleta.' }, { status: 400 });
  if (acesso.papel === 'organizador') {
    const { data: inscrito } = await acesso.db.from('inscricoes').select('id').eq('evento_id', eventoId).eq('user_id', atletaUserId).limit(1).maybeSingle();
    const { data: thread } = inscrito ? { data: inscrito } : await acesso.db.from('mensagens_evento').select('id').eq('evento_id', eventoId).eq('atleta_user_id', atletaUserId).limit(1).maybeSingle();
    if (!thread) return NextResponse.json({ error: 'Este atleta não tem conversa neste campeonato.' }, { status: 400 });
  }

  const { data, error } = await acesso.db.from('mensagens_evento').insert({
    evento_id: eventoId,
    atleta_user_id: atletaUserId,
    remetente: acesso.papel,
    texto,
  }).select('id,evento_id,atleta_user_id,remetente,texto,lida,criado_em').single();
  if (error) return NextResponse.json({ error: 'Não foi possível enviar. Confirme se o chat deste evento já foi ativado.' }, { status: 409 });
  return NextResponse.json({ mensagem: data });
}
