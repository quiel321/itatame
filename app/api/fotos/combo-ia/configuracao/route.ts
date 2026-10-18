import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';

const responder = (dados: unknown, status = 200) => NextResponse.json(dados, { status, headers: { 'Cache-Control': 'private, no-store' } });
async function autorizar(request: Request, galeriaId: string) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { erro: responder({ error: 'Entre na sua conta para configurar o combo.' }, 401) };
  const db = createSupabaseServerClient(), { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth.user) return { erro: responder({ error: 'Sessão inválida.' }, 401) };
  const { data: galeria, error: erroGaleria } = await db.from('foto_eventos').select('id,organizador_user_id,created_by,combo_ia_ativo').eq('id', galeriaId).maybeSingle();
  if (erroGaleria) return { erro: responder({ error: 'Não foi possível carregar a configuração.' }, 503) };
  if (!galeria) return { erro: responder({ error: 'Galeria não encontrada.' }, 404) };
  const podeEditar = galeria.organizador_user_id ? galeria.organizador_user_id === auth.user.id : galeria.created_by === auth.user.id;
  if (!podeEditar) {
    const { data: fotografo } = await db.from('fotografos').select('id').eq('user_id', auth.user.id).maybeSingle();
    const { data: vinculo } = fotografo ? await db.from('foto_evento_fotografos').select('evento_id').eq('evento_id', galeriaId).eq('fotografo_id', fotografo.id).eq('status', 'ativo').maybeSingle() : { data: null };
    if (!vinculo) return { erro: responder({ error: 'Sem permissão para esta galeria.' }, 403) };
  }
  return { db, galeria, podeEditar };
}
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('galeriaId') || '';
  if (!/^[a-f0-9-]{36}$/i.test(id)) return responder({ error: 'Galeria inválida.' }, 400);
  const a = await autorizar(request, id);
  return a.erro || responder({ ativo: a.galeria!.combo_ia_ativo === true, podeEditar: a.podeEditar });
}
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !/^[a-f0-9-]{36}$/i.test(body.galeriaId || '') || typeof body.ativo !== 'boolean') return responder({ error: 'Revise a configuração.' }, 400);
  const a = await autorizar(request, body.galeriaId);
  if (a.erro) return a.erro;
  if (!a.podeEditar) return responder({ error: 'Esta configuração é definida pelo responsável da galeria.' }, 403);
  let gravar = a.db!.from('foto_eventos').update({ combo_ia_ativo: body.ativo }).eq('id', a.galeria!.id);
  gravar = a.galeria!.organizador_user_id ? gravar.eq('organizador_user_id', a.galeria!.organizador_user_id) : gravar.is('organizador_user_id', null).eq('created_by', a.galeria!.created_by);
  const { data, error } = await gravar.select('combo_ia_ativo').single();
  if (error) return responder({ error: 'Não foi possível salvar o combo. Tente novamente.' }, 503);
  return responder({ ativo: data.combo_ia_ativo === true, podeEditar: true });
}
