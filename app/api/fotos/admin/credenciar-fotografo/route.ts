import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const body = await request.json();
    const eventoId = String(body.eventoId || "");
    const email = String(body.email || "").trim().toLowerCase();
    if (!eventoId || !email) {
      return NextResponse.json({ error: "Informe a galeria e o e-mail do fotógrafo." }, { status: 400 });
    }

    const { data: evento } = await supabase
      .from("foto_eventos")
      .select("id, organizador_user_id")
      .eq("id", eventoId)
      .maybeSingle();
    if (!evento) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
    if (evento.organizador_user_id !== auth.user.id) {
      return NextResponse.json({ error: "Você não administra esta galeria." }, { status: 403 });
    }

    const { data: fotografo } = await supabase
      .from("fotografos")
      .select("id, nome, email, status")
      .eq("email", email)
      .maybeSingle();
    if (!fotografo || fotografo.status !== "ativo") {
      return NextResponse.json({ error: "Fotógrafo não encontrado ou inativo." }, { status: 404 });
    }

    const { data: credencial, error } = await supabase
      .from("foto_evento_fotografos")
      .upsert(
        {
          evento_id: eventoId,
          fotografo_id: fotografo.id,
          status: "ativo",
          convidado_por: auth.user.id,
        },
        { onConflict: "evento_id,fotografo_id" },
      )
      .select("id, status")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ credencial, fotografo: { nome: fotografo.nome, email: fotografo.email } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao credenciar fotógrafo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
