import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

function getPaymentId(body: any) {
  return body?.data?.id || body?.resource?.split("/").pop() || body?.id || null;
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const inscricaoId = url.searchParams.get("inscricao_id");
    const organizadorId = url.searchParams.get("organizador_id");
    const body = await request.json();
    const paymentId = getPaymentId(body);

    if (!paymentId || !inscricaoId || !organizadorId) {
      return NextResponse.json({ success: true, message: "Webhook sem dados suficientes." });
    }

    const supabase = createSupabaseServerClient();
    const { data: organizador } = await supabase
      .from("organizadores")
      .select("mp_access_token")
      .eq("user_id", organizadorId)
      .maybeSingle();

    if (!organizador?.mp_access_token) {
      return NextResponse.json({ success: true, message: "Organizador sem Mercado Pago." });
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${organizador.mp_access_token}` },
    });
    const paymentData = await paymentResponse.json();

    if (paymentData.external_reference !== `inscricao:${inscricaoId}`) {
      return NextResponse.json({ success: true, message: "Referencia externa divergente." });
    }

    if (paymentData.status === "approved") {
      await supabase
        .from("inscricoes")
        .update({ pagamento_ok: true })
        .eq("id", inscricaoId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no webhook Mercado Pago:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}