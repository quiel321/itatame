import { Resend } from "resend";
import webpush from "web-push";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export function textoAvisoProfessor(dados: {
  professor: string;
  atleta: string;
  evento: string;
  categoria: string;
  equipe: string;
  academia: string;
  pagamentoOk: boolean;
}) {
  const situacao = dados.pagamentoOk ? "pagamento confirmado" : "pagamento ainda pendente";
  const unidade = [dados.equipe, dados.academia].filter(Boolean).join(" · ");
  return {
    assunto: `Seu aluno se inscreveu - ${dados.evento}`,
    tituloPush: "Aluno inscrito no iTatame",
    corpoPush: `${dados.atleta} se inscreveu em ${dados.evento}.`,
    introducao: `${dados.atleta} acabou de se inscrever em ${dados.evento}. A vaga segue o nome oficial da equipe, sem o atleta digitar outro.`,
    detalhe: unidade ? `${dados.categoria} · ${unidade} · ${situacao}` : `${dados.categoria} · ${situacao}`,
  };
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailEntregavel(valor?: string | null) {
  const email = String(valor || "").trim();
  if (!email || !email.includes("@") || email.toLowerCase().endsWith("@itatame.invalid")) return "";
  return email;
}

function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://itatame.com.br";
}

function assinaturaPush(raw: PushSubscriptionJSON | string | null) {
  if (!raw) return null;
  const subscription = typeof raw === "string" ? JSON.parse(raw) as PushSubscriptionJSON : raw;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return null;
  return subscription;
}

export async function avisarProfessorDaInscricao(inscricaoId: string | number) {
  const supabase = createSupabaseServerClient();
  const { data: inscricao, error } = await supabase
    .from("inscricoes")
    .select("id, user_id, atleta, categoria, absoluto, equipe, academia, evento_id, pagamento_ok, eventos(nome)")
    .eq("id", inscricaoId)
    .maybeSingle();
  if (error || !inscricao?.user_id) return { skipped: true, reason: "inscricao_nao_encontrada" };

  const { data: atleta } = await supabase
    .from("atletas")
    .select("professor_id, nome")
    .eq("user_id", inscricao.user_id)
    .maybeSingle();
  const professorId = String(atleta?.professor_id || "");
  if (!professorId || professorId === inscricao.user_id) return { skipped: true, reason: "sem_professor" };

  const { data: professor } = await supabase
    .from("atletas")
    .select("user_id, nome, email")
    .eq("user_id", professorId)
    .maybeSingle();
  if (!professor?.user_id) return { skipped: true, reason: "professor_nao_encontrado" };

  const evento = Array.isArray(inscricao.eventos) ? inscricao.eventos[0] : inscricao.eventos;
  const texto = textoAvisoProfessor({
    professor: professor.nome || "Professor",
    atleta: atleta?.nome || inscricao.atleta || "Seu aluno",
    evento: evento?.nome || "Campeonato",
    categoria: inscricao.absoluto ? `${inscricao.categoria || "Categoria"} + Absoluto` : (inscricao.categoria || "Categoria"),
    equipe: inscricao.equipe || "",
    academia: inscricao.academia || "",
    pagamentoOk: Boolean(inscricao.pagamento_ok),
  });
  const link = `${baseUrl()}/evento/${inscricao.evento_id}/equipe`;

  let email: { enviado: boolean; motivo?: string } = { enviado: false, motivo: "sem_email" };
  if (process.env.RESEND_API_KEY) {
    let destino = emailEntregavel(professor.email);
    if (!destino) {
      const { data: conta } = await supabase.auth.admin.getUserById(professor.user_id);
      destino = emailEntregavel(conta?.user?.email);
    }
    if (destino) {
      const { error: emailError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: "iTatame <suporte@itatame.com.br>",
        to: [destino],
        subject: texto.assunto,
        html: `
          <div style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;color:#ffffff;">
            <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
              <div style="border:1px solid #27272a;border-radius:18px;overflow:hidden;background:#0e0e12;">
                <div style="padding:24px;border-bottom:1px solid #27272a;background:#09090b;">
                  <h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:-1px;"><span style="color:#dc2626;">i</span>TATAME</h1>
                  <p style="margin:8px 0 0;color:#fbbf24;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">Aluno inscrito</p>
                </div>
                <div style="padding:24px;">
                  <h2 style="margin:0 0 12px;font-size:22px;">Olá, ${escapeHtml(professor.nome || "Professor")}!</h2>
                  <p style="margin:0 0 18px;color:#d4d4d8;font-size:15px;line-height:1.6;">${escapeHtml(texto.introducao)}</p>
                  <div style="background:#050505;border:1px solid #27272a;border-radius:14px;padding:16px;">
                    <p style="margin:0;color:#ffffff;font-size:18px;font-weight:900;">${escapeHtml(texto.detalhe)}</p>
                  </div>
                  <a href="${link}" style="display:block;text-align:center;background:#eab308;color:#111111;text-decoration:none;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;padding:15px 18px;border-radius:12px;margin-top:18px;">Abrir equipe no campeonato</a>
                  <p style="margin:18px 0 0;color:#71717a;font-size:12px;line-height:1.5;">Se a equipe ainda não estiver no evento, confirme o nome e a academia por lá. O atleta não precisa esperar esse passo para concluir a inscrição.</p>
                </div>
              </div>
            </div>
          </div>
        `,
      });
      email = emailError ? { enviado: false, motivo: "erro_resend" } : { enviado: true };
    }
  }

  let push = 0;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    webpush.setVapidDetails("mailto:suporte@itatame.com.br", publicKey, privateKey);
    const { data: assinaturas } = await supabase.from("assinaturas_push").select("subscription").eq("user_id", professor.user_id);
    const payload = JSON.stringify({
      title: texto.tituloPush,
      body: texto.corpoPush,
      icon: "/logo.svg",
      badge: "/logo.svg",
      url: `/evento/${inscricao.evento_id}/equipe`,
    });
    for (const item of assinaturas || []) {
      const subscription = assinaturaPush(item.subscription as PushSubscriptionJSON | string | null);
      if (!subscription) continue;
      try {
        await webpush.sendNotification(subscription, payload);
        push += 1;
      } catch (erro) {
        const status = typeof erro === "object" && erro && "statusCode" in erro ? Number((erro as { statusCode?: unknown }).statusCode) : 0;
        if (status === 404 || status === 410) {
          await supabase.from("assinaturas_push").delete().eq("user_id", professor.user_id);
        }
      }
    }
  }

  return { success: email.enviado || push > 0, email, push };
}
