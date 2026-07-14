import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { estornarRoyaltyOrganizador } from "@/app/lib/fotos-pedidos";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Operação administrativa não configurada no servidor." }, { status: 500 });
    }

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const { data: master, error: masterError } = await supabase
      .from("atletas")
      .select("role")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (masterError || master?.role !== "super-admin") {
      return NextResponse.json({ error: "Acesso exclusivo do Super Admin." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const pedidoId = String(body?.pedidoId || "").trim();
    const motivo = String(body?.motivo || "").trim();
    const confirmacao = String(body?.confirmacao || "").trim().toUpperCase();
    if (!pedidoId) return NextResponse.json({ error: "Pedido não informado." }, { status: 400 });
    if (motivo.length < 8 || motivo.length > 300) {
      return NextResponse.json({ error: "Informe um motivo entre 8 e 300 caracteres." }, { status: 400 });
    }
    if (confirmacao !== "REEMBOLSAR") {
      return NextResponse.json({ error: "Digite REEMBOLSAR para confirmar a devolução integral." }, { status: 400 });
    }

    const { data: pedido, error: pedidoError } = await supabase
      .from("foto_pedidos")
      .select("id, status, total_centavos, provedor_payment_id, fotografo_id, fotografos(mp_access_token)")
      .eq("id", pedidoId)
      .maybeSingle();
    if (pedidoError) throw new Error(pedidoError.message);
    if (!pedido) return NextResponse.json({ error: "Pedido não localizado." }, { status: 404 });
    if (pedido.status === "reembolsado") {
      return NextResponse.json({ error: "Este pedido já foi reembolsado." }, { status: 409 });
    }
    if (pedido.status !== "pago") {
      return NextResponse.json({ error: "Somente pedidos pagos podem ser reembolsados." }, { status: 409 });
    }

    const paymentId = String(pedido.provedor_payment_id || "");
    const fotografo = primeiraRelacao(pedido.fotografos);
    if (!paymentId || !fotografo?.mp_access_token) {
      return NextResponse.json({ error: "A transação ou a conta recebedora não está disponível para reembolso." }, { status: 409 });
    }

    const consultaResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${fotografo.mp_access_token}` },
      cache: "no-store",
    });
    const pagamento = await consultaResponse.json();
    if (!consultaResponse.ok) {
      return NextResponse.json({ error: pagamento?.message || "Não foi possível validar a transação." }, { status: 502 });
    }

    const referenciaCorreta = pagamento.external_reference === `foto_pedido:${pedido.id}`;
    const valorCorreto = Math.round(Number(pagamento.transaction_amount || 0) * 100) === Number(pedido.total_centavos || 0);
    if (!referenciaCorreta || !valorCorreto) {
      return NextResponse.json({ error: "Os dados da transação divergem do pedido. O reembolso foi bloqueado." }, { status: 409 });
    }

    if (pagamento.status === "refunded") {
      await supabase.from("foto_pedidos").update({ status: "reembolsado", provedor_status_detail: "refunded" }).eq("id", pedido.id);
      await estornarRoyaltyOrganizador(supabase, pedido.id);
      return NextResponse.json({ success: true, pedidoId: pedido.id, status: "reembolsado", jaReembolsadoNoProvedor: true });
    }
    if (pagamento.status !== "approved") {
      return NextResponse.json({ error: `A transação está com status ${pagamento.status || "desconhecido"} e não pode ser reembolsada por este botão.` }, { status: 409 });
    }

    const refundResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fotografo.mp_access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `itatame-fotos-reembolso-${pedido.id}`,
      },
      body: JSON.stringify({}),
    });
    const refund = await refundResponse.json();
    if (!refundResponse.ok) {
      const causa = Array.isArray(refund?.cause) ? refund.cause[0] : null;
      return NextResponse.json({ error: causa?.description || refund?.message || "O provedor recusou o reembolso." }, { status: 400 });
    }

    const { error: atualizarPedidoError } = await supabase
      .from("foto_pedidos")
      .update({ status: "reembolsado", provedor_status_detail: "refunded" })
      .eq("id", pedido.id);
    if (atualizarPedidoError) throw new Error(atualizarPedidoError.message);
    await estornarRoyaltyOrganizador(supabase, pedido.id);

    console.warn("Reembolso integral de fotos executado pelo Super Admin.", {
      pedidoId: pedido.id,
      adminUserId: auth.user.id,
      refundId: refund?.id || null,
      motivo,
    });

    return NextResponse.json({
      success: true,
      pedidoId: pedido.id,
      refundId: refund?.id || null,
      status: "reembolsado",
      valorCentavos: Number(pedido.total_centavos || 0),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir o reembolso.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
