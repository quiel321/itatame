import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { montarChaves, prepararGrupos } from '@/app/lib/gerar-chaves';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
    if (!token) return NextResponse.json({ error: 'Faça login novamente.' }, { status: 401 });
    const db = createSupabaseServerClient();
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
    const { eventoId, tipo, ignorarPagamento, confirmar } = await request.json();
    if (!eventoId || !['peso', 'absoluto'].includes(tipo)) return NextResponse.json({ error: 'Evento ou tipo inválido.' }, { status: 400 });
    const { data: evento, error: eventoError } = await db.from('eventos').select('*').eq('id', eventoId).eq('organizador_id', auth.user.id).maybeSingle();
    if (eventoError || !evento) return NextResponse.json({ error: 'Evento não autorizado.' }, { status: 403 });
    const fim = evento.data_fim_inscricoes || evento.lote3_data_fim || evento.lote2_data_fim || evento.lote1_data_fim;
    if (!fim || !Number.isFinite(new Date(fim).getTime()) || new Date(fim) > new Date()) throw new Error('Encerre as inscrições antes de gerar as chaves.');
    let query = db.from('inscricoes').select('*').eq('evento_id', eventoId).order('id');
    if (!ignorarPagamento) query = query.eq('pagamento_ok', true);
    const [inscritos, categorias, existentes] = await Promise.all([
      query, db.from('categorias_evento').select('*').eq('evento_id', eventoId),
      db.from('chaves').select('id,status_luta,vencedor,iniciada_em').eq('evento_id', eventoId),
    ]);
    if (inscritos.error || existentes.error) throw new Error('Não foi possível conferir as inscrições e chaves. Tente novamente.');
    if (categorias.error) throw new Error('A atualização do banco de competição ainda não foi instalada. As chaves foram preservadas.');
    if (existentes.data?.some(l => l.vencedor || l.iniciada_em || ['concluida', 'em_andamento'].includes(l.status_luta))) throw new Error('Já existem lutas iniciadas ou resultados neste evento. As chaves foram preservadas.');
    const preparados = prepararGrupos(inscritos.data || [], tipo, categorias.data || []);
    const grupos = Object.entries(preparados.grupos).map(([categoria, atletas]) => {
      const equipes = new Map<string, { nome: string; total: number }>();
      atletas.forEach((atleta) => {
        const atual = equipes.get(atleta.equipe_chave) || { nome: atleta.equipe_atleta, total: 0 };
        atual.total += 1;
        equipes.set(atleta.equipe_chave, atual);
      });
      return {
        categoria: categoria.replace('__', ' · '),
        atletas: atletas.length,
        equipesAcimaDoLimite: Array.from(equipes.values()).filter((equipe) => equipe.total > 2),
      };
    });
    if (!grupos.length) throw new Error('Nenhuma inscrição apta para este tipo de chave.');
    const assinatura = createHash('sha256').update(JSON.stringify({ inscritos: inscritos.data, categorias: categorias.data, existentes: existentes.data, tipo, ignorarPagamento })).digest('hex');
    if (!confirmar) return NextResponse.json({ previa: { assinatura, grupos } });
    if (confirmar !== assinatura) throw new Error('Os dados mudaram desde a conferência. Gere uma nova prévia.');
    const lutas = montarChaves(eventoId, preparados);
    const { data: total, error } = await db.rpc('substituir_chaves_evento', { p_evento: eventoId, p_tipo: tipo, p_lutas: lutas, p_organizador: auth.user.id });
    if (error) throw new Error(error.code === 'PGRST202' ? 'Instale a atualização do banco antes de gerar chaves.' : error.message);
    return NextResponse.json({ total });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível gerar as chaves.' }, { status: 409 });
  }
}
