import { dataGaleriaValida } from "@/app/lib/fotos-data";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { obterFotografoDoUsuario } from "@/app/lib/fotos-auth";
import { validarFaixasDesconto } from "@/app/lib/fotos-descontos";
import { precosGaleriaValidos } from "@/app/lib/fotos-criacao-galeria";
import { categoriaFotosValida } from "@/app/lib/fotos-categorias";

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
    if (!dataGaleriaValida(String(body.dataEvento || ""))) return NextResponse.json({ error: "Informe uma data válida no formato DD/MM/AAAA." }, { status: 400 });
    const nome = String(body.nome || "").trim();
    const categoria = body.categoria;
    if (!categoriaFotosValida(categoria)) return NextResponse.json({ error: "Selecione a categoria do evento." }, { status: 400 });
    const cidade = String(body.cidade || "").trim();
    const estado = String(body.estado || "").trim().toUpperCase().slice(0, 2);
    const dataEvento = String(body.dataEvento || "").trim() || null;
    const capaUrl = String(body.capaUrl || "").trim() || null;
    const preco = Number(body.precoCentavos ?? 1500);
    const precoVideo = Number(body.precoVideoCentavos ?? 2500);
    const descontos = validarFaixasDesconto(body.descontosProgressivos ?? []);
    if (!descontos) return NextResponse.json({ error: "Revise as faixas de desconto: até cinco faixas, com quantidades e percentuais crescentes." }, { status: 400 });
    if (!nome) return NextResponse.json({ error: "Informe o nome da galeria." }, { status: 400 });
    if (!cidade || !/^[A-Z]{2}$/.test(estado)) return NextResponse.json({ error: "Selecione a cidade do evento na lista." }, { status: 400 });
    if (!precosGaleriaValidos(preco, precoVideo, body.downloadGratuito === true)) return NextResponse.json({ error: "Informe preços válidos para foto e vídeo, maiores que zero para venda e até R$ 10.000,00." }, { status: 400 });

    const { data: galeria, error } = await supabase.from("foto_eventos").insert({
      nome,
      categoria,
      slug: `${slugify(nome)}-${crypto.randomUUID().slice(0, 8)}`,
      cidade: cidade || null,
      estado: estado || null,
      data_evento: dataEvento,
      capa_url: capaUrl,
      status: "publicado",
      em_breve: Boolean(body.emBreve),
      acesso_por_link: Boolean(body.acessoPorLink),
      permite_download_gratis: Boolean(body.downloadGratuito),
      descontos_progressivos: body.downloadGratuito === true ? [] : descontos,
      preco_padrao_centavos: preco,
      preco_video_centavos: precoVideo,
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
