import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const tipo = form.get("tipo");
  if (tipo !== "avatar" && tipo !== "capa") {
    return NextResponse.json({ error: "Tipo de imagem inválido." }, { status: 400 });
  }
  if (!(file instanceof File) || file.type !== "image/webp" || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Envie uma imagem WebP comprimida de até 3 MB." }, { status: 400 });
  }

  const { data: perfil, error: perfilError } = await supabase.from("foto_organizadores")
    .select("id").eq("id", auth.user.id).maybeSingle();
  if (perfilError || !perfil) return NextResponse.json({ error: "Perfil de organizador não encontrado." }, { status: 404 });

  const caminho = `fotos-organizadores/${auth.user.id}/${tipo}-${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage.from("avatars")
    .upload(caminho, file, { contentType: "image/webp", upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const publicUrl = supabase.storage.from("avatars").getPublicUrl(caminho).data.publicUrl;
  const coluna = tipo === "avatar" ? "avatar_url" : "capa_url";
  const { data: atualizado, error: updateError } = await supabase.from("foto_organizadores")
    .update({ [coluna]: publicUrl }).eq("id", auth.user.id).select("id, avatar_url, capa_url").maybeSingle();
  if (updateError || !atualizado || atualizado[coluna] !== publicUrl) {
    await supabase.storage.from("avatars").remove([caminho]);
    return NextResponse.json({ error: updateError?.message || "Não foi possível salvar a imagem no perfil público." }, { status: 500 });
  }

  return NextResponse.json({ publicUrl });
}
