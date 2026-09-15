import { NextResponse } from "next/server";
import { autenticarRequest } from "@/app/lib/api-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { enviarEmailIngressoConfirmado } from "@/app/lib/email-ingresso";

function numero(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const { inscricaoId, codigo } = await request.json().catch(() => ({}));
  const codigoLimpo = String(codigo || "").trim().toUpperCase();
  if (!inscricaoId || !codigoLimpo) return NextResponse.json({ error: "Informe a inscrição e o voucher." }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const { data: inscricao } = await supabase
    .from("inscricoes")
    .select("id, user_id, evento_id, valor_inscricao, valor_total, cupom_id, cupom_codigo, pagamento_ok")
    .eq("id", inscricaoId)
    .maybeSingle();
  if (!inscricao || inscricao.user_id !== usuario.id) return NextResponse.json({ error: "Inscrição não autorizada." }, { status: 403 });

  if (inscricao.cupom_id) {
    if (inscricao.cupom_codigo === codigoLimpo) {
      return NextResponse.json({
        success: true,
        valorTotal: numero(inscricao.valor_total),
        gratuito: numero(inscricao.valor_total) === 0,
        codigo: inscricao.cupom_codigo,
      });
    }
    return NextResponse.json({ error: "Esta inscrição já utilizou outro voucher." }, { status: 409 });
  }

  const { data: cupom } = await supabase
    .from("cupons")
    .select("id, codigo, evento_id, desconto_porcentagem, desconto_valor, limite_usos, usos_atualmente, ativo, expira_em, finalidade")
    .eq("evento_id", inscricao.evento_id)
    .eq("codigo", codigoLimpo)
    .maybeSingle();

  if (!cupom || cupom.ativo === false) return NextResponse.json({ error: "Voucher inválido ou inativo para este evento." }, { status: 404 });
  if (cupom.expira_em && new Date(cupom.expira_em).getTime() < Date.now()) return NextResponse.json({ error: "Este voucher expirou." }, { status: 409 });
  const usados = Number(cupom.usos_atualmente || 0);
  const limite = Number(cupom.limite_usos || 0);
  if (usados >= limite) return NextResponse.json({ error: "As vagas deste voucher já foram utilizadas." }, { status: 409 });

  const valorBase = numero(inscricao.valor_inscricao || inscricao.valor_total);
  const percentual = Math.min(100, numero(cupom.desconto_porcentagem));
  const desconto = Math.min(valorBase, percentual > 0 ? (valorBase * percentual) / 100 : numero(cupom.desconto_valor));
  if (desconto <= 0) return NextResponse.json({ error: "Voucher sem desconto configurado." }, { status: 409 });
  const valorTotal = Number(Math.max(0, valorBase - desconto).toFixed(2));

  const { data: reservado, error: reservaError } = await supabase
    .from("cupons")
    .update({ usos_atualmente: usados + 1 })
    .eq("id", cupom.id)
    .eq("usos_atualmente", usados)
    .lt("usos_atualmente", limite)
    .select("id")
    .maybeSingle();
  if (reservaError || !reservado) return NextResponse.json({ error: "Outra pessoa utilizou a última vaga. Tente outro voucher." }, { status: 409 });

  const gratuito = valorTotal === 0;
  const { data: inscricaoAtualizada, error: updateError } = await supabase.from("inscricoes").update({
    cupom_id: cupom.id,
    cupom_codigo: cupom.codigo,
    desconto_valor: Number(desconto.toFixed(2)),
    valor_total: valorTotal,
    cortesia: gratuito,
    pagamento_ok: gratuito,
  }).eq("id", inscricao.id).is("cupom_id", null).select("id").maybeSingle();

  if (updateError || !inscricaoAtualizada) {
    await supabase.from("cupons").update({ usos_atualmente: usados }).eq("id", cupom.id).eq("usos_atualmente", usados + 1);
    return NextResponse.json({ error: "Não foi possível vincular o voucher à inscrição." }, { status: 500 });
  }

  if (gratuito) await enviarEmailIngressoConfirmado({ inscricaoId: inscricao.id });

  return NextResponse.json({
    success: true,
    codigo: cupom.codigo,
    finalidade: cupom.finalidade,
    desconto: Number(desconto.toFixed(2)),
    valorTotal,
    gratuito,
  });
}
