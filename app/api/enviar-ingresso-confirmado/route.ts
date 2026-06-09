import { NextResponse } from "next/server";
import { enviarEmailIngressoConfirmado } from "@/app/lib/email-ingresso";

export async function POST(request: Request) {
  try {
    const { inscricaoId, email } = await request.json();

    if (!inscricaoId) {
      return NextResponse.json({ error: "Informe o ID da inscricao." }, { status: 400 });
    }

    const resultado = await enviarEmailIngressoConfirmado({
      inscricaoId,
      emailFallback: email,
    });

    return NextResponse.json({ success: true, resultado });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao enviar ingresso." }, { status: 500 });
  }
}