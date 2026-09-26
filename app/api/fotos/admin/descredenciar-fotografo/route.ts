import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const eventoId = String(body?.eventoId || "");
  const fotografoId = String(body?.fotografoId || "");
  if (!eventoId || !fotografoId) return NextResponse.json({ error: "Informe a galeria e o fotógrafo." }, { status: 400 });

  const { data: evento, error: eventoError } = await supabase.from("foto_eventos")
    .select("id").eq("id", eventoId).eq("organizador_user_id", auth.user.id).maybeSingle();
  if (eventoError || !evento) return NextResponse.json({ error: "Você não administra esta galeria." }, { status: 403 });

  const { data: vinculo, error } = await supabase.from("foto_evento_fotografos")
    .update({ status: "suspenso" })
    .eq("evento_id", eventoId).eq("fotografo_id", fotografoId).eq("status", "ativo")
    .select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!vinculo) return NextResponse.json({ error: "Fotógrafo não está credenciado nesta galeria." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
