import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { enviarLinkAutenticacao } from '@/app/lib/email-autenticacao';
import { consumirLimiteAuth, ipDaRequisicao } from '@/app/lib/limite-auth';

const respostaGenerica = 'Se este e-mail estiver cadastrado, você receberá um link para criar outra senha.';
const respostaConfirmacao = 'Se houver uma conta aguardando confirmação, enviaremos outro link para este e-mail.';

export async function POST(request: Request) {
  let email = '';
  let tipo: 'recuperacao' | 'confirmacao' = 'recuperacao';
  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (body.tipo === 'confirmacao') tipo = 'confirmacao';
  } catch { return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 }); }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Recuperação indisponível no momento.' }, { status: 503 });
  }

  const chave = `${tipo}:${email}`;
  const resposta = tipo === 'confirmacao' ? respostaConfirmacao : respostaGenerica;
  if (!consumirLimiteAuth(`email:${chave}`, 1, 60_000)
    || !consumirLimiteAuth(`envio:${ipDaRequisicao(request)}`, 15, 5 * 60_000)) {
    return NextResponse.json({ message: resposta });
  }

  const supabase = createSupabaseServerClient();
  const base = (process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, '');
  let link = '';
  if (tipo === 'confirmacao') {
    const [atleta, organizador] = await Promise.all([
      supabase.from('atletas').select('user_id').eq('email', email).maybeSingle(),
      supabase.from('organizadores').select('user_id').eq('email', email).maybeSingle(),
    ]);
    const id = atleta.data?.user_id || organizador.data?.user_id;
    if (!id) return NextResponse.json({ message: respostaConfirmacao });
    const { data: usuario } = await supabase.auth.admin.getUserById(id);
    if (!usuario.user || usuario.user.email?.toLowerCase() !== email || usuario.user.email_confirmed_at) {
      return NextResponse.json({ message: respostaConfirmacao });
    }
    const destino = atleta.data?.user_id ? '/login?email_confirmado=1' : '/login-organizador?email_confirmado=1';
    const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: base + destino } });
    if (error || data?.user.id !== id || !data?.properties.action_link) {
      return NextResponse.json({ error: 'Não foi possível reenviar a confirmação agora.' }, { status: 503 });
    }
    link = data.properties.action_link;
  } else {
    const { data, error } = await supabase.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: `${base}/nova-senha` } });
    // A resposta não revela se o endereço existe.
    if (error || !data?.properties.action_link) return NextResponse.json({ message: respostaGenerica });
    link = data.properties.action_link;
  }

  try {
    await enviarLinkAutenticacao({ email, link,
      assunto: tipo === 'confirmacao' ? 'Confirme seu e-mail no iTatame' : 'Recuperar sua senha no iTatame',
      titulo: tipo === 'confirmacao' ? 'Confirmar meu e-mail' : 'Criar nova senha',
      instrucao: tipo === 'confirmacao' ? 'Confirme seu endereço para acessar sua conta no iTatame.'
        : 'Use este link para criar uma nova senha da sua conta iTatame.' });
  } catch (sendError) {
    console.error('Falha ao enviar recuperação de senha:', sendError);
    return NextResponse.json({ error: 'Não foi possível enviar o e-mail agora. Tente novamente mais tarde.' }, { status: 503 });
  }
  return NextResponse.json({ message: tipo === 'confirmacao' ? respostaConfirmacao : respostaGenerica });
}
