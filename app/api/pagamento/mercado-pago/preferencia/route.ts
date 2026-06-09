import { NextResponse } from "next/server";
import { calcularComissaoMarketplace } from "@/app/lib/planos-comerciais";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

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

export async function POST(request: Request) {
  try {
    const { inscricaoId } = await request.json();
    if (!inscricaoId) {
      return NextResponse.json({ error: "Inscricao nao informada." }, { status: 400 });
    }

    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey) {
      return NextResponse.json({ error: "Configure NEXT_PUBLIC_MP_PUBLIC_KEY para usar Checkout Bricks." }, { status: 500 });
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
      return NextResponse.json({ pago: true });
    }

    const evento = Array.isArray(inscricao.eventos) ? inscricao.eventos[0] : inscricao.eventos;
    if (!evento?.organizador_id) {
      return NextResponse.json({ error: "Evento sem organizador vinculado." }, { status: 409 });
    }

    const { data: organizador, error: orgError } = await supabase
      .from("organizadores")
      .select("user_id, nome, plano_comercial, mp_access_token, mp_connected_at")
      .eq("user_id", evento.organizador_id)
      .maybeSingle();

    if (orgError || !organizador?.mp_access_token) {
      return NextResponse.json(
        { error: "O organizador ainda nao conectou o Mercado Pago." },
        { status: 409 }
      );
    }

    const valorTotal = calcularValorInscricao(inscricao, evento);
    if (valorTotal <= 0) {
      await supabase.from("inscricoes").update({ pagamento_ok: true }).eq("id", inscricao.id);
      return NextResponse.json({ pago: true });
    }

    const comissao = calcularComissaoMarketplace(valorTotal, organizador.plano_comercial);
    const baseUrl = getBaseUrl(request);

    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${organizador.mp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            id: String(inscricao.id),
            title: `Inscricao - ${evento.nome || "Evento iTatame"}`,
            description: inscricao.categoria || "Inscricao de atleta",
            quantity: 1,
            currency_id: "BRL",
            unit_price: comissao.valorTotal,
          },
        ],
        external_reference: `inscricao:${inscricao.id}`,
        marketplace_fee: comissao.comissao,
        notification_url: `${baseUrl}/api/mercado-pago/webhook?inscricao_id=${inscricao.id}&organizador_id=${evento.organizador_id}`,
        back_urls: {
          success: `${baseUrl}/pagamento?status=aprovado`,
          pending: `${baseUrl}/pagamento?status=pendente`,
          failure: `${baseUrl}/pagamento?status=erro`,
        },
        metadata: {
          inscricao_id: String(inscricao.id),
          evento_id: String(evento.id),
          organizador_id: String(evento.organizador_id),
          plano_itatame: comissao.plano.id,
          comissao_itatame: comissao.comissao,
        },
      }),
    });

    const preferenceData = await preferenceResponse.json();

    if (preferenceData?.id) {
      await supabase
        .from("inscricoes")
        .update({
          valor_inscricao: valorTotal,
          valor_total: comissao.valorTotal,
          mp_preference_id: String(preferenceData.id),
        })
        .eq("id", inscricao.id);
    }

    if (!preferenceResponse.ok || !preferenceData.id) {
      console.error("Erro ao criar preferencia Mercado Pago:", preferenceData);
      return NextResponse.json({ error: "Falha ao preparar o Checkout Bricks." }, { status: 500 });
    }

    return NextResponse.json({
      publicKey,
      preferenceId: preferenceData.id,
      inscricaoId: inscricao.id,
      eventoNome: evento.nome || "Evento iTatame",
      valorTotal: comissao.valorTotal,
      comissao: comissao.comissao,
      plano: comissao.plano.id,
    });
  } catch (error) {
    console.error("Erro na preferencia Mercado Pago:", error);
    return NextResponse.json({ error: "Erro interno ao preparar pagamento." }, { status: 500 });
  }
}