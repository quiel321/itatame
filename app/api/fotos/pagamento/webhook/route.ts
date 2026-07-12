import { NextResponse } from "next/server";
import { WebhookSignatureValidator } from "mercadopago";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { sincronizarPagamentoFotos } from "@/app/lib/fotos-mercado-pago";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const tipo = String(body?.type || body?.topic || url.searchParams.get("type") || url.searchParams.get("topic") || "payment");
    if (tipo !== "payment") return NextResponse.json({ success: true });

    const paymentId = String(
      body?.data?.id ||
      body?.id ||
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      "",
    );
    if (!paymentId) return NextResponse.json({ success: true, message: "Pagamento não informado." });

    const secret = process.env.MP_WEBHOOK_SECRET;
    const xSignature = request.headers.get("x-signature");
    const xRequestId = request.headers.get("x-request-id");
    if (secret && xSignature && xRequestId) {
      WebhookSignatureValidator.validate({
        xSignature,
        xRequestId,
        dataId: url.searchParams.get("data.id") || body?.data?.id || body?.id,
        secret,
        toleranceSeconds: 300,
      });
    }

    const supabase = createSupabaseServerClient();
    const resultado = await sincronizarPagamentoFotos(supabase, {
      pedidoId: url.searchParams.get("pedido_id"),
      paymentId,
    });

    if (!resultado) return NextResponse.json({ success: true, message: "Pedido não localizado." });
    return NextResponse.json({ success: true, status: resultado.status });
  } catch (error) {
    console.error("Webhook iTatame Fotos:", error);
    return NextResponse.json({ success: false }, { status: 401 });
  }
}
