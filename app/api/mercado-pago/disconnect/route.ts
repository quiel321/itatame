import { NextResponse } from "next/server";
import { autenticarRequest } from "@/app/lib/api-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("organizadores").update({
    mp_access_token: null,
    mp_refresh_token: null,
    mp_public_key: null,
    mp_user_id: null,
    mp_token_expires_at: null,
    mp_connected_at: null,
    mp_scope: null,
    mp_live_mode: false,
    mp_parcelamento_comprador_confirmado: false,
  }).eq("user_id", usuario.id).select("id").maybeSingle();

  if (error) {
    console.error("Erro ao desvincular Mercado Pago do organizador:", error);
    return NextResponse.json({ error: "Não foi possível desvincular o Mercado Pago." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Organizador não encontrado." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
