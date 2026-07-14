import { NextResponse } from "next/server";
import { obterFotografoDoUsuario } from "@/app/lib/fotos-auth";
import { removerIaDaFoto } from "@/app/lib/fotos-ai-server";
import { deleteR2Object } from "@/app/lib/r2";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

const LIMITE_POR_REQUISICAO = 100;

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessario." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });

    const fotografo = await obterFotografoDoUsuario(supabase, auth.user.id);
    if (!fotografo || fotografo.status !== "ativo") {
      return NextResponse.json({ error: "Perfil de fotografo inativo." }, { status: 403 });
    }

    const body = await request.json();
    const fotoIds = Array.from(new Set(
      (Array.isArray(body.fotoIds) ? body.fotoIds : []).map((id: unknown) => String(id)).filter(Boolean),
    )).slice(0, LIMITE_POR_REQUISICAO);

    if (!fotoIds.length) return NextResponse.json({ error: "Selecione ao menos uma foto." }, { status: 400 });

    const { data: fotos, error: fotosError } = await supabase
      .from("foto_arquivos")
      .select("id, evento_id, fotografo_id, r2_original_key, r2_preview_key, r2_thumb_key")
      .in("id", fotoIds);

    if (fotosError) throw new Error(fotosError.message);
    if (!fotos?.length) return NextResponse.json({ error: "Fotos nao encontradas." }, { status: 404 });

    const eventoIds = Array.from(new Set(fotos.map((foto) => foto.evento_id)));
    const { data: galerias, error: galeriasError } = await supabase
      .from("foto_eventos")
      .select("id, created_by, organizador_user_id")
      .in("id", eventoIds);

    if (galeriasError) throw new Error(galeriasError.message);
    const galeriasPorId = new Map((galerias || []).map((galeria) => [galeria.id, galeria]));

    const naoAutorizadas = fotos.filter((foto) => {
      const galeria = galeriasPorId.get(foto.evento_id);
      const acessoIntegral = galeria?.created_by === auth.user.id && !galeria?.organizador_user_id;
      return !acessoIntegral && foto.fotografo_id !== fotografo.id;
    });

    if (naoAutorizadas.length || fotos.length !== fotoIds.length) {
      return NextResponse.json(
        { error: "A selecao contem fotos inexistentes ou pertencentes a outro fotografo." },
        { status: 403 },
      );
    }

    const { data: itensVendidos, error: itensError } = await supabase
      .from("foto_pedido_itens")
      .select("foto_id")
      .in("foto_id", fotoIds);

    if (itensError) throw new Error(itensError.message);
    if (itensVendidos?.length) {
      return NextResponse.json(
        { error: "Fotos vinculadas a pedidos nao podem ser excluidas.", protegidas: itensVendidos.map((item) => item.foto_id) },
        { status: 409 },
      );
    }

    const { data: excluidas, error: excluirError } = await supabase
      .from("foto_arquivos")
      .delete()
      .in("id", fotoIds)
      .select("id");

    if (excluirError) throw new Error(excluirError.message);
    if ((excluidas || []).length !== fotos.length) {
      throw new Error("O banco nao confirmou a exclusao de todas as fotos.");
    }

    const chaves = Array.from(new Set(
      fotos.flatMap((foto) => [foto.r2_original_key, foto.r2_preview_key, foto.r2_thumb_key]).filter(Boolean) as string[],
    ));
    const resultadosR2 = await Promise.allSettled(chaves.map((key) => deleteR2Object(key)));
    const falhasR2 = resultadosR2.filter((resultado) => resultado.status === "rejected").length;
    const resultadosIa = await Promise.allSettled(fotos.map((foto) => removerIaDaFoto(foto.id)));
    const falhasIa = resultadosIa.filter((resultado) => resultado.status === "rejected").length;

    return NextResponse.json({
      excluidas: (excluidas || []).map((foto) => foto.id),
      arquivosR2Excluidos: chaves.length - falhasR2,
      falhasR2,
      falhasIa,
      aviso: falhasR2 || falhasIa ? "As fotos sairam do banco, mas alguns arquivos auxiliares precisam de nova tentativa de limpeza." : null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir fotos." },
      { status: 500 },
    );
  }
}
