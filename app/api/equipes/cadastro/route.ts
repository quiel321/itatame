import { NextResponse } from "next/server";
import { autenticarRequest } from "@/app/lib/api-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

function nomesIguais(a: string, b: string) {
  return a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");
}

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: "Entre com uma conta de professor." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const eventoId = String(body.eventoId || "").trim();
  const equipeIdInformada = String(body.equipeId || "").trim();
  const nome = String(body.nome || "").trim();
  const academia = String(body.academia || "").trim();
  const professor = String(body.professor || "").trim();
  const cidade = String(body.cidade || "").trim();
  if (!eventoId || !professor || [nome, academia, professor, cidade, equipeIdInformada].some(item => item.length > 120)) {
    return NextResponse.json({ error: "Informe equipe e professor (até 120 caracteres por campo)." }, { status: 400 });
  }
  if (!equipeIdInformada && !nome) {
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

  const { data: equipesEvento, error: buscaError } = await supabase.from("equipes_evento")
    .select("id,nome").eq("evento_id", eventoId);
  if (buscaError) return NextResponse.json({ error: "Não foi possível conferir as equipes." }, { status: 500 });

  const destino = equipeIdInformada
    ? (equipesEvento || []).find(item => item.id === equipeIdInformada) || null
    : (equipesEvento || []).find(item => nomesIguais(item.nome, nome)) || null;
  if (equipeIdInformada && !destino) {
    return NextResponse.json({ error: "Esta equipe não está neste campeonato." }, { status: 404 });
  }

  if (destino) {
    const erroVinculo = await vincularProfessor(supabase, {
      anteriorId: anterior?.id,
      eventoId,
      professorUserId: usuario.id,
      equipe: destino,
      academia,
      professor,
      cidade,
    });
    if (erroVinculo) return NextResponse.json({ error: "Não foi possível vincular a equipe ao professor." }, { status: 500 });
    return NextResponse.json({ success: true, equipeId: destino.id, entrou: true });
  }

  const { data: equipe, error: equipeError } = await supabase.from("equipes_evento")
    .insert({ evento_id: eventoId, nome, academia, professor, cidade, ativa: true })
    .select("id,nome").single();
  if (equipeError) {
    if (equipeError.code === "23505") {
      const { data: existentes } = await supabase.from("equipes_evento").select("id,nome").eq("evento_id", eventoId);
      const concorrente = (existentes || []).find(item => nomesIguais(item.nome, nome));
      if (concorrente) {
        const erroVinculo = await vincularProfessor(supabase, {
          anteriorId: anterior?.id,
          eventoId,
          professorUserId: usuario.id,
          equipe: concorrente,
          academia,
          professor,
          cidade,
        });
        if (!erroVinculo) return NextResponse.json({ success: true, equipeId: concorrente.id, entrou: true });
      }
      return NextResponse.json({ error: "Esta equipe já existe no campeonato." }, { status: 409 });
    }
    return NextResponse.json({ error: equipeError.message }, { status: 409 });
  }

  const erroVinculo = await vincularProfessor(supabase, {
    anteriorId: anterior?.id,
    eventoId,
    professorUserId: usuario.id,
    equipe,
    academia,
    professor,
    cidade,
  });
  if (erroVinculo) {
    await supabase.from("equipes_evento").delete().eq("id", equipe.id);
    return NextResponse.json({ error: "Não foi possível vincular a equipe ao professor." }, { status: 500 });
  }
  return NextResponse.json({ success: true, equipeId: equipe.id, entrou: false });
}

async function vincularProfessor(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  dados: {
    anteriorId?: string;
    eventoId: string;
    professorUserId: string;
    equipe: { id: string; nome: string };
    academia: string;
    professor: string;
    cidade: string;
  },
) {
  const registro = {
    evento_id: dados.eventoId,
    professor_user_id: dados.professorUserId,
    equipe_nome: dados.equipe.nome,
    academia: dados.academia,
    professor: dados.professor,
    cidade: dados.cidade,
    status: "aprovada",
    equipe_id: dados.equipe.id,
    atualizado_em: new Date().toISOString(),
  };
  const resultado = dados.anteriorId
    ? await supabase.from("solicitacoes_equipe_evento").update(registro).eq("id", dados.anteriorId)
    : await supabase.from("solicitacoes_equipe_evento").insert(registro);
  return resultado.error;
}
