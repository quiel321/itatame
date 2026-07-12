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
    const body = await request.json().catch(() => ({})); // Garante que não quebre se o corpo for vazio
    
    // Mercado Pago pode enviar o ID de várias formas diferentes (data.id no json ou na URL)
    const paymentId = String(body?.data?.id || url.searchParams.get("data.id") || "");
    
    if (!paymentId || paymentId === "undefined" || paymentId === "null") {
      return NextResponse.json({ success: true, message: "Aviso do MP recebido, mas não era um pagamento." });
    }

    const supabase = createSupabaseServerClient();
    
    // Tenta pegar o pedidoId pela URL que nós mesmos mandamos na criação do Pix
    let pedidoId = url.searchParams.get("pedido_id");
    let pedido = null;

    if (pedidoId) {
      pedido = (await supabase.from("foto_pedidos").select("id, total_centavos, status, fotografo_id, fotografos(mp_access_token)").eq("id", pedidoId).maybeSingle()).data;
    }
    
    // Se não achou pela URL, tenta achar pelo paymentId que guardamos no banco
    if (!pedido) {
      pedido = (await supabase.from("foto_pedidos").select("id, total_centavos, status, fotografo_id, fotografos(mp_access_token)").eq("provedor_payment_id", paymentId).maybeSingle()).data;
      pedidoId = pedido?.id || null;
    }
    
    if (!pedido || !pedidoId) {
      return NextResponse.json({ success: true, message: "Pedido não localizado na base do iTatame." });
    }

    const fotografo = primeiraRelacao(pedido.fotografos);
    if (!fotografo?.mp_access_token) {
      return NextResponse.json({ success: true, message: "Token do fotógrafo não encontrado." });
    }

    // A MÁGICA DE SEGURANÇA: Vamos direto no Mercado Pago perguntar se esse pagamento é real e se já está pago!
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${fotografo.mp_access_token}` },
    });
    
    if (!paymentResponse.ok) {
      return NextResponse.json({ success: false, message: "Falha ao consultar MP." }, { status: 502 });
    }

    const payment = await paymentResponse.json();

    // Verificações de segurança (Garante que o pagamento é realmente deste pedido e no valor certo)
    const valorCorreto = Math.round(Number(payment.transaction_amount || 0) * 100) === Number(pedido.total_centavos);
    if (payment.external_reference !== `foto_pedido:${pedidoId}` || !valorCorreto) {
      return NextResponse.json({ success: true, message: "Pagamento divergente ou manipulado." });
    }

    // Atualiza o banco com os dados novos do Mercado Pago
    await supabase.from("foto_pedidos").update({
      provedor_payment_id: paymentId,
      provedor_status_detail: payment.status_detail || null,
    }).eq("id", pedidoId);
    
    // SE O MP DISSER QUE ESTÁ PAGO (approved) e o nosso sistema ainda não marcou como pago...
    if (payment.status === "approved" && pedido.status !== "pago") {
      // 🚀 LIBERA AS FOTOS!
      await liberarPedidoFotos(supabase, pedidoId, paymentId, payment.status_detail);
      console.log(`[iTatame Webhook] PIX Aprovado! Pedido ${pedidoId} liberado com sucesso.`);
    }

    return NextResponse.json({ success: true, status: payment.status });
  } catch (error) {
    console.error("[iTatame Webhook Error]:", error);
    // Retornamos 200 pro MP parar de enviar a mesma notificação, mas avisamos que deu erro interno
    return NextResponse.json({ success: false, message: "Erro interno no servidor." }, { status: 200 });
  }
}