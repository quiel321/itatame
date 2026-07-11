import type { SupabaseClient } from "@supabase/supabase-js";

export async function obterFotografoDoUsuario(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("fotografos")
    .select("id, user_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function fotografoPodePublicarNoEvento(
  supabase: SupabaseClient,
  eventoId: string,
  fotografoId: string,
) {
  const { data, error } = await supabase
    .from("foto_evento_fotografos")
    .select("id")
    .eq("evento_id", eventoId)
    .eq("fotografo_id", fotografoId)
    .eq("status", "ativo")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

