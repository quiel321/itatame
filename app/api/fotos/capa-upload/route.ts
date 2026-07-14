import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 });
  if (!TIPOS.has(file.type) || file.size > MAX_BYTES) return NextResponse.json({ error: "Use JPG, PNG ou WebP de até 10 MB." }, { status: 400 });

  const extensao = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const caminho = `fotos/${auth.user.id}/capa-${crypto.randomUUID()}.${extensao}`;
  const { error } = await supabase.storage.from("eventos").upload(caminho, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const publicUrl = supabase.storage.from("eventos").getPublicUrl(caminho).data.publicUrl;
  return NextResponse.json({ publicUrl });
}
