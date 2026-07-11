import crypto from "crypto";
import { NextResponse } from "next/server";
import { createR2PresignedPutUrl } from "@/app/lib/r2";
import { fotoStoragePath } from "@/app/lib/fotos";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

function nomeSeguro(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessário para enviar fotos." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const body = await request.json();
    const eventoId = String(body.eventoId || "");
    const albumId = String(body.albumId || "");
    const fileName = String(body.fileName || "foto.jpg");
    const contentType = String(body.contentType || "");
    const size = Number(body.size || 0);
    const titulo = String(body.titulo || fileName).trim();
    const precoCentavos = Number(body.precoCentavos || 1500);

    if (!eventoId || !albumId) return NextResponse.json({ error: "Selecione evento e álbum." }, { status: 400 });
    if (!TIPOS_PERMITIDOS.has(contentType)) return NextResponse.json({ error: "Envie JPG, PNG ou WebP." }, { status: 400 });
    if (!size || size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Arquivo acima do limite de 5 MB." }, { status: 400 });

    let { data: fotografo } = await supabase.from("fotografos").select("id").eq("user_id", auth.user.id).maybeSingle();
    if (!fotografo) {
      const nome = auth.user.user_metadata?.nome_completo || auth.user.user_metadata?.nome || auth.user.email?.split("@")[0] || "Fotógrafo";
      const { data: novoFotógrafo, error: fotografoError } = await supabase
        .from("fotografos")
        .insert({ user_id: auth.user.id, nome, email: auth.user.email, status: "ativo" })
        .select("id")
        .single();

      if (fotografoError || !novoFotógrafo) {
        return NextResponse.json({ error: "Não foi possível criar o perfil do fotógrafo." }, { status: 500 });
      }
      fotografo = novoFotógrafo;
    }

    const { data: evento } = await supabase.from("foto_eventos").select("id, preco_padrao_centavos").eq("id", eventoId).maybeSingle();
    if (!evento) return NextResponse.json({ error: "Evento de fotos não encontrado." }, { status: 404 });

    const { data: album } = await supabase.from("foto_albuns").select("id").eq("id", albumId).eq("evento_id", eventoId).maybeSingle();
    if (!album) return NextResponse.json({ error: "Álbum não encontrado." }, { status: 404 });

    const fotoId = crypto.randomUUID();
    const key = fotoStoragePath(eventoId, albumId, fotoId, nomeSeguro(fileName));
    const previewKey = fotoStoragePath(eventoId, albumId, `${fotoId}-preview`, "preview.jpg");
    const precoFinal = Number.isFinite(precoCentavos) && precoCentavos >= 0 ? precoCentavos : Number(evento.preco_padrao_centavos || 1500);

    const { error: insertError } = await supabase.from("foto_arquivos").insert({
      id: fotoId,
      evento_id: eventoId,
      album_id: albumId,
      fotografo_id: fotografo.id,
      titulo: titulo || fileName,
      nome_original: fileName,
      mime_type: contentType,
      tamanho_bytes: size,
      r2_original_key: key,
      r2_preview_key: previewKey,
      preco_centavos: precoFinal,
      status: "processando",
    });

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    return NextResponse.json({
      fotoId,
      key,
      uploadUrl: createR2PresignedPutUrl(key),
      previewUploadUrl: createR2PresignedPutUrl(previewKey),
      previewKey,
      expiresIn: 900,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao gerar upload." }, { status: 500 });
  }
}
