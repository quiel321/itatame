import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { emailPossuiCompras, gerarAcessoPorEmail, normalizarEmail } from "@/app/lib/fotos-convidado";
import { enviarEmailAcessoRetratt } from "@/app/lib/email-fotos";
import { consumirLimiteAuth, ipDaRequisicao } from "@/app/lib/limite-auth";

export const runtime = "nodejs";

const respostaGenerica = "Se houver compras com este e-mail, enviaremos um código de acesso em instantes.";

function destinoSeguro(valor: unknown) {
  const destino = typeof valor === "string" ? valor : "";
  return destino.startsWith("/fotos/") && !destino.startsWith("//") ? destino : "/fotos/minhas-compras";
}

export async function POST(request: Request) {
  let email = "";
  let destino = "/fotos/minhas-compras";
  try {
    const body = await request.json();
    email = normalizarEmail(body.email);
    destino = destinoSeguro(body.next);
  } catch {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  if (!email) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });

  if (!consumirLimiteAuth(`retratt-acesso:${email}`, 1, 60_000)
    || !consumirLimiteAuth(`retratt-acesso-ip:${ipDaRequisicao(request)}`, 10, 5 * 60_000)) {
    return NextResponse.json({ error: "Aguarde um minuto antes de pedir outro código." }, { status: 429 });
  }

  const supabase = createSupabaseServerClient();
  // Sem compras não há conta a acessar; gerar o link aqui criaria uma conta vazia.
  if (!(await emailPossuiCompras(supabase, email))) return NextResponse.json({ message: respostaGenerica });

  try {
    const { codigo, link } = await gerarAcessoPorEmail(supabase, email, destino);
    await enviarEmailAcessoRetratt({ email, codigo, link });
  } catch (error) {
    console.error("Falha ao enviar acesso Retratt:", error);
    return NextResponse.json({ error: "Não foi possível enviar o código agora. Tente novamente." }, { status: 503 });
  }
  return NextResponse.json({ message: respostaGenerica });
}
