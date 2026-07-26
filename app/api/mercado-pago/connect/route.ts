import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  detectarIntegracaoMercadoPago,
  obterConfigMercadoPago,
  type MercadoPagoIntegracao,
} from "@/app/lib/mercado-pago-integracao";

type PerfilMercadoPago = "organizador" | "fotografo";

type OAuthState = {
  integracao: MercadoPagoIntegracao;
  perfil: PerfilMercadoPago;
  userId: string;
  returnTo: string;
  ts: number;
};

function perfilValido(valor: string | null): PerfilMercadoPago {
  return valor === "fotografo" ? "fotografo" : "organizador";
}

function returnToSeguro(valor: string | null, perfil: PerfilMercadoPago, legadoAdmin: boolean) {
  if (valor && valor.startsWith("/") && !valor.startsWith("//")) return valor;
  if (legadoAdmin) return "/admin";
  return perfil === "fotografo" ? "/fotos/fotografo/dashboard" : "/fotos/admin";
}

function assinarState(payload: OAuthState, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const legadoAdmin = Boolean(url.searchParams.get("organizador_id")) && !url.searchParams.get("perfil");
  const perfil = perfilValido(url.searchParams.get("perfil"));
  const userId = url.searchParams.get("user_id") || url.searchParams.get("organizador_id");
  const integracao = detectarIntegracaoMercadoPago(request, url.searchParams.get("integracao"));
  const config = obterConfigMercadoPago(request, integracao);

  if (!userId) {
    return NextResponse.json({ error: "Usuário não informado." }, { status: 400 });
  }

  if (!config.clientId || !config.clientSecret || !config.stateSecret) {
    const prefixo = integracao === "retratt" ? "RETRATT_MP" : "MP";
    return NextResponse.json(
      { error: `Configure ${prefixo}_CLIENT_ID, ${prefixo}_CLIENT_SECRET e o segredo de OAuth antes de conectar.` },
      { status: 500 }
    );
  }

  const mercadoPagoUrl = new URL("https://auth.mercadopago.com.br/authorization");
  mercadoPagoUrl.searchParams.set("client_id", config.clientId);
  mercadoPagoUrl.searchParams.set("response_type", "code");
  mercadoPagoUrl.searchParams.set("platform_id", "mp");
  mercadoPagoUrl.searchParams.set("redirect_uri", config.redirectUri);
  mercadoPagoUrl.searchParams.set("state", assinarState({
    integracao,
    perfil,
    userId,
    returnTo: returnToSeguro(url.searchParams.get("return_to"), perfil, legadoAdmin),
    ts: Date.now(),
  }, config.stateSecret));

  return NextResponse.redirect(mercadoPagoUrl);
}
