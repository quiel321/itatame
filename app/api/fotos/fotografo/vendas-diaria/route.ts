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
    const { data: fotografo, error: perfilError } = await supabase.from('fotografos').select('id').eq('user_id', auth.user.id).eq('status', 'ativo').maybeSingle();
    if (perfilError) throw perfilError;
    if (!fotografo) return NextResponse.json({ error: 'Perfil de fotógrafo não encontrado.' }, { status: 403, headers });
    const resumo = new Map<string, ResumoFotografoDiaria>();
    // Conjuntos disjuntos: autoria congelada de novos pedidos e diária antiga de um autor.
    // Nunca usa um ID de fotógrafo fornecido pelo navegador.
    for (const legado of [false, true]) for (let inicio = 0; ; inicio += 250) {
      let consulta = supabase.from('foto_pedidos')
        .select('id, evento_id, fotografo_id, total_centavos, comissao_itatame_centavos, vendas_fotografos, foto_eventos(nome), foto_pedido_itens(preco_centavos, foto_arquivos(fotografo_id, mime_type, fotografos(nome)))')
        .eq('modelo_recebimento', 'diaria_organizador').eq('status', 'pago');
      consulta = legado ? consulta.is('vendas_fotografos', null).eq('fotografo_id', fotografo.id)
        : consulta.contains('vendas_fotografos', JSON.stringify([{ fotografoId: fotografo.id }]));
      const { data: pedidos, error } = await consulta.order('created_at').order('id').range(inicio, inicio + 249);
      if (error) throw error;
      for (const pedido of pedidos || []) {
        const total = Number(pedido.total_centavos), comissao = Number(pedido.comissao_itatame_centavos || 0);
        const itens = (pedido.foto_pedido_itens || []).map(item => {
          const foto = primeira(item.foto_arquivos);
          return { fotografoId: String(foto?.fotografo_id || pedido.fotografo_id || 'autor-nao-identificado'),
            nome: primeira(foto?.fotografos)?.nome || 'Fotógrafo', precoCentavos: Number(item.preco_centavos), mimeType: foto?.mime_type || null };
        });
        const registro = pedido.vendas_fotografos ?? registrarVendasFotografos(itens, itens.reduce((s, i) => s + i.precoCentavos, 0) - total, comissao);
        const vendas = conferirRegistroVendas(registro, total, comissao).filter(v => v.fotografoId === fotografo.id);
        for (const venda of vendas) {
          const chave = String(pedido.evento_id || 'removida');
          const anterior = resumo.get(chave);
          if (!anterior) resumo.set(chave, { ...venda, galeriaId: chave, galeria: primeira(pedido.foto_eventos)?.nome || 'Galeria removida', pedidosPagos: 1 });
          else {
            anterior.pedidosPagos++;
            for (const campo of ['quantidade', 'subtotalCentavos', 'descontoCentavos', 'totalCentavos', 'comissaoRetrattCentavos', 'antesTarifaCentavos'] as const) anterior[campo] += venda[campo];
          }
        }
      }
      if (!pedidos || pedidos.length < 250) break;
    }
    return NextResponse.json({ vendas: [...resumo.values()].sort((a, b) => a.galeria.localeCompare(b.galeria)), atualizadoEm: new Date().toISOString() }, { headers });
  } catch (error) {
    console.error('Vendas próprias por diária:', error);
    return NextResponse.json({ error: 'Não foi possível conferir suas vendas por diária. Tente atualizar novamente.' }, { status: 500, headers });
  }
}
