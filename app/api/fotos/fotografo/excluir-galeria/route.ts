import { NextResponse } from "next/server";
import { obterFotografoDoUsuario } from "@/app/lib/fotos-auth";
import { removerIaDaFoto } from "@/app/lib/fotos-ai-server";
import { deleteR2Object } from "@/app/lib/r2";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const CONCORRENCIA_LIMPEZA = 8;

type FotoGaleria = {
  id: string;
  r2_original_key: string | null;
  r2_preview_key: string | null;
  r2_thumb_key: string | null;
};

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

async function executarEmLotes<T>(itens: T[], tarefa: (item: T) => Promise<unknown>) {
  let proximo = 0;
  let falhas = 0;
  async function worker() {
    while (proximo < itens.length) {
      const item = itens[proximo++];
      try {
        await tarefa(item);
      } catch {
        falhas += 1;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_LIMPEZA, itens.length) }, () => worker()));
  return falhas;
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

    const galeriaId = String((await request.json()).galeriaId || "");
    if (!galeriaId) return NextResponse.json({ error: "Galeria não informada." }, { status: 400 });

    const { data: galeria, error: galeriaError } = await supabase
      .from("foto_eventos")
      .select("id, created_by, organizador_user_id")
      .eq("id", galeriaId)
      .maybeSingle();
    if (galeriaError) throw new Error(galeriaError.message);
    if (!galeria) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
    if (galeria.created_by !== auth.user.id || galeria.organizador_user_id) {
      return NextResponse.json({ error: "Apenas galerias freelancer criadas por você podem ser excluídas." }, { status: 403 });
    }

    const { count: pedidos, error: pedidosError } = await supabase
      .from("foto_pedidos")
      .select("id", { count: "exact", head: true })
      .eq("evento_id", galeriaId);
    if (pedidosError) throw new Error(pedidosError.message);
    if (pedidos) {
      return NextResponse.json(
        { error: "Esta galeria já tem pedidos e não pode ser excluída. Oculte as mídias para parar as vendas." },
        { status: 409 },
      );
    }

    const fotos: FotoGaleria[] = [];
    const pagina = 1000;
    for (let inicio = 0; ; inicio += pagina) {
      const { data, error } = await supabase
        .from("foto_arquivos")
        .select("id, r2_original_key, r2_preview_key, r2_thumb_key")
        .eq("evento_id", galeriaId)
        .range(inicio, inicio + pagina - 1);
      if (error) throw new Error(error.message);
      fotos.push(...((data || []) as FotoGaleria[]));
      if (!data || data.length < pagina) break;
    }

    const { error: excluirError } = await supabase
      .from("foto_eventos")
      .delete()
      .eq("id", galeriaId)
      .eq("created_by", auth.user.id)
      .is("organizador_user_id", null);
    if (excluirError) throw new Error(excluirError.message);

    const chaves = Array.from(new Set(
      fotos.flatMap((foto) => [foto.r2_original_key, foto.r2_preview_key, foto.r2_thumb_key]).filter(Boolean) as string[],
    ));
    const falhasR2 = await executarEmLotes(chaves, (key) => deleteR2Object(key));
    const falhasIa = await executarEmLotes(fotos, (foto) => removerIaDaFoto(foto.id));

    return NextResponse.json({
      excluida: true,
      midiasExcluidas: fotos.length,
      falhasR2,
      falhasIa,
      aviso: falhasR2 || falhasIa ? "A galeria foi excluída, mas alguns arquivos auxiliares precisam de nova tentativa de limpeza." : null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir a galeria." },
      { status: 500 },
    );
  }
}
