import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();
  const { data: organizador } = await supabase.from("organizadores")
    .select("nome,foto_url,status").eq("user_id", id).maybeSingle();
  if (!organizador || !["aprovado", "ativo"].includes(organizador.status)) {
    return NextResponse.json({ error: "Organizador não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ nome: organizador.nome, foto_url: organizador.foto_url });
}
