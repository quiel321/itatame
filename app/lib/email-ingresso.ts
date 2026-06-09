import { Resend } from "resend";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

const resend = new Resend(process.env.RESEND_API_KEY);

type EnviarEmailIngressoParams = {
  inscricaoId: string | number;
  emailFallback?: string | null;
  paymentId?: string | number | null;
};

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://itatame.com.br";
}

function formatarData(dataStr?: string | null) {
  if (!dataStr) return "Data a definir";
  const [ano, mes, dia] = dataStr.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : dataStr;
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function enviarEmailIngressoConfirmado({ inscricaoId, emailFallback, paymentId }: EnviarEmailIngressoParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY nao configurada. E-mail de ingresso nao enviado.");
    return { skipped: true, reason: "RESEND_API_KEY ausente" };
  }

  const supabase = createSupabaseServerClient();
  const { data: inscricao, error } = await supabase
    .from("inscricoes")
    .select(`
      id,
      user_id,
      atleta,
      categoria,
      absoluto,
      evento_id,
      eventos (
        nome,
        data_evento,
        local,
        cidade,
        estado
      )
    `)
    .eq("id", inscricaoId)
    .maybeSingle();

  if (error || !inscricao) {
    console.error("Inscricao nao encontrada para envio de ingresso:", error);
    return { skipped: true, reason: "inscricao_nao_encontrada" };
  }

  const evento = Array.isArray(inscricao.eventos) ? inscricao.eventos[0] : inscricao.eventos;
  const { data: atleta } = await supabase
    .from("atletas")
    .select("nome, email")
    .eq("user_id", inscricao.user_id)
    .maybeSingle();

  let emailDestino = emailFallback || atleta?.email || null;

  if (!emailDestino) {
    const { data: userData } = await supabase.auth.admin.getUserById(inscricao.user_id);
    emailDestino = userData?.user?.email || null;
  }

  if (!emailDestino) {
    console.warn("E-mail do atleta nao encontrado para ingresso", { inscricaoId });
    return { skipped: true, reason: "email_nao_encontrado" };
  }

  const baseUrl = getBaseUrl();
  const nomeAtleta = atleta?.nome || inscricao.atleta || "Atleta";
  const linkIngresso = `${baseUrl}/ingresso/${inscricao.evento_id}/${inscricao.user_id}`;
  const qrValue = `ITATAME|${inscricao.evento_id}|${inscricao.user_id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrValue)}`;
  const eventoNome = evento?.nome || "Evento iTatame";
  const localEvento = [evento?.local, evento?.cidade, evento?.estado].filter(Boolean).join(" - ") || "Local a definir";
  const categoria = inscricao.absoluto ? `${inscricao.categoria} + Absoluto` : inscricao.categoria;

  const { data, error: emailError } = await resend.emails.send({
    from: "iTatame <suporte@itatame.com.br>",
    to: [emailDestino],
    subject: `Pagamento confirmado - ${eventoNome}`,
    html: `
      <div style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;color:#ffffff;">
        <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
          <div style="border:1px solid #27272a;border-radius:18px;overflow:hidden;background:#0e0e12;">
            <div style="padding:24px;border-bottom:1px solid #27272a;background:#09090b;">
              <h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:-1px;"><span style="color:#dc2626;">i</span>TATAME</h1>
              <p style="margin:8px 0 0;color:#22c55e;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">Pagamento confirmado</p>
            </div>
            <div style="padding:24px;">
              <h2 style="margin:0 0 12px;font-size:22px;color:#ffffff;">Olá, ${escapeHtml(nomeAtleta)}!</h2>
              <p style="margin:0 0 18px;color:#d4d4d8;font-size:15px;line-height:1.6;">Seu pagamento foi aprovado e sua inscrição está confirmada. O seu passaporte oficial do evento já está disponível.</p>

              <div style="background:#050505;border:1px solid #27272a;border-radius:14px;padding:16px;margin:20px 0;">
                <p style="margin:0 0 8px;color:#a1a1aa;font-size:11px;text-transform:uppercase;font-weight:800;letter-spacing:1.5px;">Evento</p>
                <p style="margin:0;color:#ffffff;font-size:18px;font-weight:900;">${escapeHtml(eventoNome)}</p>
                <p style="margin:8px 0 0;color:#a1a1aa;font-size:13px;">${escapeHtml(formatarData(evento?.data_evento))} · ${escapeHtml(localEvento)}</p>
                <p style="margin:8px 0 0;color:#f87171;font-size:13px;font-weight:800;">${escapeHtml(categoria)}</p>
              </div>

              <div style="text-align:center;margin:24px 0;">
                <div style="background:#ffffff;border-radius:16px;padding:16px;display:inline-block;">
                  <img src="${qrUrl}" width="220" height="220" alt="QR Code do passaporte" style="display:block;border:0;" />
                </div>
                <p style="margin:12px 0 0;color:#a1a1aa;font-size:12px;">Apresente este QR Code na pesagem/check-in.</p>
              </div>

              <a href="${linkIngresso}" style="display:block;text-align:center;background:#dc2626;color:#ffffff;text-decoration:none;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;padding:15px 18px;border-radius:12px;margin-top:18px;">Abrir meu passaporte</a>

              ${paymentId ? `<p style="margin:18px 0 0;color:#71717a;font-size:11px;text-align:center;">Pagamento Mercado Pago: ${escapeHtml(paymentId)}</p>` : ""}
            </div>
          </div>
        </div>
      </div>
    `,
  });

  if (emailError) {
    console.error("Erro ao enviar e-mail de ingresso:", emailError);
    return { skipped: true, reason: "erro_resend", error: emailError };
  }

  return { success: true, data };
}