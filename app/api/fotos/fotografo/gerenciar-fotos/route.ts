import { NextResponse } from "next/server";
import { obterFotografoDoUsuario } from "@/app/lib/fotos-auth";
import { createR2PresignedGetUrl } from "@/app/lib/r2";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

function urlDaMiniatura(foto: {
  mime_type: string | null;
  thumb_url: string | null;
  preview_url: string | null;
  r2_thumb_key: string | null;
  r2_preview_key: string | null;
}) {
  const ehVideo = String(foto.mime_type || "").startsWith("video/");
  const urlPublica = ehVideo ? foto.preview_url || foto.thumb_url : foto.thumb_url || foto.preview_url;
  if (urlPublica && /^https?:\/\//.test(urlPublica)) return urlPublica;

  // Em vídeos, r2_thumb_key guarda a amostra em vídeo; a imagem de capa fica em r2_preview_key.
  const key = ehVideo ? foto.r2_preview_key : foto.r2_thumb_key || foto.r2_preview_key;
  return key ? createR2PresignedGetUrl(key, 600) : null;
}

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessario." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });

    const eventoId = new URL(request.url).searchParams.get("eventoId") || "";
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(eventoId)) return NextResponse.json({ error: "Galeria inválida." }, { status: 400 });

    const fotografo = await obterFotografoDoUsuario(supabase, auth.user.id);
    if (!fotografo || fotografo.status !== "ativo") {
      return NextResponse.json({ error: "Perfil de fotografo inativo." }, { status: 403 });
    }

    const { data: galeria, error: galeriaError } = await supabase
      .from("foto_eventos")
      .select("id, created_by, organizador_user_id")
      .eq("id", eventoId)
      .maybeSingle();

    if (galeriaError) throw new Error(galeriaError.message);
    if (!galeria) return NextResponse.json({ error: "Galeria nao encontrada." }, { status: 404 });

    const acessoIntegral = galeria.created_by === auth.user.id && !galeria.organizador_user_id;
    if (!acessoIntegral) {
      const { data: credencial, error: credencialError } = await supabase
        .from("foto_evento_fotografos")
        .select("id")
        .eq("evento_id", eventoId)
        .eq("fotografo_id", fotografo.id)
        .eq("status", "ativo")
        .maybeSingle();

      if (credencialError) throw new Error(credencialError.message);
      if (!credencial) return NextResponse.json({ error: "Fotografo nao credenciado nesta galeria." }, { status: 403 });
    }

    const consultarFotos = () => {
      let query = supabase
      .from("foto_arquivos")
      .select("id, evento_id, fotografo_id, titulo, mime_type, status, preco_centavos, thumb_url, preview_url, r2_thumb_key, r2_preview_key, created_at")
      .eq("evento_id", eventoId)
      .order("id");

      if (!acessoIntegral) query = query.eq("fotografo_id", fotografo.id);
      return query;
    };

    const { data: primeiraPagina, error: fotosError } = await consultarFotos().limit(500);
    if (fotosError) throw new Error(fotosError.message);
    const fotos = primeiraPagina || [];
    let pagina = primeiraPagina || [];
    while (pagina.length === 500) {
      const r = await consultarFotos().gt('id', pagina[pagina.length - 1].id).limit(500);
      if (r.error) throw new Error(r.error.message);
      pagina = r.data || []; fotos.push(...pagina);
    }
    fotos.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || String(a.id).localeCompare(String(b.id)));

    const fotoIds = (fotos || []).map((foto) => foto.id);
    const itens: { foto_id: string; foto_pedidos: unknown }[] = [];
    // URLs limitadas a 100 UUIDs; consulta única com centenas de IDs retorna Bad Request.
    for (let inicio = 0; inicio < fotoIds.length; inicio += 100) {
      let ultimoId = '';
      while (true) {
        let queryItens = supabase
          .from("foto_pedido_itens")
          .select("id, foto_id, foto_pedidos(status)")
          .in("foto_id", fotoIds.slice(inicio, inicio + 100)).order('id').limit(1000);
        if (ultimoId) queryItens = queryItens.gt('id', ultimoId);
        const r = await queryItens;
        if (r.error) throw new Error(r.error.message);
        itens.push(...(r.data || []));
        if (!r.data || r.data.length < 1000) break;
        ultimoId = r.data[r.data.length - 1].id;
      }
    }

    const situacaoPorFoto = new Map<string, "vendida" | "reservada" | "vinculada">();
    const vendasPorFoto = new Map<string, number>();
    const reservasPorFoto = new Map<string, number>();
    for (const item of itens || []) {
      const relacao = item.foto_pedidos as unknown;
      const pedido = (Array.isArray(relacao) ? relacao[0] : relacao) as { status?: string } | null;
      const situacao = pedido?.status === "pago"
        ? "vendida"
        : pedido?.status === "pendente"
          ? "reservada"
          : "vinculada";
      const atual = situacaoPorFoto.get(item.foto_id);
      if (!atual || situacao === "vendida" || (situacao === "reservada" && atual === "vinculada")) {
        situacaoPorFoto.set(item.foto_id, situacao);
      }
      if (situacao === "vendida") vendasPorFoto.set(item.foto_id, (vendasPorFoto.get(item.foto_id) || 0) + 1);
      if (situacao === "reservada") reservasPorFoto.set(item.foto_id, (reservasPorFoto.get(item.foto_id) || 0) + 1);
    }

    return NextResponse.json({
      acessoIntegral,
      fotos: (fotos || []).map((foto) => ({
        id: foto.id,
        evento_id: foto.evento_id,
        fotografo_id: foto.fotografo_id,
        titulo: foto.titulo,
        mime_type: foto.mime_type,
        status: foto.status,
        preco_centavos: foto.preco_centavos,
        situacao_pedido: situacaoPorFoto.get(foto.id) || null,
        quantidade_vendas: vendasPorFoto.get(foto.id) || 0,
        quantidade_reservas: reservasPorFoto.get(foto.id) || 0,
        created_at: foto.created_at,
        miniatura_url: urlDaMiniatura(foto),
        sem_amostra_video: String(foto.mime_type || "").startsWith("video/") && !foto.r2_thumb_key,
      })),
    }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization' } });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar fotos." },
      { status: 500 },
    );
  }
}
