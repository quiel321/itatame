import { limiteParcelas, validarParcelas } from '@/app/lib/parcelamento';
import crypto from "crypto";
import { NextResponse } from "next/server";
import { calcularComissaoMarketplace } from "@/app/lib/planos-comerciais";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { enviarEmailIngressoConfirmado } from "@/app/lib/email-ingresso";
import { enviarEmailPagamentoPendente } from "@/app/lib/email-pagamento-pendente";
import { obterAccessTokenOrganizador } from "@/app/lib/mercado-pago-integracao";
import { autenticarRequest } from "@/app/lib/api-auth";
import { aplicarDescontoCupom, calcularValorInscricao, valorAindaDevido } from "@/app/lib/valor-inscricao";
import { usuarioGerenciaInscricao } from "@/app/lib/inscricao-autorizacao";

type EventoPagamento = {
  id: string | number;
  nome?: string | null;
  organizador_id?: string | null;
  lote1_valor?: number | string | null;
  lote1_data_fim?: string | null;
  lote2_valor?: number | string | null;
  lote2_data_fim?: string | null;
  lote3_valor?: number | string | null;
  valor_absoluto?: number | string | null;
  regras_pontuacao_equipes?: { valor_absoluto?: number | string | null } | null;
};

function getBaseUrl(request: Request) {
  const origin = new URL(request.url).origin;
  return process.env.NEXT_PUBLIC_BASE_URL || origin;
}

async function calcularValoresCobranca(supabase: ReturnType<typeof createSupabaseServerClient>, inscricao: any, evento: EventoPagamento) {
  let cupom = null;
  if (inscricao.cupom_id) {
    const { data } = await supabase.from("cupons").select("desconto_porcentagem, desconto_valor").eq("id", inscricao.cupom_id).eq("evento_id", evento.id).maybeSingle();
    cupom = data;
  }
  return {
    devidoCheio: aplicarDescontoCupom(calcularValorInscricao(inscricao, evento), cupom),
    aCobrar: valorAindaDevido(inscricao, evento, cupom),
  };
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

  // Preserve a quantidade escolhida e exibida pelo Mercado Pago.
  if (payload.issuer_id) payload.issuer_id = String(payload.issuer_id);
  if (!payload.payer?.email) delete payload.payer;

  return payload;
}

export async function POST(request: Request) {
  try {
    const usuario = await autenticarRequest(request);
    if (!usuario) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
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
        idade,
        pagamento_ok,
        cupom_id,
        valor_inscricao,
        valor_total,
        evento_id,
        eventos (
          id,
          nome,
          organizador_id,
          lote1_valor,
          lote1_data_fim,
          lote2_valor,
          lote2_data_fim,
          lote3_valor,
          valor_absoluto,
          regras_pontuacao_equipes
        )
      `)
      .eq("id", inscricaoId)
      .maybeSingle();

    if (inscricaoError || !inscricao) {
      return NextResponse.json({ error: "Inscricao nao encontrada." }, { status: 404 });
    }
    if (!(await usuarioGerenciaInscricao(supabase, usuario.id, inscricao.user_id))) {
      return NextResponse.json({ error: "Inscrição não autorizada para este usuário." }, { status: 403 });
    }

    const evento = Array.isArray(inscricao.eventos) ? inscricao.eventos[0] : inscricao.eventos;
    if (!evento?.organizador_id) {
      return NextResponse.json({ error: "Evento sem organizador vinculado." }, { status: 409 });
    }

    const { data: organizador, error: orgError } = await supabase
      .from("organizadores")
      .select("*")
      .eq("user_id", evento.organizador_id)
      .maybeSingle();

    if (orgError || !organizador?.mp_access_token) {
      return NextResponse.json({ error: "Organizador sem Mercado Pago conectado." }, { status: 409 });
    }

    const accessToken = await obterAccessTokenOrganizador(request, organizador, supabase);
    if (!accessToken) return NextResponse.json({ error: "A conexão Mercado Pago do organizador expirou. Solicite uma nova conexão." }, { status: 409 });

    try { formData.installments = validarParcelas(formData.installments, limiteParcelas(organizador.mp_parcelamento_comprador_confirmado)); }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
    const { devidoCheio, aCobrar } = await calcularValoresCobranca(supabase, inscricao, evento);
    if (aCobrar <= 0) {
      await supabase.from("inscricoes").update({ pagamento_ok: true, valor_inscricao: devidoCheio }).eq("id", inscricao.id);
      return NextResponse.json({ status: "approved", message: "Inscricao ja estava paga." });
    }
    const valorTotal = aCobrar;
    const comissao = calcularComissaoMarketplace(valorTotal, organizador.plano_comercial);
    const descricao = `Inscricao - ${evento.nome || "Evento iTatame"}`;
    const paymentPayload = limparPayloadPagamento(formData, comissao.valorTotal, comissao.comissao, descricao, request, inscricao, evento);

    const paymentResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${accessToken}`,
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

    await supabase.from("inscricoes").update({ mp_payment_id: String(paymentData.id), valor_inscricao: devidoCheio, valor_total: inscricao.pagamento_ok ? Number(inscricao.valor_total || 0) + comissao.valorTotal : comissao.valorTotal }).eq("id", inscricao.id);

    if (paymentData.status === "approved") {
      await supabase.from("inscricoes").update({ pagamento_ok: true, mp_payment_id: String(paymentData.id), valor_inscricao: devidoCheio, valor_total: inscricao.pagamento_ok ? Number(inscricao.valor_total || 0) + comissao.valorTotal : comissao.valorTotal }).eq("id", inscricao.id);
      await enviarEmailIngressoConfirmado({
        inscricaoId: inscricao.id,
        emailFallback: formData?.payer?.email,
        paymentId: paymentData.id,
      });
    } else if (paymentData.status === "pending" || paymentData.status === "in_process") {
      const ticketUrl = paymentData.transaction_details?.external_resource_url
        || paymentData.point_of_interaction?.transaction_data?.ticket_url
        || null;
      const isPix = paymentData.payment_method_id === "pix" || paymentData.payment_type_id === "bank_transfer";
      await enviarEmailPagamentoPendente({
        inscricaoId: inscricao.id,
        emailFallback: formData?.payer?.email,
        ticketUrl,
        meio: isPix ? "pix" : "boleto",
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
