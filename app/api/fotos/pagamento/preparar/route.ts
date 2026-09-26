import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import {
  calcularDistribuicaoFotos,
  calcularDistribuicaoDiariaFotos,
  COMISSAO_ITATAME_FOTOS_PERCENTUAL,
} from "@/app/lib/fotos-financeiro";
import {
  bearerToken,
  normalizarEmail,
  obterOuCriarCompradorConvidado,
  tokenAcessoPedido,
} from "@/app/lib/fotos-convidado";
import { consumirLimiteAuth, ipDaRequisicao } from "@/app/lib/limite-auth";
import { modeloRecebimentoFotos, obterRecebedorFotos } from "@/app/lib/fotos-recebedor";

export const runtime = "nodejs";

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function baseUrl(_request: Request) {
  return process.env.NEXT_PUBLIC_FOTOS_URL || "https://retratt.com";
}

function notificationUrl(request: Request, pedidoId: string) {
  const url = new URL("/api/fotos/pagamento/webhook", baseUrl(request));
  url.searchParams.set("pedido_id", pedidoId);
  url.searchParams.set("source_news", "webhooks");
  return url.toString();
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const body = await request.json();
    const token = bearerToken(request);
    let compradorUserId = "";
    let compradorEmail = "";
    let compradorNome = "";
    let convidado = false;

    if (token) {
      const { data: auth, error: authError } = await supabase.auth.getUser(token);
      if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
      compradorUserId = auth.user.id;
      compradorEmail = String(auth.user.email || "").trim().toLowerCase();
      compradorNome = auth.user.user_metadata?.nome_completo || compradorEmail.split("@")[0];
      if (!compradorEmail) {
        return NextResponse.json({ error: "Sua conta não possui um e-mail válido para o pagamento." }, { status: 400 });
      }
    } else {
      compradorEmail = normalizarEmail(body.comprador?.email);
      compradorNome = String(body.comprador?.nome || "").trim().replace(/\s+/g, " ").slice(0, 120);
      if (compradorNome.length < 3 || !compradorEmail) {
        return NextResponse.json({ error: "Informe seu nome e um e-mail válido para receber os arquivos." }, { status: 400 });
      }
      if (!consumirLimiteAuth(`compra-convidado:${ipDaRequisicao(request)}`, 10, 10 * 60_000)) {
        return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429 });
      }
      convidado = true;
    }

    const fotoIds = [...new Set((Array.isArray(body.fotoIds) ? body.fotoIds : []).map(String))];
    if (!fotoIds.length || fotoIds.length > 50) {
      return NextResponse.json({ error: "Selecione entre 1 e 50 itens." }, { status: 400 });
    }

    const { data: fotos, error: fotosError } = await supabase
      .from("foto_arquivos")
      .select(`
        id, evento_id, fotografo_id, titulo, preco_centavos, status,
        foto_eventos (id, nome, status, vendas_ate, desconto_combo_qtd, desconto_combo_percentual, organizador_user_id),
        fotografos (id, nome, mp_access_token, mp_connected_at, status)
      `)
      .in("id", fotoIds)
      .eq("status", "publicada");
    if (fotosError || !fotos || fotos.length !== fotoIds.length) {
      return NextResponse.json({ error: "Um ou mais itens não estão disponíveis." }, { status: 409 });
    }

    const eventoId = String(fotos[0].evento_id);
    const fotografoId = String(fotos[0].fotografo_id);
    if (fotos.some((foto) => String(foto.evento_id) !== eventoId || String(foto.fotografo_id) !== fotografoId)) {
      return NextResponse.json({ error: "Finalize separadamente os itens de cada fotógrafo e evento." }, { status: 409 });
    }

    const evento = primeiraRelacao(fotos[0].foto_eventos);
    const fotografo = primeiraRelacao(fotos[0].fotografos);
    if (!evento || evento.status !== "publicado") {
      return NextResponse.json({ error: "A galeria não está disponível para vendas." }, { status: 409 });
    }
    if (evento.vendas_ate && new Date(evento.vendas_ate) < new Date()) {
      return NextResponse.json({ error: "O prazo de compra desta galeria terminou." }, { status: 409 });
    }
    if (fotografo?.status !== "ativo") {
      return NextResponse.json({ error: "O fotógrafo desta galeria não está ativo." }, { status: 409 });
    }

    const subtotalCentavos = fotos.reduce((total, foto) => total + Math.max(0, Number(foto.preco_centavos || 0)), 0);
    const comboQtd = Math.max(2, Number(evento.desconto_combo_qtd || 3));
    const comboPercentual = Math.min(90, Math.max(0, Number(evento.desconto_combo_percentual || 0)));
    const descontoCentavos = fotos.length >= comboQtd
      ? Math.round(subtotalCentavos * comboPercentual / 100)
      : 0;
    const totalCentavos = subtotalCentavos - descontoCentavos;
    if (totalCentavos <= 0) return NextResponse.json({ error: "Total do pedido inválido." }, { status: 409 });

    let percentualOrganizador = 0;
    let modeloRecebimento = modeloRecebimentoFotos(null);
    const organizadorUserId = evento.organizador_user_id ? String(evento.organizador_user_id) : null;
    if (organizadorUserId) {
      const { data: vinculo, error: vinculoError } = await supabase
        .from("foto_evento_fotografos")
        .select("comissao_organizador_percentual, modelo_recebimento")
        .eq("evento_id", eventoId)
        .eq("fotografo_id", fotografoId)
        .maybeSingle();
      if (vinculoError) throw new Error(vinculoError.message);
      if (!vinculo) return NextResponse.json({ error: "Fotógrafo sem regra de recebimento nesta galeria." }, { status: 409 });
      percentualOrganizador = Number(vinculo?.comissao_organizador_percentual || 0);
      modeloRecebimento = modeloRecebimentoFotos(vinculo?.modelo_recebimento);
    }

    const recebedor = await obterRecebedorFotos(supabase, request, {
      modelo_recebimento: modeloRecebimento,
      fotografo_id: fotografoId,
      organizador_user_id: organizadorUserId,
    });
    if (!recebedor) {
      return NextResponse.json({ error: modeloRecebimento === "diaria_organizador" ? "O organizador precisa conectar a conta Mercado Pago da Retratt." : "O fotógrafo ainda não conectou a conta de recebimento." }, { status: 409 });
    }
    const publicKey = recebedor.publicKey || (modeloRecebimento === "royalty" ? process.env.NEXT_PUBLIC_RETRATT_MP_PUBLIC_KEY : null);
    if (!publicKey) return NextResponse.json({ error: "Chave pública da conta recebedora indisponível." }, { status: 409 });

    const distribuicao = modeloRecebimento === "diaria_organizador"
      ? calcularDistribuicaoDiariaFotos(totalCentavos)
      : calcularDistribuicaoFotos({
        totalCentavos,
        percentualItatame: COMISSAO_ITATAME_FOTOS_PERCENTUAL,
        percentualOrganizador,
      });
    if (convidado) {
      ({ userId: compradorUserId } = await obterOuCriarCompradorConvidado(supabase, {
        email: compradorEmail,
        nome: compradorNome,
      }));
    }

    const { data: pedido, error: pedidoError } = await supabase
      .from("foto_pedidos")
      .insert({
        comprador_user_id: compradorUserId,
        comprador_email: compradorEmail,
        comprador_nome: compradorNome,
        evento_id: eventoId,
        fotografo_id: fotografoId,
        status: "pendente",
        subtotal_centavos: subtotalCentavos,
        desconto_centavos: descontoCentavos,
        total_centavos: totalCentavos,
        organizador_user_id: organizadorUserId,
        modelo_recebimento: modeloRecebimento,
        receita_direta_organizador_centavos: modeloRecebimento === "diaria_organizador" ? distribuicao.receitaDiretaOrganizadorCentavos : 0,
        comissao_itatame_centavos: distribuicao.comissaoItatameCentavos,
        comissao_organizador_percentual: distribuicao.percentualOrganizador,
        comissao_organizador_centavos: distribuicao.comissaoOrganizadorCentavos,
        repasse_organizador_status: distribuicao.comissaoOrganizadorCentavos > 0 ? "pendente" : "nao_aplicavel",
        provedor_pagamento: "mercado_pago",
      })
      .select("id")
      .single();
    if (pedidoError || !pedido) throw new Error(pedidoError?.message || "Não foi possível criar o pedido.");

    const { error: itensError } = await supabase.from("foto_pedido_itens").insert(
      fotos.map((foto) => ({
        pedido_id: pedido.id,
        foto_id: foto.id,
        preco_centavos: Number(foto.preco_centavos || 0),
      })),
    );
    if (itensError) {
      await supabase.from("foto_pedidos").delete().eq("id", pedido.id);
      throw new Error(itensError.message);
    }

    if (modeloRecebimento === "royalty" && organizadorUserId && distribuicao.comissaoOrganizadorCentavos > 0) {
      const { error: royaltyError } = await supabase.from("foto_royalties_organizador").insert({
        pedido_id: pedido.id,
        evento_id: eventoId,
        fotografo_id: fotografoId,
        organizador_user_id: organizadorUserId,
        percentual: distribuicao.percentualOrganizador,
        valor_centavos: distribuicao.comissaoOrganizadorCentavos,
        status: "pendente",
      });
      if (royaltyError) {
        await supabase.from("foto_pedido_itens").delete().eq("pedido_id", pedido.id);
        await supabase.from("foto_pedidos").delete().eq("id", pedido.id);
        throw new Error(royaltyError.message);
      }
    }

    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${recebedor.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{
          id: pedido.id,
          title: `Retratt - ${evento.nome || "Evento"}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: totalCentavos / 100,
        }],
        external_reference: `foto_pedido:${pedido.id}`,
        marketplace_fee: distribuicao.comissaoMarketplaceCentavos / 100,
        notification_url: notificationUrl(request, pedido.id),
        payer: {
          email: compradorEmail,
        },
        metadata: {
          pedido_id: pedido.id,
          evento_id: eventoId,
          fotografo_id: fotografoId,
          organizador_user_id: organizadorUserId,
        },
      }),
    });
    const preference = await preferenceResponse.json();
    if (!preferenceResponse.ok || !preference.id) {
      await supabase.from("foto_royalties_organizador").delete().eq("pedido_id", pedido.id);
      await supabase.from("foto_pedido_itens").delete().eq("pedido_id", pedido.id);
      await supabase.from("foto_pedidos").delete().eq("id", pedido.id);
      return NextResponse.json({ error: preference.message || "Falha ao preparar o pagamento." }, { status: 502 });
    }

    await supabase.from("foto_pedidos").update({ provedor_preference_id: String(preference.id) }).eq("id", pedido.id);
    return NextResponse.json({
      publicKey,
      preferenceId: String(preference.id),
      pedidoId: pedido.id,
      eventoNome: evento.nome || "Evento Retratt",
      total: totalCentavos / 100,
      compradorEmail,
      acesso: convidado ? tokenAcessoPedido(pedido.id) : null,
      distribuicao: {
        comissaoItatameCentavos: distribuicao.comissaoItatameCentavos,
        royaltyOrganizadorCentavos: distribuicao.comissaoOrganizadorCentavos,
        fotografoAntesDaTarifaCentavos: distribuicao.fotografoAntesDaTarifaCentavos,
        receitaDiretaOrganizadorCentavos: distribuicao.receitaDiretaOrganizadorCentavos,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao preparar pagamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
