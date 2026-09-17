import { Resend } from "resend";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { formatarDataHoraNoFuso } from "@/app/lib/evento-datas";

const resend = new Resend(process.env.RESEND_API_KEY);

type EnviarEmailPagamentoPendenteParams = {
  inscricaoId: string | number;
  emailFallback?: string | null;
  ticketUrl?: string | null;
  meio?: "boleto" | "pix" | "inscricao";
};

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://itatame.com.br";
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatarMoeda(valor: unknown) {
  const parsed = Number(valor);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "a definir";
}

export async function enviarEmailPagamentoPendente({
  inscricaoId,
  emailFallback,
  ticketUrl,
  meio = "inscricao",
}: EnviarEmailPagamentoPendenteParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY nao configurada. E-mail de pagamento pendente nao enviado.");
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
      email,
      pagamento_ok,
      valor_inscricao,
      valor_total,
      eventos (
        nome,
        data_evento,
        data_fim_pagamento,
        local,
        cidade,
        estado
      )
    `)
    .eq("id", inscricaoId)
    .maybeSingle();

  if (error || !inscricao) return { skipped: true, reason: "inscricao_nao_encontrada" };
  if (inscricao.pagamento_ok) return { skipped: true, reason: "ja_pago" };

  const evento = Array.isArray(inscricao.eventos) ? inscricao.eventos[0] : inscricao.eventos;
  const { data: atleta } = await supabase
    .from("atletas")
    .select("nome, email")
    .eq("user_id", inscricao.user_id)
    .maybeSingle();

  let emailDestino = atleta?.email || inscricao.email || null;
  if (!emailDestino) {
    const { data: userData } = await supabase.auth.admin.getUserById(inscricao.user_id);
    emailDestino = userData?.user?.email || emailFallback || null;
  }
  if (!emailDestino) return { skipped: true, reason: "email_nao_encontrado" };

  const baseUrl = getBaseUrl();
  const nomeAtleta = atleta?.nome || inscricao.atleta || "Atleta";
  const eventoNome = evento?.nome || "Evento iTatame";
  const prazo = formatarDataHoraNoFuso(evento?.data_fim_pagamento, true, evento?.estado);
  const linkPagamento = `${baseUrl}/pagamento`;
  const categoria = inscricao.absoluto ? `${inscricao.categoria} + Absoluto` : inscricao.categoria;
  const valor = formatarMoeda(inscricao.valor_total || inscricao.valor_inscricao);
  const titulo = meio === "boleto" ? "Boleto gerado" : meio === "pix" ? "Pix gerado" : "Pagamento pendente";
  const introducao = meio === "boleto"
    ? "Sua inscrição está reservada. Pague o boleto para garantir sua vaga na chave."
    : meio === "pix"
      ? "Sua inscrição está reservada. Conclua o Pix para garantir sua vaga na chave."
      : "Sua inscrição foi registrada, mas o pagamento ainda está pendente. Sem o pagamento, o nome não entra na chave.";

  const { data, error: emailError } = await resend.emails.send({
    from: "iTatame <suporte@itatame.com.br>",
    to: [emailDestino],
    subject: `${titulo} - ${eventoNome}`,
    html: `
      <div style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;color:#ffffff;">
        <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
          <div style="border:1px solid #27272a;border-radius:18px;overflow:hidden;background:#0e0e12;">
            <div style="padding:24px;border-bottom:1px solid #27272a;background:#09090b;">
              <h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:-1px;"><span style="color:#dc2626;">i</span>TATAME</h1>
              <p style="margin:8px 0 0;color:#fbbf24;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">${escapeHtml(titulo)}</p>
            </div>
            <div style="padding:24px;">
              <h2 style="margin:0 0 12px;font-size:22px;color:#ffffff;">Olá, ${escapeHtml(nomeAtleta)}!</h2>
              <p style="margin:0 0 18px;color:#d4d4d8;font-size:15px;line-height:1.6;">${escapeHtml(introducao)}</p>
              <div style="background:#050505;border:1px solid #27272a;border-radius:14px;padding:16px;margin:20px 0;">
                <p style="margin:0 0 8px;color:#a1a1aa;font-size:11px;text-transform:uppercase;font-weight:800;letter-spacing:1.5px;">Evento</p>
                <p style="margin:0;color:#ffffff;font-size:18px;font-weight:900;">${escapeHtml(eventoNome)}</p>
                <p style="margin:8px 0 0;color:#f87171;font-size:13px;font-weight:800;">${escapeHtml(categoria)}</p>
                <p style="margin:8px 0 0;color:#ffffff;font-size:15px;font-weight:800;">Valor: ${escapeHtml(valor)}</p>
                <p style="margin:8px 0 0;color:#fbbf24;font-size:13px;font-weight:800;">Pague até ${escapeHtml(prazo)}</p>
              </div>
              <a href="${linkPagamento}" style="display:block;text-align:center;background:#dc2626;color:#ffffff;text-decoration:none;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;padding:15px 18px;border-radius:12px;margin-top:18px;">Abrir central de pagamentos</a>
              ${ticketUrl ? `<a href="${escapeHtml(ticketUrl)}" style="display:block;text-align:center;background:#111113;color:#ffffff;border:1px solid #3f3f46;text-decoration:none;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:14px 18px;border-radius:12px;margin-top:10px;">${meio === "pix" ? "Abrir Pix" : "Abrir boleto"}</a>` : ""}
              <p style="margin:18px 0 0;color:#71717a;font-size:12px;line-height:1.5;">Se você tiver um cupom de cortesia, pode aplicá-lo na central de pagamentos mesmo depois de confirmar a inscrição.</p>
            </div>
          </div>
        </div>
      </div>
    `,
  });

  if (emailError) {
    console.error("Erro ao enviar e-mail de pagamento pendente:", emailError);
    return { skipped: true, reason: "erro_resend", error: emailError };
  }

  return { success: true, data };
}
