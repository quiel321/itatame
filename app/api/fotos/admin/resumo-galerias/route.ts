import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const { data: galerias, error } = await supabase.from("foto_eventos").select("id").eq("organizador_user_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: contaOrganizador } = await supabase.from("foto_mp_organizadores")
    .select("mp_connected_at").eq("user_id", auth.user.id).maybeSingle();
  const ids = (galerias || []).map((item) => item.id);
  if (!ids.length) return NextResponse.json({
    vendasTotal: 0,
    vendasPorGaleria: {},
    fotografosPorGaleria: {},
    mercadoPagoOrganizadorConectado: Boolean(contaOrganizador?.mp_connected_at),
    royaltiesTotalCentavos: 0,
    royaltiesPorGaleria: {},
    receitaDiretaTotalCentavos: 0,
    receitaDiretaPorGaleria: {},
  });

  const [{ data: vinculos }, { data: pedidos }] = await Promise.all([
    supabase.from("foto_evento_fotografos").select("evento_id, fotografo_id, status, comissao_organizador_percentual, modelo_recebimento").in("evento_id", ids).eq("status", "ativo"),
    supabase.from("foto_pedidos").select("id, evento_id, comissao_organizador_centavos, receita_direta_organizador_centavos, repasse_organizador_status").in("evento_id", ids).eq("status", "pago"),
  ]);

  const fotografoIds = [...new Set((vinculos || []).map((item) => item.fotografo_id).filter(Boolean))];
  const pedidoIds = (pedidos || []).map((item) => item.id);
  const [{ data: fotografos }, { data: itens }] = await Promise.all([
    fotografoIds.length ? supabase.from("fotografos").select("id, nome, email, foto_url").in("id", fotografoIds) : Promise.resolve({ data: [] }),
    pedidoIds.length ? supabase.from("foto_pedido_itens").select("id, pedido_id").in("pedido_id", pedidoIds) : Promise.resolve({ data: [] }),
  ]);

  const fotografoPorId = new Map((fotografos || []).map((item) => [item.id, item]));
  const eventoPorPedido = new Map((pedidos || []).map((item) => [item.id, item.evento_id]));
  const vendasPorGaleria: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const royaltiesPorGaleria: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const receitaDiretaPorGaleria: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const pedido of pedidos || []) {
    royaltiesPorGaleria[pedido.evento_id] = (royaltiesPorGaleria[pedido.evento_id] || 0)
      + Number(pedido.comissao_organizador_centavos || 0);
    receitaDiretaPorGaleria[pedido.evento_id] = (receitaDiretaPorGaleria[pedido.evento_id] || 0)
      + Number(pedido.receita_direta_organizador_centavos || 0);
  }
  for (const item of itens || []) {
    const eventoId = eventoPorPedido.get(item.pedido_id);
    if (eventoId) vendasPorGaleria[eventoId] = (vendasPorGaleria[eventoId] || 0) + 1;
  }

  const fotografosPorGaleria: Record<string, Array<{ id: string; nome: string | null; email: string | null; foto_url: string | null; comissao_organizador_percentual: number; modelo_recebimento: string }>> = Object.fromEntries(ids.map((id) => [id, []]));
  for (const vinculo of vinculos || []) {
    const fotografo = fotografoPorId.get(vinculo.fotografo_id);
    if (fotografo) fotografosPorGaleria[vinculo.evento_id].push({
      ...fotografo,
      comissao_organizador_percentual: Number(vinculo.comissao_organizador_percentual || 0),
      modelo_recebimento: vinculo.modelo_recebimento || "royalty",
    });
  }

  return NextResponse.json({
    mercadoPagoOrganizadorConectado: Boolean(contaOrganizador?.mp_connected_at),
    vendasTotal: Object.values(vendasPorGaleria).reduce((total, quantidade) => total + quantidade, 0),
    vendasPorGaleria,
    fotografosPorGaleria,
    royaltiesTotalCentavos: Object.values(royaltiesPorGaleria).reduce((total, valor) => total + valor, 0),
    royaltiesPorGaleria,
    receitaDiretaTotalCentavos: Object.values(receitaDiretaPorGaleria).reduce((total, valor) => total + valor, 0),
    receitaDiretaPorGaleria,
  });
}
