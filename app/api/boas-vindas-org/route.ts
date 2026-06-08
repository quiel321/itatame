import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, nome } = await request.json();

    const { data, error } = await resend.emails.send({
      from: 'iTatame <suporte@itatame.com.br>', 
      to: email,
      subject: 'Bem-vindo à Central de Comando iTatame! 🥋',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #050505; color: #ffffff; padding: 40px 20px; text-align: center;">
          
          <!-- LOGO OFICIAL AQUI -->
          <img src="https://itatame.com.br/logo.svg" alt="iTatame Logo" style="height: 45px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />
          
          <h2 style="color: #ffffff;">Bem-vindo à Central de Comando, ${nome ? nome : 'Gestor'}!</h2>
          
          <p style="color: #a1a1aa; font-size: 16px; line-height: 1.6; max-width: 600px; margin: 0 auto 30px;">
            O seu cadastro como Organizador foi recebido com sucesso. Você acaba de dar o primeiro passo para elevar o nível dos seus campeonatos com a tecnologia líder do mercado.
          </p>
          
          <div style="background-color: #1e1e24; border-radius: 8px; padding: 20px; max-width: 500px; margin: 0 auto; text-align: left; border-left: 4px solid #eab308;">
            <h3 style="color: #eab308; margin-top: 0;">Status: Conta em Homologação ⏱️</h3>
            <p style="color: #a1a1aa; line-height: 1.6; font-size: 14px;">
              Para garantir a segurança do nosso ambiente e evitar fraudes, todas as novas contas de organizadores passam por uma rápida análise humana. 
              <br><br>
              A nossa equipe entrará em contato em breve para liberar o seu painel de criação de eventos.
            </p>
          </div>
          
          <p style="margin-top: 40px; color: #71717a; font-size: 14px;">
            Equipe de Gestão <br><strong>iTatame</strong>
          </p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}