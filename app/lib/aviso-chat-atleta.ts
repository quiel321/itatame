import { Resend } from "resend";
import webpush from "web-push";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export function textoAvisoChat(dados: { atleta: string; evento: string }) {
  return {
    assunto: `A organização enviou uma mensagem - ${dados.evento}`,
    tituloPush: "Mensagem da organização",
    corpoPush: `${dados.evento} enviou uma mensagem no chat do iTatame.`,
    introducao: `A organização de ${dados.evento} abriu uma conversa com você no chat do campeonato.`,
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

export async function avisarAtletaPrimeiraMensagem(eventoId: string, atletaUserId: string, eventoNome: string) {
  const supabase = createSupabaseServerClient();
  const { data: atleta } = await supabase.from("atletas").select("nome,email,responsavel_id").eq("user_id", atletaUserId).maybeSingle();
  const texto = textoAvisoChat({ atleta: atleta?.nome || "Atleta", evento: eventoNome });
  const link = `${baseUrl()}/evento/${eventoId}`;

  let destino = emailEntregavel(atleta?.email);
  if (!destino && atleta?.responsavel_id) {
    const { data: responsavel } = await supabase.from("atletas").select("email").eq("user_id", atleta.responsavel_id).maybeSingle();
    destino = emailEntregavel(responsavel?.email);
    if (!destino) {
      const { data: conta } = await supabase.auth.admin.getUserById(atleta.responsavel_id);
      destino = emailEntregavel(conta?.user?.email);
    }
  }
  if (!destino) {
    const { data: conta } = await supabase.auth.admin.getUserById(atletaUserId);
    destino = emailEntregavel(conta?.user?.email);
  }

  let emailEnviado = false;
  if (destino && process.env.RESEND_API_KEY) {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: "iTatame <suporte@itatame.com.br>",
      to: [destino],
      subject: texto.assunto,
      html: `
        <div style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;color:#ffffff;">
          <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
            <div style="border:1px solid #27272a;border-radius:18px;overflow:hidden;background:#0e0e12;">
              <div style="padding:24px;border-bottom:1px solid #27272a;background:#09090b;">
                <h1 style="margin:0;font-size:26px;font-weight:900;"><span style="color:#dc2626;">i</span>TATAME</h1>
                <p style="margin:8px 0 0;color:#22d3ee;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">Chat do campeonato</p>
              </div>
              <div style="padding:24px;">
                <h2 style="margin:0 0 12px;font-size:22px;">Olá, ${escapeHtml(atleta?.nome || "atleta")}!</h2>
                <p style="margin:0 0 18px;color:#d4d4d8;font-size:15px;line-height:1.6;">${escapeHtml(texto.introducao)} As próximas mensagens desta conversa ficam só no chat.</p>
                <a href="${link}" style="display:block;text-align:center;background:#dc2626;color:#ffffff;text-decoration:none;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;padding:15px 18px;border-radius:12px;">Abrir o campeonato e ler a mensagem</a>
              </div>
            </div>
          </div>
        </div>
      `,
    });
    emailEnviado = !error;
  }

  let push = 0;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const destinosPush = [atletaUserId, atleta?.responsavel_id].filter((id, indice, lista): id is string => Boolean(id) && lista.indexOf(id) === indice);
  if (publicKey && privateKey) {
    webpush.setVapidDetails("mailto:suporte@itatame.com.br", publicKey, privateKey);
    const payload = JSON.stringify({
      title: texto.tituloPush,
      body: texto.corpoPush,
      icon: "/logo.svg",
      badge: "/logo.svg",
      url: `/evento/${eventoId}`,
    });
    for (const userId of destinosPush) {
      const { data: assinaturas } = await supabase.from("assinaturas_push").select("subscription").eq("user_id", userId);
      for (const item of assinaturas || []) {
        const subscription = assinaturaPush(item.subscription as PushSubscriptionJSON | string | null);
        if (!subscription) continue;
        try {
          await webpush.sendNotification(subscription, payload);
          push += 1;
        } catch (erro) {
          const status = typeof erro === "object" && erro && "statusCode" in erro ? Number((erro as { statusCode?: unknown }).statusCode) : 0;
          if (status === 404 || status === 410) await supabase.from("assinaturas_push").delete().eq("user_id", userId);
        }
      }
    }
  }

  return { emailEnviado, push };
}
