'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { fusoHorarioEvento } from '@/app/lib/evento-datas';
import { resumirProgramacao, type CategoriaProgramada, type LutaProgramacao } from '@/app/lib/programacao-categorias';

/** Painel somente de leitura: previsão nunca aprova, despacha ou chama atletas. */
export default function ProgramacaoLutas({ eventoId, categoriaId, tatame, ativa = true }: { eventoId: string; categoriaId?: string | null; tatame?: string; ativa?: boolean }) {
  const [resumo, setResumo] = useState<ReturnType<typeof resumirProgramacao>>([]);
  const [estado, setEstado] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (!eventoId || !ativa) return;
    let cancelado = false;
    let lendo = false;
    const ler = async () => {
      if (lendo) return;
      lendo = true;
      try {
        const [categorias, evento] = await Promise.all([
          supabase.from('categorias_evento').select('id,nome,inicio_lutas_previsto').eq('evento_id', eventoId),
          supabase.from('eventos').select('estado').eq('id', eventoId).single(),
        ]);
        if (categorias.error || evento.error) throw new Error('Não foi possível atualizar os horários previstos.');
        const lutas: LutaProgramacao[] = [];
        for (let inicio = 0; ; inicio += 500) {
          const { data, error } = await supabase.from('chaves').select('id,categoria,categoria_id,faixa,tatame,ordem_tatame,horario_estimado,status_luta,vencedor,iniciada_em,atleta_1,atleta_2')
            .eq('evento_id', eventoId).order('id').range(inicio, inicio + 499);
          if (error) throw new Error('Não foi possível atualizar a programação das lutas.');
          lutas.push(...(data || []));
          if (!data || data.length < 500 || cancelado) break;
        }
        if (!cancelado) { setResumo(resumirProgramacao(lutas, (categorias.data || []) as CategoriaProgramada[])); setEstado(evento.data?.estado); setErro(''); }
      } catch (e) {
        if (!cancelado) { setResumo([]); setErro(e instanceof Error ? e.message : 'Confira a conexão para atualizar os horários.'); }
      } finally { lendo = false; }
    };
    void ler();
    const timer = window.setInterval(() => void ler(), 20000);
    return () => { cancelado = true; window.clearInterval(timer); };
  }, [eventoId, ativa]);
  if (!ativa || !eventoId) return null;
  const filtradas = resumo.filter(c => (!categoriaId || c.categoriaId === categoriaId) && (!tatame || c.tatame.toUpperCase() === tatame.trim().toUpperCase()));
  const proximas = filtradas.filter((c, i, todas) => !c.concluida && !todas.slice(0, i).some(a => !a.concluida && a.tatame === c.tatame));
  const hora = (v?: string | null) => v ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: fusoHorarioEvento(estado) }) : 'não definido';
  const cartao = (c: typeof resumo[number]) => <div key={`${c.tatame}:${c.categoriaId}`} className="min-w-0 rounded-xl border border-white/20 bg-black/25 p-3">
    <p className="break-words text-sm font-bold text-white">{c.tatame} · {c.nome}</p>
    <p className="mt-1 text-xs text-amber-200">Início previsto: {hora(c.previsto || c.estimado)}</p>
    {c.previsto && c.estimado && Date.parse(c.estimado) > Date.parse(c.previsto) && !c.emOperacao && <p className="mt-1 text-xs text-zinc-300">Fila estimada: {hora(c.estimado)}</p>}
    <p className={`mt-1 text-xs ${c.horarioUltrapassado ? 'text-amber-300' : 'text-zinc-400'}`}>{c.concluida ? 'Categoria concluída' : c.emOperacao ? 'Categoria em operação' : c.horarioUltrapassado ? 'Horário previsto ultrapassado. Confira o andamento do tatame.' : 'Preparar a categoria para o horário previsto.'}</p>
  </div>;
  return <section aria-label="Programação de lutas" className="rounded-2xl border border-white/20 bg-[#101014] p-3 shadow-md">
    <h2 className="text-sm font-bold text-white">Programação de lutas</h2>
    <p className="mt-1 text-xs leading-relaxed text-zinc-400">Horário local do campeonato. A pesagem pode ser antecipada; a chamada continua sob controle do operador.</p>
    {erro ? <p role="status" className="mt-2 text-xs text-amber-200">{erro} Os controles de operação continuam disponíveis.</p> : <>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{proximas.map(cartao)}</div>
      {filtradas.length > 0 && proximas.length === 0 && <p className="mt-2 text-xs text-zinc-400">Todas as categorias desta seleção foram concluídas.</p>}
      {filtradas.length > 0 && <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-xs font-bold text-zinc-300">Ver programação completa ({filtradas.length})</summary><div className="grid gap-2 sm:grid-cols-2">{filtradas.map(cartao)}</div></details>}
    </>}
  </section>;
}
