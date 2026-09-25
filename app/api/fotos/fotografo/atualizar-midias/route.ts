import { NextResponse } from "next/server";
import { obterFotografoDoUsuario } from "@/app/lib/fotos-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

const LIMITE_POR_REQUISICAO = 500;
const PRECO_MINIMO_CENTAVOS = 100;
const PRECO_MAXIMO_CENTAVOS = 1_000_000;
const ACOES = new Set(["ocultar", "publicar", "preco"]);

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
    const acao = String(body.acao || "");
    if (!ACOES.has(acao)) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });

    const fotoIds = Array.from(new Set(
      (Array.isArray(body.fotoIds) ? body.fotoIds : []).map((id: unknown) => String(id)).filter(Boolean),
    )).slice(0, LIMITE_POR_REQUISICAO);
    if (!fotoIds.length) return NextResponse.json({ error: "Selecione ao menos uma mídia." }, { status: 400 });

    const precoCentavos = Math.round(Number(body.precoCentavos));
    if (acao === "preco" && (!Number.isFinite(precoCentavos) || precoCentavos < PRECO_MINIMO_CENTAVOS || precoCentavos > PRECO_MAXIMO_CENTAVOS)) {
      return NextResponse.json({ error: "O preço deve ficar entre R$ 1,00 e R$ 10.000,00." }, { status: 400 });
    }

    const { data: fotos, error: fotosError } = await supabase
      .from("foto_arquivos")
      .select("id, evento_id, fotografo_id, status")
      .in("id", fotoIds);
    if (fotosError) throw new Error(fotosError.message);
    if (!fotos?.length || fotos.length !== fotoIds.length) {
      return NextResponse.json({ error: "A seleção contém mídias inexistentes." }, { status: 404 });
    }

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
    if (naoAutorizadas.length) {
      return NextResponse.json({ error: "A seleção contém mídias de outro fotógrafo." }, { status: 403 });
    }

    const statusOrigem = acao === "ocultar" ? "publicada" : acao === "publicar" ? "oculta" : null;
    const alteracao = acao === "ocultar"
      ? { status: "oculta" }
      : acao === "publicar"
        ? { status: "publicada" }
        : { preco_centavos: precoCentavos };

    let consulta = supabase.from("foto_arquivos").update(alteracao).in("id", fotoIds);
    if (statusOrigem) consulta = consulta.eq("status", statusOrigem);
    else consulta = consulta.in("status", ["publicada", "oculta"]);

    const { data: atualizadas, error: updateError } = await consulta.select("id, status, preco_centavos");
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      atualizadas: atualizadas || [],
      ignoradas: fotoIds.length - (atualizadas || []).length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar mídias." },
      { status: 500 },
    );
  }
}
