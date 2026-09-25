import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

const CAMPOS_TEXTO = ["nome", "telefone", "documento", "cep", "endereco", "cidade", "estado", "bio"] as const;
const LIMITE_CAMPO = 500;

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

export async function PATCH(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const { data: fotografo, error: fotografoError } = await supabase
      .from("fotografos")
      .select("id, status")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (fotografoError) throw new Error(fotografoError.message);
    if (!fotografo) return NextResponse.json({ error: "Perfil de fotógrafo não encontrado." }, { status: 404 });

    const body = await request.json();
    const dados = Object.fromEntries(
      CAMPOS_TEXTO.map((campo) => [campo, String(body[campo] ?? "").trim().slice(0, LIMITE_CAMPO)]),
    ) as Record<(typeof CAMPOS_TEXTO)[number], string>;
    dados.estado = dados.estado.toUpperCase().slice(0, 2);

    if (!dados.nome || !dados.telefone || !dados.documento) {
      return NextResponse.json({ error: "Nome, WhatsApp e CPF são obrigatórios." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("fotografos")
      .update({
        ...dados,
        perfil_completo: true,
        ...(fotografo.status === "pendente" ? { status: "ativo" } : {}),
      })
      .eq("id", fotografo.id)
      .select("id, nome, email, foto_url, telefone, documento, cep, endereco, cidade, estado, bio, perfil_completo, status, mp_connected_at, mp_user_id")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ perfil: data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar o perfil." },
      { status: 500 },
    );
  }
}
