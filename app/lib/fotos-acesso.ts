import type { SupabaseClient, User } from "@supabase/supabase-js";

export type PerfilFotos = "comprador" | "fotografo" | "organizador";

function perfilDosMetadados(user: User): PerfilFotos | null {
  const perfil = user.user_metadata?.foto_perfil;
  return perfil === "comprador" || perfil === "fotografo" || perfil === "organizador" ? perfil : null;
}

export async function resolverPerfilFotos(supabase: SupabaseClient, user: User): Promise<PerfilFotos | null> {
  const perfilMetadata = perfilDosMetadados(user);
  if (perfilMetadata) return perfilMetadata;

  const [fotografo, organizador, comprador] = await Promise.all([
    supabase.from("fotografos").select("id").eq("user_id", user.id).maybeSingle(),
    supabase.from("organizadores").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("foto_compradores").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  if (fotografo.data) return "fotografo";
  if (organizador.data) return "organizador";
  if (comprador.data) return "comprador";
  return null;
}

export async function podeAcessarPerfilFotos(
  supabase: SupabaseClient,
  user: User,
  esperado: PerfilFotos,
): Promise<boolean> {
  const perfil = await resolverPerfilFotos(supabase, user);
  if (!perfil && esperado === "comprador") return true;
  return perfil === esperado;
}

export function rotaPainelFotos(perfil: PerfilFotos | null) {
  if (perfil === "fotografo") return "/fotos/fotografo/dashboard";
  if (perfil === "organizador") return "/fotos/admin";
  return "/fotos/comprador";
}

export function rotaLoginFotos(perfil: PerfilFotos, next?: string, trocar = false) {
  const params = new URLSearchParams({ perfil });
  if (next) params.set("next", next);
  if (trocar) params.set("trocar", "1");
  return `/fotos/login?${params.toString()}`;
}
