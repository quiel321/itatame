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
