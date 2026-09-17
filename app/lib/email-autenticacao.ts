import { Resend } from 'resend';

export async function enviarLinkAutenticacao({ email, link, assunto, titulo, instrucao }: {
  email: string; link: string; assunto: string; titulo: string; instrucao: string;
}) {
  if (!process.env.RESEND_API_KEY) throw new Error('Serviço de e-mail indisponível.');
  const url = new URL(link);
  if (url.protocol !== 'https:' || url.hostname !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname) {
    throw new Error('Link de autenticação inválido.');
  }
  const href = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const logo = 'https://itatame.com.br/logo.svg';
  const escapar = (valor: string) => valor.replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[caractere] || caractere));
  const tituloSeguro = escapar(titulo);
  const instrucaoSegura = escapar(instrucao);
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'iTatame <suporte@itatame.com.br>',
    to: [email],
    subject: assunto,
    html: `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#09090b;color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#111116;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
        <tr><td style="height:5px;background:#ef1b2d;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px 20px;text-align:center;">
          <img src="${logo}" width="190" alt="iTatame - Sistema de Campeonatos" style="display:block;width:190px;max-width:80%;height:auto;margin:0 auto 24px;">
          <div style="color:#ef1b2d;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">iTatame</div>
          <h1 style="margin:10px 0 12px;color:#ffffff;font-size:26px;line-height:1.2;">${tituloSeguro}</h1>
          <p style="margin:0;color:#a1a1aa;font-size:15px;line-height:1.6;">${instrucaoSegura}</p>
        </td></tr>
        <tr><td style="padding:4px 32px 30px;text-align:center;">
          <a href="${href}" style="display:inline-block;background:#ef1b2d;color:#ffffff;text-decoration:none;border-radius:8px;padding:15px 26px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${tituloSeguro}</a>
          <p style="margin:22px 0 0;color:#71717a;font-size:12px;line-height:1.6;">Se o botão não abrir, copie e cole este endereço no navegador:<br><span style="color:#a1a1aa;word-break:break-all;">${href}</span></p>
        </td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid #27272a;text-align:center;">
          <p style="margin:0;color:#71717a;font-size:11px;line-height:1.5;">Se você não solicitou este e-mail, ignore esta mensagem.</p>
          <p style="margin:6px 0 0;color:#52525b;font-size:10px;">Sistema de Campeonatos iTatame</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  });
  if (error) throw new Error('Não foi possível enviar o e-mail agora. Tente novamente.');
}
