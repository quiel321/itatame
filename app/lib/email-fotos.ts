import "server-only";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function escapeHtml(valor: unknown) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatarMoeda(centavos: number | null | undefined) {
  return ((Number(centavos) || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://itatame.com.br";
}

export async function enviarEmailPedidoFotosConfirmado(supabase: SupabaseClient, pedidoId: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY não configurada. E-mail do iTatame Fotos não enviado.");
    return { skipped: true, reason: "resend_ausente" };
  }

  const reservadoEm = new Date().toISOString();
  const { data: reservado, error: reservaError } = await supabase
    .from("foto_pedidos")
    .update({ email_confirmacao_enviado_em: reservadoEm, email_confirmacao_erro: null })
    .eq("id", pedidoId)
    .is("email_confirmacao_enviado_em", null)
    .select(`
      id, comprador_user_id, comprador_email, comprador_nome, total_centavos, provedor_payment_id,
      foto_eventos(nome),
      foto_pedido_itens(id)
    `)
    .maybeSingle();

  if (reservaError) {
    console.error("Não foi possível reservar o e-mail do pedido de fotos:", reservaError);
    return { skipped: true, reason: "colunas_email_ausentes" };
  }
  if (!reservado) return { skipped: true, reason: "email_ja_enviado" };

  let email = reservado.comprador_email || null;
  if (!email && reservado.comprador_user_id) {
    const { data } = await supabase.auth.admin.getUserById(reservado.comprador_user_id);
    email = data.user?.email || null;
  }

  if (!email) {
    await supabase.from("foto_pedidos").update({
      email_confirmacao_enviado_em: null,
      email_confirmacao_erro: "E-mail do comprador não encontrado.",
    }).eq("id", pedidoId);
    return { skipped: true, reason: "email_nao_encontrado" };
  }

  const evento = primeiraRelacao(reservado.foto_eventos);
  const itens = reservado.foto_pedido_itens || [];
  const nome = reservado.comprador_nome || email.split("@")[0] || "Cliente";
  const linkFotos = `${baseUrl()}/fotos/minhas-compras?pedido=${encodeURIComponent(pedidoId)}`;
  const remetente = process.env.FOTOS_EMAIL_FROM || "iTatame Fotos <suporte@itatame.com.br>";

  const { data, error } = await resend.emails.send({
    from: remetente,
    to: [email],
    subject: `Suas fotos estão liberadas - ${evento?.nome || "iTatame Fotos"}`,
    html: `
      <div style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;color:#fff">
        <div style="max-width:620px;margin:0 auto;padding:28px 16px">
          <div style="overflow:hidden;border:1px solid #27272a;border-radius:16px;background:#0b0b0f">
            <div style="padding:24px;border-bottom:1px solid #27272a;background:#09090b">
              <div style="font-size:25px;font-weight:900;letter-spacing:-1px"><span style="color:#dc2626">i</span>TATAME <span style="color:#ef4444;font-size:15px;letter-spacing:4px">FOTOS</span></div>
              <p style="margin:10px 0 0;color:#34d399;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px">Pagamento confirmado</p>
            </div>
            <div style="padding:24px">
              <h1 style="margin:0 0 12px;font-size:22px">Olá, ${escapeHtml(nome)}!</h1>
              <p style="margin:0;color:#d4d4d8;font-size:15px;line-height:1.6">Seu pedido foi aprovado e as fotos originais já estão disponíveis para download na sua conta.</p>
              <div style="margin:22px 0;padding:16px;border:1px solid #27272a;border-radius:12px;background:#050505">
                <p style="margin:0 0 7px;color:#a1a1aa;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px">Evento</p>
                <p style="margin:0;font-size:17px;font-weight:900">${escapeHtml(evento?.nome || "Evento iTatame")}</p>
                <p style="margin:12px 0 0;color:#d4d4d8;font-size:13px">${itens.length} ${itens.length === 1 ? "foto" : "fotos"} · ${escapeHtml(formatarMoeda(reservado.total_centavos))}</p>
              </div>
              <a href="${linkFotos}" style="display:block;padding:15px 18px;border-radius:10px;background:#dc2626;color:#fff;text-align:center;text-decoration:none;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px">Acessar e baixar minhas fotos</a>
              <p style="margin:18px 0 0;color:#71717a;font-size:11px;line-height:1.5;text-align:center">Entre com o mesmo e-mail usado na compra. Os downloads ficam protegidos dentro da sua conta.</p>
              ${reservado.provedor_payment_id ? `<p style="margin:12px 0 0;color:#52525b;font-size:10px;text-align:center">Pagamento Mercado Pago: ${escapeHtml(reservado.provedor_payment_id)}</p>` : ""}
            </div>
          </div>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Erro ao enviar e-mail do iTatame Fotos:", error);
    await supabase.from("foto_pedidos").update({
      email_confirmacao_enviado_em: null,
      email_confirmacao_erro: String(error.message || "Falha no Resend").slice(0, 500),
    }).eq("id", pedidoId);
    return { skipped: true, reason: "erro_resend", error };
  }

  return { success: true, data };
}
