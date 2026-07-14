import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { obterFotografoDoUsuario } from "@/app/lib/fotos-auth";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

function slugify(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });
    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const fotografo = await obterFotografoDoUsuario(supabase, auth.user.id);
    if (!fotografo || fotografo.status !== "ativo") return NextResponse.json({ error: "Perfil de fotógrafo inativo." }, { status: 403 });

    const body = await request.json();
    const nome = String(body.nome || "").trim();
    const cidade = String(body.cidade || "").trim();
    const estado = String(body.estado || "").trim().toUpperCase().slice(0, 2);
    const dataEvento = String(body.dataEvento || "").trim() || null;
    const capaUrl = String(body.capaUrl || "").trim() || null;
    const preco = Math.max(0, Math.round(Number(body.precoCentavos || 1500)));
    if (!nome) return NextResponse.json({ error: "Informe o nome da galeria." }, { status: 400 });

    const { data: galeria, error } = await supabase.from("foto_eventos").insert({
      nome,
      slug: `${slugify(nome)}-${crypto.randomUUID().slice(0, 8)}`,
      cidade: cidade || null,
      estado: estado || null,
      data_evento: dataEvento,
      capa_url: capaUrl,
      status: "publicado",
      preco_padrao_centavos: Number.isFinite(preco) ? preco : 1500,
      created_by: auth.user.id,
      organizador_user_id: null,
    }).select("id, nome").single();
    if (error || !galeria) return NextResponse.json({ error: error?.message || "Não foi possível criar a galeria." }, { status: 500 });

    const [vinculo, album] = await Promise.all([
      supabase.from("foto_evento_fotografos").upsert({ evento_id: galeria.id, fotografo_id: fotografo.id, status: "ativo" }, { onConflict: "evento_id,fotografo_id" }),
      supabase.from("foto_albuns").insert({ evento_id: galeria.id, fotografo_id: fotografo.id, titulo: "Geral", status: "publicado", ordem: 0 }),
    ]);
    if (vinculo.error || album.error) {
      await supabase.from("foto_eventos").delete().eq("id", galeria.id).eq("created_by", auth.user.id);
      return NextResponse.json({ error: vinculo.error?.message || album.error?.message || "Falha ao preparar a galeria." }, { status: 500 });
    }
    return NextResponse.json({ galeria });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao criar galeria." }, { status: 500 });
  }
}
