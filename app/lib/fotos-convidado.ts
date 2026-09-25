import "server-only";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

function segredoAcesso() {
  const segredo = process.env.FOTOS_ACESSO_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo) throw new Error("Acesso de convidado não configurado.");
  return segredo;
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

export function normalizarEmail(valor: unknown) {
  const email = typeof valor === "string" ? valor.trim().toLowerCase() : "";
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

/** Token que permite a quem finalizou o pedido sem login pagar, acompanhar e baixar apenas aquele pedido. */
export function tokenAcessoPedido(pedidoId: string) {
  return crypto.createHmac("sha256", segredoAcesso()).update(`foto_pedido:${pedidoId}`).digest("base64url");
}

export function acessoPedidoValido(pedidoId: string, token: unknown) {
  if (!pedidoId || typeof token !== "string" || !token) return false;
  const esperado = Buffer.from(tokenAcessoPedido(pedidoId));
  const recebido = Buffer.from(token);
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
}

/** Link curto de download para o comprador logado: o navegador baixa direto, sem carregar o arquivo na memória. */
export function assinaturaDownloadItem(itemId: string, expira: number) {
  return crypto.createHmac("sha256", segredoAcesso()).update(`foto_download:${itemId}:${expira}`).digest("base64url");
}

export function linkDownloadItem(itemId: string, validadeSegundos = 300) {
  const expira = Math.floor(Date.now() / 1000) + validadeSegundos;
  const params = new URLSearchParams({ exp: String(expira), assinatura: assinaturaDownloadItem(itemId, expira) });
  return `/api/fotos/download/${itemId}?${params.toString()}`;
}

export function downloadItemValido(itemId: string, exp: string | null, assinatura: string | null) {
  const expira = Number(exp);
  if (!assinatura || !Number.isFinite(expira) || expira < Date.now() / 1000) return false;
  const esperado = Buffer.from(assinaturaDownloadItem(itemId, expira));
  const recebido = Buffer.from(assinatura);
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
}

/** Resolve quem pode operar um pedido: o usuário logado dono dele ou o portador do token do pedido. */
export async function autorizarPedido(
  supabase: SupabaseClient,
  request: Request,
  pedidoId: string,
  acesso?: unknown,
) {
  const token = bearerToken(request);
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    if (data.user) return { userId: data.user.id, convidado: false };
  }
  if (acessoPedidoValido(pedidoId, acesso)) return { userId: null, convidado: true };
  return null;
}

/**
 * Compra sem login: vincula o pedido a uma conta pelo e-mail informado.
 * Se ainda não existir, cria a conta sem senha; o comprador entra depois pelo código enviado ao e-mail.
 */
export async function obterOuCriarCompradorConvidado(
  supabase: SupabaseClient,
  { email, nome }: { email: string; nome: string },
) {
  const criado = await supabase.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { nome_completo: nome, foto_perfil: "comprador", origem: "retratt_compra_sem_login" },
  });

  if (criado.data.user) {
    await supabase.from("foto_compradores").insert({
      user_id: criado.data.user.id,
      nome,
      email,
      perfil_completo: false,
    });
    return { userId: criado.data.user.id, contaNova: true };
  }

  if (criado.error?.code !== "email_exists") {
    throw new Error(criado.error?.message || "Não foi possível registrar o comprador.");
  }

  // generateLink não envia e-mail; aqui serve só para descobrir o id da conta existente.
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.user) throw new Error("Não foi possível localizar a conta deste e-mail.");
  return { userId: data.user.id, contaNova: false };
}

export async function emailPossuiCompras(supabase: SupabaseClient, email: string) {
  const [pedidos, comprador] = await Promise.all([
    supabase.from("foto_pedidos").select("id").eq("comprador_email", email).limit(1),
    supabase.from("foto_compradores").select("user_id").eq("email", email).limit(1),
  ]);
  return Boolean(pedidos.data?.length || comprador.data?.length);
}

/** Gera o código de 6 dígitos e o link direto de entrada, sem depender das URLs de redirecionamento do Supabase. */
export async function gerarAcessoPorEmail(supabase: SupabaseClient, email: string, destino: string) {
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token || !data.properties.email_otp) {
    throw new Error("Não foi possível gerar o acesso por e-mail.");
  }
  const base = process.env.NEXT_PUBLIC_FOTOS_URL || "https://retratt.com";
  const link = new URL("/fotos/acesso", base);
  link.searchParams.set("token_hash", data.properties.hashed_token);
  link.searchParams.set("next", destino);
  return { codigo: data.properties.email_otp, link: link.toString() };
}
