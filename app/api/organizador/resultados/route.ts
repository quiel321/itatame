import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { bloqueioResultadoManual, type LutaResultadoManual } from '@/app/lib/resultados-manuais';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
    if (!token) return NextResponse.json({ error: 'Entre com a conta do organizador.' }, { status: 401 });
    // A sessão do organizador também acompanha o RPC: auth.uid() e as travas
    // transacionais do banco continuam sendo a autoridade final da gravação.
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user || auth.user.is_anonymous) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
    const body = await request.json();
    const motivo = String(body.motivo || '').trim();
    if (!body.eventoId || !body.lutaId || motivo.length < 5 || motivo.length > 1000
      || !['pontos', 'vantagens', 'finalizacao', 'decisao', 'desclassificacao', 'wo'].includes(body.metodo)) {
      return NextResponse.json({ error: 'Confira a luta, o método e a justificativa.' }, { status: 400 });
    }
    const { data: evento } = await db.from('eventos').select('id').eq('id', body.eventoId).eq('organizador_id', auth.user.id).maybeSingle();
    if (!evento) return NextResponse.json({ error: 'Campeonato não autorizado.' }, { status: 403 });
    if (body.operacaoId) {
      if(!Number.isInteger(body.vencedor)||body.vencedor<=0||![body.atleta1,body.atleta2].includes(body.vencedor))return NextResponse.json({error:'Escolha um vencedor válido.'},{status:400});
      if (!/^[0-9a-f-]{36}$/i.test(String(body.operacaoId))) return NextResponse.json({error:'Identificação da operação inválida.'},{status:400});
      const { data, error: registroError } = await db.rpc('operacao_executar', {
        p_id:body.operacaoId,p_evento:body.eventoId,p_tipo:'sumula',p_alvo:body.lutaId,
        p_dados:{tatame:body.tatame??null,lado:body.vencedor===body.atleta1?1:2,metodo:body.metodo,motivo,
          contingencia:body.contingencia===true,placar1:body.placar1,placar2:body.placar2},
        p_base:{atleta_1_id:body.atleta1,atleta_2_id:body.atleta2,pontuacao_atleta_1:body.base1,pontuacao_atleta_2:body.base2},
      });
      if(registroError)return NextResponse.json({error:registroError.message},{status:409});
      return NextResponse.json({success:true,...data});
    }
    const { data: luta, error } = await db.from('chaves').select('*').eq('id', body.lutaId).eq('evento_id', body.eventoId).maybeSingle();
    if (error || !luta) return NextResponse.json({ error: 'Luta não encontrada.' }, { status: 404 });
    if (luta.atleta_1_id !== body.atleta1 || luta.atleta_2_id !== body.atleta2) return NextResponse.json({ error: 'Os atletas mudaram. Atualize antes de registrar.' }, { status: 409 });
    const grupo: LutaResultadoManual[] = [];
    for (let pagina = 0; ; pagina++) {
      const { data, error: consultaError } = await db.from('chaves').select('*').eq('evento_id', body.eventoId)
        .eq('categoria', luta.categoria).eq('faixa', luta.faixa).order('id').range(pagina * 500, pagina * 500 + 499);
      if (consultaError) throw new Error('Não foi possível conferir a hierarquia da chave.');
      grupo.push(...(data || []));
      if ((data || []).length < 500) break;
    }
    const atual = grupo.find(item => item.id === luta.id);
    if (!atual || atual.atleta_1_id !== body.atleta1 || atual.atleta_2_id !== body.atleta2) return NextResponse.json({ error: 'Os atletas mudaram. Atualize antes de registrar.' }, { status: 409 });
    const bloqueio = bloqueioResultadoManual(grupo, atual);
    if (bloqueio) return NextResponse.json({ error: bloqueio }, { status: 409 });
    const vencedor = Number(body.vencedor);
    if (!Number.isInteger(vencedor) || vencedor <= 0 || ![luta.atleta_1_id, luta.atleta_2_id].includes(vencedor)) return NextResponse.json({ error: 'Escolha um vencedor válido.' }, { status: 400 });
    if ((!luta.atleta_1_id || !luta.atleta_2_id) && body.metodo !== 'wo') return NextResponse.json({ error: 'Sem dois atletas, somente W.O. pode ser registrado.' }, { status: 400 });
    const { error: registroError } = await db.rpc('registrar_resultado_manual', {
      p_luta: luta.id, p_vencedor: vencedor, p_atleta1: body.atleta1, p_atleta2: body.atleta2, p_metodo: body.metodo, p_motivo: motivo,
    });
    if (registroError) return NextResponse.json({ error: registroError.message }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Não foi possível confirmar o resultado. Atualize a chave antes de tentar novamente.' }, { status: 500 });
  }
}
