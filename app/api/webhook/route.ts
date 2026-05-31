import { NextResponse } from 'next/server';
import { supabase } from '../../lib/supabase'; 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const paymentId = body?.data?.id || body?.resource?.split('/').pop();

    if (!paymentId) {
      return NextResponse.json({ success: true, message: "Webhook recebido sem ID" });
    }

    // Buscando a chave segura que configuramos na Vercel e no .env.local
    const MEU_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN; 

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${MEU_ACCESS_TOKEN}` 
      }
    });
    
    const paymentData = await mpResponse.json();

    console.log("Status do Pagamento no MP:", paymentData.status);

    if (paymentData.status === 'approved') {
      const tokenDoCliente = paymentData.external_reference;

      if (tokenDoCliente) {
        
        // 1. Atualiza o banco para 'pago' e EXIGE os dados de volta (.select().single())
        const { data: acessoAtualizado, error } = await supabase
          .from('ppv_acessos')
          .update({ status: 'pago' })
          .eq('token', tokenDoCliente)
          .select() 
          .single();
          
        if (error) {
          console.error("Erro ao atualizar banco:", error);
        } else if (acessoAtualizado) {
          
          // 2. Pagamento aprovado e banco atualizado! Hora de enviar o e-mail.
          const emailDoPagador = acessoAtualizado.email;
          
          // Define a URL base (Muda automaticamente se estiver no localhost ou na Vercel)
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://itatame.com.br';
          
          try {
            await fetch(`${baseUrl}/api/enviar-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                email: emailDoPagador, 
                nome: "Fã de Jiu-Jitsu", // Se quiser o nome real, precisará adicionar a coluna 'nome' na tabela ppv_acessos
                token: tokenDoCliente,
                eventoNome: "Copa iTatame Open 2026", 
                dataEvento: "15 de Agosto de 2026" 
              })
            });
            
            console.log("E-mail de acesso PPV disparado com sucesso para:", emailDoPagador);
          } catch (emailError) {
            console.error("Erro ao tentar disparar a rota de e-mail:", emailError);
          }
          
        }
      }
    }

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Erro no Webhook:", error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}