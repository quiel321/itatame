import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  obterConfigMercadoPago,
  type MercadoPagoIntegracao,
} from "@/app/lib/mercado-pago-integracao";
import { autenticarRequest } from "@/app/lib/api-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

type PerfilMercadoPago = "organizador" | "fotografo" | "organizador_fotos";

type OAuthState = {
  integracao: MercadoPagoIntegracao;
  perfil: PerfilMercadoPago;
  userId: string;
  returnTo: string;
  ts: number;
};

function perfilValido(valor: string | null): PerfilMercadoPago {
  if (valor === "organizador_fotos") return "organizador_fotos";
  return valor === "fotografo" ? "fotografo" : "organizador";
}

function returnToSeguro(valor: string | null, perfil: PerfilMercadoPago, legadoAdmin: boolean) {
  if (valor && valor.startsWith("/") && !valor.startsWith("//")) return valor;
  if (legadoAdmin) return "/admin";
  return perfil === "fotografo" ? "/fotos/fotografo/dashboard" : perfil === "organizador_fotos" ? "/fotos/admin" : "/fotos/admin";
}

function assinarState(payload: OAuthState, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function urlAutorizacao(config: ReturnType<typeof obterConfigMercadoPago>, payload: OAuthState) {
  const mercadoPagoUrl = new URL("https://auth.mercadopago.com.br/authorization");
  mercadoPagoUrl.searchParams.set("client_id", config.clientId);
  mercadoPagoUrl.searchParams.set("response_type", "code");
  mercadoPagoUrl.searchParams.set("platform_id", "mp");
  mercadoPagoUrl.searchParams.set("redirect_uri", config.redirectUri);
  mercadoPagoUrl.searchParams.set("state", assinarState(payload, config.stateSecret));
  return mercadoPagoUrl;
}

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const perfil = perfilValido(body.perfil || null);

  const supabase = createSupabaseServerClient();
  const tabelaPerfil = perfil === "fotografo" ? "fotografos" : perfil === "organizador_fotos" ? "foto_organizadores" : "organizadores";
  const colunaUsuario = perfil === "organizador_fotos" ? "id" : "user_id";
  const { data: registroPerfil } = await supabase.from(tabelaPerfil).select("id").eq(colunaUsuario, usuario.id).maybeSingle();
  if (!registroPerfil) return NextResponse.json({ error: `${perfil === "fotografo" ? "Fotógrafo" : "Organizador"} não encontrado.` }, { status: 403 });

  const integracao: MercadoPagoIntegracao = perfil === "organizador" ? "itatame" : "retratt";
  const config = obterConfigMercadoPago(request, integracao);
  if (!config.clientId || !config.clientSecret || !config.stateSecret) {
    return NextResponse.json({ error: "Integração Mercado Pago não configurada." }, { status: 500 });
  }

  const payload: OAuthState = {
    integracao,
    perfil,
    userId: usuario.id,
    returnTo: returnToSeguro(body.returnTo || null, perfil, false),
    ts: Date.now(),
  };
  return NextResponse.json({ url: urlAutorizacao(config, payload).toString() });
}

export async function GET() {
  return NextResponse.json({ error: "Use o botão autenticado para conectar o Mercado Pago." }, { status: 405, headers: { Allow: "POST" } });
}
