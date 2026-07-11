import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { fotografoPodePublicarNoEvento, obterFotografoDoUsuario } from "@/app/lib/fotos-auth";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessario." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });

    const { eventoId, titulo } = await request.json();
    if (!eventoId || !String(titulo || "").trim()) return NextResponse.json({ error: "Informe evento e titulo." }, { status: 400 });

    const fotografo = await obterFotografoDoUsuario(supabase, auth.user.id);
    if (!fotografo || fotografo.status !== "ativo") {
      return NextResponse.json({ error: "Perfil de fotógrafo não encontrado ou inativo." }, { status: 403 });
    }

    const { data: evento } = await supabase
      .from("foto_eventos")
      .select("id, status")
      .eq("id", eventoId)
      .maybeSingle();
    if (!evento || evento.status !== "publicado") {
      return NextResponse.json({ error: "Evento de fotos indisponível." }, { status: 404 });
    }

    if (!(await fotografoPodePublicarNoEvento(supabase, eventoId, fotografo.id))) {
      return NextResponse.json({ error: "Fotógrafo não credenciado para este evento." }, { status: 403 });
    }
    const { data, error } = await supabase
      .from("foto_albuns")
      .insert({ evento_id: eventoId, fotografo_id: fotografo.id, titulo: String(titulo).trim(), status: "publicado" })
      .select("id, evento_id, fotografo_id, titulo, descricao, capa_url, status")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ album: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao criar álbum.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
