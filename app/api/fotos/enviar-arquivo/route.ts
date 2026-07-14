import { NextResponse } from "next/server";
import { obterFotografoDoUsuario } from "@/app/lib/fotos-auth";
import { FOTO_IA_MAX_BYTES, fotoIaStorageKey } from "@/app/lib/fotos-ai";
import { createR2PresignedPutUrl, deleteR2Object } from "@/app/lib/r2";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

const MAX_ARQUIVO_BYTES = 3 * 1024 * 1024;
const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessario." }, { status: 401 });

    const fotoId = request.headers.get("x-foto-id") || "";
    const tipoArquivo = request.headers.get("x-arquivo-tipo") || "";
    const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();

    if (!fotoId || !["original", "preview", "ia"].includes(tipoArquivo)) {
      return NextResponse.json({ error: "Arquivo de foto nao identificado." }, { status: 400 });
    }
    if (!TIPOS_PERMITIDOS.has(contentType)) {
      return NextResponse.json({ error: "Formato de imagem nao permitido." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });

    const fotografo = await obterFotografoDoUsuario(supabase, auth.user.id);
    if (!fotografo || fotografo.status !== "ativo") {
      return NextResponse.json({ error: "Perfil de fotografo inativo." }, { status: 403 });
    }

    const { data: foto, error: fotoError } = await supabase
      .from("foto_arquivos")
      .select("id, fotografo_id, status, r2_original_key, r2_preview_key")
      .eq("id", fotoId)
      .maybeSingle();

    if (fotoError) throw new Error(fotoError.message);
    if (!foto || foto.fotografo_id !== fotografo.id) {
      return NextResponse.json({ error: "Foto nao encontrada ou sem permissao." }, { status: 403 });
    }
    if (foto.status !== "processando") {
      return NextResponse.json({ error: "Este upload ja foi finalizado." }, { status: 409 });
    }
    const fotoValidada = foto;
    const fotografoId = fotografo.id;

    async function limparUploadIncompleto() {
      await supabase
        .from("foto_arquivos")
        .delete()
        .eq("id", fotoValidada.id)
        .eq("fotografo_id", fotografoId)
        .eq("status", "processando");

      const chaves = [fotoValidada.r2_original_key, fotoValidada.r2_preview_key, fotoIaStorageKey(fotoValidada.id)].filter(Boolean) as string[];
      await Promise.allSettled(chaves.map((key) => deleteR2Object(key)));
    }

    const corpo = await request.arrayBuffer();
    const limiteBytes = tipoArquivo === "ia" ? FOTO_IA_MAX_BYTES : MAX_ARQUIVO_BYTES;
    if (!corpo.byteLength || corpo.byteLength > limiteBytes) {
      await limparUploadIncompleto();
      const limite = tipoArquivo === "ia" ? "300 KB" : "3 MB";
      return NextResponse.json({ error: `O arquivo precisa ter no maximo ${limite}.` }, { status: 413 });
    }

    const key = tipoArquivo === "ia"
      ? fotoIaStorageKey(fotoValidada.id)
      : tipoArquivo === "preview"
        ? fotoValidada.r2_preview_key
        : fotoValidada.r2_original_key;
    if (!key) return NextResponse.json({ error: "Destino do arquivo nao configurado." }, { status: 500 });

    const r2Response = await fetch(createR2PresignedPutUrl(key, 300), {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: corpo,
      cache: "no-store",
    });

    if (!r2Response.ok) {
      await limparUploadIncompleto();
      return NextResponse.json({ error: `O R2 recusou o arquivo (${r2Response.status}).` }, { status: 502 });
    }

    return NextResponse.json({ ok: true, tipo: tipoArquivo, tamanho: corpo.byteLength });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao enviar arquivo." },
      { status: 500 },
    );
  }
}
