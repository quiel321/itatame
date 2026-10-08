import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { obterFotografoDoUsuario } from "@/app/lib/fotos-auth";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function contexto(request: Request, eventoId: string) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !UUID.test(eventoId)) return null;
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth.user) return null;
  const dono = await obterFotografoDoUsuario(supabase, auth.user.id);
  if (!dono || dono.status !== "ativo") return null;
  const { data: evento } = await supabase.from("foto_eventos")
    .select("id").eq("id", eventoId).eq("created_by", auth.user.id)
    .is("organizador_user_id", null).neq("status", "arquivado").maybeSingle();
  return evento ? { supabase, dono, userId: auth.user.id } : null;
}

export async function GET(request: Request) {
  const eventoId = new URL(request.url).searchParams.get("eventoId") || "";
  const ctx = await contexto(request, eventoId);
  if (!ctx) return NextResponse.json({ error: "Álbum não encontrado ou acesso negado." }, { status: 403 });
  const { data: vinculos, error } = await ctx.supabase.from("foto_evento_fotografos")
    .select("fotografo_id, status").eq("evento_id", eventoId).neq("fotografo_id", ctx.dono.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (vinculos || []).map((item) => item.fotografo_id);
  const { data: perfis } = ids.length ? await ctx.supabase.from("fotografos").select("id, nome, email")
    .in("id", ids) : { data: [] };
  return NextResponse.json({ parceiros: (vinculos || []).map((item) => ({
    fotografoId: item.fotografo_id, status: item.status,
    nome: perfis?.find((perfil) => perfil.id === item.fotografo_id)?.nome || "Fotógrafo",
    email: perfis?.find((perfil) => perfil.id === item.fotografo_id)?.email || "",
  })) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const eventoId = String(body?.eventoId || "");
  const email = String(body?.email || "").trim().toLowerCase();
  const ctx = await contexto(request, eventoId);
  if (!ctx) return NextResponse.json({ error: "Álbum não encontrado ou acesso negado." }, { status: 403 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  const { data: parceiro } = await ctx.supabase.from("fotografos").select("id, status")
    .eq("email", email).maybeSingle();
  if (!parceiro || parceiro.status !== "ativo") return NextResponse.json({ error: "Fotógrafo ativo não encontrado. Ele precisa cadastrar-se antes." }, { status: 404 });
  if (parceiro.id === ctx.dono.id) return NextResponse.json({ error: "Você já é o responsável por este álbum." }, { status: 400 });
  const { error } = await ctx.supabase.from("foto_evento_fotografos").upsert({
    evento_id: eventoId, fotografo_id: parceiro.id, status: "ativo", convidado_por: ctx.userId,
    comissao_organizador_percentual: 0, modelo_recebimento: "royalty",
  }, { onConflict: "evento_id,fotografo_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const eventoId = String(body?.eventoId || "");
  const fotografoId = String(body?.fotografoId || "");
  const ctx = await contexto(request, eventoId);
  if (!ctx || !UUID.test(fotografoId) || fotografoId === ctx.dono.id) {
    return NextResponse.json({ error: "Álbum não encontrado ou acesso negado." }, { status: 403 });
  }
  const { error } = await ctx.supabase.from("foto_evento_fotografos").update({ status: "suspenso" })
    .eq("evento_id", eventoId).eq("fotografo_id", fotografoId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
