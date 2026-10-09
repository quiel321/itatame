import { NextResponse } from "next/server";
import { autenticarRequest } from "@/app/lib/api-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { ErroRetiradaCortesia, retirarCortesia } from "@/app/lib/retirar-cortesia";

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: "Entre com a conta do organizador." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const inscricaoId = String(body.inscricaoId || "");
  if (!/^\d+$/.test(inscricaoId)) return NextResponse.json({ error: "Informe a inscrição." }, { status: 400 });
  try {
    const inscricao = await retirarCortesia(createSupabaseServerClient(), usuario.id, inscricaoId);
    return NextResponse.json({ success: true, inscricao });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível retirar a cortesia." }, { status: error instanceof ErroRetiradaCortesia ? error.status : 500 });
  }
}
