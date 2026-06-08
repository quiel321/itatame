import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, nome } = await request.json();

    const { data, error } = await resend.emails.send({
      from: 'iTatame <suporte@itatame.com.br>',
      to: email,
      subject: 'Bem-vindo ao iTatame! Oss 🥋',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #121214; color: #ffffff; padding: 40px 20px; text-align: center;">
          
          <!-- LOGO OFICIAL AQUI -->
          <img src="https://itatame.com.br/logo.svg" alt="iTatame Logo" style="height: 45px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />
          
          <h2 style="color: #ffffff;">Bem-vindo ao nosso tatame digital, ${nome ? nome : 'Atleta'}!</h2>
          
          <p style="color: #a1a1aa; font-size: 16px; line-height: 1.6; max-width: 600px; margin: 0 auto 30px;">
            Sua conta foi criada com sucesso. Agora você faz parte da plataforma definitiva de gestão e inscrições para campeonatos de Jiu-Jitsu.
          </p>
          
          <div style="background-color: #1e1e24; border-radius: 8px; padding: 20px; max-width: 500px; margin: 0 auto; text-align: left; border-left: 4px solid #dc2626;">
            <h3 style="color: #ffffff; margin-top: 0;">Próximos passos:</h3>
            <ul style="color: #a1a1aa; line-height: 1.8; padding-left: 20px;">
              <li>Complete seu perfil.</li>
              <li>Explore os próximos campeonatos e compre seu PPV.</li>
              <li>Garanta sua vaga na chave.</li>
            </ul>
          </div>
          
          <p style="margin-top: 40px; color: #71717a; font-size: 14px;">
            Nos vemos no tatame!<br><strong>Equipe iTatame</strong>
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