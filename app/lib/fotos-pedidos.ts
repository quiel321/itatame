import type { SupabaseClient } from "@supabase/supabase-js";

export async function liberarPedidoFotos(
  supabase: SupabaseClient,
  pedidoId: string,
  paymentId: string,
  statusDetail?: string | null,
) {
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: pedidoError } = await supabase
    .from("foto_pedidos")
    .update({
      status: "pago",
      provedor_pagamento: "mercado_pago",
      provedor_payment_id: paymentId,
      provedor_status_detail: statusDetail || null,
      pago_em: agora.toISOString(),
    })
    .eq("id", pedidoId);
  if (pedidoError) throw new Error(pedidoError.message);

  const { error: itensError } = await supabase
    .from("foto_pedido_itens")
    .update({ download_liberado: true, download_expires_at: expiraEm })
    .eq("pedido_id", pedidoId);
  if (itensError) throw new Error(itensError.message);
}

