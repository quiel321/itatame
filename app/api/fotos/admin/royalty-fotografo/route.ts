import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import {
  COMISSAO_ITATAME_FOTOS_PERCENTUAL,
  LIMITE_ROYALTY_ORGANIZADOR_PERCENTUAL,
} from "@/app/lib/fotos-financeiro";

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

    const body = await request.json();
    const eventoId = String(body.eventoId || "");
    const fotografoId = String(body.fotografoId || "");
    const percentual = Number(String(body.percentual ?? "0").replace(",", "."));
    if (!eventoId || !fotografoId || !Number.isFinite(percentual)) {
      return NextResponse.json({ error: "Galeria, fotógrafo e percentual são obrigatórios." }, { status: 400 });
    }
    if (percentual < 0 || percentual > LIMITE_ROYALTY_ORGANIZADOR_PERCENTUAL) {
      return NextResponse.json(
        {
          error: `O royalty deve ficar entre 0% e ${LIMITE_ROYALTY_ORGANIZADOR_PERCENTUAL}%. A comissão de ${COMISSAO_ITATAME_FOTOS_PERCENTUAL}% do Itatame é preservada em toda venda.`,
        },
        { status: 400 },
      );
    }

    const { data: evento, error: eventoError } = await supabase
      .from("foto_eventos")
      .select("id, organizador_user_id")
      .eq("id", eventoId)
      .maybeSingle();
    if (eventoError || !evento) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
    if (evento.organizador_user_id !== auth.user.id) {
      return NextResponse.json({ error: "Você não administra esta galeria." }, { status: 403 });
    }

    const { data: vinculo, error } = await supabase
      .from("foto_evento_fotografos")
      .update({ comissao_organizador_percentual: percentual })
      .eq("evento_id", eventoId)
      .eq("fotografo_id", fotografoId)
      .eq("status", "ativo")
      .select("evento_id, fotografo_id, comissao_organizador_percentual")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!vinculo) return NextResponse.json({ error: "Fotógrafo não está credenciado nesta galeria." }, { status: 404 });

    return NextResponse.json({ vinculo });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar o royalty." },
      { status: 500 },
    );
  }
}
