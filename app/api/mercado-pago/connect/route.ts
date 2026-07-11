import crypto from "crypto";
import { NextResponse } from "next/server";

type PerfilMercadoPago = "organizador" | "fotografo";

type OAuthState = {
  perfil: PerfilMercadoPago;
  userId: string;
  returnTo: string;
  ts: number;
};

function getRedirectUri(request: Request) {
  const origin = new URL(request.url).origin;
  return process.env.MP_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || origin}/api/mercado-pago/callback`;
}

function getStateSecret() {
  return process.env.MP_OAUTH_STATE_SECRET || process.env.MP_CLIENT_SECRET || "";
}

function perfilValido(valor: string | null): PerfilMercadoPago {
  return valor === "fotografo" ? "fotografo" : "organizador";
}

function returnToSeguro(valor: string | null, perfil: PerfilMercadoPago, legadoAdmin: boolean) {
  if (valor && valor.startsWith("/") && !valor.startsWith("//")) return valor;
  if (legadoAdmin) return "/admin";
  return perfil === "fotografo" ? "/fotos/fotografo/dashboard" : "/fotos/admin";
}

function assinarState(payload: OAuthState) {
  const secret = getStateSecret();
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const legadoAdmin = Boolean(url.searchParams.get("organizador_id")) && !url.searchParams.get("perfil");
  const perfil = perfilValido(url.searchParams.get("perfil"));
  const userId = url.searchParams.get("user_id") || url.searchParams.get("organizador_id");
  const clientId = process.env.MP_CLIENT_ID;
  const stateSecret = getStateSecret();

  if (!userId) {
    return NextResponse.json({ error: "Usuário não informado." }, { status: 400 });
  }

  if (!clientId || !stateSecret) {
    return NextResponse.json(
      { error: "Configure MP_CLIENT_ID, MP_CLIENT_SECRET e MP_OAUTH_STATE_SECRET antes de conectar." },
      { status: 500 }
    );
  }

  const mercadoPagoUrl = new URL("https://auth.mercadopago.com.br/authorization");
  mercadoPagoUrl.searchParams.set("client_id", clientId);
  mercadoPagoUrl.searchParams.set("response_type", "code");
  mercadoPagoUrl.searchParams.set("platform_id", "mp");
  mercadoPagoUrl.searchParams.set("redirect_uri", getRedirectUri(request));
  mercadoPagoUrl.searchParams.set("state", assinarState({
    perfil,
    userId,
    returnTo: returnToSeguro(url.searchParams.get("return_to"), perfil, legadoAdmin),
    ts: Date.now(),
  }));

  return NextResponse.redirect(mercadoPagoUrl);
}