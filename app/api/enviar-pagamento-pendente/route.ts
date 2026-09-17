import { NextResponse } from "next/server";
import { autenticarRequest } from "@/app/lib/api-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { enviarEmailPagamentoPendente } from "@/app/lib/email-pagamento-pendente";

export async function POST(request: Request) {
  try {
    const usuario = await autenticarRequest(request);
    if (!usuario) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const { inscricaoId, ticketUrl, meio } = await request.json();
    if (!inscricaoId) return NextResponse.json({ error: "Informe o ID da inscrição." }, { status: 400 });

    const supabase = createSupabaseServerClient();
    const { data: inscricao } = await supabase
      .from("inscricoes")
      .select("id, user_id")
      .eq("id", inscricaoId)
      .maybeSingle();
    if (!inscricao) return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });

    if (inscricao.user_id !== usuario.id) {
      const { data: atleta } = await supabase.from("atletas").select("responsavel_id").eq("user_id", inscricao.user_id).maybeSingle();
      if (atleta?.responsavel_id !== usuario.id) {
        return NextResponse.json({ error: "Inscrição não autorizada." }, { status: 403 });
      }
    }

    const resultado = await enviarEmailPagamentoPendente({
      inscricaoId,
      emailFallback: usuario.email,
      ticketUrl,
      meio: meio === "boleto" || meio === "pix" ? meio : "inscricao",
    });

    return NextResponse.json({ success: Boolean(resultado.success), resultado });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao enviar e-mail." }, { status: 500 });
  }
}
