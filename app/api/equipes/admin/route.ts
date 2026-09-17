import { NextResponse } from "next/server";
import { autenticarRequest } from "@/app/lib/api-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

function limpar(valor: unknown) {
  return String(valor || "").trim();
}

async function autorizarOrganizador(eventoId: string, usuarioId: string) {
  const supabase = createSupabaseServerClient();
  const { data: evento } = await supabase.from("eventos").select("id").eq("id", eventoId).eq("organizador_id", usuarioId).maybeSingle();
  return evento ? supabase : null;
}

export async function PATCH(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: "Entre com a conta do organizador." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const eventoId = limpar(body.eventoId);
  const tipo = limpar(body.tipo);
  const id = limpar(body.id);
  const nome = limpar(body.nome);
  const academia = limpar(body.academia);
  const professor = limpar(body.professor);
  const cidade = limpar(body.cidade);
  if (!eventoId || !tipo || [nome, academia, professor, cidade].some(item => item.length > 120)) {
    return NextResponse.json({ error: "Informe os dados da equipe ou da academia (até 120 caracteres)." }, { status: 400 });
  }
  if (tipo !== "unir" && !id) {
    return NextResponse.json({ error: "Informe os dados da equipe ou da academia (até 120 caracteres)." }, { status: 400 });
  }
  const supabase = await autorizarOrganizador(eventoId, usuario.id);
  if (!supabase) return NextResponse.json({ error: "Campeonato não autorizado." }, { status: 403 });

  if (tipo === "equipe") {
    if (!nome) return NextResponse.json({ error: "Informe o nome da equipe." }, { status: 400 });
    const { data: atual, error: buscaError } = await supabase.from("equipes_evento").select("id,nome").eq("id", id).eq("evento_id", eventoId).maybeSingle();
    if (buscaError || !atual) return NextResponse.json({ error: "Equipe não encontrada." }, { status: 404 });
    const { error } = await supabase.from("equipes_evento").update({ nome }).eq("id", id).eq("evento_id", eventoId);
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Já existe uma equipe com este nome no campeonato." : error.message }, { status: 409 });
    await Promise.all([
      supabase.from("inscricoes").update({ equipe: nome }).eq("evento_id", eventoId).eq("equipe_id", id),
      supabase.from("solicitacoes_equipe_evento").update({ equipe_nome: nome, atualizado_em: new Date().toISOString() }).eq("evento_id", eventoId).eq("equipe_id", id),
      supabase.from("chaves").update({ equipe_1: nome }).eq("evento_id", eventoId).eq("equipe_1", atual.nome),
      supabase.from("chaves").update({ equipe_2: nome }).eq("evento_id", eventoId).eq("equipe_2", atual.nome),
    ]);
    return NextResponse.json({ success: true });
  }

  if (tipo === "academia") {
    if (!professor) return NextResponse.json({ error: "Informe o professor da academia." }, { status: 400 });
    const equipeId = id.startsWith("equipe-") ? id.slice(7) : limpar(body.equipeId);
    if (!equipeId) return NextResponse.json({ error: "Academia sem equipe vinculada." }, { status: 400 });
    const { data: equipe } = await supabase.from("equipes_evento").select("id,academia,professor").eq("id", equipeId).eq("evento_id", eventoId).maybeSingle();
    if (!equipe) return NextResponse.json({ error: "Equipe não encontrada." }, { status: 404 });
    if (id.startsWith("equipe-")) {
      const { error } = await supabase.from("equipes_evento").update({ academia, professor, cidade }).eq("id", equipeId).eq("evento_id", eventoId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { data: unidade, error: unidadeError } = await supabase.from("solicitacoes_equipe_evento")
        .update({ academia, professor, cidade, atualizado_em: new Date().toISOString() })
        .eq("id", id).eq("evento_id", eventoId).eq("equipe_id", equipeId)
        .select("id").maybeSingle();
      if (unidadeError || !unidade) return NextResponse.json({ error: unidadeError?.message || "Academia não encontrada." }, { status: 404 });
      if (equipe.academia === academia || equipe.professor === professor) {
        await supabase.from("equipes_evento").update({ academia, professor, cidade }).eq("id", equipeId).eq("evento_id", eventoId);
      }
    }
    return NextResponse.json({ success: true });
  }

  if (tipo === "unir") {
    const origemId = limpar(body.origemId);
    const destinoId = limpar(body.destinoId);
    if (!origemId || !destinoId || origemId === destinoId) {
      return NextResponse.json({ error: "Escolha duas equipes diferentes para unificar." }, { status: 400 });
    }
    const [{ data: origem }, { data: destino }] = await Promise.all([
      supabase.from("equipes_evento").select("id,nome").eq("id", origemId).eq("evento_id", eventoId).maybeSingle(),
      supabase.from("equipes_evento").select("id,nome").eq("id", destinoId).eq("evento_id", eventoId).maybeSingle(),
    ]);
    if (!origem || !destino) return NextResponse.json({ error: "Equipe não encontrada." }, { status: 404 });
    await Promise.all([
      supabase.from("inscricoes").update({ equipe_id: destino.id, equipe: destino.nome }).eq("evento_id", eventoId).eq("equipe_id", origem.id),
      supabase.from("inscricoes").update({ equipe_id: destino.id, equipe: destino.nome }).eq("evento_id", eventoId).eq("equipe", origem.nome),
      supabase.from("solicitacoes_equipe_evento").update({ equipe_id: destino.id, equipe_nome: destino.nome, atualizado_em: new Date().toISOString() }).eq("evento_id", eventoId).eq("equipe_id", origem.id),
      supabase.from("chaves").update({ equipe_1: destino.nome }).eq("evento_id", eventoId).eq("equipe_1", origem.nome),
      supabase.from("chaves").update({ equipe_2: destino.nome }).eq("evento_id", eventoId).eq("equipe_2", origem.nome),
    ]);
    const { error } = await supabase.from("equipes_evento").delete().eq("id", origem.id).eq("evento_id", eventoId);
    if (error) return NextResponse.json({ error: "As inscrições foram unificadas, mas a equipe duplicada não pôde ser removida." }, { status: 409 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: "Entre com a conta do organizador." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const eventoId = limpar(body.eventoId);
  const tipo = limpar(body.tipo);
  const id = limpar(body.id);
  if (!eventoId || !tipo || !id) return NextResponse.json({ error: "Informe a equipe ou a academia." }, { status: 400 });
  const supabase = await autorizarOrganizador(eventoId, usuario.id);
  if (!supabase) return NextResponse.json({ error: "Campeonato não autorizado." }, { status: 403 });

  if (tipo === "equipe") {
    const { data: atual } = await supabase.from("equipes_evento").select("id,nome").eq("id", id).eq("evento_id", eventoId).maybeSingle();
    if (!atual) return NextResponse.json({ error: "Equipe não encontrada." }, { status: 404 });
    await supabase.from("inscricoes").update({ equipe_id: null }).eq("evento_id", eventoId).eq("equipe_id", id);
    await supabase.from("solicitacoes_equipe_evento").update({ status: "recusada", equipe_id: null, atualizado_em: new Date().toISOString() }).eq("evento_id", eventoId).eq("equipe_id", id);
    const { error } = await supabase.from("equipes_evento").delete().eq("id", id).eq("evento_id", eventoId);
    if (error) return NextResponse.json({ error: error.code === "23503" ? "Esta equipe ainda está vinculada a inscrições ou chaves e foi preservada." : error.message }, { status: 409 });
    return NextResponse.json({ success: true });
  }

  if (tipo === "academia") {
    const equipeId = id.startsWith("equipe-") ? id.slice(7) : limpar(body.equipeId);
    if (!equipeId) return NextResponse.json({ error: "Academia sem equipe vinculada." }, { status: 400 });
    const { data: equipe } = await supabase.from("equipes_evento").select("id,academia,professor,cidade").eq("id", equipeId).eq("evento_id", eventoId).maybeSingle();
    if (!equipe) return NextResponse.json({ error: "Equipe não encontrada." }, { status: 404 });
    if (id.startsWith("equipe-")) {
      const { data: restantes } = await supabase.from("solicitacoes_equipe_evento")
        .select("academia,professor,cidade").eq("evento_id", eventoId).eq("equipe_id", equipeId).eq("status", "aprovada");
      const proxima = (restantes || [])[0];
      const { error } = await supabase.from("equipes_evento").update({
        academia: proxima?.academia || "",
        professor: proxima?.professor || "",
        cidade: proxima?.cidade || "",
      }).eq("id", equipeId).eq("evento_id", eventoId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { data: unidade, error: unidadeError } = await supabase.from("solicitacoes_equipe_evento")
        .update({ status: "recusada", equipe_id: null, atualizado_em: new Date().toISOString() })
        .eq("id", id).eq("evento_id", eventoId)
        .select("id,academia,professor").maybeSingle();
      if (unidadeError || !unidade) return NextResponse.json({ error: unidadeError?.message || "Academia não encontrada." }, { status: 404 });
      const { data: restantes } = await supabase.from("solicitacoes_equipe_evento")
        .select("academia,professor,cidade").eq("evento_id", eventoId).eq("equipe_id", equipeId).eq("status", "aprovada");
      const proxima = (restantes || [])[0];
      if (!proxima || equipe.academia === unidade.academia || equipe.professor === unidade.professor) {
        await supabase.from("equipes_evento").update({
          academia: proxima?.academia || "",
          professor: proxima?.professor || "",
          cidade: proxima?.cidade || "",
        }).eq("id", equipeId).eq("evento_id", eventoId);
      }
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
}
