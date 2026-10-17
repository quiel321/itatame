import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { conferirRegistroVendas, registrarVendasFotografos, type ResumoFotografoDiaria } from '@/app/lib/fotos-vendas-diaria';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const primeira = (v: any) => Array.isArray(v) ? v[0] : v;

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Login necessário.' }, { status: 401, headers });
    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401, headers });
    const { data: galerias, error } = await supabase.from('foto_eventos').select('id, nome').eq('organizador_user_id', auth.user.id);
    if (error) throw error;
    const nomes = new Map((galerias || []).map(g => [String(g.id), String(g.nome || 'Galeria')]));
    const resumo = new Map<string, ResumoFotografoDiaria>();
    if (nomes.size) for (let inicio = 0; ; inicio += 250) {
      const { data: pedidos, error: erroPedidos } = await supabase.from('foto_pedidos')
        .select('id, evento_id, fotografo_id, modelo_recebimento, status, total_centavos, comissao_itatame_centavos, vendas_fotografos, foto_pedido_itens(preco_centavos, foto_arquivos(fotografo_id, mime_type, fotografos(nome)))')
        .eq('organizador_user_id', auth.user.id).eq('modelo_recebimento', 'diaria_organizador').eq('status', 'pago')
        .in('evento_id', [...nomes.keys()]).order('created_at').order('id').range(inicio, inicio + 249);
      if (erroPedidos) throw erroPedidos;
      for (const pedido of pedidos || []) {
        const total = Number(pedido.total_centavos), comissao = Number(pedido.comissao_itatame_centavos || 0);
        // Pedidos antigos não são atualizados: usam preços e totais já registrados.
        const itens = (pedido.foto_pedido_itens || []).map(item => {
          const foto = primeira(item.foto_arquivos);
          return { fotografoId: String(foto?.fotografo_id || pedido.fotografo_id || 'autor-nao-identificado'),
            nome: primeira(foto?.fotografos)?.nome || 'Autor não identificado',
            precoCentavos: Number(item.preco_centavos), mimeType: foto?.mime_type || null };
        });
        const registro = pedido.vendas_fotografos ?? registrarVendasFotografos(itens,
          itens.reduce((s, i) => s + i.precoCentavos, 0) - total, comissao);
        const vendas = conferirRegistroVendas(registro, total, comissao);
        for (const venda of vendas) {
          const chave = `${pedido.evento_id}:${venda.fotografoId}`;
          const anterior = resumo.get(chave);
          if (!anterior) resumo.set(chave, { ...venda, galeriaId: String(pedido.evento_id), galeria: nomes.get(String(pedido.evento_id))!, pedidosPagos: 1 });
          else {
            anterior.pedidosPagos++;
            for (const campo of ['quantidade', 'subtotalCentavos', 'descontoCentavos', 'totalCentavos', 'comissaoRetrattCentavos', 'antesTarifaCentavos'] as const) anterior[campo] += venda[campo];
          }
        }
      }
      if (!pedidos || pedidos.length < 250) break;
    }
    return NextResponse.json({ vendas: [...resumo.values()].sort((a, b) => a.galeria.localeCompare(b.galeria) || a.nome.localeCompare(b.nome)), atualizadoEm: new Date().toISOString() }, { headers });
  } catch (error) {
    console.error('Conferência de vendas por diária:', error);
    return NextResponse.json({ error: 'Não foi possível conferir as vendas por fotógrafo. Tente atualizar novamente.' }, { status: 500, headers });
  }
}
