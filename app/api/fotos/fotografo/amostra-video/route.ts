import { NextResponse } from "next/server";
import { fotoStoragePath } from "@/app/lib/fotos";
import { obterFotografoDoUsuario } from "@/app/lib/fotos-auth";
import { createR2PresignedGetUrl, createR2PresignedPutUrl } from "@/app/lib/r2";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const fotografo = await obterFotografoDoUsuario(supabase, auth.user.id);
    if (!fotografo || fotografo.status !== "ativo") {
      return NextResponse.json({ error: "Perfil de fotógrafo inativo." }, { status: 403 });
    }

    const body = await request.json();
    const fotoId = String(body.fotoId || "");
    const etapa = String(body.etapa || "");
    if (!fotoId || (etapa !== "preparar" && etapa !== "confirmar")) {
      return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
    }

    const { data: foto, error: fotoError } = await supabase
      .from("foto_arquivos")
      .select("id, evento_id, album_id, fotografo_id, mime_type, status, r2_original_key")
      .eq("id", fotoId)
      .maybeSingle();
    if (fotoError) throw new Error(fotoError.message);
    if (!foto) return NextResponse.json({ error: "Vídeo não encontrado." }, { status: 404 });
    if (!String(foto.mime_type || "").startsWith("video/") || !foto.r2_original_key) {
      return NextResponse.json({ error: "Esta mídia não é um vídeo." }, { status: 400 });
    }
    if (foto.status === "processando" || foto.status === "erro") {
      return NextResponse.json({ error: "O envio deste vídeo não foi concluído. Envie o vídeo novamente." }, { status: 409 });
    }

    const { data: galeria, error: galeriaError } = await supabase
      .from("foto_eventos")
      .select("id, created_by, organizador_user_id")
      .eq("id", foto.evento_id)
      .maybeSingle();
    if (galeriaError) throw new Error(galeriaError.message);
    const acessoIntegral = galeria?.created_by === auth.user.id && !galeria?.organizador_user_id;
    if (!acessoIntegral && foto.fotografo_id !== fotografo.id) {
      return NextResponse.json({ error: "Este vídeo pertence a outro fotógrafo." }, { status: 403 });
    }

    const chaveAmostra = fotoStoragePath(foto.evento_id, foto.album_id, `${foto.id}-amostra`, "amostra.mp4");

    if (etapa === "preparar") {
      return NextResponse.json({
        originalUrl: createR2PresignedGetUrl(foto.r2_original_key, 900),
        uploadUrl: createR2PresignedPutUrl(chaveAmostra),
      });
    }

    const { error: updateError } = await supabase
      .from("foto_arquivos")
      .update({ r2_thumb_key: chaveAmostra })
      .eq("id", foto.id);
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível gerar a amostra." },
      { status: 500 },
    );
  }
}
