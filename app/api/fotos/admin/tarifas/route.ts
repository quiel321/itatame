import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { conferirTarifaMP, type TarifaPedidoMP } from '@/app/lib/fotos-tarifas-mp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };
const resposta = (dados: unknown, status = 200) => NextResponse.json(dados, { status, headers });

// Só consulta. Não renova OAuth, não sincroniza pedidos e não escreve em pagamentos.
export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return resposta({ error: 'Login necessário.' }, 401);
    const db = createSupabaseServerClient();
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return resposta({ error: 'Sessão inválida.' }, 401);
    const params = new URL(request.url).searchParams, galeria = params.get('galeria');
    const inicio = Number(params.get('inicio') || 0);
    if (!Number.isSafeInteger(inicio) || inicio < 0 || inicio > 100000 || (galeria && !/^[a-f0-9-]{36}$/i.test(galeria))) return resposta({ error: 'Filtro inválido.' }, 400);
    const { data: galerias, error: erroGalerias } = await db.from('foto_eventos').select('id').eq('organizador_user_id', auth.user.id);
    if (erroGalerias) throw erroGalerias;
    const ids = (galerias || []).map(g => g.id);
    if (galeria && !ids.includes(galeria)) return resposta({ error: 'Galeria não autorizada.' }, 403);
    if (!ids.length) return resposta({ pedidos: [], total: 0, proximo: null, atualizadoEm: new Date().toISOString() });
    const consulta = db.from('foto_pedidos').select('id, evento_id, total_centavos, provedor_payment_id', { count: 'exact' })
      .eq('organizador_user_id', auth.user.id).eq('modelo_recebimento', 'diaria_organizador').eq('status', 'pago')
      .in('evento_id', galeria ? [galeria] : ids).order('created_at', { ascending: false }).order('id').range(inicio, inicio + 19);
    const { data: pedidos, count, error } = await consulta;
    if (error) throw error;
    const { data: conta, error: erroConta } = await db.from('foto_mp_organizadores').select('mp_access_token, mp_user_id').eq('user_id', auth.user.id).maybeSingle();
    if (erroConta) throw erroConta;
    const resultados: TarifaPedidoMP[] = [];
    // Quatro consultas de cada vez; um pagamento indisponível não bloqueia os demais.
    for (let i = 0; i < (pedidos || []).length; i += 4) {
      resultados.push(...await Promise.all(pedidos!.slice(i, i + 4).map(async p => {
        try {
          if (!p.provedor_payment_id || !conta?.mp_access_token || !conta.mp_user_id) throw Error('Sem cobrança conferível.');
          const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(p.provedor_payment_id)}`, {
            headers: { Authorization: `Bearer ${conta.mp_access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(7000),
          });
          if (!r.ok) throw Error('Consulta indisponível.');
          return conferirTarifaMP(p, await r.json(), String(conta.mp_user_id));
        } catch { return { pedidoId: p.id, galeriaId: p.evento_id, tarifaCentavos: null, liquidoCentavos: null }; }
      })));
    }
    return resposta({ pedidos: resultados, total: count || 0, proximo: inicio + resultados.length < (count || 0) ? inicio + resultados.length : null, atualizadoEm: new Date().toISOString() });
  } catch {
    return resposta({ error: 'Não foi possível conferir as tarifas agora. Os pagamentos continuam no fluxo normal.' }, 503);
  }
}
