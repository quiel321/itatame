import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { sincronizarPagamentoFotos } from "@/app/lib/fotos-mercado-pago";
import { autorizarPedido } from "@/app/lib/fotos-convidado";

export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;
  const pedidoId = parametros.get("pedido_id");
  if (!pedidoId) return NextResponse.json({ error: "Pedido não informado." }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const autorizado = await autorizarPedido(supabase, request, pedidoId, parametros.get("acesso"));
  if (!autorizado) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  try {
    const pedido = await sincronizarPagamentoFotos(supabase, {
      pedidoId,
      compradorUserId: autorizado.userId,
    });
    if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    return NextResponse.json(pedido);
  } catch (error) {
    console.error("Consulta de pagamento Retratt:", error);
    let consulta = supabase
      .from("foto_pedidos")
      .select("id, status, provedor_status_detail, pago_em")
      .eq("id", pedidoId);
    if (autorizado.userId) consulta = consulta.eq("comprador_user_id", autorizado.userId);
    const { data: pedido } = await consulta.maybeSingle();
    if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    return NextResponse.json({ ...pedido, sincronizado: false });
  }
}
