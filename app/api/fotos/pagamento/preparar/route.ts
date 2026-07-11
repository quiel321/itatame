import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function baseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Faça login para finalizar a compra." }, { status: 401 });

    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey) return NextResponse.json({ error: "Mercado Pago não configurado." }, { status: 500 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const body = await request.json();
    const fotoIds = [...new Set((Array.isArray(body.fotoIds) ? body.fotoIds : []).map(String))];
    if (!fotoIds.length || fotoIds.length > 50) {
      return NextResponse.json({ error: "Selecione entre 1 e 50 fotos." }, { status: 400 });
    }

    const { data: fotos, error: fotosError } = await supabase
      .from("foto_arquivos")
      .select(`
        id, evento_id, fotografo_id, titulo, preco_centavos, status,
        foto_eventos (id, nome, status, vendas_ate, desconto_combo_qtd, desconto_combo_percentual),
        fotografos (id, nome, mp_access_token, mp_connected_at, status)
      `)
      .in("id", fotoIds)
      .eq("status", "publicada");
    if (fotosError || !fotos || fotos.length !== fotoIds.length) {
      return NextResponse.json({ error: "Uma ou mais fotos não estão disponíveis." }, { status: 409 });
    }

    const eventoId = String(fotos[0].evento_id);
    const fotografoId = String(fotos[0].fotografo_id);
    if (fotos.some((foto) => String(foto.evento_id) !== eventoId || String(foto.fotografo_id) !== fotografoId)) {
      return NextResponse.json({ error: "Finalize separadamente as fotos de cada fotógrafo e evento." }, { status: 409 });
    }

    const evento = primeiraRelacao(fotos[0].foto_eventos);
    const fotografo = primeiraRelacao(fotos[0].fotografos);
    if (!evento || evento.status !== "publicado") {
      return NextResponse.json({ error: "A galeria não está disponível para vendas." }, { status: 409 });
    }
    if (evento.vendas_ate && new Date(evento.vendas_ate) < new Date()) {
      return NextResponse.json({ error: "O prazo de compra desta galeria terminou." }, { status: 409 });
    }
    if (!fotografo?.mp_access_token || fotografo.status !== "ativo") {
      return NextResponse.json({ error: "O fotógrafo ainda não conectou a conta de recebimento." }, { status: 409 });
    }

    const subtotalCentavos = fotos.reduce((total, foto) => total + Math.max(0, Number(foto.preco_centavos || 0)), 0);
    const comboQtd = Math.max(2, Number(evento.desconto_combo_qtd || 3));
    const comboPercentual = Math.min(90, Math.max(0, Number(evento.desconto_combo_percentual || 0)));
    const descontoCentavos = fotos.length >= comboQtd
      ? Math.round(subtotalCentavos * comboPercentual / 100)
      : 0;
    const totalCentavos = subtotalCentavos - descontoCentavos;
    if (totalCentavos <= 0) return NextResponse.json({ error: "Total do pedido inválido." }, { status: 409 });

    const percentualComissao = Math.min(90, Math.max(0, Number(process.env.FOTOS_COMISSAO_PERCENTUAL || 10)));
    const comissaoCentavos = Math.round(totalCentavos * percentualComissao / 100);
    const { data: pedido, error: pedidoError } = await supabase
      .from("foto_pedidos")
      .insert({
        comprador_user_id: auth.user.id,
        comprador_email: auth.user.email,
        comprador_nome: auth.user.user_metadata?.nome_completo || auth.user.email?.split("@")[0],
        evento_id: eventoId,
        fotografo_id: fotografoId,
        status: "pendente",
        subtotal_centavos: subtotalCentavos,
        desconto_centavos: descontoCentavos,
        total_centavos: totalCentavos,
        comissao_itatame_centavos: comissaoCentavos,
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

    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fotografo.mp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{
          id: pedido.id,
          title: `Fotos - ${evento.nome || "Evento iTatame"}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: totalCentavos / 100,
        }],
        external_reference: `foto_pedido:${pedido.id}`,
        marketplace_fee: comissaoCentavos / 100,
        notification_url: `${baseUrl(request)}/api/fotos/pagamento/webhook?pedido_id=${pedido.id}`,
        metadata: { pedido_id: pedido.id, evento_id: eventoId, fotografo_id: fotografoId },
      }),
    });
    const preference = await preferenceResponse.json();
    if (!preferenceResponse.ok || !preference.id) {
      await supabase.from("foto_pedido_itens").delete().eq("pedido_id", pedido.id);
      await supabase.from("foto_pedidos").delete().eq("id", pedido.id);
      return NextResponse.json({ error: preference.message || "Falha ao preparar o pagamento." }, { status: 502 });
    }

    await supabase.from("foto_pedidos").update({ provedor_preference_id: String(preference.id) }).eq("id", pedido.id);
    return NextResponse.json({
      publicKey,
      preferenceId: String(preference.id),
      pedidoId: pedido.id,
      eventoNome: evento.nome || "Evento iTatame",
      total: totalCentavos / 100,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao preparar pagamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

