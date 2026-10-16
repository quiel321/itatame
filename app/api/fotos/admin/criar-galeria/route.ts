import { dataGaleriaValida } from "@/app/lib/fotos-data";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { categoriaFotosValida } from "@/app/lib/fotos-categorias";
import { validarFaixasDesconto } from "@/app/lib/fotos-descontos";
import { precosGaleriaValidos } from "@/app/lib/fotos-criacao-galeria";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const header = request.headers.get("authorization") || "";
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });
    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    const body = await request.json();
    if (!dataGaleriaValida(String(body.dataEvento || ""))) return NextResponse.json({ error: "Informe uma data válida no formato DD/MM/AAAA." }, { status: 400 });
    const { eventoId, categoria } = body;
    if (!categoriaFotosValida(categoria)) return NextResponse.json({ error: "Selecione a categoria do evento." }, { status: 400 });
    const [org, fotoOrg] = await Promise.all([
      supabase.from("organizadores").select("user_id").eq("user_id", auth.user.id).maybeSingle(),
      supabase.from("foto_organizadores").select("id").eq("id", auth.user.id).maybeSingle(),
    ]);
    if (!org.data && !fotoOrg.data) return NextResponse.json({ error: "Perfil de organizador necessário." }, { status: 403 });

    let evento: { id: string; nome: string; local: string | null; cidade: string | null; estado: string | null; data_evento: string | null; banner_url: string | null } | null = null;
    if (eventoId) {
      const { data, error } = await supabase.from("eventos")
        .select("id, nome, local, cidade, estado, data_evento, banner_url, organizador_id")
        .eq("id", eventoId).maybeSingle();
      if (error || !data) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
      if (data.organizador_id !== auth.user.id) return NextResponse.json({ error: "Você não pode criar uma galeria para este evento." }, { status: 403 });
      evento = data;
      const { data: existente, error: buscaError } = await supabase.from("foto_eventos").select("id").eq("evento_id", eventoId).maybeSingle();
      if (buscaError) throw new Error(buscaError.message);
      if (existente) return NextResponse.json({ error: "Esse evento já possui galeria de fotos." }, { status: 409 });
    }
    const nome = evento?.nome || String(body.nome || "").trim();
    const cidade = evento ? evento.cidade : String(body.cidade || "").trim();
    const estado = evento ? evento.estado : String(body.estado || "").trim().toUpperCase();
    if (!nome) return NextResponse.json({ error: "Informe o nome da galeria." }, { status: 400 });
    if (!evento && (!cidade || !estado || !/^[A-Z]{2}$/.test(estado))) return NextResponse.json({ error: "Selecione a cidade do evento na lista." }, { status: 400 });
    const preco = Number(body.precoCentavos ?? 1500);
    const precoVideo = Number(body.precoVideoCentavos ?? 2500);
    const gratuito = body.downloadGratuito === true;
    if (!precosGaleriaValidos(preco, precoVideo, gratuito)) return NextResponse.json({ error: "Informe preços válidos para foto e vídeo, maiores que zero para venda e até R$ 10.000,00." }, { status: 400 });
    const descontos = validarFaixasDesconto(body.descontosProgressivos ?? [{ quantidade: body.descontoComboQtd ?? 3, percentual: body.descontoComboPercentual ?? 20 }]);
    if (!descontos) return NextResponse.json({ error: "Revise as faixas de desconto: quantidades e percentuais devem crescer." }, { status: 400 });
    const slug = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    const { data: galeria, error } = await supabase.from("foto_eventos").insert({
      evento_id: evento?.id || null, nome, categoria,
      slug: `${slug}-${crypto.randomUUID().slice(0, 8)}`,
      local: evento?.local || null, cidade, estado,
      data_evento: evento ? evento.data_evento : body.dataEvento || null,
      capa_url: body.capaUrl || evento?.banner_url || null,
      status: "publicado", preco_padrao_centavos: preco, preco_video_centavos: precoVideo,
      preco_bloqueado: body.precoBloqueado === true,
      desconto_combo_qtd: descontos[0]?.quantidade || 3,
      desconto_combo_percentual: descontos[0]?.percentual || 0,
      descontos_progressivos: gratuito ? [] : descontos,
      em_breve: body.emBreve === true, acesso_por_link: body.acessoPorLink === true,
      permite_download_gratis: gratuito, created_by: auth.user.id, organizador_user_id: auth.user.id,
    }).select("id, nome").single();
    if (error || !galeria) return NextResponse.json({ error: error?.message || "Não foi possível criar a galeria." }, { status: 500 });
    const { error: albumError } = await supabase.from("foto_albuns").insert({ evento_id: galeria.id, titulo: "Geral", status: "publicado", ordem: 0 });
    if (albumError) {
      await supabase.from("foto_eventos").delete().eq("id", galeria.id).eq("organizador_user_id", auth.user.id);
      return NextResponse.json({ error: albumError.message }, { status: 500 });
    }
    return NextResponse.json({ galeria });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao criar galeria." }, { status: 500 });
  }
}
