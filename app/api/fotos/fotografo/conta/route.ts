import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Exclusão temporariamente indisponível." }, { status: 503 });
    }
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user?.email) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    const email = String((await request.json()).email || "").trim().toLowerCase();
    if (email !== auth.user.email.toLowerCase()) {
      return NextResponse.json({ error: "Confirme o e-mail da sua conta." }, { status: 400 });
    }

    const { data: fotografo, error: perfilError } = await supabase
      .from("fotografos").select("id").eq("user_id", auth.user.id).maybeSingle();
    if (perfilError) throw new Error(perfilError.message);
    if (!fotografo) return NextResponse.json({ error: "Perfil de fotógrafo não encontrado." }, { status: 404 });

    const [galeriasAbertas, pedidosPendentes, credenciais, atleta, organizador, comprador, organizadorFotos, compras] = await Promise.all([
      supabase.from("foto_eventos").select("id", { count: "exact", head: true }).eq("created_by", auth.user.id).neq("status", "arquivado"),
      supabase.from("foto_pedidos").select("id", { count: "exact", head: true }).eq("fotografo_id", fotografo.id).eq("status", "pendente"),
      supabase.from("foto_evento_fotografos").select("evento_id, foto_eventos!inner(organizador_user_id)").eq("fotografo_id", fotografo.id).eq("status", "ativo"),
      supabase.from("atletas").select("id").eq("user_id", auth.user.id).limit(1),
      supabase.from("organizadores").select("user_id").eq("user_id", auth.user.id).limit(1),
      supabase.from("foto_compradores").select("id").eq("user_id", auth.user.id).limit(1),
      supabase.from("foto_organizadores").select("id").eq("id", auth.user.id).limit(1),
      supabase.from("foto_pedidos").select("id").eq("comprador_user_id", auth.user.id).limit(1),
    ]);
    const erro = [galeriasAbertas, pedidosPendentes, credenciais, atleta, organizador, comprador, organizadorFotos, compras].find((resultado) => resultado.error)?.error;
    if (erro) throw new Error(erro.message);
    if (galeriasAbertas.count) return NextResponse.json({ error: "Remova ou arquive suas galerias publicadas antes de excluir a conta." }, { status: 409 });
    if (pedidosPendentes.count) return NextResponse.json({ error: "Há pagamento pendente no Mercado Pago. Aguarde a confirmação ou cancelamento antes de excluir a conta." }, { status: 409 });
    if (credenciais.data?.some((item) => {
      const evento = Array.isArray(item.foto_eventos) ? item.foto_eventos[0] : item.foto_eventos;
      return Boolean(evento?.organizador_user_id);
    })) return NextResponse.json({ error: "Peça ao organizador para remover seu credenciamento ativo antes de excluir a conta." }, { status: 409 });

    const contaCompartilhada = Boolean(
      atleta.data?.length || organizador.data?.length || comprador.data?.length || organizadorFotos.data?.length || compras.data?.length || auth.user.user_metadata?.role,
    );
    if (auth.user.user_metadata?.foto_perfil === "fotografo") {
      const { error: metadataError } = await supabase.auth.admin.updateUserById(auth.user.id, { user_metadata: { foto_perfil: null } });
      if (metadataError) throw new Error(metadataError.message);
    }

    const { data: excluido, error: excluirError } = await supabase
      .from("fotografos").delete().eq("id", fotografo.id).eq("user_id", auth.user.id).select("id").maybeSingle();
    if (excluirError) throw new Error(excluirError.message);
    if (!excluido) throw new Error("O banco não confirmou a exclusão do perfil.");

    if (!contaCompartilhada) {
      const { error: usuarioError } = await supabase.auth.admin.deleteUser(auth.user.id);
      if (usuarioError) {
        return NextResponse.json({ excluido: true, contaCompartilhada: true, aviso: "O perfil de fotógrafo foi excluído, mas a conta de acesso precisa de limpeza pela equipe." });
      }
    }
    return NextResponse.json({ excluido: true, contaCompartilhada });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível excluir a conta." }, { status: 500 });
  }
}
