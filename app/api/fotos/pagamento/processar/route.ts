import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { liberarPedidoFotos } from "@/app/lib/fotos-pedidos";
import { autorizarPedido } from "@/app/lib/fotos-convidado";
import { obterRecebedorFotos } from "@/app/lib/fotos-recebedor";

export const runtime = "nodejs";

function baseUrl(_request: Request) {
  return process.env.NEXT_PUBLIC_FOTOS_URL || "https://retratt.com";
}

function notificationUrl(request: Request, pedidoId: string) {
  const url = new URL("/api/fotos/pagamento/webhook", baseUrl(request));
  url.searchParams.set("pedido_id", pedidoId);
  url.searchParams.set("source_news", "webhooks");
  return url.toString();
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const { pedidoId, formData, acesso } = await request.json();
    if (!pedidoId || !formData) return NextResponse.json({ error: "Dados de pagamento incompletos." }, { status: 400 });

    const autorizado = await autorizarPedido(supabase, request, String(pedidoId), acesso);
    if (!autorizado) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    let consulta = supabase
      .from("foto_pedidos")
      .select("id, comprador_user_id, comprador_email, status, total_centavos, comissao_itatame_centavos, comissao_organizador_centavos, fotografo_id, organizador_user_id, modelo_recebimento")
      .eq("id", pedidoId);
    if (autorizado.userId) consulta = consulta.eq("comprador_user_id", autorizado.userId);
    const { data: pedido } = await consulta.maybeSingle();
    if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (pedido.status === "pago") return NextResponse.json({ status: "approved", pedidoId: pedido.id });

    const recebedor = await obterRecebedorFotos(supabase, request, pedido);
    if (!recebedor) {
      return NextResponse.json({ error: "Conta de recebimento indisponível." }, { status: 409 });
    }
    const compradorEmail = String(pedido.comprador_email || "").trim().toLowerCase();
    if (!compradorEmail) {
      return NextResponse.json({ error: "Sua conta não possui um e-mail válido para o pagamento." }, { status: 400 });
    }

    const payload = {
      ...formData,
      payer: {
        ...(formData.payer || {}),
        email: compradorEmail,
      },
      transaction_amount: Number(pedido.total_centavos) / 100,
      description: "Compra de fotos Retratt",
      external_reference: `foto_pedido:${pedido.id}`,
      application_fee: (
        Number(pedido.comissao_itatame_centavos) + Number(pedido.comissao_organizador_centavos || 0)
      ) / 100,
      notification_url: notificationUrl(request, pedido.id),
      metadata: {
        ...(formData.metadata || {}),
        pedido_id: pedido.id,
        fotografo_id: pedido.fotografo_id,
        organizador_user_id: pedido.organizador_user_id,
      },
      installments: 1,
    };

    const paymentResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${recebedor.accessToken}`,
        "X-Idempotency-Key": `foto-pedido-${pedido.id}`,
      },
      body: JSON.stringify(payload),
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) {
      const causa = Array.isArray(payment?.cause) ? payment.cause[0] : null;
      return NextResponse.json({ error: causa?.description || payment?.message || "Pagamento recusado." }, { status: 400 });
    }

    await supabase.from("foto_pedidos").update({
      provedor_payment_id: String(payment.id),
      provedor_status_detail: payment.status_detail || null,
    }).eq("id", pedido.id);

    if (payment.status === "approved") {
      await liberarPedidoFotos(supabase, pedido.id, String(payment.id), payment.status_detail);
    }

    return NextResponse.json({
      id: payment.id,
      pedidoId: pedido.id,
      status: payment.status,
      status_detail: payment.status_detail,
      payment_method_id: payment.payment_method_id,
      payment_type_id: payment.payment_type_id,
      ticket_url: payment.transaction_details?.external_resource_url || payment.point_of_interaction?.transaction_data?.ticket_url,
      qr_code: payment.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao processar pagamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
