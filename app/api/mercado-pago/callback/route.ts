import crypto from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

type PerfilMercadoPago = "organizador" | "fotografo";

type OAuthState = {
  perfil?: PerfilMercadoPago;
  userId?: string;
  organizadorUserId?: string;
  returnTo?: string;
  ts: number;
};

function getBaseUrl(request: Request) {
  const origin = new URL(request.url).origin;
  return process.env.NEXT_PUBLIC_BASE_URL || origin;
}

function getRedirectUri(request: Request) {
  return process.env.MP_REDIRECT_URI || `${getBaseUrl(request)}/api/mercado-pago/callback`;
}

function getStateSecret() {
  return process.env.MP_OAUTH_STATE_SECRET || process.env.MP_CLIENT_SECRET || "";
}

function returnToSeguro(valor: string | null | undefined, perfil: PerfilMercadoPago) {
  if (valor && valor.startsWith("/") && !valor.startsWith("//")) return valor;
  return perfil === "fotografo" ? "/fotos/fotografo/dashboard" : "/admin";
}

function lerState(state: string | null): OAuthState | null {
  if (!state) return null;
  const [body, signature] = state.split(".");
  if (!body || !signature) return null;

  const expected = crypto.createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
  const quinzeMinutos = 15 * 60 * 1000;
  const userId = payload.userId || payload.organizadorUserId;
  if (!userId || Date.now() - payload.ts > quinzeMinutos) return null;

  return payload;
}

function credenciaisMercadoPago(tokenData: any, expiresAt: string | null) {
  return {
    mp_access_token: tokenData.access_token,
    mp_refresh_token: tokenData.refresh_token || null,
    mp_public_key: tokenData.public_key || null,
    mp_user_id: tokenData.user_id ? String(tokenData.user_id) : null,
    mp_token_expires_at: expiresAt,
    mp_connected_at: new Date().toISOString(),
    mp_scope: tokenData.scope || null,
    mp_live_mode: Boolean(tokenData.live_mode),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = lerState(url.searchParams.get("state"));
  const baseUrl = getBaseUrl(request);
  const perfil = state?.perfil === "fotografo" ? "fotografo" : "organizador";
  const userId = state?.userId || state?.organizadorUserId || "";
  const returnTo = returnToSeguro(state?.returnTo, perfil);

  if (error) {
    return NextResponse.redirect(`${baseUrl}${returnTo}?mp=erro&motivo=${encodeURIComponent(error)}`);
  }

  if (!code || !state || !userId) {
    return NextResponse.redirect(`${baseUrl}/admin?mp=erro&motivo=oauth_invalido`);
  }

  const clientId = process.env.MP_CLIENT_ID;
  const clientSecret = process.env.MP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseUrl}${returnTo}?mp=erro&motivo=env_mercado_pago`);
  }

  const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(request),
      test_token: process.env.MP_OAUTH_TEST_TOKEN === "true" ? "true" : "false",
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error("Erro OAuth Mercado Pago:", tokenData);
    return NextResponse.redirect(`${baseUrl}${returnTo}?mp=erro&motivo=token`);
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
    : null;

  const supabase = createSupabaseServerClient();
  const credenciais = credenciaisMercadoPago(tokenData, expiresAt);

  if (perfil === "fotografo") {
    const { data: fotografo } = await supabase.from("fotografos").select("id").eq("user_id", userId).maybeSingle();

    const resultado = fotografo?.id
      ? await supabase.from("fotografos").update(credenciais).eq("id", fotografo.id)
      : await supabase.from("fotografos").insert({
          user_id: userId,
          nome: "Fotógrafo",
          status: "ativo",
          ...credenciais,
        });

    if (resultado.error) {
      console.error("Erro ao salvar Mercado Pago do fotógrafo:", resultado.error);
      return NextResponse.redirect(`${baseUrl}${returnTo}?mp=erro&motivo=banco`);
    }
  } else {
    const { error: dbError } = await supabase
      .from("organizadores")
      .update(credenciais)
      .eq("user_id", userId);

    if (dbError) {
      console.error("Erro ao salvar credenciais Mercado Pago:", dbError);
      return NextResponse.redirect(`${baseUrl}${returnTo}?mp=erro&motivo=banco`);
    }
  }

  return NextResponse.redirect(`${baseUrl}${returnTo}?mp=conectado`);
}