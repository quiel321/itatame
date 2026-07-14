import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarEmailPedidoFotosConfirmado } from "@/app/lib/email-fotos";

export async function confirmarRoyaltyOrganizador(
  supabase: SupabaseClient,
  pedidoId: string,
  paymentId: string,
) {
  const [pedido, royalty] = await Promise.all([
    supabase
      .from("foto_pedidos")
      .update({ repasse_organizador_status: "aguardando_liberacao" })
      .eq("id", pedidoId)
      .gt("comissao_organizador_centavos", 0),
    supabase
      .from("foto_royalties_organizador")
      .update({ status: "aguardando_liberacao", provedor_payment_id: paymentId })
      .eq("pedido_id", pedidoId)
      .in("status", ["pendente", "aguardando_liberacao"]),
  ]);

  if (pedido.error) throw new Error(pedido.error.message);
  if (royalty.error) throw new Error(royalty.error.message);
}

export async function estornarRoyaltyOrganizador(
  supabase: SupabaseClient,
  pedidoId: string,
) {
  const agora = new Date().toISOString();
  const [pedido, royalty, downloads] = await Promise.all([
    supabase
      .from("foto_pedidos")
      .update({ repasse_organizador_status: "estornado" })
      .eq("id", pedidoId)
      .gt("comissao_organizador_centavos", 0),
    supabase
      .from("foto_royalties_organizador")
      .update({ status: "estornado", estornado_em: agora })
      .eq("pedido_id", pedidoId)
      .neq("status", "estornado"),
    supabase
      .from("foto_pedido_itens")
      .update({ download_liberado: false, download_expires_at: null })
      .eq("pedido_id", pedidoId),
  ]);

  if (pedido.error) throw new Error(pedido.error.message);
  if (royalty.error) throw new Error(royalty.error.message);
  if (downloads.error) throw new Error(downloads.error.message);
}

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

  await confirmarRoyaltyOrganizador(supabase, pedidoId, paymentId);

  // O e-mail é complementar: uma falha no provedor não pode reverter a liberação já confirmada.
  try {
    await enviarEmailPedidoFotosConfirmado(supabase, pedidoId);
  } catch (error) {
    console.error("Falha inesperada ao enviar a confirmação do pedido de fotos:", error);
  }
}
