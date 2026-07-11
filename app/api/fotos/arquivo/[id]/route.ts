import { NextResponse } from "next/server";
import { createR2PresignedGetUrl } from "@/app/lib/r2";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const tipo = url.searchParams.get("tipo") || "preview";

    const supabase = createSupabaseServerClient();
    const { data: foto, error } = await supabase
      .from("foto_arquivos")
      .select("id, status, r2_original_key, r2_preview_key, r2_thumb_key, preview_url, thumb_url")
      .eq("id", id)
      .maybeSingle();

    if (error || !foto || foto.status !== "publicada") {
      return NextResponse.json({ error: "Foto nao encontrada." }, { status: 404 });
    }

    const key = tipo === "thumb"
      ? foto.r2_thumb_key || foto.r2_preview_key
      : foto.r2_preview_key || foto.r2_thumb_key;

    const urlPublica = tipo === "thumb"
      ? foto.thumb_url || foto.preview_url
      : foto.preview_url || foto.thumb_url;

    if (urlPublica && /^https?:\/\//.test(urlPublica)) {
      return NextResponse.redirect(urlPublica);
    }

    if (!key) {
      return NextResponse.json({ error: "Preview ainda nao gerado." }, { status: 404 });
    }

    const arquivo = await fetch(createR2PresignedGetUrl(key, 180), { cache: "no-store" });
    if (!arquivo.ok || !arquivo.body) {
      return NextResponse.json({ error: "Arquivo nao disponivel no R2." }, { status: arquivo.status || 502 });
    }

    return new NextResponse(arquivo.body, {
      status: 200,
      headers: {
        "Content-Type": arquivo.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "private, max-age=180",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao abrir preview." }, { status: 500 });
  }
}
