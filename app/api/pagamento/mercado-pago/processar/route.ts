import crypto from "crypto";
import { NextResponse } from "next/server";
import { calcularComissaoMarketplace } from "@/app/lib/planos-comerciais";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { enviarEmailIngressoConfirmado } from "@/app/lib/email-ingresso";

type EventoPagamento = {
  id: string | number;
  nome?: string | null;
  organizador_id?: string | null;
  lote1_valor?: number | string | null;
  lote1_data_fim?: string | null;
  lote2_valor?: number | string | null;
  lote2_data_fim?: string | null;
  lote3_valor?: number | string | null;
};

function getBaseUrl(request: Request) {
  const origin = new URL(request.url).origin;
  return process.env.NEXT_PUBLIC_BASE_URL || origin;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calcularValorInscricao(inscricao: any, evento: EventoPagamento) {
  const hoje = new Date();
  const lote1Fim = evento.lote1_data_fim ? new Date(`${evento.lote1_data_fim}T23:59:59`) : null;
  const lote2Fim = evento.lote2_data_fim ? new Date(`${evento.lote2_data_fim}T23:59:59`) : null;

  let valor = numberValue(evento.lote3_valor) || numberValue(evento.lote2_valor) || numberValue(evento.lote1_valor);
  if (lote1Fim && hoje <= lote1Fim) valor = numberValue(evento.lote1_valor);
  else if (lote2Fim && hoje <= lote2Fim) valor = numberValue(evento.lote2_valor);

  const lutaPesoEAbsoluto = inscricao.absoluto === true && inscricao.categoria !== "Absoluto";
  return lutaPesoEAbsoluto ? valor + 50 : valor;
}

function limparPayloadPagamento(formData: any, valorTotal: number, comissao: number, descricao: string, request: Request, inscricao: any, evento: any) {
  const payload: any = {
    ...formData,
    transaction_amount: valorTotal,
    description: descricao,
    external_reference: `inscricao:${inscricao.id}`,
    application_fee: comissao,
    notification_url: `${getBaseUrl(request)}/api/mercado-pago/webhook?inscricao_id=${inscricao.id}&organizador_id=${evento.organizador_id}`,
    metadata: {
      ...(formData?.metadata || {}),
      inscricao_id: String(inscricao.id),
      evento_id: String(evento.id),
      organizador_id: String(evento.organizador_id),
      comissao_itatame: String(comissao),
      comissao_automatica: "sim",
    },
  };

  if (payload.installments) payload.installments = 1;
  if (payload.issuer_id) payload.issuer_id = String(payload.issuer_id);
  if (!payload.payer?.email) delete payload.payer;

  return payload;
}

export async function POST(request: Request) {
  try {
    const { inscricaoId, formData } = await request.json();
    if (!inscricaoId || !formData) {
      return NextResponse.json({ error: "Dados de pagamento incompletos." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: inscricao, error: inscricaoError } = await supabase
      .from("inscricoes")
      .select(`
        id,
        user_id,
        atleta,
        categoria,
        absoluto,
        pagamento_ok,
        evento_id,
        eventos (
          id,
          nome,
          organizador_id,
          lote1_valor,
          lote1_data_fim,
          lote2_valor,
          lote2_data_fim,
          lote3_valor
        )
      `)
      .eq("id", inscricaoId)
      .maybeSingle();

    if (inscricaoError || !inscricao) {
      return NextResponse.json({ error: "Inscricao nao encontrada." }, { status: 404 });
    }

    if (inscricao.pagamento_ok) {
      return NextResponse.json({ status: "approved", message: "Inscricao ja estava paga." });
    }

    const evento = Array.isArray(inscricao.eventos) ? inscricao.eventos[0] : inscricao.eventos;
    if (!evento?.organizador_id) {
      return NextResponse.json({ error: "Evento sem organizador vinculado." }, { status: 409 });
    }

    const { data: organizador, error: orgError } = await supabase
      .from("organizadores")
      .select("plano_comercial, mp_access_token")
      .eq("user_id", evento.organizador_id)
      .maybeSingle();

    if (orgError || !organizador?.mp_access_token) {
      return NextResponse.json({ error: "Organizador sem Mercado Pago conectado." }, { status: 409 });
    }

    const valorTotal = calcularValorInscricao(inscricao, evento);
    const comissao = calcularComissaoMarketplace(valorTotal, organizador.plano_comercial);
    const descricao = `Inscricao - ${evento.nome || "Evento iTatame"}`;
    const paymentPayload = limparPayloadPagamento(formData, comissao.valorTotal, comissao.comissao, descricao, request, inscricao, evento);

    const paymentResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${organizador.mp_access_token}`,
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error("Erro ao processar pagamento Mercado Pago:", paymentData);
      const primeiraCausa = Array.isArray(paymentData?.cause) ? paymentData.cause[0] : null;
      const mensagem = primeiraCausa?.description || paymentData?.message || paymentData?.error || "Pagamento recusado pelo Mercado Pago.";
      return NextResponse.json(
        { error: mensagem, details: paymentData },
        { status: 400 }
      );
    }

    await supabase.from("inscricoes").update({ mp_payment_id: String(paymentData.id), valor_inscricao: valorTotal, valor_total: comissao.valorTotal }).eq("id", inscricao.id);

    if (paymentData.status === "approved") {
      await supabase.from("inscricoes").update({ pagamento_ok: true, mp_payment_id: String(paymentData.id), valor_inscricao: valorTotal, valor_total: comissao.valorTotal }).eq("id", inscricao.id);
      await enviarEmailIngressoConfirmado({
        inscricaoId: inscricao.id,
        emailFallback: formData?.payer?.email,
        paymentId: paymentData.id,
      });
    }

    return NextResponse.json({
      id: paymentData.id,
      status: paymentData.status,
      status_detail: paymentData.status_detail,
      payment_method_id: paymentData.payment_method_id,
      payment_type_id: paymentData.payment_type_id,
      ticket_url: paymentData.transaction_details?.external_resource_url || paymentData.point_of_interaction?.transaction_data?.ticket_url,
      qr_code: paymentData.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: paymentData.point_of_interaction?.transaction_data?.qr_code_base64,
    });
  } catch (error) {
    console.error("Erro ao processar Checkout Bricks:", error);
    return NextResponse.json({ error: "Erro interno ao processar pagamento." }, { status: 500 });
  }
}