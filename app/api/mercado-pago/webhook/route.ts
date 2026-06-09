import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { enviarEmailIngressoConfirmado } from "@/app/lib/email-ingresso";

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
      .select("mp_access_token")
      .eq("user_id", organizadorId)
      .maybeSingle();

    if (!organizador?.mp_access_token) {
      return NextResponse.json({ success: true, message: "Organizador sem Mercado Pago." });
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${organizador.mp_access_token}` },
    });
    const paymentData = await paymentResponse.json();

    if (paymentData.external_reference !== `inscricao:${inscricaoId}`) {
      return NextResponse.json({ success: true, message: "Referencia externa divergente." });
    }

    if (paymentData.status === "approved") {
      const { data: inscricaoAtual } = await supabase
        .from("inscricoes")
        .select("pagamento_ok")
        .eq("id", inscricaoId)
        .maybeSingle();

      await supabase
        .from("inscricoes")
        .update({ pagamento_ok: true, mp_payment_id: String(paymentId) })
        .eq("id", inscricaoId);

      if (!inscricaoAtual?.pagamento_ok) {
        await enviarEmailIngressoConfirmado({
          inscricaoId,
          emailFallback: paymentData?.payer?.email,
          paymentId,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no webhook Mercado Pago:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}