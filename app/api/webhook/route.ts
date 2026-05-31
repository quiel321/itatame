import { NextResponse } from 'next/server';
import { supabase } from '../../lib/supabase'; 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const paymentId = body?.data?.id || body?.resource?.split('/').pop();

    if (!paymentId) {
      return NextResponse.json({ success: true, message: "Webhook recebido sem ID" });
    }

    // 🔴 COLE A SUA CHAVE APP_USR... AQUI DENTRO DAS ASPAS SIMPLES
    const MEU_ACCESS_TOKEN = 'COLE_AQUI_SEU_APP_USR'; 

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${MEU_ACCESS_TOKEN}` 
      }
    });
    
    const paymentData = await mpResponse.json();

    if (paymentData.status === 'approved') {
      const tokenDoCliente = paymentData.external_reference;

      if (tokenDoCliente) {
        const { error } = await supabase
          .from('ppv_acessos')
          .update({ status: 'pago' })
          .eq('token', tokenDoCliente);
          
        if (error) {
          console.error("Erro ao atualizar banco:", error);
        }
      }
    }

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Erro no Webhook:", error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}