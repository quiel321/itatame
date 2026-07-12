import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { liberarPedidoFotos } from "@/app/lib/fotos-pedidos";
import { enviarEmailPedidoFotosConfirmado } from "@/app/lib/email-fotos";

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

type SincronizarPagamentoParams = {
  pedidoId?: string | null;
  paymentId?: string | null;
  compradorUserId?: string | null;
};

export async function sincronizarPagamentoFotos(
  supabase: SupabaseClient,
  { pedidoId, paymentId, compradorUserId }: SincronizarPagamentoParams,
) {
  let consulta = supabase
    .from("foto_pedidos")
    .select("id, total_centavos, status, provedor_payment_id, fotografo_id, fotografos(mp_access_token)");

  if (pedidoId) consulta = consulta.eq("id", pedidoId);
  else if (paymentId) consulta = consulta.eq("provedor_payment_id", paymentId);
  else return null;
  if (compradorUserId) consulta = consulta.eq("comprador_user_id", compradorUserId);

  const { data: pedido, error: pedidoError } = await consulta.maybeSingle();
  if (pedidoError || !pedido) return null;

  const idPagamento = String(paymentId || pedido.provedor_payment_id || "");
  const fotografo = primeiraRelacao(pedido.fotografos);
  if (!idPagamento || !fotografo?.mp_access_token) {
    return { id: pedido.id, status: pedido.status, sincronizado: false };
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(idPagamento)}`, {
    headers: { Authorization: `Bearer ${fotografo.mp_access_token}` },
    cache: "no-store",
  });
  const payment = await response.json();
  if (!response.ok) throw new Error(payment?.message || "Não foi possível consultar o pagamento no Mercado Pago.");

  const referenciaCorreta = payment.external_reference === `foto_pedido:${pedido.id}`;
  const valorCorreto = Math.round(Number(payment.transaction_amount || 0) * 100) === Number(pedido.total_centavos);
  if (!referenciaCorreta || !valorCorreto) throw new Error("Os dados do pagamento divergem do pedido.");

  await supabase.from("foto_pedidos").update({
    provedor_payment_id: idPagamento,
    provedor_status_detail: payment.status_detail || null,
  }).eq("id", pedido.id);

  if (payment.status === "approved" && pedido.status !== "pago") {
    await liberarPedidoFotos(supabase, pedido.id, idPagamento, payment.status_detail);
  } else if (payment.status === "approved") {
    await enviarEmailPedidoFotosConfirmado(supabase, pedido.id);
  }

  return {
    id: pedido.id,
    status: payment.status === "approved" ? "pago" : pedido.status,
    provedor_status: payment.status,
    provedor_status_detail: payment.status_detail || null,
    sincronizado: true,
  };
}
