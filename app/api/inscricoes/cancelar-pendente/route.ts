import "server-only";
import { NextResponse } from "next/server";
import { autenticarRequest } from "@/app/lib/api-auth";
import { conferirCancelamentoInscricao } from "@/app/lib/cancelamento-inscricao";
import { obterAccessTokenOrganizador } from "@/app/lib/mercado-pago-integracao";
import { acaoParaPagamentoPendente, pagamentoPertenceAInscricao } from "@/app/lib/cancelamento-pagamento";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: "Entre na sua conta para cancelar a inscrição." }, { status: 401 });
  const { inscricaoId } = await request.json().catch(() => ({}));
  if (!inscricaoId) return NextResponse.json({ error: "Inscrição não informada." }, { status: 400 });

  const db = createSupabaseServerClient();
  const { data: inscricao, error } = await db.from("inscricoes")
    .select("id,user_id,evento_id,pagamento_ok,mp_payment_id,cortesia,estorno_status,eventos(organizador_id)")
    .eq("id", inscricaoId).maybeSingle();
  if (error || !inscricao) return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });
  const impedimento = await conferirCancelamentoInscricao(db, usuario.id, inscricao);
  if (impedimento) return NextResponse.json({ error: impedimento }, { status: 409 });
  if (inscricao.pagamento_ok || inscricao.cortesia || inscricao.estorno_status || !inscricao.mp_payment_id) {
    return NextResponse.json({ error: "Atualize a página para conferir o estado do pagamento antes de cancelar." }, { status: 409 });
  }

  const evento = Array.isArray(inscricao.eventos) ? inscricao.eventos[0] : inscricao.eventos;
  if (!evento?.organizador_id) return NextResponse.json({ error: "Evento sem organizador vinculado." }, { status: 409 });
  const { data: organizador } = await db.from("organizadores")
    .select("user_id,mp_access_token,mp_refresh_token,mp_token_expires_at")
    .eq("user_id", evento.organizador_id).maybeSingle();
  if (!organizador?.mp_access_token) return NextResponse.json({ error: "Não foi possível conferir o pagamento com o organizador." }, { status: 409 });
  const token = await obterAccessTokenOrganizador(request, organizador, db);
  if (!token) return NextResponse.json({ error: "Conexão de pagamento indisponível. Tente novamente mais tarde." }, { status: 409 });

  const url = `https://api.mercadopago.com/v1/payments/${encodeURIComponent(inscricao.mp_payment_id)}`;
  const headers = { Authorization: `Bearer ${token}` };
  const consulta = await fetch(url, { headers, cache: "no-store" });
  if (!consulta.ok) return NextResponse.json({ error: "Não foi possível conferir o pagamento. Nenhuma inscrição foi removida." }, { status: 502 });
  const pagamento = await consulta.json();
  if (!pagamentoPertenceAInscricao(pagamento.external_reference, inscricao.id)) {
    return NextResponse.json({ error: "A referência do pagamento diverge da inscrição. Cancelamento bloqueado." }, { status: 409 });
  }
  let status = String(pagamento.status || "");
  if (acaoParaPagamentoPendente(status) === "cancelar-no-provedor") {
    const cancelamento = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!cancelamento.ok) return NextResponse.json({ error: "O Mercado Pago não confirmou o cancelamento. Nenhuma inscrição foi removida." }, { status: 502 });
    status = String((await cancelamento.json()).status || "");
  }
  if (status === "approved" || status === "refunded" || status === "charged_back") {
    return NextResponse.json({ error: "O Mercado Pago registrou uma movimentação financeira. A inscrição foi mantida; procure a organização para conferir o estorno." }, { status: 409 });
  }
  if (acaoParaPagamentoPendente(status) !== "remover-inscricao") {
    return NextResponse.json({ error: `Pagamento em estado ${status || "desconhecido"}. A inscrição foi mantida por segurança.` }, { status: 409 });
  }

  const impedimentoAtual = await conferirCancelamentoInscricao(db, usuario.id, inscricao);
  if (impedimentoAtual) return NextResponse.json({ error: impedimentoAtual }, { status: 409 });
  const { data: excluidas, error: erroExclusao } = await db.from("inscricoes").delete()
    .eq("id", inscricao.id).eq("user_id", inscricao.user_id)
    .eq("mp_payment_id", inscricao.mp_payment_id).eq("pagamento_ok", false)
    .is("estorno_status", null).select("id");
  if (erroExclusao) {
    console.error("Falha ao remover inscrição após cancelar pagamento pendente:", {
      inscricaoId: inscricao.id, codigo: erroExclusao.code, mensagem: erroExclusao.message,
    });
    return NextResponse.json({ error: "O pagamento foi cancelado, mas não foi possível remover a inscrição. Tente novamente; se persistir, contate a organização." }, { status: 500 });
  }
  if (!excluidas?.length) {
    return NextResponse.json({ error: "O pagamento foi cancelado, mas os dados da inscrição mudaram. Atualize a página antes de tentar novamente." }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
