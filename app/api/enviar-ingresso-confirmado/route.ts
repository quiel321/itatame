import { NextResponse } from "next/server";
import { enviarEmailIngressoConfirmado } from "@/app/lib/email-ingresso";
import { autenticarRequest } from "@/app/lib/api-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { usuarioGerenciaInscricao } from "@/app/lib/inscricao-autorizacao";

export async function POST(request: Request) {
  try {
    const usuario = await autenticarRequest(request);
    if (!usuario) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const { inscricaoId } = await request.json();

    if (!inscricaoId) {
      return NextResponse.json({ error: "Informe o ID da inscricao." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: inscricao } = await supabase
      .from("inscricoes")
      .select("id, user_id, eventos ( organizador_id )")
      .eq("id", inscricaoId)
      .maybeSingle();
    const evento = Array.isArray(inscricao?.eventos) ? inscricao.eventos[0] : inscricao?.eventos;
    if (!inscricao || (inscricao.user_id !== usuario.id && evento?.organizador_id !== usuario.id
      && !(await usuarioGerenciaInscricao(supabase, usuario.id, inscricao.user_id)))) {
      return NextResponse.json({ error: "Inscrição não autorizada." }, { status: 403 });
    }

    const resultado = await enviarEmailIngressoConfirmado({
      inscricaoId,
      forcarReenvio: true,
    });

    if (!resultado.success) {
      return NextResponse.json({ error: "Não foi possível enviar o passaporte.", resultado }, { status: 502 });
    }

    return NextResponse.json({ success: true, resultado });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao enviar ingresso." }, { status: 500 });
  }
}
