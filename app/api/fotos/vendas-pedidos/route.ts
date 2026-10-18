import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { apresentarPedidoFotos, prepararTextoLembreteFotos, type PedidoAcompanhamento } from '@/app/lib/fotos-acompanhamento';
import { createR2PresignedGetUrl } from '@/app/lib/r2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };
const resposta = (dados: unknown, status = 200) => NextResponse.json(dados, { status, headers });
const primeira = <T,>(v: T | T[] | null | undefined): T | undefined => Array.isArray(v) ? v[0] : v ?? undefined;
const LIMITE = 500;

// Este endpoint só lê: não chama a sincronização, não renova OAuth e não envia mensagens.
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const perfil = params.get('perfil');
    if (perfil !== 'organizador' && perfil !== 'fotografo') return resposta({ error: 'Perfil inválido.' }, 400);
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return resposta({ error: 'Entre na sua conta para acompanhar os pedidos.' }, 401);
    const db = createSupabaseServerClient();
    const { data: auth, error: erroAuth } = await db.auth.getUser(token);
    if (erroAuth || !auth.user) return resposta({ error: 'Sessão inválida.' }, 401);
    let fotografoId: string | null = null;
    let galerias: { id: string; nome: string; slug: string | null; created_at: string }[] = [];
    if (perfil === 'fotografo') {
      const { data: f, error } = await db.from('fotografos').select('id').eq('user_id', auth.user.id).eq('status', 'ativo').maybeSingle();
      if (error) throw error;
      if (!f) return resposta({ error: 'Perfil de fotógrafo não encontrado.' }, 403);
      fotografoId = String(f.id);
      const [vinculos, proprias] = await Promise.all([
        db.from('foto_evento_fotografos').select('foto_eventos(id, nome, slug, created_at)').eq('fotografo_id', fotografoId).eq('status', 'ativo').limit(1000),
        db.from('foto_eventos').select('id, nome, slug, created_at').eq('created_by', auth.user.id).limit(1000),
      ]);
      if (vinculos.error || proprias.error) throw vinculos.error || proprias.error;
      galerias = [...new Map([...(proprias.data || []), ...(vinculos.data || []).flatMap(v => { const g = primeira(v.foto_eventos); return g ? [g] : []; })]
        .map(g => [String(g.id), g])).values()];
    } else {
      const { data, error } = await db.from('foto_eventos').select('id, nome, slug, created_at').eq('organizador_user_id', auth.user.id).order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      galerias = data || [];
    }
    galerias.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const galeriaId = params.get('galeria') || galerias[0]?.id;
    const galeria = galerias.find(g => g.id === galeriaId);
    if (galeriaId && !galeria) return resposta({ error: 'Galeria não autorizada.' }, 403);
    if (!galeria) return resposta({ galerias: [], galeriaId: null, pedidos: [], parcial: false, atualizadoEm: new Date().toISOString() });

    const brutos: PedidoAcompanhamento[] = [];
    for (let inicio = 0; inicio <= LIMITE; inicio += 250) {
      const itens = fotografoId ? 'foto_pedido_itens!inner' : 'foto_pedido_itens';
      const arquivos = fotografoId ? 'foto_arquivos!inner' : 'foto_arquivos';
      let consulta = db.from('foto_pedidos').select(`id,evento_id,comprador_user_id,comprador_email,comprador_nome,status,created_at,pago_em,provedor_payment_id,provedor_status_detail,total_centavos,subtotal_centavos,desconto_centavos,comissao_itatame_centavos,comissao_organizador_centavos,modelo_recebimento,fotografo_id,organizador_user_id,email_confirmacao_enviado_em,email_confirmacao_erro,vendas_fotografos,
        ${itens}(id,foto_id,preco_centavos,download_liberado,download_expires_at,${arquivos}(fotografo_id,titulo,nome_original,mime_type,r2_preview_key,fotografos(nome)))`)
        .eq('evento_id', galeria.id);
      if (fotografoId) consulta = consulta.eq('foto_pedido_itens.foto_arquivos.fotografo_id', fotografoId);
      else consulta = consulta.eq('organizador_user_id', auth.user.id);
      const { data, error } = await consulta.order('created_at', { ascending: false }).order('id', { ascending: false }).range(inicio, Math.min(inicio + 249, LIMITE));
      if (error) throw error;
      for (const raw of data || []) {
        const p = raw as unknown as PedidoAcompanhamento;
        p.foto_pedido_itens = (p.foto_pedido_itens || []).map(i => {
          const a = primeira(i.foto_arquivos);
          return { ...i, foto_arquivos: a ? { ...a, fotografos: primeira(a.fotografos) || null } : null };
        }).filter(i => !fotografoId || i.foto_arquivos?.fotografo_id === fotografoId);
        if (!fotografoId || p.foto_pedido_itens.length) brutos.push(p);
      }
      if (!data || data.length < Math.min(250, LIMITE - inicio + 1)) break;
    }
    const parcial = brutos.length > LIMITE;
    const historico = brutos.slice(0, LIMITE);
    const pedidos = historico.map(p => apresentarPedidoFotos(p, historico, fotografoId, !parcial));
    const pedidoId = params.get('pedido');
    if (!pedidoId) return resposta({ galerias: galerias.map(g => ({ id: g.id, nome: g.nome })), galeriaId: galeria.id, pedidos, parcial, limite: LIMITE, atualizadoEm: new Date().toISOString() });
    const raw = historico.find(p => p.id === pedidoId), pedido = pedidos.find(p => p.id === pedidoId);
    if (!raw || !pedido) return resposta({ error: 'Pedido não encontrado neste histórico.' }, 404);

    if (params.get('acao') === 'lembrete') {
      if (fotografoId || !pedido.lembrete.permitido) return resposta({ error: pedido.lembrete.motivo || 'Lembrete indisponível.' }, 409);
      // Rascunho sem link do Pix antigo, sem token de acesso e sem envio por e-mail/push.
      return resposta({ rascunho: prepararTextoLembreteFotos(pedido, galeria.nome, `https://retratt.com/evento/${encodeURIComponent(galeria.slug || galeria.id)}`) });
    }
    const ids = pedido.itens.map(i => i.id);
    const downloads = ids.length ? await db.from('foto_downloads').select('item_id, created_at', { count: 'exact' }).in('item_id', ids).order('created_at', { ascending: false }).range(0, 499) : { data: [], count: 0, error: null };
    if (downloads.error) throw downloads.error;
    const imagens = raw.foto_pedido_itens.flatMap(i => {
      if (!i.foto_arquivos?.r2_preview_key) return [];
      try { return [{ fotoId: i.foto_id, url: createR2PresignedGetUrl(i.foto_arquivos.r2_preview_key, 120) }]; } catch { return []; }
    });
    let mercadoPago: Record<string, unknown> | null = null, erroMP: string | null = null;
    if (params.get('conferirMP') === '1' && !fotografoId && raw.provedor_payment_id) {
      try {
        const diaria = raw.modelo_recebimento === 'diaria_organizador';
        const consulta = diaria ? db.from('foto_mp_organizadores').select('mp_access_token, mp_user_id').eq('user_id', raw.organizador_user_id!)
          : db.from('fotografos').select('mp_access_token, mp_user_id').eq('id', raw.fotografo_id!);
        const { data: conta, error } = await consulta.maybeSingle();
        if (error || !conta?.mp_access_token) throw new Error('Conta indisponível.');
        const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(raw.provedor_payment_id)}`, { headers: { Authorization: `Bearer ${conta.mp_access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('Consulta indisponível.');
        const mp = await r.json();
        if (String(mp.id) !== raw.provedor_payment_id || mp.external_reference !== `foto_pedido:${raw.id}` || Math.round(Number(mp.transaction_amount) * 100) !== raw.total_centavos || String(mp.collector_id) !== String(conta.mp_user_id)) throw new Error('Pagamento divergente.');
        const taxa = (mp.fee_details || []).filter((f: { type?: string }) => f.type === 'mercadopago_fee').reduce((s: number, f: { amount?: number }) => s + Math.round(Number(f.amount) * 100), 0);
        mercadoPago = { status: mp.status, metodo: mp.payment_method_id, tipo: mp.payment_type_id, aprovadoEm: mp.date_approved, expiraEm: mp.date_of_expiration,
          taxaCentavos: mp.status === 'approved' ? taxa : null, liquidoCentavos: mp.status === 'approved' && mp.transaction_details?.net_received_amount != null ? Math.round(Number(mp.transaction_details.net_received_amount) * 100) : null,
          consultadoEm: new Date().toISOString() };
      } catch { erroMP = 'Não foi possível conferir o Mercado Pago agora. Os dados locais continuam disponíveis; nenhum pagamento foi alterado.'; }
    }
    return resposta({ pedido, imagens, downloads: { solicitacoes: downloads.count || 0, itensAcessados: new Set((downloads.data || []).map(d => d.item_id)).size,
      ultimoEm: downloads.data?.[0]?.created_at || null, parcial: (downloads.count || 0) > 500 }, mercadoPago, erroMP });
  } catch (error) {
    console.error('Acompanhamento de pedidos Retratt indisponível:', error instanceof Error ? error.message : 'Erro de consulta');
    return resposta({ error: 'Não foi possível carregar os pedidos. Tente atualizar novamente.' }, 503);
  }
}
