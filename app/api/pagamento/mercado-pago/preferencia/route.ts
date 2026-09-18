import { limiteParcelas } from '@/app/lib/parcelamento';
import { NextResponse } from "next/server";
import { calcularComissaoMarketplace } from "@/app/lib/planos-comerciais";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
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

export async function POST(request: Request) {
  try {
    const usuario = await autenticarRequest(request);
    if (!usuario) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
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
      return NextResponse.json(
        { error: "O organizador ainda nao conectou o Mercado Pago." },
        { status: 409 }
      );
    }

    const accessToken = await obterAccessTokenOrganizador(request, organizador, supabase);
    if (!accessToken) return NextResponse.json({ error: "A conexão Mercado Pago do organizador expirou. Solicite uma nova conexão." }, { status: 409 });

    const { devidoCheio, aCobrar } = await calcularValoresCobranca(supabase, inscricao, evento);
    if (aCobrar <= 0) {
      await supabase.from("inscricoes").update({ pagamento_ok: true, valor_inscricao: devidoCheio }).eq("id", inscricao.id);
      return NextResponse.json({ pago: true });
    }
    const valorTotal = aCobrar;

    const comissao = calcularComissaoMarketplace(valorTotal, organizador.plano_comercial);
    const baseUrl = getBaseUrl(request);

    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment_methods: { installments: limiteParcelas(organizador.mp_parcelamento_comprador_confirmado) },
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
      const update: Record<string, string | number> = { mp_preference_id: String(preferenceData.id) };
      if (!inscricao.pagamento_ok) {
        update.valor_inscricao = valorTotal;
        update.valor_total = comissao.valorTotal;
      }
      await supabase.from("inscricoes").update(update).eq("id", inscricao.id);
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
      maxParcelas: limiteParcelas(organizador.mp_parcelamento_comprador_confirmado),
    });
  } catch (error) {
    console.error("Erro na preferencia Mercado Pago:", error);
    return NextResponse.json({ error: "Erro interno ao preparar pagamento." }, { status: 500 });
  }
}
