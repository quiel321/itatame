import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { Resend } from "resend";
import { enviarLinkAutenticacao } from "@/app/lib/email-autenticacao";
import { consumirLimiteAuth, ipDaRequisicao } from '@/app/lib/limite-auth';

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
    const cpf = texto(form.get("cpf")).replace(/\D/g, "");
    const telefone = texto(form.get("telefone")).replace(/\D/g, "");
    const academia = texto(form.get("academia"));
    const foto = form.get("foto");

    if (!email || !email.includes("@") || password.length < 6) {
      return NextResponse.json({ error: "Informe um e-mail válido e uma senha com pelo menos 6 caracteres." }, { status: 400 });
    }
    if (!['atleta', 'professor', 'organizador'].includes(perfil)) {
      return NextResponse.json({ error: "Tipo de cadastro inválido." }, { status: 400 });
    }
    if (perfil === "organizador" && (!nome || telefone.length < 10 || telefone.length > 11)) {
      return NextResponse.json({ error: "Informe nome e telefone do organizador." }, { status: 400 });
    }
    if (perfil !== "organizador" && (cpf.length !== 11 || telefone.length < 10 || telefone.length > 11)) {
      return NextResponse.json({ error: "Informe CPF e telefone válidos." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Cadastro temporariamente indisponível." }, { status: 503 });
    }

    const supabase = createSupabaseServerClient();
    if (perfil !== "organizador") {
      const cpfFormatado = cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
      const { data: existentes, error: buscaError } = await supabase.from("atletas").select("cpf").in("cpf", [cpf, cpfFormatado]).limit(1);
      if (buscaError) return NextResponse.json({ error: "Não foi possível validar o CPF agora." }, { status: 500 });
      if ((existentes || []).some(item => String(item.cpf || "").replace(/\D/g, "") === cpf)) {
        return NextResponse.json({ error: "Este CPF já possui cadastro. Entre na conta existente ou recupere a senha." }, { status: 409 });
      }
    } else {
      const telefoneFormatado = telefone.length === 11
        ? telefone.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3")
        : telefone.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
      const { data: existentes, error: buscaError } = await supabase.from("organizadores").select("user_id,telefone").in("telefone", [telefone, telefoneFormatado]).limit(50);
      if (buscaError) return NextResponse.json({ error: "Não foi possível validar o telefone agora." }, { status: 500 });
      const idsRetratt = (existentes || []).map(item => item.user_id).filter(Boolean);
      const { data: perfisRetratt } = idsRetratt.length
        ? await supabase.from("foto_organizadores").select("id").in("id", idsRetratt)
        : { data: [] as { id: string }[] };
      const retratt = new Set((perfisRetratt || []).map(item => item.id));
      if ((existentes || []).some(item => String(item.telefone || "").replace(/\D/g, "") === telefone && !retratt.has(item.user_id))) {
        return NextResponse.json({ error: "Este telefone já possui cadastro de organizador." }, { status: 409 });
      }
    }

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
    const destino = perfil === "organizador" ? "/login-organizador?email_confirmado=1" : "/login?email_confirmado=1";
    // O envio só acontece depois que o perfil foi gravado: nunca enviamos link para conta incompleta.
    if (!consumirLimiteAuth(`cadastro:${ipDaRequisicao(request)}`, 30, 5 * 60_000)) {
      return NextResponse.json({ error: 'Muitos cadastros em sequência. Aguarde alguns minutos.' }, { status: 429 });
    }
    const { data, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { role: perfil, cpf: cpf || undefined, nome: nome || undefined },
    });
    if (signUpError) return NextResponse.json({ error: signUpError.code === 'email_exists' || signUpError.message.toLowerCase().includes('already')
      ? "Este e-mail já possui cadastro. Entre na conta existente ou recupere a senha." : "Não foi possível criar a conta. Tente novamente." }, { status: 400 });
    if (!data.user) return NextResponse.json({ error: "Não foi possível criar a conta." }, { status: 500 });

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
          telefone,
          role: perfil,
          nome: "",
          equipe: "Independente",
          professor: "",
          faixa: "",
          cidade: "",
          modalidade: "Jiu-Jitsu",
        });

    if (resultado.error) {
      await supabase.auth.admin.deleteUser(data.user.id);
      return NextResponse.json({ error: resultado.error.code === '23505' ? 'CPF, telefone ou e-mail já cadastrado.' : 'Não foi possível salvar o perfil. Confira os dados e tente novamente.' }, { status: 400 });
    }

    try {
      const { data: confirmacao, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'signup', email, password, options: { redirectTo: `${baseUrl}${destino}` },
      });
      if (linkError || !confirmacao?.properties.action_link || confirmacao.user.id !== data.user.id) throw linkError || new Error('Link inválido');
      await enviarLinkAutenticacao({
        email, link: confirmacao.properties.action_link, assunto: 'Confirme seu e-mail no iTatame',
        titulo: 'Confirmar meu e-mail', instrucao: 'Confirme seu endereço para acessar sua conta no iTatame.',
      });
    } catch (error) {
      console.error('Falha ao gerar ou enviar confirmação:', error);
      await supabase.from(perfil === 'organizador' ? 'organizadores' : 'atletas').delete().eq('user_id', data.user.id);
      await supabase.auth.admin.deleteUser(data.user.id);
      return NextResponse.json({ error: 'Não foi possível enviar a confirmação. Tente criar a conta novamente em instantes.' }, { status: 503 });
    }

    if (perfil === "organizador" && process.env.RESEND_API_KEY) {
      const { data: gestores } = await supabase.from("atletas").select("email").eq("role", "super-admin");
      const destinos = (gestores || []).map(item => item.email).filter((valor): valor is string => Boolean(valor));
      if (destinos.length) {
        const aviso = await new Resend(process.env.RESEND_API_KEY).emails.send({
          from: "iTatame <suporte@itatame.com.br>",
          to: destinos,
          subject: "Novo organizador aguardando análise",
          html: `<p>Um novo organizador se cadastrou e aguarda sua análise no painel do iTatame.</p><p>Nome: ${nome.replace(/[<>&"']/g, "")}</p><p>E-mail: ${email.replace(/[<>&"']/g, "")}</p><p><a href="${baseUrl}/super-admin/organizadores">Abrir solicitações</a></p>`,
        }).catch(erro => ({ error: erro }));
        if (aviso.error) console.error("Falha ao avisar Super Admin sobre organizador:", aviso.error);
      }
    }

    return NextResponse.json({ success: true, requiresEmailConfirmation: true });
  } catch (error) {
    console.error("Erro no cadastro:", error);
    return NextResponse.json({ error: "Não foi possível concluir o cadastro." }, { status: 500 });
  }
}
