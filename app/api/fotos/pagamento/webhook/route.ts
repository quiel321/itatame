import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { liberarPedidoFotos } from "@/app/lib/fotos-pedidos";

export const runtime = "nodejs";

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({})); 
    
    const paymentId = String(body?.data?.id || url.searchParams.get("data.id") || "");
    
    if (!paymentId || paymentId === "undefined" || paymentId === "null") {
      return NextResponse.json({ success: true, message: "Aviso do MP ignorado." });
    }

    const supabase = createSupabaseServerClient();
    
    // Busca o pedido pelo ID do pagamento gerado
    const { data: pedidoBusca } = await supabase
      .from("foto_pedidos")
      .select("id, total_centavos, status, fotografo_id, fotografos(mp_access_token)")
      .eq("provedor_payment_id", paymentId)
      .maybeSingle();
    
    if (!pedidoBusca || !pedidoBusca.id) {
      return NextResponse.json({ success: true, message: "Pedido não localizado." });
    }

    const fotografo = primeiraRelacao(pedidoBusca.fotografos);
    if (!fotografo?.mp_access_token) {
      return NextResponse.json({ success: true, message: "Token do fotógrafo ausente." });
    }

    // Consulta direta na fonte de verdade: O Mercado Pago
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${fotografo.mp_access_token}` },
    });
    
    if (!paymentResponse.ok) {
      return NextResponse.json({ success: false, message: "Falha ao consultar MP." }, { status: 502 });
    }

    const payment = await paymentResponse.json();

    // 🔥 A TESOURA: Pega apenas o UUID limpo da referência do MP
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = payment.external_reference?.match(uuidRegex);
    const extractedPedidoId = match ? match[0] : null;

    // Verificações de Segurança Rigorosas
    const valorCorreto = Math.round(Number(payment.transaction_amount || 0) * 100) === Number(pedidoBusca.total_centavos);
    if (!extractedPedidoId || extractedPedidoId !== pedidoBusca.id || !valorCorreto) {
      return NextResponse.json({ success: true, message: "Pagamento divergente ou manipulado." });
    }

    // 🔥 TRADUTOR: Se o MP disser "approved", nós forçamos a palavra "pago" no Supabase!
    const isAprovado = payment.status === "approved";
    const statusBanco = isAprovado ? "pago" : pedidoBusca.status;

    // Atualiza o banco garantindo o status correto
    await supabase.from("foto_pedidos").update({
      provedor_payment_id: paymentId,
      provedor_status_detail: payment.status_detail || null,
      status: statusBanco 
    }).eq("id", extractedPedidoId);
    
    // E finalmente, libera os downloads!
    if (isAprovado && pedidoBusca.status !== "pago") {
      await liberarPedidoFotos(supabase, extractedPedidoId, paymentId, payment.status_detail);
      console.log(`[iTatame Webhook] PIX Aprovado! Pedido ${extractedPedidoId} liberado com sucesso.`);
    }

    return NextResponse.json({ success: true, status: payment.status });
  } catch (error) {
    console.error("[iTatame Webhook Error]:", error);
    return NextResponse.json({ success: false, message: "Erro interno no servidor." }, { status: 200 });
  }
}