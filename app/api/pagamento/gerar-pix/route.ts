import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { nome, cpf, email, valor, inscricao_id } = await request.json();

    // ⚠️ Use a URL de Sandbox para testar. Depois troque para https://api.asaas.com
    const ASAAS_URL = "https://sandbox.asaas.com/api/v3"; 
    const ASAAS_KEY = process.env.ASAAS_API_KEY; // Coloque sua chave no .env.local

    if (!ASAAS_KEY) throw new Error("Chave do Asaas não configurada.");

    // 1. CRIAR OU BUSCAR O CLIENTE NO ASAAS
    const customerReq = await fetch(`${ASAAS_URL}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": ASAAS_KEY },
      body: JSON.stringify({ name: nome, cpfCnpj: cpf, email: email })
    });
    const customer = await customerReq.json();
    
    if (customer.errors) throw new Error(customer.errors[0].description);

    // 2. GERAR A COBRANÇA PIX
    const paymentReq = await fetch(`${ASAAS_URL}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": ASAAS_KEY },
      body: JSON.stringify({
        customer: customer.id,
        billingType: "PIX",
        value: valor,
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Vence amanhã
        description: `Inscrição iTatame #${inscricao_id}`,
        externalReference: inscricao_id // 🔥 O PULO DO GATO: Salvamos o ID da inscrição aqui!
      })
    });
    const payment = await paymentReq.json();

    if (payment.errors) throw new Error(payment.errors[0].description);

    // 3. PEGAR O QR CODE E O "COPIA E COLA"
    const qrCodeReq = await fetch(`${ASAAS_URL}/payments/${payment.id}/pixQrCode`, {
      method: "GET",
      headers: { "access_token": ASAAS_KEY }
    });
    const qrCode = await qrCodeReq.json();

    // Retorna para o Frontend desenhar na tela
    return NextResponse.json({
      success: true,
      qrCodeImage: qrCode.encodedImage, // A imagem base64
      pixCopiaECola: qrCode.payload,    // O texto para copiar
      cobrancaId: payment.id
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}