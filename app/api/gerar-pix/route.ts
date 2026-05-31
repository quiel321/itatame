import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export async function POST(request: Request) {
  try {
    const { email, nome, tokenOriginal } = await request.json();

    // 1. Configura a sua conta do Mercado Pago
   const client = new MercadoPagoConfig({
   accessToken: process.env.MP_ACCESS_TOKEN || '', 
    });
    const payment = new Payment(client);

    // 2. Solicita a criação do Pix
    const resposta = await payment.create({
      body: {
        transaction_amount: 7.99, // Valor do seu PPV
        description: 'Acesso PPV - iTATAME (Ao Vivo)',
        payment_method_id: 'pix',
        external_reference: tokenOriginal, // Guarda o nosso token (tk_...) para identificarmos depois
        payer: {
          email: email,
          first_name: nome,
        },
      }
    });

    // 3. Captura o QR Code em Imagem e o texto "Copia e Cola"
    const qrCodeBase64 = resposta.point_of_interaction?.transaction_data?.qr_code_base64;
    const qrCodeCopiaECola = resposta.point_of_interaction?.transaction_data?.qr_code;
    const paymentId = resposta.id;

    return NextResponse.json({ 
      success: true, 
      qrCodeBase64, 
      qrCodeCopiaECola, 
      paymentId 
    });

  } catch (error) {
    console.error("Erro ao gerar Pix no MP:", error);
    return NextResponse.json({ error: 'Falha ao processar pagamento no Mercado Pago.' }, { status: 500 });
  }
}