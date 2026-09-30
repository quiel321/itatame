import "server-only";
import { NextResponse } from "next/server";
import { autenticarRequest } from "@/app/lib/api-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const { atletaUserId } = await request.json().catch(() => ({}));
  const alvo = String(atletaUserId || usuario.id);
  const db = createSupabaseServerClient();
  const { data: perfil, error: erroPerfil } = await db.from("atletas")
    .select("user_id,nome,responsavel_id").eq("user_id", alvo).maybeSingle();
  if (erroPerfil || !perfil) return NextResponse.json({ error: "Cadastro do atleta não encontrado." }, { status: 404 });
  if (perfil.user_id !== usuario.id && perfil.responsavel_id !== usuario.id) {
    return NextResponse.json({ error: "Você não gerencia este atleta." }, { status: 403 });
  }
  const nomeAtual = String(perfil.nome || "").trim();
  if (!nomeAtual) return NextResponse.json({ error: "O nome do cadastro está vazio." }, { status: 409 });

  const hoje = new Date().toISOString().slice(0, 10);
  const { data: inscricoes, error: erroInscricoes } = await db.from("inscricoes")
    .select("id,evento_id,atleta,pagamento_ok,mp_payment_id,eventos(data_evento)")
    .eq("user_id", alvo).neq("atleta", nomeAtual);
  if (erroInscricoes) return NextResponse.json({ error: "Não foi possível conferir as inscrições." }, { status: 500 });
  const futuras = (inscricoes || []).filter((insc) => {
    const evento = Array.isArray(insc.eventos) ? insc.eventos[0] : insc.eventos;
    return evento?.data_evento && String(evento.data_evento).slice(0, 10) >= hoje;
  });
  if (!futuras.length) return NextResponse.json({ atualizadas: 0, pendentesRevisao: 0 });

  const pendentesRevisao = futuras.filter(insc => insc.pagamento_ok || insc.mp_payment_id).length;
  const semPagamento = futuras.filter(insc => !insc.pagamento_ok && !insc.mp_payment_id);
  if (!semPagamento.length) return NextResponse.json({ atualizadas: 0, pendentesRevisao });

  const eventoIds = [...new Set(semPagamento.map(insc => insc.evento_id))];
  const { data: chaves, error: erroChaves } = await db.from("chaves")
    .select("evento_id").in("evento_id", eventoIds);
  if (erroChaves) return NextResponse.json({ error: "Não foi possível conferir as chaves. Nenhum nome foi alterado." }, { status: 500 });
  const eventosComChaves = new Set((chaves || []).map(chave => chave.evento_id));
  let atualizadas = 0;
  for (const inscricao of semPagamento) {
    if (eventosComChaves.has(inscricao.evento_id)) continue;
    const { data, error } = await db.from("inscricoes").update({ atleta: nomeAtual })
      .eq("id", inscricao.id).eq("user_id", alvo).eq("atleta", inscricao.atleta).select("id");
    if (error) return NextResponse.json({ error: `Cadastro salvo; ${atualizadas} inscrição(ões) atualizada(s), mas outra atualização falhou.` }, { status: 500 });
    atualizadas += data?.length || 0;
  }
  return NextResponse.json({ atualizadas, pendentesRevisao, ignoradasComChaves: semPagamento.length - atualizadas });
}
