import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const pedidoId = new URL(request.url).searchParams.get("pedido_id");
  if (!pedidoId) return NextResponse.json({ error: "Pedido não informado." }, { status: 400 });

  const { data: pedido } = await supabase
    .from("foto_pedidos")
    .select("id, status, provedor_status_detail, pago_em")
    .eq("id", pedidoId)
    .eq("comprador_user_id", auth.user.id)
    .maybeSingle();
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  return NextResponse.json(pedido);
}

