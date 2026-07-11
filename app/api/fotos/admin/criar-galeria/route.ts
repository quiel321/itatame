import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

function slugify(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessario." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });

    const { eventoId, precoCentavos, descontoComboQtd, descontoComboPercentual } = await request.json();
    if (!eventoId) return NextResponse.json({ error: "Selecione um evento." }, { status: 400 });

    const { data: evento, error: eventoError } = await supabase
      .from("eventos")
      .select("id, nome, local, cidade, estado, data_evento, banner_url, organizador_id")
      .eq("id", eventoId)
      .maybeSingle();

    if (eventoError || !evento) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    if (evento.organizador_id !== auth.user.id) {
      return NextResponse.json({ error: "Você não pode criar uma galeria para este evento." }, { status: 403 });
    }

    const { data: existente } = await supabase.from("foto_eventos").select("id").eq("evento_id", evento.id).maybeSingle();
    if (existente) return NextResponse.json({ error: "Esse evento já possui galeria de fotos." }, { status: 409 });

    const preco = Number.isFinite(Number(precoCentavos)) ? Math.max(0, Number(precoCentavos)) : 1500;
    const comboQtd = Number.isFinite(Number(descontoComboQtd)) ? Math.max(2, Math.round(Number(descontoComboQtd))) : 3;
    const comboPercentual = Number.isFinite(Number(descontoComboPercentual)) ? Math.min(90, Math.max(0, Number(descontoComboPercentual))) : 20;
    const { data: galeria, error: galeriaError } = await supabase
      .from("foto_eventos")
      .insert({
        evento_id: evento.id,
        nome: evento.nome,
        slug: `${slugify(evento.nome)}-${String(evento.id).slice(0, 8)}`,
        local: evento.local,
        cidade: evento.cidade,
        estado: evento.estado,
        data_evento: evento.data_evento,
        capa_url: evento.banner_url,
        status: "publicado",
        preco_padrao_centavos: preco,
        desconto_combo_qtd: comboQtd,
        desconto_combo_percentual: comboPercentual,
        created_by: auth.user.id,
        organizador_user_id: auth.user.id,
      })
      .select("id, nome")
      .single();

    if (galeriaError || !galeria) return NextResponse.json({ error: galeriaError?.message || "Nao foi possivel criar galeria." }, { status: 500 });

    const { error: albumError } = await supabase.from("foto_albuns").insert({ evento_id: galeria.id, titulo: "Geral", status: "publicado", ordem: 0 });
    if (albumError) return NextResponse.json({ error: albumError.message }, { status: 500 });

    return NextResponse.json({ galeria });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao criar galeria.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
