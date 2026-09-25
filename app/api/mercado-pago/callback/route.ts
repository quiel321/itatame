import crypto from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import {
  detectarIntegracaoMercadoPago,
  obterConfigMercadoPago,
  type MercadoPagoIntegracao,
} from "@/app/lib/mercado-pago-integracao";

type PerfilMercadoPago = "organizador" | "fotografo" | "organizador_fotos";

type TokenMercadoPago = {
  access_token?: string;
  refresh_token?: string | null;
  public_key?: string | null;
  user_id?: string | number | null;
  expires_in?: number | null;
  scope?: string | null;
  live_mode?: boolean;
};

type OAuthState = {
  integracao?: MercadoPagoIntegracao;
  perfil?: PerfilMercadoPago;
  userId?: string;
  organizadorUserId?: string;
  returnTo?: string;
  ts: number;
};

function returnToSeguro(valor: string | null | undefined, perfil: PerfilMercadoPago) {
  if (valor && valor.startsWith("/") && !valor.startsWith("//")) return valor;
  return perfil === "fotografo" ? "/fotos/fotografo/dashboard" : perfil === "organizador_fotos" ? "/fotos/admin" : "/admin";
}

function lerState(state: string | null, request: Request): OAuthState | null {
  if (!state) return null;
  const [body, signature] = state.split(".");
  if (!body || !signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    const integracao = payload.integracao === "retratt" ? "retratt" : "itatame";
    const config = obterConfigMercadoPago(request, integracao);
    if (!config.stateSecret) return null;

    const expected = crypto.createHmac("sha256", config.stateSecret).update(body).digest("base64url");
    const assinaturaRecebida = Buffer.from(signature);
    const assinaturaEsperada = Buffer.from(expected);
    if (
      assinaturaRecebida.length !== assinaturaEsperada.length ||
      !crypto.timingSafeEqual(assinaturaRecebida, assinaturaEsperada)
    ) return null;

    const quinzeMinutos = 15 * 60 * 1000;
    const userId = payload.userId || payload.organizadorUserId;
    if (!userId || !payload.ts || Date.now() - payload.ts > quinzeMinutos) return null;

    return { ...payload, integracao };
  } catch {
    return null;
  }
}

function credenciaisMercadoPago(tokenData: TokenMercadoPago, expiresAt: string | null) {
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
  const stateParam = url.searchParams.get("state");
  const state = lerState(stateParam, request);
  const integracao = state?.integracao || detectarIntegracaoMercadoPago(request);
  const config = obterConfigMercadoPago(request, integracao);
  const baseUrl = config.baseUrl;
  const perfil = state?.perfil === "fotografo" ? "fotografo" : state?.perfil === "organizador_fotos" ? "organizador_fotos" : "organizador";
  const userId = state?.userId || state?.organizadorUserId || "";
  const returnTo = returnToSeguro(state?.returnTo, perfil);

  if (error) {
    return NextResponse.redirect(`${baseUrl}${returnTo}?mp=erro&motivo=${encodeURIComponent(error)}`);
  }

  if (!code || !state || !userId) {
    return NextResponse.redirect(`${baseUrl}/admin?mp=erro&motivo=oauth_invalido`);
  }

  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(`${baseUrl}${returnTo}?mp=erro&motivo=env_mercado_pago`);
  }

  const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      state: stateParam || "",
    }),
  });

  const tokenData = await tokenResponse.json() as TokenMercadoPago;

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
  } else if (perfil === "organizador_fotos") {
    const { error: dbError } = await supabase.from("foto_mp_organizadores").upsert({
      user_id: userId,
      ...credenciais,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (dbError) {
      console.error("Erro ao salvar Mercado Pago do organizador Retratt:", dbError);
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
