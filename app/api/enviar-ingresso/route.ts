import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Puxa a chave do .env.local
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { to, subject, html } = await request.json();

    const data = await resend.emails.send({
      from: 'iTatame <suporte@itatame.com.br>', 
      to: [to],
      subject: subject,
      html: html,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}