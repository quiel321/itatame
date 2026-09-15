import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

function texto(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const perfil = texto(form.get("perfil"));
    const email = texto(form.get("email")).toLowerCase();
    const password = texto(form.get("password"));
    const nome = texto(form.get("nome"));
    const cpf = texto(form.get("cpf"));
    const telefone = texto(form.get("telefone"));
    const academia = texto(form.get("academia"));
    const foto = form.get("foto");

    if (!email || !email.includes("@") || password.length < 6) {
      return NextResponse.json({ error: "Informe um e-mail válido e uma senha com pelo menos 6 caracteres." }, { status: 400 });
    }
    if (!['atleta', 'professor', 'organizador'].includes(perfil)) {
      return NextResponse.json({ error: "Tipo de cadastro inválido." }, { status: 400 });
    }
    if (perfil === "organizador" && (!nome || !telefone)) {
      return NextResponse.json({ error: "Informe nome e telefone do organizador." }, { status: 400 });
    }
    if (perfil !== "organizador" && cpf.length < 11) {
      return NextResponse.json({ error: "Informe um CPF válido." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return NextResponse.json({ error: "Cadastro temporariamente indisponível." }, { status: 500 });

    const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
    const destino = perfil === "organizador" ? "/login-organizador?email_confirmado=1" : "/login?email_confirmado=1";
    const { data, error: signUpError } = await auth.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${baseUrl}${destino}`,
        data: { role: perfil, cpf: cpf || undefined, nome: nome || undefined },
      },
    });
    if (signUpError) return NextResponse.json({ error: signUpError.message }, { status: 400 });
    if (!data.user || (Array.isArray(data.user.identities) && data.user.identities.length === 0)) {
      return NextResponse.json({ error: "Este e-mail já possui cadastro. Use a opção de entrar ou recuperar senha." }, { status: 409 });
    }

    const supabase = createSupabaseServerClient();
    let fotoUrl = "";
    if (perfil === "organizador" && foto instanceof File && foto.size > 0) {
      if (foto.size > 5 * 1024 * 1024 || !foto.type.startsWith("image/")) {
        await supabase.auth.admin.deleteUser(data.user.id);
        return NextResponse.json({ error: "A foto deve ser uma imagem de até 5 MB." }, { status: 400 });
      }
      const ext = (foto.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 5);
      const caminho = `organizadores/${data.user.id}-${Date.now()}.${ext}`;
      const bytes = Buffer.from(await foto.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from("avatars").upload(caminho, bytes, { contentType: foto.type, upsert: false });
      if (uploadError) {
        await supabase.auth.admin.deleteUser(data.user.id);
        return NextResponse.json({ error: "Não foi possível salvar a foto do perfil." }, { status: 500 });
      }
      fotoUrl = supabase.storage.from("avatars").getPublicUrl(caminho).data.publicUrl;
    }

    const resultado = perfil === "organizador"
      ? await supabase.from("organizadores").insert({
          user_id: data.user.id,
          nome,
          email,
          telefone,
          academia: academia || "Independente",
          foto_url: fotoUrl,
          status: "pendente",
          plano_comercial: "essencial",
          comissao_percentual: 5,
        })
      : await supabase.from("atletas").insert({
          user_id: data.user.id,
          email,
          cpf,
          role: perfil,
          nome: "",
          equipe: "Independente",
        });

    if (resultado.error) {
      await supabase.auth.admin.deleteUser(data.user.id);
      return NextResponse.json({ error: resultado.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, requiresEmailConfirmation: !data.session });
  } catch (error) {
    console.error("Erro no cadastro:", error);
    return NextResponse.json({ error: "Não foi possível concluir o cadastro." }, { status: 500 });
  }
}
