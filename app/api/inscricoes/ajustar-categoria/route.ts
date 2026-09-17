import { NextResponse } from "next/server";
import { autenticarRequest } from "@/app/lib/api-auth";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { CategoriaCompeticao, categoriaCompativel, categoriaCompativelSemPeso, rotuloCategoria } from "@/app/lib/categorias-competicao";
import { usuarioGerenciaInscricao } from "@/app/lib/inscricao-autorizacao";

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: "Entre na sua conta para ajustar a inscrição." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const inscricaoId = String(body.inscricaoId || "");
  const categoriaId = String(body.categoriaId || "");
  if (!inscricaoId || !categoriaId) return NextResponse.json({ error: "Escolha a inscrição e a categoria." }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const { data: inscricao, error: erroInscricao } = await supabase.from("inscricoes")
    .select("id,user_id,evento_id,categoria_id,categoria,idade,sexo,faixa,modalidade,peso,absoluto,pesagem_ok")
    .eq("id", inscricaoId).maybeSingle();
  if (erroInscricao || !inscricao) return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });

  if (!(await usuarioGerenciaInscricao(supabase, usuario.id, inscricao.user_id))) {
    return NextResponse.json({ error: "Você não pode alterar esta inscrição." }, { status: 403 });
  }

  const [{ data: evento }, { count: chaves, error: erroChaves }, { data: categorias, error: erroCategorias }] = await Promise.all([
    supabase.from("eventos").select("data_inicio_checagem,data_fim_checagem").eq("id", inscricao.evento_id).maybeSingle(),
    supabase.from("chaves").select("id", { count: "exact", head: true }).eq("evento_id", inscricao.evento_id),
    supabase.from("categorias_evento").select("*").eq("evento_id", inscricao.evento_id).eq("ativa", true).eq("tipo", "peso"),
  ]);
  if (!evento || erroChaves || erroCategorias) return NextResponse.json({ error: "Não foi possível conferir as regras do campeonato." }, { status: 500 });
  if (!evento.data_inicio_checagem || !evento.data_fim_checagem) {
    return NextResponse.json({ error: "A organização ainda não configurou o período de checagem." }, { status: 409 });
  }
  const agora = Date.now();
  if ((evento.data_inicio_checagem && agora < new Date(evento.data_inicio_checagem).getTime())
    || (evento.data_fim_checagem && agora > new Date(evento.data_fim_checagem).getTime())) {
    return NextResponse.json({ error: "A mudança de peso só pode ser feita durante a checagem." }, { status: 409 });
  }
  if (chaves) return NextResponse.json({ error: "As chaves já foram geradas. Procure a organização." }, { status: 409 });
  if (inscricao.pesagem_ok) return NextResponse.json({ error: "A pesagem oficial já foi confirmada. Procure a organização." }, { status: 409 });

  const lista = (categorias || []) as CategoriaCompeticao[];
  const destino = lista.find(c => c.id === categoriaId);
  if (!destino || !categoriaCompativelSemPeso(destino, inscricao)) {
    return NextResponse.json({ error: "Categoria indisponível para idade, faixa, sexo ou modalidade desta inscrição." }, { status: 400 });
  }
  const pesoInformado = String(body.pesoAtual ?? '').trim().replace(',', '.');
  const pesoMedido = Number(pesoInformado);
  const pesoInscricao = Number(String(inscricao.peso ?? '').replace(',', '.'));
  const pesoFinal = Number.isFinite(pesoMedido) && pesoMedido > 0 ? pesoMedido : pesoInscricao;
  if (!Number.isFinite(pesoFinal) || pesoFinal <= 0 || !categoriaCompativel(destino, { ...inscricao, peso: pesoFinal })) {
    return NextResponse.json({ error: "Informe o peso atual medido na academia, dentro do intervalo da categoria escolhida." }, { status: 400 });
  }
  const manterAbsoluto = body.manterAbsoluto === undefined ? Boolean(inscricao.absoluto) : body.manterAbsoluto === true;
  if (!inscricao.absoluto && manterAbsoluto) {
    return NextResponse.json({ error: "O absoluto só pode ser mantido se já fazia parte da inscrição." }, { status: 400 });
  }

  const pesoGravado = String(pesoFinal);
  const payload = {
    categoria_id: destino.id,
    categoria: rotuloCategoria(destino),
    absoluto: Boolean(inscricao.absoluto && manterAbsoluto),
    peso: pesoGravado,
  };
  const { data: atualizada, error: erroUpdate } = await supabase.from("inscricoes")
    .update(payload).eq("id", inscricao.id).eq("user_id", inscricao.user_id)
    .select("id,categoria,categoria_id,peso,absoluto").maybeSingle();
  if (erroUpdate || !atualizada) {
    return NextResponse.json({ error: erroUpdate?.message || "Não foi possível salvar o ajuste. Recarregue a inscrição e tente novamente." }, { status: 409 });
  }

  const { error: erroCadastro } = await supabase.from("atletas")
    .update({ peso: pesoGravado })
    .eq("user_id", inscricao.user_id);
  if (erroCadastro) {
    return NextResponse.json({ error: "A inscrição foi ajustada, mas o peso do cadastro não foi atualizado. Recarregue e tente novamente." }, { status: 409 });
  }

  return NextResponse.json({ success: true, inscricao: atualizada });
}
