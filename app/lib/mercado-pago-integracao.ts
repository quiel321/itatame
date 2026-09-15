import type { SupabaseClient } from "@supabase/supabase-js";

export type MercadoPagoIntegracao = "itatame" | "retratt";

export type MercadoPagoConfig = {
  integracao: MercadoPagoIntegracao;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
  baseUrl: string;
};

function normalizarBaseUrl(valor: string | undefined, fallback: string) {
  return (valor || fallback).replace(/\/+$/, "");
}

export function detectarIntegracaoMercadoPago(
  request: Request,
  valor?: string | null,
): MercadoPagoIntegracao {
  if (valor === "retratt") return "retratt";
  if (valor === "itatame") return "itatame";

  const hostname = new URL(request.url).hostname.toLowerCase();
  let fotosHostname = "";
  try {
    fotosHostname = process.env.NEXT_PUBLIC_FOTOS_URL
      ? new URL(process.env.NEXT_PUBLIC_FOTOS_URL).hostname.toLowerCase()
      : "";
  } catch {
    fotosHostname = "";
  }

  return hostname === fotosHostname ||
    hostname === "retratt.com" ||
    hostname.endsWith(".retratt.com") ||
    hostname === "retratt.com.br" ||
    hostname.endsWith(".retratt.com.br")
    ? "retratt"
    : "itatame";
}

export function obterConfigMercadoPago(
  request: Request,
  integracao: MercadoPagoIntegracao,
): MercadoPagoConfig {
  const origin = new URL(request.url).origin;

  if (integracao === "retratt") {
    const baseUrl = normalizarBaseUrl(process.env.NEXT_PUBLIC_FOTOS_URL, origin);
    const clientSecret = process.env.RETRATT_MP_CLIENT_SECRET || "";

    return {
      integracao,
      clientId: process.env.RETRATT_MP_CLIENT_ID || "",
      clientSecret,
      redirectUri:
        process.env.RETRATT_MP_REDIRECT_URI ||
        `${baseUrl}/api/mercado-pago/callback`,
      stateSecret:
        process.env.RETRATT_MP_OAUTH_STATE_SECRET ||
        clientSecret,
      baseUrl,
    };
  }

  const baseUrl = normalizarBaseUrl(process.env.NEXT_PUBLIC_BASE_URL, origin);
  const clientSecret = process.env.MP_CLIENT_SECRET || "";

  return {
    integracao,
    clientId: process.env.MP_CLIENT_ID || "",
    clientSecret,
    redirectUri:
      process.env.MP_REDIRECT_URI ||
      `${baseUrl}/api/mercado-pago/callback`,
    stateSecret:
      process.env.MP_OAUTH_STATE_SECRET ||
      clientSecret,
    baseUrl,
  };
}

type OrganizadorMercadoPago = {
  user_id?: string | null;
  mp_access_token?: string | null;
  mp_refresh_token?: string | null;
  mp_token_expires_at?: string | null;
};

export async function obterAccessTokenOrganizador(
  request: Request,
  organizador: OrganizadorMercadoPago,
  supabase: SupabaseClient,
) {
  if (!organizador.mp_access_token) return null;
  const expiraEm = organizador.mp_token_expires_at ? new Date(organizador.mp_token_expires_at).getTime() : 0;
  if (!expiraEm || expiraEm > Date.now() + 5 * 60 * 1000 || !organizador.mp_refresh_token) {
    return organizador.mp_access_token;
  }

  const config = obterConfigMercadoPago(request, "itatame");
  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: organizador.mp_refresh_token,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error("Não foi possível renovar o Mercado Pago do organizador:", data);
    return expiraEm > Date.now() ? organizador.mp_access_token : null;
  }

  const tokenExpiresAt = data.expires_in
    ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
    : null;
  if (organizador.user_id) {
    await supabase.from("organizadores").update({
      mp_access_token: data.access_token,
      mp_refresh_token: data.refresh_token || organizador.mp_refresh_token,
      mp_token_expires_at: tokenExpiresAt,
      mp_scope: data.scope || null,
    }).eq("user_id", organizador.user_id);
  }
  return String(data.access_token);
}
