import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { liberarPedidoFotos } from "@/app/lib/fotos-pedidos";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function baseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
}

function notificationUrl(request: Request, pedidoId: string) {
  const url = new URL("/api/fotos/pagamento/webhook", baseUrl(request));
  url.searchParams.set("pedido_id", pedidoId);
  url.searchParams.set("source_news", "webhooks");
  return url.toString();
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const { pedidoId, formData } = await request.json();
    if (!pedidoId || !formData) return NextResponse.json({ error: "Dados de pagamento incompletos." }, { status: 400 });

    const { data: pedido } = await supabase
      .from("foto_pedidos")
      .select("id, comprador_user_id, comprador_email, status, total_centavos, comissao_itatame_centavos, comissao_organizador_centavos, fotografo_id, organizador_user_id, fotografos(mp_access_token)")
      .eq("id", pedidoId)
      .eq("comprador_user_id", auth.user.id)
      .maybeSingle();
    if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (pedido.status === "pago") return NextResponse.json({ status: "approved", pedidoId: pedido.id });

    const fotografo = primeiraRelacao(pedido.fotografos);
    if (!fotografo?.mp_access_token) {
      return NextResponse.json({ error: "Conta de recebimento indisponível." }, { status: 409 });
    }
    const compradorEmail = String(auth.user.email || pedido.comprador_email || "").trim().toLowerCase();
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
      description: "Compra de fotos iTatame",
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
        Authorization: `Bearer ${fotografo.mp_access_token}`,
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
