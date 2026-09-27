import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { sincronizarPagamentoFotos } from "@/app/lib/fotos-mercado-pago";
import { obterRecebedorFotos } from "@/app/lib/fotos-recebedor";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Operação administrativa indisponível." }, { status: 503 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    const { data: perfil, error: perfilError } = await supabase.from("atletas").select("role").eq("user_id", auth.user.id).maybeSingle();
    if (perfilError || perfil?.role !== "super-admin") return NextResponse.json({ error: "Acesso exclusivo do Super Admin." }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const pedidoId = String(body.pedidoId || "").trim();
    const acao = String(body.acao || "");
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(pedidoId) || !["consultar", "cancelar"].includes(acao)) {
      return NextResponse.json({ error: "Pedido ou ação inválida." }, { status: 400 });
    }
    if (acao === "cancelar" && (String(body.confirmacao || "").trim().toUpperCase() !== "CANCELAR" || String(body.motivo || "").trim().length < 8)) {
      return NextResponse.json({ error: "Informe o motivo e digite CANCELAR para confirmar." }, { status: 400 });
    }

    const { data: pedido, error: pedidoError } = await supabase.from("foto_pedidos")
      .select("id, status, total_centavos, provedor_payment_id, fotografo_id, organizador_user_id, modelo_recebimento")
      .eq("id", pedidoId).maybeSingle();
    if (pedidoError) throw new Error(pedidoError.message);
    if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (pedido.status !== "pendente") return NextResponse.json({ error: `Este pedido já está ${pedido.status}. Atualize a lista.` }, { status: 409 });
    const paymentId = String(pedido.provedor_payment_id || "");
    if (!paymentId || !/^\d+$/.test(paymentId)) {
      return NextResponse.json({ error: "Pedido sem pagamento identificado no Mercado Pago. Requer análise manual antes de cancelar." }, { status: 409 });
    }

    if (acao === "consultar") {
      const resultado = await sincronizarPagamentoFotos(supabase, { pedidoId }, request);
      if (!resultado?.sincronizado) return NextResponse.json({ error: "Não foi possível consultar a conta recebedora no Mercado Pago." }, { status: 503 });
      return NextResponse.json(resultado);
    }

    const recebedor = await obterRecebedorFotos(supabase, request, pedido);
    if (!recebedor) return NextResponse.json({ error: "Conta recebedora indisponível para consultar o pagamento." }, { status: 503 });
    const url = `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`;
    const cabecalhos = { Authorization: `Bearer ${recebedor.accessToken}` };
    const consulta = await fetch(url, { headers: cabecalhos, cache: "no-store" });
    const pagamento = await consulta.json();
    if (!consulta.ok) return NextResponse.json({ error: pagamento?.message || "Mercado Pago não confirmou o pagamento." }, { status: 502 });
    if (String(pagamento.id) !== paymentId || pagamento.external_reference !== `foto_pedido:${pedido.id}` || Math.round(Number(pagamento.transaction_amount || 0) * 100) !== Number(pedido.total_centavos)) {
      return NextResponse.json({ error: "ID, referência ou valor divergente. Cancelamento bloqueado." }, { status: 409 });
    }
    if (["approved", "refunded", "charged_back", "rejected", "cancelled"].includes(String(pagamento.status))) {
      const resultado = await sincronizarPagamentoFotos(supabase, { pedidoId }, request);
      return NextResponse.json({
        error: pagamento.status === "approved" ? "Pagamento aprovado. Use o fluxo de reembolso se precisar devolver a venda." : "O pagamento já tem status final no Mercado Pago. A lista foi atualizada.",
        resultado,
      }, { status: 409 });
    }
    if (!["pending", "in_process", "authorized"].includes(String(pagamento.status))) {
      return NextResponse.json({ error: `Status ${pagamento.status || "desconhecido"} não permite cancelamento.` }, { status: 409 });
    }

    const cancelamento = await fetch(url, {
      method: "PUT",
      headers: { ...cabecalhos, "Content-Type": "application/json", "X-Idempotency-Key": `retratt-cancelar-${pedido.id}` },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const resposta = await cancelamento.json();
    if (!cancelamento.ok || resposta.status !== "cancelled") {
      return NextResponse.json({ error: resposta?.message || "Mercado Pago não confirmou o cancelamento. Consulte novamente." }, { status: 502 });
    }
    const resultado = await sincronizarPagamentoFotos(supabase, { pedidoId }, request);
    if (resultado?.status !== "cancelado") throw new Error("Mercado Pago cancelou, mas o pedido não foi sincronizado. Consulte novamente.");
    console.warn("Pagamento pendente de fotos cancelado pelo Super Admin.", { pedidoId, adminUserId: auth.user.id, motivo: String(body.motivo).trim().slice(0, 300) });
    return NextResponse.json({ success: true, ...resultado });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível resolver o pedido." }, { status: 500 });
  }
}
