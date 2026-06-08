import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const baseURL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    await fetch(`${baseURL}/api/enviar-ingresso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: "email_do_atleta_aqui@email.com",
        subject: `Seu Passaporte Confirmado! 🎫`,
        html: `<div style="font-family: Arial, sans-serif; background-color: #050505; color: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #1f2937; max-width: 500px; margin: auto;">
  <div style="text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 15px; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 26px; font-style: italic; font-weight: 900; color: #ffffff; letter-spacing: -1px;">
      <span style="color: #dc2626;">i</span>TATAME
    </h1>
    <p style="margin: 5px 0 0; color: #9ca3af; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 2px;">
      Passaporte Oficial
    </p>
  </div>
  <div style="padding: 10px 0;">
    <h2 style="font-size: 18px; margin: 0 0 10px 0; color: #ffffff;">Olá, Atleta! 🥋</h2>
    <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
      O seu pagamento foi aprovado e a sua inscrição está confirmada. Apresente o QR Code abaixo no dia do evento para liberar o seu acesso.
    </p>
    
    <div style="background-color: #ffffff; padding: 20px; border-radius: 12px; text-align: center; margin: 20px auto; width: 180px;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=iTatame-Ingresso-Aprovado" alt="QR Code Ingresso" style="width: 100%; max-width: 180px; display: block; margin: 0 auto;">
    </div>

      <p style="text-align: center; color: #dc2626; font-size: 11px; font-weight: bold; margin-top: 15px;">
      NÃO COMPARTILHE ESTE QR CODE. ELE É DE ACESSO ÚNICO.
        </p>
       </div>
      </div>
     `
      })
    });

    return NextResponse.json({ success: true, message: 'Processado e ingresso enviado!' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}