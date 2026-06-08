import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";

type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type AssinaturaPush = {
  user_id: string;
  subscription: PushSubscriptionJSON | string | null;
};

type NotificarBody = {
  atleta_id?: number | string;
  user_id?: string;
  titulo?: string;
  title?: string;
  mensagem?: string;
  body?: string;
  url?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseServer =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

function normalizarAssinatura(raw: AssinaturaPush["subscription"]): PushSubscriptionJSON | null {
  if (!raw) return null;
  const subscription = typeof raw === "string" ? JSON.parse(raw) : raw;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return null;
  }

  return subscription;
}

async function buscarUserId(atletaId?: number | string, userId?: string) {
  if (userId) return userId;
  if (!atletaId || !supabaseServer) return null;

  const { data, error } = await supabaseServer
    .from("atletas")
    .select("user_id")
    .eq("id", atletaId)
    .maybeSingle();

  if (error) throw error;
  return data?.user_id || null;
}

function getStatusCode(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? Number((error as { statusCode?: unknown }).statusCode)
    : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao enviar notificacao.";
}

export async function POST(request: Request) {
  try {
    if (!supabaseServer) {
      return NextResponse.json({ success: false, error: "Supabase nao configurado." }, { status: 500 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      return NextResponse.json({ success: false, error: "Chaves VAPID nao configuradas." }, { status: 500 });
    }

    webpush.setVapidDetails("mailto:suporte@itatame.com.br", publicKey, privateKey);

    const body = (await request.json()) as NotificarBody;
    const destinoUserId = await buscarUserId(body.atleta_id, body.user_id);

    if (!destinoUserId) {
      return NextResponse.json({ success: false, error: "Atleta sem user_id encontrado." }, { status: 404 });
    }

    const { data: assinaturas, error } = await supabaseServer
      .from("assinaturas_push")
      .select("user_id, subscription")
      .eq("user_id", destinoUserId);

    if (error) throw error;

    const payload = JSON.stringify({
      title: body.titulo || body.title || "iTatame",
      body: body.mensagem || body.body || "Voce tem uma atualizacao no evento.",
      icon: "/logo.svg",
      badge: "/logo.svg",
      url: body.url || "/perfil",
    });

    let enviadas = 0;
    let removidas = 0;

    for (const assinatura of (assinaturas || []) as AssinaturaPush[]) {
      const subscription = normalizarAssinatura(assinatura.subscription);
      if (!subscription) continue;

      try {
        await webpush.sendNotification(subscription, payload);
        enviadas += 1;
      } catch (err: unknown) {
        const statusCode = getStatusCode(err);

        if (statusCode === 404 || statusCode === 410) {
          await supabaseServer.from("assinaturas_push").delete().eq("user_id", destinoUserId);
          removidas += 1;
          continue;
        }

        throw err;
      }
    }

    return NextResponse.json({
      success: true,
      sent: enviadas,
      removed: removidas,
      subscribed: (assinaturas || []).length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
