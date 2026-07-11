import { NextResponse } from "next/server";
import { WebhookSignatureValidator } from "mercadopago";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { liberarPedidoFotos } from "@/app/lib/fotos-pedidos";

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json();
    const paymentId = String(body?.data?.id || url.searchParams.get("data.id") || "");
    if (!paymentId) return NextResponse.json({ success: true });

    const secret = process.env.MP_WEBHOOK_SECRET;
    if (secret) {
      WebhookSignatureValidator.validate({
        xSignature: request.headers.get("x-signature"),
        xRequestId: request.headers.get("x-request-id"),
        dataId: url.searchParams.get("data.id") || body?.data?.id,
        secret,
        toleranceSeconds: 300,
      });
    }

    const supabase = createSupabaseServerClient();
    let pedidoId = url.searchParams.get("pedido_id");
    let pedido = pedidoId
      ? (await supabase.from("foto_pedidos").select("id, total_centavos, status, fotografo_id, fotografos(mp_access_token)").eq("id", pedidoId).maybeSingle()).data
      : null;
    if (!pedido) {
      pedido = (await supabase.from("foto_pedidos").select("id, total_centavos, status, fotografo_id, fotografos(mp_access_token)").eq("provedor_payment_id", paymentId).maybeSingle()).data;
      pedidoId = pedido?.id || null;
    }
    if (!pedido || !pedidoId) return NextResponse.json({ success: true, message: "Pedido não localizado." });

    const fotografo = primeiraRelacao(pedido.fotografos);
    if (!fotografo?.mp_access_token) return NextResponse.json({ success: true, message: "Recebedor não localizado." });

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${fotografo.mp_access_token}` },
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) return NextResponse.json({ success: false }, { status: 502 });

    const valorCorreto = Math.round(Number(payment.transaction_amount || 0) * 100) === Number(pedido.total_centavos);
    if (payment.external_reference !== `foto_pedido:${pedidoId}` || !valorCorreto) {
      return NextResponse.json({ success: true, message: "Pagamento divergente." });
    }

    await supabase.from("foto_pedidos").update({
      provedor_payment_id: paymentId,
      provedor_status_detail: payment.status_detail || null,
    }).eq("id", pedidoId);
    if (payment.status === "approved" && pedido.status !== "pago") {
      await liberarPedidoFotos(supabase, pedidoId, paymentId, payment.status_detail);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook iTatame Fotos:", error);
    return NextResponse.json({ success: false }, { status: 401 });
  }
}

