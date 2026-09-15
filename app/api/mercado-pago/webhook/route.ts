import { NextResponse } from "next/server";
import { WebhookSignatureValidator } from "mercadopago";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { enviarEmailIngressoConfirmado } from "@/app/lib/email-ingresso";
import { obterAccessTokenOrganizador } from "@/app/lib/mercado-pago-integracao";

function getPaymentId(body: any) {
  return body?.data?.id || body?.resource?.split("/").pop() || body?.id || null;
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    let inscricaoId = url.searchParams.get("inscricao_id");
    let organizadorId = url.searchParams.get("organizador_id");
    const body = await request.json();
    const paymentId = getPaymentId(body);

    if (!paymentId) {
      return NextResponse.json({ success: true, message: "Webhook sem pagamento." });
    }

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

    if (!inscricaoId || !organizadorId) {
      const { data: inscricaoPorPagamento } = await supabase
        .from("inscricoes")
        .select("id, eventos ( organizador_id )")
        .eq("mp_payment_id", String(paymentId))
        .maybeSingle();

      const evento = Array.isArray(inscricaoPorPagamento?.eventos)
        ? inscricaoPorPagamento?.eventos[0]
        : inscricaoPorPagamento?.eventos;

      inscricaoId = inscricaoPorPagamento?.id ? String(inscricaoPorPagamento.id) : null;
      organizadorId = evento?.organizador_id || null;
    }

    if (!inscricaoId || !organizadorId) {
      return NextResponse.json({ success: true, message: "Inscricao nao localizada para este pagamento." });
    }

    const { data: organizador } = await supabase
      .from("organizadores")
      .select("user_id, mp_access_token, mp_refresh_token, mp_token_expires_at")
      .eq("user_id", organizadorId)
      .maybeSingle();

    if (!organizador?.mp_access_token) {
      return NextResponse.json({ success: true, message: "Organizador sem Mercado Pago." });
    }

    const accessToken = await obterAccessTokenOrganizador(request, organizador, supabase);
    if (!accessToken) return NextResponse.json({ success: true, message: "Conexão Mercado Pago expirada." });

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const paymentData = await paymentResponse.json();

    if (paymentData.external_reference !== `inscricao:${inscricaoId}`) {
      return NextResponse.json({ success: true, message: "Referencia externa divergente." });
    }

    if (paymentData.status === "approved") {
      await supabase
        .from("inscricoes")
        .update({ pagamento_ok: true, mp_payment_id: String(paymentId) })
        .eq("id", inscricaoId);

      await enviarEmailIngressoConfirmado({
        inscricaoId,
        emailFallback: paymentData?.payer?.email,
        paymentId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no webhook Mercado Pago:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
