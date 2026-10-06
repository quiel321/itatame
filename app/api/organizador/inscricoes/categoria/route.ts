import { NextResponse } from 'next/server';
import { autenticarRequest } from '@/app/lib/api-auth';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { rotuloCategoria, type CategoriaCompeticao } from '@/app/lib/categorias-competicao';
import { categoriaPermitidaAoOrganizador } from '@/app/lib/ajuste-categoria-organizador';
import { inscricaoSomenteAbsoluto } from '@/app/lib/valor-inscricao';

export async function PATCH(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: 'Entre com a conta do organizador.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const inscricaoId = String(body.inscricaoId || '').trim();
  const categoriaId = String(body.categoriaId || '').trim();
  const motivo = String(body.motivo || '').trim();
  if (!/^\d+$/.test(inscricaoId) || !categoriaId || motivo.length < 10 || motivo.length > 500) {
    return NextResponse.json({ error: 'Escolha a categoria e descreva o motivo em 10 a 500 caracteres.' }, { status: 400 });
  }

  const db = createSupabaseServerClient();
  const { data: inscricao, error: erroInscricao } = await db.from('inscricoes')
    .select('id,evento_id,categoria,categoria_id,idade,peso,sexo,faixa,modalidade,absoluto,atleta')
    .eq('id', inscricaoId).maybeSingle();
  if (erroInscricao || !inscricao) return NextResponse.json({ error: 'Inscrição não encontrada.' }, { status: 404 });

  const [{ data: evento, error: erroEvento }, { data: destino, error: erroDestino }, { count: chaves, error: erroChaves }] = await Promise.all([
    db.from('eventos').select('id').eq('id', inscricao.evento_id).eq('organizador_id', usuario.id).maybeSingle(),
    db.from('categorias_evento').select('*').eq('id', categoriaId).eq('evento_id', inscricao.evento_id).eq('ativa', true).eq('tipo', 'peso').maybeSingle(),
    db.from('chaves').select('id', { count: 'exact', head: true }).eq('evento_id', inscricao.evento_id),
  ]);
  if (erroEvento || !evento) return NextResponse.json({ error: 'Campeonato não autorizado.' }, { status: 403 });
  if (erroDestino || !destino) return NextResponse.json({ error: 'Escolha uma categoria de peso ativa deste campeonato.' }, { status: 400 });
  if (erroChaves) return NextResponse.json({ error: 'Não foi possível conferir as chaves.' }, { status: 500 });
  if (chaves) return NextResponse.json({ error: 'As chaves já foram geradas. A categoria foi preservada para não deslocar lutas.' }, { status: 409 });
  if (inscricaoSomenteAbsoluto(inscricao)) return NextResponse.json({ error: 'Esta inscrição é somente de absoluto. O pacote precisa ser alterado separadamente.' }, { status: 409 });
  const idade = Number(inscricao.idade);
  const peso = Number(String(inscricao.peso ?? '').replace(',', '.'));
  if (!Number.isInteger(idade) || idade < 4 || idade > 100 || !Number.isFinite(peso) || peso <= 0) {
    return NextResponse.json({ error: 'Confira a idade e o peso reais da inscrição antes de escolher uma exceção.' }, { status: 409 });
  }

  const categoria = destino as CategoriaCompeticao;
  if (!categoriaPermitidaAoOrganizador(categoria, inscricao)) {
    return NextResponse.json({ error: 'A categoria deve manter o sexo e a modalidade da inscrição. Idade, peso e faixa diferentes exigem justificativa.' }, { status: 400 });
  }
  if (inscricao.categoria_id === categoria.id) return NextResponse.json({ error: 'O atleta já está nesta categoria.' }, { status: 409 });

  let update = db.from('inscricoes').update({
    categoria_id: categoria.id,
    categoria: rotuloCategoria(categoria),
    categoria_ajuste_motivo: motivo,
    categoria_ajuste_por: usuario.id,
    categoria_ajuste_em: new Date().toISOString(),
  }).eq('id', inscricao.id).eq('evento_id', inscricao.evento_id);
  update = inscricao.categoria_id ? update.eq('categoria_id', inscricao.categoria_id) : update.is('categoria_id', null);
  const { data: atualizada, error: erroUpdate } = await update
    .select('id,categoria,categoria_id,categoria_ajuste_motivo,categoria_ajuste_em').maybeSingle();
  if (erroUpdate || !atualizada) {
    return NextResponse.json({ error: erroUpdate?.message || 'A categoria não foi alterada. Recarregue a inscrição.' }, { status: 409 });
  }
  return NextResponse.json({ success: true, inscricao: atualizada });
}
