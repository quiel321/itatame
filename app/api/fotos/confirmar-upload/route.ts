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
    if (!token) return NextResponse.json({ error: "Login necessario." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });

    const { fotoId } = await request.json();
    if (!fotoId) return NextResponse.json({ error: "Foto nao informada." }, { status: 400 });

    const { data: fotografo } = await supabase.from("fotografos").select("id").eq("user_id", auth.user.id).maybeSingle();
    if (!fotografo) return NextResponse.json({ error: "Fotografo nao encontrado." }, { status: 403 });

    const { data, error } = await supabase
      .from("foto_arquivos")
      .update({ status: "publicada" })
      .eq("id", fotoId)
      .eq("fotografo_id", fotografo.id)
      .select("id, status")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ foto: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao confirmar upload." }, { status: 500 });
  }
}
