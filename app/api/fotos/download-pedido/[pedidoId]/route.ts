import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { createR2PresignedGetUrl } from '@/app/lib/r2';
import { acessoZipValido, criarZipFotos, linkZipPedido, nomeFotoZip } from '@/app/lib/fotos-zip';

export const runtime = 'nodejs';
export const maxDuration = 300;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const resposta = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store' } });
type Foto = { r2_original_key: string | null; nome_original: string | null; mime_type: string | null };
type Item = { id: string; download_liberado: boolean; download_expires_at: string | null; foto_arquivos: Foto | Foto[] | null };
const primeira = <T,>(r: T | T[] | null) => Array.isArray(r) ? r[0] : r;

export async function GET(request: Request, context: { params: Promise<{ pedidoId: string }> }) {
  try {
    const { pedidoId } = await context.params;
    if (!uuid.test(pedidoId)) return resposta('Pedido inválido.', 400);
    const params = new URL(request.url).searchParams, token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const assinada = params.get('link') !== '1' && acessoZipValido(pedidoId, params.get('exp'), params.get('assinatura'));
    if (!token && !assinada) return resposta('Entre na sua conta para baixar as fotos.', 401);
    const db = createSupabaseServerClient();
    let userId: string | null = null;
    if (token) {
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return resposta('Sessão inválida.', 401);
      userId = data.user.id;
    }
    const { data: pedido, error } = await db.from('foto_pedidos').select('id,comprador_user_id,status').eq('id', pedidoId).maybeSingle();
    if (error) return resposta('Não foi possível conferir o pedido.', 503);
    if (!pedido || (userId && pedido.comprador_user_id !== userId)) return resposta('Pedido não encontrado.', 404);
    if (pedido.status !== 'pago') return resposta('O pagamento precisa estar confirmado.', 403);
    const itens: Item[] = [];
    // Pagina antes de filtrar para não perder fotos em pedidos grandes.
    for (let inicio = 0; ; inicio += 500) {
      const r = await db.from('foto_pedido_itens').select('id,download_liberado,download_expires_at,foto_arquivos(r2_original_key,nome_original,mime_type)').eq('pedido_id', pedidoId).order('id').range(inicio, inicio + 499);
      if (r.error) return resposta('Não foi possível conferir os arquivos.', 503);
      itens.push(...(r.data || []) as unknown as Item[]);
      if (!r.data || r.data.length < 500) break;
      if (inicio >= 1000) return resposta('Pedido muito grande. Use os downloads individuais.', 413);
    }
    const fotos = itens.flatMap(item => { const foto = primeira(item.foto_arquivos); return foto && !foto.mime_type?.startsWith('video/') ? [{ item, foto }] : []; });
    if (!fotos.length) return resposta('Este pedido não tem fotos para baixar em ZIP.', 404);
    if (fotos.length > 500) return resposta('Use os downloads individuais para pedidos com mais de 500 fotos.', 413);
    if (fotos.some(({ item, foto }) => !item.download_liberado || !foto.r2_original_key || (item.download_expires_at && Date.parse(item.download_expires_at) <= Date.now()))) return resposta('Há fotos ainda não liberadas ou com acesso expirado neste pedido.', 403);
    if (params.get('link') === '1') return NextResponse.json({ url: linkZipPedido(pedidoId), quantidade: fotos.length }, { headers: { 'Cache-Control': 'private, no-store' } });
    await db.from('foto_downloads').insert(fotos.map(({ item }) => ({ item_id: item.id, user_id: userId || pedido.comprador_user_id, user_agent: request.headers.get('user-agent') })));
    const stream = criarZipFotos(fotos.map(({ item, foto }, indice) => ({ nome: nomeFotoZip(foto.nome_original, indice, item.id), abrir: signal => fetch(createR2PresignedGetUrl(foto.r2_original_key!, 300), { cache: 'no-store', signal }) })), request.signal);
    return new NextResponse(stream, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="retratt-fotos-${pedidoId.slice(0, 8)}.zip"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
  } catch { return resposta('Não foi possível preparar o ZIP. Tente novamente.', 500); }
}
