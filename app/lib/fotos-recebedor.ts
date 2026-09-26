import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { obterConfigMercadoPago } from "@/app/lib/mercado-pago-integracao";

export type ModeloRecebimentoFotos = "royalty" | "diaria_organizador";

export function modeloRecebimentoFotos(valor: unknown): ModeloRecebimentoFotos {
  return valor === "diaria_organizador" ? "diaria_organizador" : "royalty";
}

export async function obterRecebedorFotos(
  supabase: SupabaseClient,
  request: Request,
  pedido: { modelo_recebimento?: string | null; fotografo_id?: string | null; organizador_user_id?: string | null },
) {
  if (modeloRecebimentoFotos(pedido.modelo_recebimento) === "royalty") {
    if (!pedido.fotografo_id) return null;
    const { data, error } = await supabase.from("fotografos")
      .select("mp_access_token, mp_refresh_token, mp_public_key, mp_token_expires_at")
      .eq("id", pedido.fotografo_id).maybeSingle();
    if (error || !data?.mp_access_token) return null;
    const expiraEm = data.mp_token_expires_at ? new Date(data.mp_token_expires_at).getTime() : 0;
    if (!expiraEm || expiraEm > Date.now() + 5 * 60_000) {
      return { accessToken: String(data.mp_access_token), publicKey: data.mp_public_key ? String(data.mp_public_key) : null };
    }
    if (!data.mp_refresh_token) return null;
    const config = obterConfigMercadoPago(request, "retratt");
    if (!config.clientId || !config.clientSecret) return null;
    const response = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: data.mp_refresh_token,
      }),
    });
    const renovado = await response.json();
    if (!response.ok || !renovado.access_token) return null;
    const publicKey = renovado.public_key || data.mp_public_key || null;
    const { error: updateError } = await supabase.from("fotografos").update({
      mp_access_token: renovado.access_token,
      mp_refresh_token: renovado.refresh_token || data.mp_refresh_token,
      mp_public_key: publicKey,
      mp_token_expires_at: renovado.expires_in ? new Date(Date.now() + Number(renovado.expires_in) * 1000).toISOString() : null,
    }).eq("id", pedido.fotografo_id);
    if (updateError) return null;
    return { accessToken: String(renovado.access_token), publicKey: publicKey ? String(publicKey) : null };
  }

  if (!pedido.organizador_user_id) return null;
  const { data, error } = await supabase.from("foto_mp_organizadores")
    .select("mp_access_token, mp_refresh_token, mp_public_key, mp_token_expires_at")
    .eq("user_id", pedido.organizador_user_id).maybeSingle();
  if (error || !data?.mp_access_token) return null;

  const expiraEm = data.mp_token_expires_at ? new Date(data.mp_token_expires_at).getTime() : 0;
  if (!expiraEm || expiraEm > Date.now() + 5 * 60_000) {
    return { accessToken: String(data.mp_access_token), publicKey: data.mp_public_key ? String(data.mp_public_key) : null };
  }
  if (!data.mp_refresh_token) return null;

  const config = obterConfigMercadoPago(request, "retratt");
  if (!config.clientId || !config.clientSecret) return null;
  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: data.mp_refresh_token,
    }),
  });
  const renovado = await response.json();
  if (!response.ok || !renovado.access_token) return null;
  const publicKey = renovado.public_key || data.mp_public_key || null;
  const { error: updateError } = await supabase.from("foto_mp_organizadores").update({
    mp_access_token: renovado.access_token,
    mp_refresh_token: renovado.refresh_token || data.mp_refresh_token,
    mp_public_key: publicKey,
    mp_token_expires_at: renovado.expires_in ? new Date(Date.now() + Number(renovado.expires_in) * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("user_id", pedido.organizador_user_id);
  if (updateError) return null;
  return { accessToken: String(renovado.access_token), publicKey: publicKey ? String(publicKey) : null };
}
