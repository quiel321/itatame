import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { salvarMidiaPublica } from '@/app/lib/midia-publica-servidor';

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

  try {
    const { publicUrl } = await salvarMidiaPublica(Buffer.from(await file.arrayBuffer()), 'capa', 'retratt');
    return NextResponse.json({ publicUrl });
  } catch {
    return NextResponse.json({ error: 'Não foi possível enviar a capa. Tente novamente.' }, { status: 400 });
  }
}
