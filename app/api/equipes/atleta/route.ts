import { NextResponse } from "next/server";
import { autenticarRequest } from "@/app/lib/api-auth";
import { encontrarEquipeSemelhante } from "@/app/lib/equipes-nome";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: "Entre na sua conta para escolher a equipe." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const eventoId = String(body.eventoId || "").trim();
  const atletaId = Number(body.atletaId);
  if (!eventoId || !Number.isSafeInteger(atletaId) || atletaId <= 0) {
    return NextResponse.json({ error: "Campeonato ou atleta inválido." }, { status: 400 });
  }
  const db = createSupabaseServerClient();
  const [{ data: evento, error: erroEvento }, { data: atleta, error: erroAtleta }] = await Promise.all([
    db.from("eventos").select("id").eq("id", eventoId).maybeSingle(),
    db.from("atletas").select("id,user_id,responsavel_id,equipe,professor").eq("id", atletaId).maybeSingle(),
  ]);
  if (erroEvento || !evento || erroAtleta || !atleta) return NextResponse.json({ error: "Campeonato ou atleta não encontrado." }, { status: 404 });
  if (atleta.user_id !== usuario.id && atleta.responsavel_id !== usuario.id) {
    return NextResponse.json({ error: "Você não pode alterar a equipe deste atleta." }, { status: 403 });
  }
  if (!String(atleta.professor || '').trim()) {
    return NextResponse.json({ error: "Informe o professor no perfil do atleta antes de concluir a inscrição." }, { status: 400 });
  }
  const nome = String(atleta.equipe || "").trim();
  if (!nome || nome.length > 120) return NextResponse.json({ error: "Informe uma equipe válida no cadastro do atleta." }, { status: 400 });

  const { data: equipes, error: erroBusca } = await db.from("equipes_evento")
    .select("id,nome,ativa").eq("evento_id", eventoId);
  if (erroBusca) return NextResponse.json({ error: "Não foi possível conferir as equipes do campeonato." }, { status: 500 });
  const existente = encontrarEquipeSemelhante(equipes || [], nome);
  if (existente) {
    if (!existente.ativa) return NextResponse.json({ error: "Esta equipe está desativada no campeonato. Procure a organização." }, { status: 409 });
    return NextResponse.json({ equipeId: existente.id, nome: existente.nome });
  }

  const { data: criada, error: erroCriacao } = await db.from("equipes_evento")
    .insert({ evento_id: eventoId, nome, academia: "", professor: "", cidade: "", ativa: true })
    .select("id,nome").single();
  if (criada) return NextResponse.json({ equipeId: criada.id, nome: criada.nome });
  if (erroCriacao?.code === "23505") {
    const { data: atuais } = await db.from("equipes_evento").select("id,nome,ativa").eq("evento_id", eventoId);
    const concorrente = encontrarEquipeSemelhante(atuais || [], nome);
    if (concorrente?.ativa) return NextResponse.json({ equipeId: concorrente.id, nome: concorrente.nome });
  }
  return NextResponse.json({ error: erroCriacao?.message || "Não foi possível cadastrar a equipe." }, { status: 409 });
}
