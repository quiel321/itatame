import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { email, nome, token } = await request.json();

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'suporteitatame@gmail.com',
        pass: process.env.SENHA_EMAIL,
      },
    });

    // TEMPLATE INSPIRADO NO CONCORRENTE (VERSÃO iTATAME PREMIUM)
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #050505; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #ffffff;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #050505; padding: 40px 20px;">
          <tr>
            <td align="center">
              
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #0a0a0e; border: 1px solid #1f1f22; border-radius: 12px; overflow: hidden; margin: 0 auto;">
                
                <tr>
                  <td align="center" style="padding: 40px 30px 20px 30px;">
                    <div style="font-size: 28px; font-weight: 900; font-style: italic; letter-spacing: -1px; margin-bottom: 20px;">
                      <span style="color: #dc2626;">i</span><span style="color: #ffffff;">TATAME</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0 0 5px 0; letter-spacing: 0.5px;">
                      Seu acesso está liberado!
                    </h1>
                    <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
                      1º Campeonato de Jiu-Jitsu Oficial
                    </p>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding: 0 30px;">
                    <hr style="border: 0; border-top: 2px solid #eab308; margin: 0;" />
                  </td>
                </tr>

                <tr>
                  <td align="left" style="padding: 30px;">
                    <p style="color: #e4e4e7; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
                      Olá, <strong style="color: #ffffff;">${nome}</strong>!<br><br>
                      Seu pagamento foi confirmado com sucesso. Clique no botão abaixo para assistir à transmissão ao vivo em alta definição.
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 35px;">
                      <tr>
                        <td align="center">
                          <a href="https://itatame.com.br/ppv/assistir?token=${token}" style="display: inline-block; background-color: #eab308; color: #000000; text-decoration: none; font-weight: 900; padding: 16px 32px; border-radius: 8px; font-size: 16px; box-shadow: 0 4px 15px rgba(234, 179, 8, 0.2);">
                            ▶ Assistir à transmissão agora
                          </a>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #121214; border: 1px solid #27272a; border-radius: 8px; margin-bottom: 20px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="color: #eab308; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 15px 0;">
                            Detalhes do Acesso
                          </p>
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color: #a1a1aa; font-size: 13px; padding-bottom: 10px;">Data do evento</td>
                              <td align="right" style="color: #ffffff; font-size: 13px; font-weight: bold; padding-bottom: 10px;">15 e 16/08/2026</td>
                            </tr>
                            <tr>
                              <td style="color: #a1a1aa; font-size: 13px;">Acesso válido até</td>
                              <td align="right" style="color: #ffffff; font-size: 13px; font-weight: bold;">16/08/2026 às 23:59</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #121214; border: 1px solid #27272a; border-radius: 8px; margin-bottom: 20px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="color: #ffffff; font-size: 12px; font-weight: bold; margin: 0 0 10px 0;">
                            Seu link de acesso (salve este e-mail):
                          </p>
                          <a href="https://itatame.com.br/ppv/assistir?token=${token}" style="display: block; color: #3b82f6; text-decoration: underline; font-size: 13px; word-break: break-all;">
                            https://itatame.com.br/ppv/assistir?token=${token}
                          </a>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a0505; border: 1px solid #450a0a; border-radius: 8px;">
                      <tr>
                        <td align="left" style="padding: 16px;">
                          <p style="color: #d1d5db; font-size: 12px; margin: 0; line-height: 1.5;">
                            <strong style="color: #eab308;">⚠️ Não compartilhe este link.</strong> O acesso é pessoal e intransferível. Se o link for aberto em outro dispositivo, o acesso atual pode ser encerrado.
                          </p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding: 0 30px 30px 30px;">
                    <div style="border-top: 1px solid #1f1f22; padding-top: 25px;">
                      <p style="color: #71717a; font-size: 11px; margin: 0 0 10px 0;">
                        Dúvidas? Fale com o suporte:
                      </p>
                     <p style="color: #a1a1aa; font-size: 12px; font-weight: bold; margin: 0;">
  <a href="mailto:suporteitatame@gmail.com" style="color: #a1a1aa; text-decoration: none;">✉️ suporteitatame@gmail.com</a> 
  &nbsp;|&nbsp; 
  <a href="https://api.whatsapp.com/send?phone=5565993059729" target="_blank" style="color: #25D366; text-decoration: none;">💬 WhatsApp: (65) 99305-9729</a>
</p>
                      <p style="color: #52525b; font-size: 10px; margin: 15px 0 0 0;">
                        Este e-mail foi enviado automaticamente após a confirmação do seu pagamento.
                      </p>
                    </div>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: '"iTATAME Transmissão" <suporteitatame@gmail.com>', 
      to: email,
      subject: '🎟️ Seu Acesso está Liberado! - iTATAME',
      html: htmlTemplate,
    });

    return NextResponse.json({ success: true, message: "E-mail enviado com sucesso" });

  } catch (error) {
    console.error("Erro ao enviar e-mail:", error);
    return NextResponse.json({ error: 'Erro interno ao enviar e-mail' }, { status: 500 });
  }
}