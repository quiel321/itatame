import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

async function garantirFotografo(supabase: ReturnType<typeof createSupabaseServerClient>, user: any) {
  let { data: fotografo } = await supabase.from("fotografos").select("id").eq("user_id", user.id).maybeSingle();
  if (fotografo) return fotografo;

  const nome = user.user_metadata?.nome_completo || user.user_metadata?.nome || user.email?.split("@")[0] || "Fotógrafo";
  const { data, error } = await supabase
    .from("fotografos")
    .insert({ user_id: user.id, nome, email: user.email, status: "ativo" })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message || "Nao foi possivel criar fotografo.");
  return data;
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

    const fotografo = await garantirFotografo(supabase, auth.user);
    const { data, error } = await supabase
      .from("foto_albuns")
      .insert({ evento_id: eventoId, fotografo_id: fotografo.id, titulo: String(titulo).trim(), status: "publicado" })
      .select("id, evento_id, fotografo_id, titulo, descricao, capa_url, status")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ album: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao criar album." }, { status: 500 });
  }
}
