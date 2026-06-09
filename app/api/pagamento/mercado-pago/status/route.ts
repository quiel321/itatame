import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { enviarEmailIngressoConfirmado } from "@/app/lib/email-ingresso";

function dadosDeExibicao(paymentData: any) {
  return {
    id: paymentData.id,
    status: paymentData.status,
    status_detail: paymentData.status_detail,
    payment_method_id: paymentData.payment_method_id,
    payment_type_id: paymentData.payment_type_id,
    ticket_url: paymentData.transaction_details?.external_resource_url || paymentData.point_of_interaction?.transaction_data?.ticket_url,
    qr_code: paymentData.point_of_interaction?.transaction_data?.qr_code,
    qr_code_base64: paymentData.point_of_interaction?.transaction_data?.qr_code_base64,
  };
}

export async function POST(request: Request) {
  try {
    const { inscricaoId, paymentId } = await request.json();

    if (!inscricaoId && !paymentId) {
      return NextResponse.json({ error: "Informe a inscricao ou o pagamento." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    let query = supabase
      .from("inscricoes")
      .select("id, user_id, pagamento_ok, mp_payment_id, eventos ( organizador_id )");

    query = inscricaoId
      ? query.eq("id", inscricaoId)
      : query.eq("mp_payment_id", String(paymentId));

    const { data: inscricao, error: inscricaoError } = await query.maybeSingle();

    if (inscricaoError || !inscricao) {
      return NextResponse.json({ error: "Inscricao nao encontrada para este pagamento." }, { status: 404 });
    }

    const idPagamento = paymentId || inscricao.mp_payment_id;
    if (!idPagamento) {
      return NextResponse.json({ error: "Pagamento Mercado Pago ainda nao registrado." }, { status: 409 });
    }

    const evento = Array.isArray(inscricao.eventos) ? inscricao.eventos[0] : inscricao.eventos;
    if (!evento?.organizador_id) {
      return NextResponse.json({ error: "Evento sem organizador vinculado." }, { status: 409 });
    }

    const { data: organizador } = await supabase
      .from("organizadores")
      .select("mp_access_token")
      .eq("user_id", evento.organizador_id)
      .maybeSingle();

    if (!organizador?.mp_access_token) {
      return NextResponse.json({ error: "Organizador sem Mercado Pago conectado." }, { status: 409 });
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${idPagamento}`, {
      headers: { Authorization: `Bearer ${organizador.mp_access_token}` },
    });
    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      return NextResponse.json({ error: paymentData?.message || "Falha ao consultar pagamento." }, { status: 400 });
    }

    if (paymentData.external_reference && paymentData.external_reference !== `inscricao:${inscricao.id}`) {
      return NextResponse.json({ error: "Referencia externa divergente." }, { status: 409 });
    }

    if (paymentData.status === "approved") {
      await supabase
        .from("inscricoes")
        .update({ pagamento_ok: true, mp_payment_id: String(idPagamento) })
        .eq("id", inscricao.id);

      if (!inscricao.pagamento_ok) {
        await enviarEmailIngressoConfirmado({
          inscricaoId: inscricao.id,
          emailFallback: paymentData?.payer?.email,
          paymentId: idPagamento,
        });
      }
    }

    return NextResponse.json(dadosDeExibicao(paymentData));
  } catch (error) {
    console.error("Erro ao consultar status Mercado Pago:", error);
    return NextResponse.json({ error: "Erro interno ao consultar pagamento." }, { status: 500 });
  }
}