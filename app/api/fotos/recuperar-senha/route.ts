import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { consumirLimiteAuth, ipDaRequisicao } from "@/app/lib/limite-auth";

export const runtime = "nodejs";

const resposta = "Se este e-mail estiver cadastrado, você receberá um link para criar outra senha.";

export async function POST(request: Request) {
  let email: string;
  let perfil: string;
  let next: string;
  try {
    const body = await request.json();
    email = String(body.email || "").trim().toLowerCase();
    perfil = ["comprador", "fotografo", "organizador"].includes(body.perfil) ? body.perfil : "comprador";
    next = typeof body.next === "string" && body.next.startsWith("/fotos/") && !body.next.startsWith("//") ? body.next : "";
  } catch {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Recuperação indisponível no momento." }, { status: 503 });
  }
  if (!consumirLimiteAuth(`retratt-recuperar:${email}`, 1, 60_000)
    || !consumirLimiteAuth(`retratt-recuperar-ip:${ipDaRequisicao(request)}`, 15, 5 * 60_000)) {
    return NextResponse.json({ message: resposta });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data?.properties?.hashed_token) return NextResponse.json({ message: resposta });

  const url = new URL("/nova-senha", process.env.NEXT_PUBLIC_FOTOS_URL || "https://retratt.com");
  url.search = new URLSearchParams({ origem: "fotos", perfil, token_hash: data.properties.hashed_token, ...(next ? { next } : {}) }).toString();
  if (url.protocol !== "https:") return NextResponse.json({ error: "Recuperação indisponível no momento." }, { status: 503 });
  const link = url.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  try {
    const { error: envioError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: "Retratt <suporte@itatame.com.br>",
      to: [email],
      subject: "Recuperar sua senha na Retratt",
      html: `<div style="background:#0a0a0a;color:#fff;font-family:Arial,sans-serif;padding:32px;max-width:560px;margin:auto"><h1 style="color:#ff5a1f">Retratt</h1><p>Recebemos um pedido para criar uma nova senha da sua conta Retratt.</p><p><a href="${link}" style="display:inline-block;background:#ff5a1f;color:#000;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Criar nova senha</a></p><p style="color:#aaa;font-size:12px">Se você não solicitou esta alteração, ignore este e-mail.</p></div>`,
    });
    if (envioError) throw envioError;
  } catch (envioError) {
    console.error("Falha ao enviar recuperação Retratt:", envioError);
    return NextResponse.json({ error: "Não foi possível enviar o e-mail agora. Tente novamente mais tarde." }, { status: 503 });
  }
  return NextResponse.json({ message: resposta });
}
