import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';

const headers = { 'Cache-Control': 'private, no-store' };
const campos = 'id, em_breve, created_by, organizador_user_id';
async function autorizar(request: Request, id: string) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return { erro: NextResponse.json({ error: 'Login necessário.' }, { status: 401, headers }) };
  const supabase = createSupabaseServerClient();
  const { data: auth, error } = await supabase.auth.getUser(token);
  if (error || !auth.user) return { erro: NextResponse.json({ error: 'Sessão inválida. Entre novamente.' }, { status: 401, headers }) };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { erro: NextResponse.json({ error: 'Galeria inválida.' }, { status: 400, headers }) };
  const { data: galeria, error: buscaError } = await supabase.from('foto_eventos').select(campos).eq('id', id).maybeSingle();
  if (buscaError) throw buscaError;
  const dono = galeria?.organizador_user_id ? galeria.organizador_user_id === auth.user.id : galeria?.created_by === auth.user.id;
  if (!galeria || !dono) return { erro: NextResponse.json({ error: 'Galeria não encontrada ou sem permissão.' }, { status: 404, headers }) };
  return { supabase, galeria, userId: auth.user.id };
}
const resposta = (galeria: { id: string; em_breve: boolean | null }) => NextResponse.json({ galeria: { id: galeria.id, em_breve: Boolean(galeria.em_breve) } }, { headers });
export async function GET(request: Request) {
  try {
    const ctx = await autorizar(request, new URL(request.url).searchParams.get('galeriaId') || '');
    return ctx.erro || resposta(ctx.galeria!);
  } catch { return NextResponse.json({ error: 'Não foi possível conferir o aviso Em breve.' }, { status: 500, headers }); }
}
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.emBreve !== 'boolean') return NextResponse.json({ error: 'Informe o estado do aviso Em breve.' }, { status: 400, headers });
    const ctx = await autorizar(request, String(body.galeriaId || ''));
    if (ctx.erro) return ctx.erro;
    if (Boolean(ctx.galeria!.em_breve) === body.emBreve) return resposta(ctx.galeria!);
    let consulta = ctx.supabase!.from('foto_eventos').update({ em_breve: body.emBreve }).eq('id', ctx.galeria!.id);
    consulta = ctx.galeria!.organizador_user_id ? consulta.eq('organizador_user_id', ctx.userId!) : consulta.eq('created_by', ctx.userId!).is('organizador_user_id', null);
    const { data, error } = await consulta.select('id, em_breve').maybeSingle();
    if (error || !data) throw error || Error('Atualização não confirmada');
    return resposta(data);
  } catch { return NextResponse.json({ error: 'Não foi possível confirmar a alteração. Confira o estado atual da galeria antes de tentar novamente.' }, { status: 500, headers }); }
}
