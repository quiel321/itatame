import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { autenticarRequest } from "@/app/lib/api-auth";
import { obterAccessTokenOrganizador } from "@/app/lib/mercado-pago-integracao";
import { enviarEmailEstorno } from "@/app/lib/email-estorno";
import { conferirCancelamentoInscricao } from "@/app/lib/cancelamento-inscricao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function numero(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function papelDoUsuario(userId: string) {
  const supabase = createSupabaseServerClient();
  const [{ data: atleta }, { data: organizador }] = await Promise.all([
    supabase.from("atletas").select("role").eq("user_id", userId).maybeSingle(),
    supabase.from("organizadores").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (atleta?.role === "super-admin") return "super-admin" as const;
  if (organizador) return "organizador" as const;
  return null;
}

export async function GET(request: Request) {
  try {
    const usuario = await autenticarRequest(request);
    if (!usuario) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    if (await papelDoUsuario(usuario.id) !== "super-admin") {
      return NextResponse.json({ error: "Acesso exclusivo do Super Admin." }, { status: 403 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("inscricoes")
      .select("id,evento_id,atleta,equipe,categoria,pagamento_ok,valor_inscricao,valor_total,mp_payment_id,estorno_status,estorno_valor,estorno_motivo,estornado_em,eventos(id,nome,data_evento,organizador_id)")
      .not("mp_payment_id", "is", null)
      .order("id", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return NextResponse.json({ inscricoes: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível carregar os pagamentos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const inscricaoId = String(body.inscricaoId || "").trim();
  const motivo = String(body.motivo || "").trim();
  const confirmacao = String(body.confirmacao || "").trim().toUpperCase();
  if (!inscricaoId) return NextResponse.json({ error: "Inscrição não informada." }, { status: 400 });
  if (motivo.length < 8 || motivo.length > 300) {
    return NextResponse.json({ error: "Informe um motivo entre 8 e 300 caracteres." }, { status: 400 });
  }
  if (confirmacao !== "ESTORNAR" && confirmacao !== "CANCELAR") {
    return NextResponse.json({ error: "Confirme a devolução integral para continuar." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const papel = (await papelDoUsuario(usuario.id)) || "atleta";

  const { data: inscricao, error: inscricaoError } = await supabase
    .from("inscricoes")
    .select("id,evento_id,user_id,email,atleta,pagamento_ok,valor_inscricao,valor_total,mp_payment_id,cortesia,estorno_status,eventos(id,nome,organizador_id)")
    .eq("id", inscricaoId)
    .maybeSingle();
  if (inscricaoError) return NextResponse.json({ error: inscricaoError.message }, { status: 500 });
  if (!inscricao) return NextResponse.json({ error: "Inscrição não localizada." }, { status: 404 });
  const evento = primeiraRelacao(inscricao.eventos);
  if (!evento?.organizador_id) return NextResponse.json({ error: "Evento sem organizador vinculado." }, { status: 409 });
  if (papel === "organizador" && evento.organizador_id !== usuario.id) {
    return NextResponse.json({ error: "Você só pode estornar inscrições dos seus eventos." }, { status: 403 });
  }
  if (papel === "atleta") {
    if (confirmacao !== "CANCELAR") return NextResponse.json({ error: "Confirme o cancelamento da inscrição." }, { status: 400 });
    const impedimento = await conferirCancelamentoInscricao(supabase, usuario.id, inscricao);
    if (impedimento) return NextResponse.json({ error: impedimento }, { status: 409 });
  } else if (confirmacao !== "ESTORNAR") {
    return NextResponse.json({ error: "Digite ESTORNAR para confirmar a devolução integral." }, { status: 400 });
  }
  if (inscricao.cortesia || !inscricao.mp_payment_id) {
    return NextResponse.json({ error: "Cortesias e inscrições sem transação não possuem valor para estornar." }, { status: 409 });
  }
  if (inscricao.estorno_status === "estornado") {
    return NextResponse.json({ error: "Esta inscrição já foi estornada." }, { status: 409 });
  }
  if (!inscricao.pagamento_ok) {
    return NextResponse.json({ error: "Somente inscrições pagas podem ser estornadas." }, { status: 409 });
  }

  const { data: lutas } = await supabase
    .from("chaves")
    .select("id,status_luta,vencedor,iniciada_em")
    .eq("evento_id", inscricao.evento_id);
  const chaveEmOperacao = (lutas || []).some((luta) => luta.vencedor || luta.iniciada_em || ["em_andamento", "concluida"].includes(String(luta.status_luta)));
  if (chaveEmOperacao) {
    return NextResponse.json({ error: "O campeonato já possui lutas iniciadas ou resultados. O estorno automático foi bloqueado para preservar a chave." }, { status: 409 });
  }
  const exigeRegenerarChaves = Boolean(lutas?.length);

  const { data: organizador } = await supabase
    .from("organizadores")
    .select("user_id,mp_access_token,mp_refresh_token,mp_token_expires_at")
    .eq("user_id", evento.organizador_id)
    .maybeSingle();
  if (!organizador?.mp_access_token) {
    return NextResponse.json({ error: "A conta Mercado Pago recebedora não está conectada." }, { status: 409 });
  }
  const accessToken = await obterAccessTokenOrganizador(request, organizador, supabase);
  if (!accessToken) return NextResponse.json({ error: "A conexão Mercado Pago do organizador expirou." }, { status: 409 });

  const paymentId = String(inscricao.mp_payment_id);
  const consulta = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const pagamento = await consulta.json();
  if (!consulta.ok) return NextResponse.json({ error: pagamento?.message || "Não foi possível validar a transação." }, { status: 502 });
  if (pagamento.external_reference !== `inscricao:${inscricao.id}`) {
    return NextResponse.json({ error: "A referência da transação diverge da inscrição. Estorno bloqueado." }, { status: 409 });
  }
  const valorPagamento = numero(pagamento.transaction_amount);
  const valorRegistrado = numero(inscricao.valor_total || inscricao.valor_inscricao);
  if (valorRegistrado > 0 && Math.abs(valorPagamento - valorRegistrado) > 0.01) {
    return NextResponse.json({ error: "O valor no Mercado Pago diverge do valor registrado. Estorno bloqueado." }, { status: 409 });
  }

  const registrarAuditoria = async (status: "processando" | "estornado" | "erro", extras: Record<string, unknown> = {}) => {
    const { error } = await supabase.from("inscricao_estornos").upsert({
      inscricao_id: inscricao.id,
      evento_id: inscricao.evento_id,
      mp_payment_id: paymentId,
      valor: valorPagamento,
      status,
      solicitado_por: usuario.id,
      papel_solicitante: papel,
      motivo,
      atualizado_em: new Date().toISOString(),
      ...extras,
    }, { onConflict: "inscricao_id" });
    if (error) throw new Error(`Falha ao registrar auditoria: ${error.message}`);
  };

  const concluir = async (refundId: string | null, mpStatus: string, jaEstornado = false) => {
    await registrarAuditoria("estornado", { mp_refund_id: refundId, mp_status: mpStatus, erro: null });
    const { error } = await supabase.from("inscricoes").update({
      pagamento_ok: false,
      estorno_status: "estornado",
      estorno_valor: valorPagamento,
      estorno_refund_id: refundId,
      estorno_motivo: motivo,
      estornado_em: new Date().toISOString(),
      estornado_por: usuario.id,
    }).eq("id", inscricao.id);
    if (error) throw new Error(error.message);
    const aviso = await enviarEmailEstorno(inscricao, evento.nome || "Campeonato", valorPagamento)
      .catch((erro: unknown) => ({ enviado: false, motivo: erro instanceof Error ? erro.message : "Falha no envio" }));
    if (!aviso.enviado) console.error("Estorno confirmado, mas e-mail não enviado:", aviso.motivo, inscricao.id);
    return NextResponse.json({ success: true, status: "estornado", valor: valorPagamento, refundId, jaEstornado, exigeRegenerarChaves, emailEnviado: aviso.enviado });
  };

  if (pagamento.status === "refunded") return concluir(null, "refunded", true);
  if (pagamento.status !== "approved") {
    return NextResponse.json({ error: `A transação está com status ${pagamento.status || "desconhecido"} e não permite estorno integral por este botão.` }, { status: 409 });
  }

  // A consulta ao Mercado Pago pode demorar; confira o prazo novamente antes do estorno.
  if (papel === "atleta") {
    const impedimento = await conferirCancelamentoInscricao(supabase, usuario.id, inscricao);
    if (impedimento) return NextResponse.json({ error: impedimento }, { status: 409 });
  }

  await registrarAuditoria("processando", { mp_status: pagamento.status, erro: null });
  const { error: marcarProcessandoError } = await supabase.from("inscricoes").update({ estorno_status: "processando", estorno_motivo: motivo }).eq("id", inscricao.id);
  if (marcarProcessandoError) throw new Error(marcarProcessandoError.message);

  const refundResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `itatame-estorno-${inscricao.id}-${paymentId}`.slice(0, 64),
    },
    body: JSON.stringify({}),
  });
  const refund = await refundResponse.json();
  if (!refundResponse.ok) {
    const causa = Array.isArray(refund?.cause) ? refund.cause[0] : null;
    const erro = String(causa?.description || refund?.message || "O Mercado Pago recusou o estorno.").slice(0, 500);
    await registrarAuditoria("erro", { mp_status: pagamento.status, erro });
    await supabase.from("inscricoes").update({ estorno_status: "erro", estorno_motivo: motivo }).eq("id", inscricao.id);
    return NextResponse.json({ error: erro }, { status: 400 });
  }

  return concluir(refund?.id ? String(refund.id) : null, String(refund?.status || "refunded"));
}
