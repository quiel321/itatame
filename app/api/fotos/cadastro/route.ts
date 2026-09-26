import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { consumirLimiteAuth, ipDaRequisicao } from "@/app/lib/limite-auth";

export const runtime = "nodejs";

type Perfil = "comprador" | "fotografo" | "organizador";

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[caractere] || caractere);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const nome = String(body.nome || "").trim();
    const perfil = String(body.perfil || "") as Perfil;
    const next = String(body.next || "");
    if (!nome || nome.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || !["comprador", "fotografo", "organizador"].includes(perfil)) {
      return NextResponse.json({ error: "Informe nome, e-mail válido e senha de pelo menos 6 caracteres." }, { status: 400 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Cadastro temporariamente indisponível." }, { status: 503 });
    }
    if (!consumirLimiteAuth(`cadastro-fotos:${ipDaRequisicao(request)}`, 20, 5 * 60_000)) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: false,
      user_metadata: { nome_completo: nome, foto_perfil: perfil },
    });
    if (error || !data.user) {
      return NextResponse.json({ error: "Não foi possível criar a conta. Se este e-mail já estiver em uso, entre ou recupere a senha." }, { status: 400 });
    }

    try {
      const destino = new URLSearchParams({ perfil, email_confirmado: "1" });
      if (next.startsWith("/") && !next.startsWith("//")) destino.set("next", next);
      const redirectTo = `${new URL(request.url).origin}/fotos/login?${destino.toString()}`;
      const { data: confirmacao, error: linkError } = await supabase.auth.admin.generateLink({
        type: "signup", email, password, options: { redirectTo },
      });
      const link = confirmacao?.properties?.action_link;
      if (linkError || !link || confirmacao.user.id !== data.user.id) throw linkError || new Error("Link inválido.");
      const url = new URL(link);
      if (url.protocol !== "https:" || url.hostname !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname) throw new Error("Link inválido.");
      const { error: envioError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: "Retratt <suporte@itatame.com.br>",
        to: [email],
        subject: "Confirme seu e-mail na Retratt",
        html: `<div style="background:#0a0a0a;color:#fff;font-family:Arial,sans-serif;padding:32px;max-width:560px;margin:auto"><h1 style="color:#ff5a1f">Retratt</h1><p>Olá, ${escapar(nome)}. Confirme seu e-mail para acessar sua conta.</p><p><a href="${escapar(link)}" style="display:inline-block;background:#ff5a1f;color:#000;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Confirmar e-mail</a></p><p style="color:#aaa;font-size:12px">Se você não criou esta conta, ignore esta mensagem.</p></div>`,
      });
      if (envioError) throw envioError;
    } catch (erroEnvio) {
      console.error("Falha ao enviar confirmação Retratt:", erroEnvio);
      await supabase.auth.admin.deleteUser(data.user.id);
      return NextResponse.json({ error: "Não foi possível enviar a confirmação. Tente criar a conta novamente em instantes." }, { status: 503 });
    }

    return NextResponse.json({ requiresEmailConfirmation: true });
  } catch (error) {
    console.error("Falha no cadastro Retratt:", error);
    return NextResponse.json({ error: "Não foi possível criar a conta agora." }, { status: 500 });
  }
}
