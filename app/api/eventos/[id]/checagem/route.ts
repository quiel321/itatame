import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function todos<T>(carregar: (de: number, ate: number) => Promise<{ data: T[] | null; error: { message?: string } | null }>) {
  const pagina = 1000;
  const linhas: T[] = [];
  for (let de = 0; ; de += pagina) {
    const { data, error } = await carregar(de, de + pagina - 1);
    if (error) throw new Error(error.message || 'Falha ao carregar a checagem.');
    linhas.push(...(data || []));
    if (!data || data.length < pagina) break;
  }
  return linhas;
}

export async function GET(_request: Request, contexto: { params: Promise<{ id: string }> }) {
  const { id: eventoId } = await contexto.params;
  if (!eventoId) return NextResponse.json({ error: 'Evento não informado.' }, { status: 400 });
  const db = createSupabaseServerClient();

  let evento: Record<string, unknown> | null = null;
  const eventoResposta = await db
    .from('eventos')
    .select('id,nome,estado,data_evento,data_inicio_inscricoes,data_inicio_checagem,data_fim_checagem,data_fim_inscricoes')
    .eq('id', eventoId)
    .maybeSingle();
  if (eventoResposta.error) {
    const semData = await db
      .from('eventos')
      .select('id,nome,estado,data_inicio_inscricoes,data_inicio_checagem,data_fim_checagem,data_fim_inscricoes')
      .eq('id', eventoId)
      .maybeSingle();
    evento = semData.data;
    if (semData.error || !evento) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }
  } else {
    evento = eventoResposta.data;
    if (!evento) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
  }
  const [{ data: categorias, error: erroCategorias }, equipesResposta] = await Promise.all([
    db.from('categorias_evento').select('*').eq('evento_id', eventoId),
    db.from('equipes_evento').select('id,nome,academia,professor,cidade,logo_url,academia_logo_url').eq('evento_id', eventoId).eq('ativa', true),
  ]);

  let equipes = equipesResposta.data || [];
  if (equipesResposta.error) {
    const semLogo = await db.from('equipes_evento').select('id,nome,academia,professor,cidade').eq('evento_id', eventoId).eq('ativa', true);
    if (semLogo.error || erroCategorias) {
      return NextResponse.json({ error: 'Não foi possível carregar as categorias e equipes oficiais.' }, { status: 500 });
    }
    equipes = (semLogo.data || []).map((equipe) => ({ ...equipe, logo_url: null, academia_logo_url: null }));
  } else if (erroCategorias) {
    return NextResponse.json({ error: 'Não foi possível carregar as categorias e equipes oficiais.' }, { status: 500 });
  }

  const colunasInscricao = [
    'id,user_id,atleta,equipe,equipe_id,faixa,peso,sexo,idade,modalidade,absoluto,pagamento_ok,categoria,categoria_id,created_at',
    'id,user_id,atleta,equipe,equipe_id,faixa,peso,sexo,idade,absoluto,pagamento_ok,categoria,categoria_id,created_at',
    'id,user_id,atleta,equipe,equipe_id,faixa,peso,sexo,absoluto,pagamento_ok,categoria,categoria_id,created_at',
    'id,user_id,atleta,equipe,equipe_id,faixa,peso,sexo,absoluto,pagamento_ok,categoria,categoria_id',
  ];
  let inscricoes: Array<Record<string, unknown>> = [];
  let ultimoErro: unknown = null;
  for (const colunas of colunasInscricao) {
    try {
      inscricoes = await todos((de, ate) => db
        .from('inscricoes')
        .select(colunas)
        .eq('evento_id', eventoId)
        .range(de, ate));
      ultimoErro = null;
      break;
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  if (ultimoErro) throw ultimoErro instanceof Error ? ultimoErro : new Error('Falha ao carregar a checagem.');

  const userIds = [...new Set(inscricoes.map((item) => String(item.user_id || '')).filter(Boolean))];
  const atletas: Array<Record<string, unknown>> = [];
  for (let i = 0; i < userIds.length; i += 200) {
    const fatia = userIds.slice(i, i + 200);
    let fatiaAtletas = await db.from('atletas_publico').select('user_id,nome,equipe,academia,professor,faixa,peso,sexo,nascimento,modalidade').in('user_id', fatia);
    if (fatiaAtletas.error) {
      fatiaAtletas = await db.from('atletas_publico').select('user_id,nome,equipe,academia,professor,faixa,peso,sexo').in('user_id', fatia);
    }
    atletas.push(...(fatiaAtletas.data || []));
  }

  let academias: Array<Record<string, unknown>> = [];
  const academiasResposta = await db
    .from('solicitacoes_equipe_evento')
    .select('id,equipe_id,academia,professor,logo_url')
    .eq('evento_id', eventoId)
    .eq('status', 'aprovada');
  if (!academiasResposta.error) academias = academiasResposta.data || [];

  return NextResponse.json({
    evento,
    categorias: categorias || [],
    equipes,
    academias,
    inscricoes,
    atletas,
  });
}
