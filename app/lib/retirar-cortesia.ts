import type { SupabaseClient } from "@supabase/supabase-js";

export class ErroRetiradaCortesia extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

const campos = "id,evento_id,pagamento_ok,cupom_id,cupom_codigo,desconto_valor,cortesia,valor_inscricao,valor_total,mp_payment_id";

export async function retirarCortesia(db: SupabaseClient, organizadorId: string, inscricaoId: string) {
  const { data: original, error } = await db.from("inscricoes").select(campos).eq("id", inscricaoId).maybeSingle();
  if (error) throw new ErroRetiradaCortesia("Não foi possível consultar a inscrição.", 500);
  if (!original) throw new ErroRetiradaCortesia("Inscrição não encontrada.", 404);
  const { data: evento, error: erroEvento } = await db.from("eventos").select("id").eq("id", original.evento_id).eq("organizador_id", organizadorId).maybeSingle();
  if (erroEvento) throw new ErroRetiradaCortesia("Não foi possível conferir o organizador.", 500);
  if (!evento) throw new ErroRetiradaCortesia("Campeonato não autorizado.", 403);
  // Uma chamada repetida não deve devolver uma segunda vaga.
  if (!original.cupom_id && !original.cortesia) return original;
  if (!original.cortesia || original.mp_payment_id) throw new ErroRetiradaCortesia("Esta ação é exclusiva para cortesias sem pagamento no Mercado Pago.");
  const valorBase = Number(original.valor_inscricao);
  if (!Number.isFinite(valorBase) || valorBase < 0) throw new ErroRetiradaCortesia("Confira o valor original da inscrição antes de retirar a cortesia.");
  if (original.cupom_id) {
    const { data: cupom, error: erroCupom } = await db.from("cupons").select("id").eq("id", original.cupom_id).eq("evento_id", original.evento_id).maybeSingle();
    if (erroCupom || !cupom) throw new ErroRetiradaCortesia("Não foi possível conferir o cupom desta inscrição.", 409);
  }
  const retirada = { pagamento_ok: false, cupom_id: null, cupom_codigo: null, desconto_valor: 0, cortesia: false, valor_total: valorBase };
  let update = db.from("inscricoes").update(retirada).eq("id", original.id).eq("cortesia", true).eq("pagamento_ok", original.pagamento_ok);
  update = original.cupom_id ? update.eq("cupom_id", original.cupom_id) : update.is("cupom_id", null);
  const { data: atualizada, error: erroRetirada } = await update.select(campos).maybeSingle();
  if (erroRetirada) throw new ErroRetiradaCortesia("Não foi possível retirar a cortesia.", 500);
  if (!atualizada) throw new ErroRetiradaCortesia("A inscrição mudou durante a operação. Atualize a página e confira novamente.");
  if (!original.cupom_id) return atualizada;
  try {
    // Atualização condicional preserva reservas de outras inscrições concorrentes.
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const { data: cupom, error: erroCupom } = await db.from("cupons").select("id,usos_atualmente").eq("id", original.cupom_id).eq("evento_id", original.evento_id).maybeSingle();
      if (erroCupom || !cupom) throw new Error("Não foi possível consultar o estoque.");
      const usados = Number(cupom.usos_atualmente);
      if (!Number.isInteger(usados) || usados < 0) throw new Error("Estoque inválido.");
      if (usados === 0) return atualizada;
      const { data: devolvido, error: erroDevolucao } = await db.from("cupons").update({ usos_atualmente: usados - 1 }).eq("id", cupom.id).eq("evento_id", original.evento_id).eq("usos_atualmente", usados).select("id").maybeSingle();
      if (erroDevolucao) throw new Error("Não foi possível devolver a vaga.");
      if (devolvido) return atualizada;
    }
    throw new Error("O estoque mudou durante a operação.");
  } catch {
    // Se o estoque falhar, restaura a cortesia para permitir uma nova tentativa.
    const restaurar = { pagamento_ok: original.pagamento_ok, cupom_id: original.cupom_id, cupom_codigo: original.cupom_codigo, desconto_valor: original.desconto_valor, cortesia: original.cortesia, valor_total: original.valor_total };
    const { data: restaurada, error: erroRestauro } = await db.from("inscricoes").update(restaurar).eq("id", original.id).is("cupom_id", null).eq("cortesia", false).eq("pagamento_ok", false).eq("valor_total", valorBase).select("id").maybeSingle();
    if (erroRestauro || !restaurada) throw new ErroRetiradaCortesia("A retirada foi registrada, mas a devolução do cupom precisa de conferência. Atualize a página e contate o suporte.", 500);
    throw new ErroRetiradaCortesia("Não foi possível devolver a vaga do cupom. A cortesia foi preservada; tente novamente.", 503);
  }
}
