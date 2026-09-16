import { NextResponse } from "next/server";
import { autenticarRequest } from "@/app/lib/api-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: "Entre com uma conta de professor." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const eventoId = String(body.eventoId || "").trim();
  const nome = String(body.nome || "").trim();
  const academia = String(body.academia || "").trim();
  const professor = String(body.professor || "").trim();
  const cidade = String(body.cidade || "").trim();
  if (!eventoId || !nome || !professor || [nome, academia, professor, cidade].some(item => item.length > 120)) {
    return NextResponse.json({ error: "Informe equipe e professor (até 120 caracteres por campo)." }, { status: 400 });
  }
  const supabase = createSupabaseServerClient();
  const [{ data: perfil }, { data: evento }] = await Promise.all([
    supabase.from("atletas").select("role").eq("user_id", usuario.id).maybeSingle(),
    supabase.from("eventos").select("id").eq("id", eventoId).maybeSingle(),
  ]);
  if (perfil?.role !== "professor") return NextResponse.json({ error: "Somente professores podem cadastrar equipes." }, { status: 403 });
  if (!evento) return NextResponse.json({ error: "Campeonato não encontrado." }, { status: 404 });

  const { data: anterior } = await supabase.from("solicitacoes_equipe_evento")
    .select("id,status,equipe_id").eq("evento_id", eventoId).eq("professor_user_id", usuario.id).maybeSingle();
  if (anterior?.status === "aprovada" && anterior.equipe_id) {
    return NextResponse.json({ error: "Sua equipe já foi cadastrada neste campeonato." }, { status: 409 });
  }

  const { data: existentes, error: buscaError } = await supabase.from("equipes_evento")
    .select("id,nome").eq("evento_id", eventoId).ilike("nome", nome).limit(10);
  if (buscaError) return NextResponse.json({ error: "Não foi possível conferir as equipes." }, { status: 500 });
  if ((existentes || []).some(item => item.nome.trim().toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
    return NextResponse.json({ error: "Esta equipe já existe no campeonato e pode ser selecionada pelos atletas." }, { status: 409 });
  }

  const { data: equipe, error: equipeError } = await supabase.from("equipes_evento")
    .insert({ evento_id: eventoId, nome, academia, professor, cidade, ativa: true })
    .select("id").single();
  if (equipeError) return NextResponse.json({ error: equipeError.code === "23505" ? "Esta equipe já existe no campeonato." : equipeError.message }, { status: 409 });

  const registro = { evento_id: eventoId, professor_user_id: usuario.id, equipe_nome: nome, academia, professor, cidade,
    status: "aprovada", equipe_id: equipe.id, atualizado_em: new Date().toISOString() };
  const resultado = anterior
    ? await supabase.from("solicitacoes_equipe_evento").update(registro).eq("id", anterior.id)
    : await supabase.from("solicitacoes_equipe_evento").insert(registro);
  if (resultado.error) {
    await supabase.from("equipes_evento").delete().eq("id", equipe.id);
    return NextResponse.json({ error: "Não foi possível vincular a equipe ao professor." }, { status: 500 });
  }
  return NextResponse.json({ success: true, equipeId: equipe.id });
}
