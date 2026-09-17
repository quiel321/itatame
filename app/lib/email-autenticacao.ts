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
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'iTatame <suporte@itatame.com.br>',
    to: [email],
    subject: assunto,
    html: `<p>${instrucao}</p><p><a href="${href}">${titulo}</a></p><p>Se você não solicitou este e-mail, ignore esta mensagem.</p>`,
  });
  if (error) throw new Error('Não foi possível enviar o e-mail agora. Tente novamente.');
}
