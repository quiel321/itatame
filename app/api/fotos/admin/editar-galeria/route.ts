import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

export async function PATCH(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const body = await request.json();
  const galeriaId = String(body.galeriaId || "");
  const nome = String(body.nome || "").trim();
  const status = ["rascunho", "publicado", "arquivado"].includes(body.status) ? body.status : "publicado";
  const capaUrl = String(body.capaUrl || "").trim() || null;
  if (!galeriaId || !nome) return NextResponse.json({ error: "Informe a galeria e o nome." }, { status: 400 });

  const { data, error } = await supabase.from("foto_eventos").update({ nome, status, capa_url: capaUrl }).eq("id", galeriaId).eq("organizador_user_id", auth.user.id).select("id, nome, evento_id, status, capa_url, preco_padrao_centavos, desconto_combo_qtd, desconto_combo_percentual").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Galeria não encontrada ou sem permissão." }, { status: 403 });
  return NextResponse.json({ galeria: data });
}
