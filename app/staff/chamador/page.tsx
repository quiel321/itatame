'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock3, LogOut, Megaphone, RefreshCw, ShieldCheck, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { processarAvancosAutomaticosChaves, propagarResultadoChave } from '../../lib/chaves-auto-avanco';
import { obterTempoRegulamentar } from '../../lib/cronograma';

type StaffSession = {
  evento_id: string | number;
  evento_nome?: string;
  funcao: string;
  identificacao: string;
};

type Luta = {
  id: string | number;
  evento_id: string | number;
  categoria: string;
  faixa?: string | null;
  fase?: string | null;
  id_visual?: string | number | null;
  ordem?: number | null;
  ordem_tatame?: number | null;
  tatame?: string | null;
  atleta_1?: string | null;
  atleta_2?: string | null;
  atleta_1_id?: number | null;
  atleta_2_id?: number | null;
  status_luta?: string | null;
  iniciada_em?: string | null;
  horario_estimado?: string | null;
  proxima_luta?: string | number | null;
  equipe_1?: string | null;
  equipe_2?: string | null;
  pontuacao_atleta_1?: Record<string, unknown> | null;
  pontuacao_atleta_2?: Record<string, unknown> | null;
  checkin_1?: string;
  checkin_2?: string;
};

function texto(valor?: string | null) {
  return String(valor || '').trim();
}

function atletaReal(nome?: string | null) {
  const valor = texto(nome).toUpperCase();
  return Boolean(valor) && valor !== 'BYE' && valor !== 'TBD' && !valor.includes('SEM OPONENTE');
}

function ordenar(a: Luta, b: Luta) {
  const ordemA = a.ordem_tatame ?? a.ordem ?? 9999;
  const ordemB = b.ordem_tatame ?? b.ordem ?? 9999;
  if (ordemA !== ordemB) return ordemA - ordemB;
  return Number(a.id_visual || 0) - Number(b.id_visual || 0);
}

function hora(valor?: string | null) {
  if (!valor) return 'Sem horário';
  return new Date(valor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function checkinAprovado(luta: Luta) {
  return atletaReal(luta.atleta_1) && atletaReal(luta.atleta_2) && luta.checkin_1 === 'aprovado' && luta.checkin_2 === 'aprovado';
}

function controleChamador(luta: Luta, lado: 1 | 2) {
  const dados = (lado === 1 ? luta.pontuacao_atleta_1 : luta.pontuacao_atleta_2) || {};
  return {
    presente: Boolean(dados.chamador_presente),
    chamadas: Math.max(0, Math.min(2, Number(dados.chamador_chamadas || 0))),
  };
}

function ambosPresentes(luta: Luta) {
  return controleChamador(luta, 1).presente && controleChamador(luta, 2).presente;
}

function chaveAtleta(id?: number | null, nome?: string | null) {
  if (id) return `id:${id}`;
  const nomeLimpo = texto(nome).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return atletaReal(nome) ? `nome:${nomeLimpo}` : '';
}

function chavesDosAtletas(luta: Luta) {
  return [chaveAtleta(luta.atleta_1_id, luta.atleta_1), chaveAtleta(luta.atleta_2_id, luta.atleta_2)].filter(Boolean);
}

function prioridadeOperacional(luta: Luta) {
  if (luta.status_luta === 'em_andamento') return 0;
  if (luta.iniciada_em) return 1;
  if (controleChamador(luta, 1).presente || controleChamador(luta, 2).presente) return 2;
  return 3;
}

function reservarUmaLutaPorAtleta(lutas: Luta[]) {
  const reservados = new Set<string>();
  return [...lutas].sort((a, b) => prioridadeOperacional(a) - prioridadeOperacional(b) || ordenar(a, b)).filter((luta) => {
    const atletas = chavesDosAtletas(luta);
    if (atletas.some((atleta) => reservados.has(atleta))) return false;
    atletas.forEach((atleta) => reservados.add(atleta));
    return true;
  });
}

export default function PainelChamador() {
  const router = useRouter();
  const [sessao, setSessao] = useState<StaffSession | null>(null);
  const [lutas, setLutas] = useState<Luta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acaoId, setAcaoId] = useState<string | number | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState('');
  const [toast, setToast] = useState<{ mensagem: string; tipo: 'info' | 'sucesso' | 'erro' } | null>(null);
  const canalOperacaoRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    document.body.classList.add('hide-global-nav');
    const salva = localStorage.getItem('itatame_staff_session');
    if (!salva) {
      router.replace('/staff/login');
      return () => document.body.classList.remove('hide-global-nav');
    }

    try {
      const atual = JSON.parse(salva) as StaffSession;
      if (atual.funcao !== 'chamador') {
        router.replace('/staff/login');
      } else {
        void Promise.resolve().then(() => setSessao(atual));
      }
    } catch {
      localStorage.removeItem('itatame_staff_session');
      router.replace('/staff/login');
    }

    return () => document.body.classList.remove('hide-global-nav');
  }, [router]);

  const carregar = useCallback(async (silencioso = false) => {
    if (!sessao) return;
    if (!silencioso) setLoading(true);
    setRefreshing(true);

    const { data: chaves, error } = await supabase
      .from('chaves')
      .select('id, evento_id, categoria, faixa, fase, id_visual, ordem, ordem_tatame, tatame, atleta_1, atleta_2, atleta_1_id, atleta_2_id, equipe_1, equipe_2, status_luta, iniciada_em, horario_estimado, proxima_luta, pontuacao_atleta_1, pontuacao_atleta_2')
      .eq('evento_id', sessao.evento_id)
      .order('ordem_tatame', { ascending: true })
      .order('ordem', { ascending: true });

    if (error || !chaves) {
      setToast({ mensagem: 'Não foi possível carregar a fila do Chamador.', tipo: 'erro' });
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const lutasReais = (chaves as Luta[]).filter((luta) =>
      (atletaReal(luta.atleta_1) || atletaReal(luta.atleta_2)) && luta.status_luta !== 'concluida'
    );
    const ids = Array.from(new Set(lutasReais.flatMap((luta) => [luta.atleta_1_id, luta.atleta_2_id]).filter(Boolean))) as number[];
    const { data: inscricoes } = ids.length
      ? await supabase.from('inscricoes').select('atleta_id, status_checkin').eq('evento_id', sessao.evento_id).in('atleta_id', ids)
      : { data: [] as Array<{ atleta_id: number; status_checkin: string }> };

    const statusPorAtleta = new Map((inscricoes || []).map((item) => [Number(item.atleta_id), String(item.status_checkin || 'pendente')]));
    setLutas(lutasReais.map((luta) => ({
      ...luta,
      checkin_1: luta.atleta_1_id ? statusPorAtleta.get(Number(luta.atleta_1_id)) || 'pendente' : 'pendente',
      checkin_2: luta.atleta_2_id ? statusPorAtleta.get(Number(luta.atleta_2_id)) || 'pendente' : 'pendente',
    })).sort(ordenar));
    setLoading(false);
    setRefreshing(false);
  }, [sessao]);

  useEffect(() => {
    if (!sessao) return;
    void Promise.resolve().then(() => { void carregar(); });

    const canal = supabase
      .channel(`operacao-tatames-${sessao.evento_id}`)
      .on('broadcast', { event: 'checkin_atualizado' }, () => { void carregar(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chaves', filter: `evento_id=eq.${sessao.evento_id}` }, () => { void carregar(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inscricoes', filter: `evento_id=eq.${sessao.evento_id}` }, () => { void carregar(true); })
      .subscribe();
    canalOperacaoRef.current = canal;
    const intervalo = window.setInterval(() => { void carregar(true); }, 10000);

    return () => {
      window.clearInterval(intervalo);
      canalOperacaoRef.current = null;
      void supabase.removeChannel(canal);
    };
  }, [carregar, sessao]);

  const lutasOperacionais = useMemo(() => reservarUmaLutaPorAtleta(lutas), [lutas]);
  const lutasVisiveis = useMemo(() => lutasOperacionais.filter((luta) => !categoriaAtiva || `${luta.categoria}__${luta.faixa || ''}` === categoriaAtiva), [categoriaAtiva, lutasOperacionais]);
  const chamadas = useMemo(() => lutasVisiveis.filter((luta) => luta.status_luta !== 'em_andamento' && Boolean(luta.iniciada_em)), [lutasVisiveis]);
  const emAndamento = useMemo(() => lutasVisiveis.filter((luta) => luta.status_luta === 'em_andamento'), [lutasVisiveis]);
  const baias = useMemo(() => lutasVisiveis.filter((luta) => luta.status_luta !== 'em_andamento' && !luta.iniciada_em && atletaReal(luta.atleta_1) !== atletaReal(luta.atleta_2)), [lutasVisiveis]);
  const prontas = useMemo(() => lutasVisiveis.filter((luta) => luta.status_luta !== 'em_andamento' && !luta.iniciada_em && checkinAprovado(luta) && ambosPresentes(luta)), [lutasVisiveis]);
  const aguardandoCheckin = useMemo(() => lutasVisiveis.filter((luta) => atletaReal(luta.atleta_1) && atletaReal(luta.atleta_2) && luta.status_luta !== 'em_andamento' && !luta.iniciada_em && (!checkinAprovado(luta) || !ambosPresentes(luta))), [lutasVisiveis]);
  const categoriasChamada = useMemo(() => Array.from(new Map(lutas.map((luta) => [`${luta.categoria}__${luta.faixa || ''}`, luta])).values()), [lutas]);

  useEffect(() => {
    if (!sessao || lutas.length === 0) return;

    const enviarAvisosProgressivos = async () => {
      const agora = Date.now();
      const pendentes = lutas.filter((luta) => atletaReal(luta.atleta_1) && atletaReal(luta.atleta_2) && luta.status_luta !== 'concluida' && luta.status_luta !== 'em_andamento' && !luta.iniciada_em);

      for (const luta of pendentes) {
        if (!checkinAprovado(luta)) continue;
        const filaTatame = pendentes.filter((item) => texto(item.tatame).toUpperCase() === texto(luta.tatame).toUpperCase()).sort(ordenar);
        const posicao = filaTatame.findIndex((item) => item.id === luta.id);
        if (posicao < 0) continue;
        const diffCronograma = luta.horario_estimado ? Math.ceil((new Date(luta.horario_estimado).getTime() - agora) / 60000) : 0;
        const estimativaFila = Math.max(5, posicao * (obterTempoRegulamentar(luta.categoria || '', luta.faixa || '') + 2));
        const minutos = Math.max(5, diffCronograma, estimativaFila);
        const horarioPrevisto = new Date(agora + minutos * 60_000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const previsaoHorario = minutos > 5 ? ` Previsão local: ${horarioPrevisto}.` : '';
        const marco = minutos <= 5 ? 5 : minutos <= 15 ? 15 : null;
        if (!marco) continue;

        const atletas = [
          { id: luta.atleta_1_id, nome: luta.atleta_1, oponente: luta.atleta_2 },
          { id: luta.atleta_2_id, nome: luta.atleta_2, oponente: luta.atleta_1 },
        ];
        for (const atleta of atletas) {
          if (!atleta.id) continue;
          const chave = `itatame_aviso_${sessao.evento_id}_${luta.id}_${marco}_${atleta.id}`;
          if (localStorage.getItem(chave)) continue;
          const resposta = await fetch('/api/notificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              atleta_id: atleta.id,
              titulo: marco === 5 ? 'Sua luta está muito próxima' : 'Prepare-se para sua luta',
              mensagem: `${texto(atleta.nome)}, faltam aproximadamente ${minutos} minutos e ${posicao} luta(s) para enfrentar ${texto(atleta.oponente)} no ${luta.tatame || 'tatame'}.${previsaoHorario}`,
              url: `/evento/${sessao.evento_id}/ao-vivo`,
            }),
          }).catch(() => null);
          if (resposta?.ok) localStorage.setItem(chave, new Date().toISOString());
        }
      }
    };

    void enviarAvisosProgressivos();
    const intervalo = window.setInterval(() => void enviarAvisosProgressivos(), 30000);
    return () => window.clearInterval(intervalo);
  }, [lutas, sessao]);

  useEffect(() => {
    if (!toast || toast.tipo === 'info') return;
    const timer = window.setTimeout(() => setToast(null), toast.tipo === 'erro' ? 8000 : 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const buscarConflitoAtleta = async (lutaAtual: Luta) => {
    if (!sessao) return null;
    const chavesAtuais = new Set(chavesDosAtletas(lutaAtual));
    const { data, error } = await supabase
      .from('chaves')
      .select('id, id_visual, tatame, atleta_1, atleta_2, atleta_1_id, atleta_2_id, status_luta, iniciada_em, pontuacao_atleta_1, pontuacao_atleta_2')
      .eq('evento_id', sessao.evento_id)
      .neq('id', lutaAtual.id)
      .neq('status_luta', 'concluida');
    if (error) throw error;

    return ((data || []) as Luta[]).find((outra) => {
      const compartilhaAtleta = chavesDosAtletas(outra).some((chave) => chavesAtuais.has(chave));
      const estaReservada = outra.status_luta === 'em_andamento' || Boolean(outra.iniciada_em)
        || controleChamador(outra, 1).presente || controleChamador(outra, 2).presente;
      return compartilhaAtleta && estaReservada;
    }) || null;
  };

  const atualizarControle = async (luta: Luta, lado: 1 | 2, acao: 'presenca' | 'chamada') => {
    if (!sessao) return;
    const nome = lado === 1 ? luta.atleta_1 : luta.atleta_2;
    const atletaId = lado === 1 ? luta.atleta_1_id : luta.atleta_2_id;
    const statusCheckin = lado === 1 ? luta.checkin_1 : luta.checkin_2;
    if (!atletaReal(nome)) return;
    if (acao === 'presenca' && statusCheckin !== 'aprovado') {
      setToast({ mensagem: `${texto(nome)} ainda não foi liberado pelo check-in.`, tipo: 'erro' });
      return;
    }
    if (acao === 'presenca' && !controleChamador(luta, lado).presente) {
      try {
        const conflito = await buscarConflitoAtleta(luta);
        if (conflito) {
          setToast({ mensagem: `${texto(nome)} já está reservado para a luta ${conflito.id_visual || conflito.id} no ${conflito.tatame || 'tatame definido'}.`, tipo: 'erro' });
          return;
        }
      } catch (error: any) {
        setToast({ mensagem: `Não foi possível validar a disponibilidade do atleta: ${error?.message || 'erro inesperado'}.`, tipo: 'erro' });
        return;
      }
    }

    const campo = lado === 1 ? 'pontuacao_atleta_1' : 'pontuacao_atleta_2';
    const atual = controleChamador(luta, lado);
    const base = (lado === 1 ? luta.pontuacao_atleta_1 : luta.pontuacao_atleta_2) || {};
    const novo = acao === 'presenca'
      ? { ...base, chamador_presente: !atual.presente, chamador_chamadas: atual.chamadas }
      : { ...base, chamador_presente: atual.presente, chamador_chamadas: Math.min(2, atual.chamadas + 1) };

    setAcaoId(`${luta.id}-${lado}`);
    const { error } = await supabase.from('chaves').update({ [campo]: novo }).eq('id', luta.id).eq('evento_id', sessao.evento_id);
    if (error) setToast({ mensagem: `Não foi possível registrar: ${error.message}`, tipo: 'erro' });
    else {
      if (acao === 'chamada' && atletaId) {
        const numero = Math.min(2, atual.chamadas + 1);
        await fetch('/api/notificar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ atleta_id: atletaId, titulo: `${numero}ª chamada da categoria`, mensagem: `${texto(nome)}, apresente-se ao Chamador para ${luta.categoria} · ${luta.faixa || 'faixa não informada'}.`, url: `/evento/${sessao.evento_id}/ao-vivo` }),
        }).catch(() => null);
        setToast({ mensagem: `${numero}ª chamada registrada para ${texto(nome)}.`, tipo: 'sucesso' });
      }
      await carregar(true);
    }
    setAcaoId(null);
  };

  const confirmarWo = async (luta: Luta, ladoAusente: 1 | 2) => {
    if (!sessao || !window.confirm('Confirmar ausência? Esta ação encerra a luta e avança o atleta presente, sem registrar vitória por W.O. no ranking.')) return;
    const ladoVencedor = ladoAusente === 1 ? 2 : 1;
    const nomeVencedor = ladoVencedor === 1 ? luta.atleta_1 : luta.atleta_2;
    const idVencedor = ladoVencedor === 1 ? luta.atleta_1_id : luta.atleta_2_id;
    if (!atletaReal(nomeVencedor) || !controleChamador(luta, ladoVencedor).presente) {
      setToast({ mensagem: 'Marque primeiro a presença do atleta que vencerá por W.O.', tipo: 'erro' });
      return;
    }
    setAcaoId(luta.id);
    const { error } = await supabase.from('chaves').update({ status_luta: 'concluida', vencedor: nomeVencedor, vencedor_id: idVencedor || null, metodo_vitoria: 'ausencia', finalizada_em: new Date().toISOString() }).eq('id', luta.id).eq('evento_id', sessao.evento_id);
    if (error) setToast({ mensagem: `Não foi possível registrar a ausência: ${error.message}`, tipo: 'erro' });
    else {
      await propagarResultadoChave(supabase, lutas as any[], luta as any, {
        vencedorNome: texto(nomeVencedor),
        vencedorEquipe: ladoVencedor === 1 ? luta.equipe_1 : luta.equipe_2,
        vencedorId: idVencedor,
        propagarPerdedor: false,
      });
      await processarAvancosAutomaticosChaves(supabase, sessao.evento_id);
      setToast({ mensagem: `Ausência confirmada. ${texto(nomeVencedor)} avançou na chave sem W.O. no ranking.`, tipo: 'sucesso' });
      await carregar(true);
    }
    setAcaoId(null);
  };

  const anunciarCategoria = (luta: Luta) => {
    setToast({ mensagem: `Anunciar no som: atletas da categoria ${luta.categoria}, faixa ${luta.faixa || 'não informada'}, apresentem-se à área de chamada.`, tipo: 'sucesso' });
  };

  const notificarAtleta = async (atletaId: number | null | undefined, nome: string | null | undefined, oponente: string | null | undefined, luta: Luta) => {
    if (!atletaId || !sessao) return;
    await fetch('/api/notificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        atleta_id: atletaId,
        titulo: 'Dirija-se à área de chamada',
        mensagem: `${texto(nome)}, sua luta contra ${texto(oponente)} foi liberada para o ${luta.tatame || 'tatame definido'}.`,
        url: `/evento/${sessao.evento_id}/ao-vivo`,
      }),
    });
  };

  const chamar = async (luta: Luta) => {
    if (!sessao || !checkinAprovado(luta) || !ambosPresentes(luta)) return;
    setAcaoId(luta.id);
    setToast({ mensagem: 'Registrando chamada e avisando os atletas...', tipo: 'info' });

    try {
      const conflito = await buscarConflitoAtleta(luta);
      if (conflito) {
        setToast({ mensagem: `Um atleta desta luta já está comprometido na luta ${conflito.id_visual || conflito.id}, no ${conflito.tatame || 'tatame definido'}.`, tipo: 'erro' });
        setAcaoId(null);
        return;
      }
    } catch (error: any) {
      setToast({ mensagem: `Não foi possível validar a disponibilidade dos atletas: ${error?.message || 'erro inesperado'}.`, tipo: 'erro' });
      setAcaoId(null);
      return;
    }

    const { error } = await supabase
      .from('chaves')
      .update({ iniciada_em: new Date().toISOString() })
      .eq('id', luta.id)
      .eq('evento_id', sessao.evento_id)
      .neq('status_luta', 'concluida');

    if (error) {
      setToast({ mensagem: `Não foi possível chamar a luta: ${error.message}`, tipo: 'erro' });
      setAcaoId(null);
      return;
    }

    void canalOperacaoRef.current?.send({
      type: 'broadcast',
      event: 'luta_chamada',
      payload: { evento_id: sessao.evento_id, luta_id: luta.id, tatame: luta.tatame },
    });

    await Promise.allSettled([
      notificarAtleta(luta.atleta_1_id, luta.atleta_1, luta.atleta_2, luta),
      notificarAtleta(luta.atleta_2_id, luta.atleta_2, luta.atleta_1, luta),
    ]);
    setToast({ mensagem: `Luta ${luta.id_visual || luta.id} chamada. O mesário já pode iniciar.`, tipo: 'sucesso' });
    setAcaoId(null);
    await carregar(true);
  };

  const sair = async () => {
    localStorage.removeItem('itatame_staff_session');
    document.cookie = 'itatame_staff_access=; Path=/; Max-Age=0; SameSite=Lax';
    await supabase.auth.signOut();
    router.replace('/staff/login');
  };

  const card = (luta: Luta, tipo: 'pronta' | 'chamada' | 'aguardando' | 'baia') => (
    <article key={luta.id} className={`rounded-2xl border p-4 ${tipo === 'chamada' ? 'border-yellow-500/40 bg-yellow-500/10' : tipo === 'pronta' ? 'border-emerald-500/25 bg-emerald-500/5' : tipo === 'baia' ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/10 bg-[#0b0b10]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{luta.tatame || 'Sem tatame'} · Luta {luta.id_visual || luta.id} · {hora(luta.horario_estimado)}</p>
          <h3 className="mt-1 truncate text-sm font-black uppercase text-white">{luta.categoria}</h3>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">{luta.faixa || 'Faixa não informada'} · {luta.fase || 'Fase'}</p>
        </div>
        {tipo === 'chamada' && <span className="rounded-full bg-yellow-400 px-2 py-1 text-[8px] font-black uppercase text-black">Já chamada</span>}
        {tipo === 'baia' && <button onClick={() => anunciarCategoria(luta)} className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[8px] font-black uppercase text-cyan-200"><Megaphone size={10} className="mr-1 inline" /> Anunciar categoria</button>}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          { lado: 1 as const, nome: luta.atleta_1, status: luta.checkin_1 },
          { lado: 2 as const, nome: luta.atleta_2, status: luta.checkin_2 },
        ].map((atleta, index) => (
          <div key={`${luta.id}-${index}`} className="rounded-xl border border-white/5 bg-black/50 p-3">
            {atletaReal(atleta.nome) ? <>
              <p className="truncate text-xs font-black uppercase text-white">{atleta.nome}</p>
              <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-black uppercase ${atleta.status === 'aprovado' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-yellow-500/10 text-yellow-300'}`}>
                {atleta.status === 'aprovado' ? <CheckCircle2 size={11} /> : <Clock3 size={11} />}
                {atleta.status === 'aprovado' ? 'Check-in aprovado' : 'Aguardando check-in'}
              </span>
              {tipo !== 'chamada' && <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => atualizarControle(luta, atleta.lado, 'presenca')} disabled={acaoId === `${luta.id}-${atleta.lado}`} className={`rounded-lg border px-2 py-2 text-[8px] font-black uppercase ${controleChamador(luta, atleta.lado).presente ? 'border-emerald-400 bg-emerald-500 text-black' : 'border-white/10 bg-white/5 text-zinc-300'}`}>{controleChamador(luta, atleta.lado).presente ? 'Na baia ✓' : 'Marcar presença'}</button>
                <button onClick={() => atualizarControle(luta, atleta.lado, 'chamada')} disabled={controleChamador(luta, atleta.lado).chamadas >= 2 || acaoId === `${luta.id}-${atleta.lado}`} className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-2 py-2 text-[8px] font-black uppercase text-yellow-200 disabled:opacity-40">{controleChamador(luta, atleta.lado).chamadas >= 2 ? '2 chamadas' : `${controleChamador(luta, atleta.lado).chamadas + 1}ª chamada`}</button>
              </div>}
              {tipo !== 'chamada' && controleChamador(luta, atleta.lado).chamadas >= 2 && !controleChamador(luta, atleta.lado).presente && controleChamador(luta, atleta.lado === 1 ? 2 : 1).presente && <button onClick={() => confirmarWo(luta, atleta.lado)} className="mt-2 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-2 text-[8px] font-black uppercase text-red-300">Confirmar ausência</button>}
            </> : <div className="flex min-h-24 flex-col items-center justify-center text-center"><Clock3 size={18} className="text-cyan-400" /><p className="mt-2 text-[9px] font-black uppercase text-cyan-200">Vaga do adversário</p><p className="mt-1 text-[8px] text-zinc-600">Aguardando vencedor da luta anterior</p></div>}
          </div>
        ))}
      </div>

      {tipo === 'pronta' && (
        <button onClick={() => chamar(luta)} disabled={acaoId === luta.id} className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-yellow-300 disabled:opacity-50">
          {acaoId === luta.id ? <RefreshCw size={15} className="animate-spin" /> : <Megaphone size={15} />}
          Chamar atletas
        </button>
      )}
    </article>
  );

  if (!sessao) return <main className="min-h-screen bg-black" />;

  return (
    <main className="min-h-screen bg-[#050505] pb-12 font-sans text-white">
      <style dangerouslySetInnerHTML={{ __html: `.hide-global-nav > header:first-of-type, .hide-global-nav nav:first-of-type { display: none !important; } body.hide-global-nav > main, body.hide-global-nav > div > main { padding-top: 0 !important; margin-top: 0 !important; }` }} />

      {toast && (
        <div className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[200] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 animate-in slide-in-from-top-4">
          <div className={`flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${toast.tipo === 'erro' ? 'border-red-500/50 bg-red-950/95 text-red-50' : toast.tipo === 'sucesso' ? 'border-emerald-500/50 bg-emerald-950/95 text-emerald-50' : 'border-yellow-500/50 bg-yellow-950/95 text-yellow-50'}`}>
            {toast.tipo === 'sucesso' ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={19} /> : toast.tipo === 'erro' ? <AlertCircle className="mt-0.5 shrink-0 text-red-300" size={19} /> : <RefreshCw className="mt-0.5 shrink-0 animate-spin text-yellow-300" size={19} />}
            <p className="min-w-0 flex-1 text-xs font-black leading-5">{toast.mensagem}</p>
            <button onClick={() => setToast(null)} className="shrink-0 rounded-lg p-1 text-current opacity-70 hover:bg-white/10 hover:opacity-100" aria-label="Fechar aviso"><X size={16} /></button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div>
            <p className="text-lg font-black italic"><span className="text-red-600">i</span>TATAME</p>
            <p className="mt-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-yellow-300"><Megaphone size={13} /> Chamador · {sessao.identificacao}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => carregar()} className="rounded-xl border border-white/10 bg-white/5 p-3" title="Atualizar"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button>
            <button onClick={sair} className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-300" title="Sair"><LogOut size={16} /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        {categoriasChamada.length > 0 && <section><div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-yellow-300"><ShieldCheck size={15} /> Chave digital por categoria</div><div className="flex gap-2 overflow-x-auto pb-2"><button onClick={() => setCategoriaAtiva('')} className={`min-w-max rounded-xl border px-4 py-3 text-[9px] font-black uppercase ${!categoriaAtiva ? 'border-yellow-400 bg-yellow-400 text-black' : 'border-white/10 bg-white/5 text-zinc-400'}`}>Todas</button>{categoriasChamada.map((luta) => { const chave = `${luta.categoria}__${luta.faixa || ''}`; return <div key={chave} className={`flex min-w-max overflow-hidden rounded-xl border ${categoriaAtiva === chave ? 'border-yellow-400 bg-yellow-500/10' : 'border-yellow-500/20 bg-yellow-500/5'}`}><button onClick={() => setCategoriaAtiva(chave)} className="px-4 py-3 text-left"><strong className="block text-[10px] uppercase text-white">{luta.categoria}</strong><span className="mt-1 block text-[8px] font-bold uppercase tracking-widest text-zinc-500">{luta.faixa || 'Faixa não informada'} · ver chave</span></button><button onClick={() => anunciarCategoria(luta)} title="Texto para o locutor" className="border-l border-yellow-500/20 px-3 text-yellow-300"><Megaphone size={14} /></button></div>})}</div></section>}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="text-[8px] font-black uppercase tracking-widest text-emerald-300">Prontas</p><strong className="mt-2 block text-2xl">{prontas.length}</strong></div>
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4"><p className="text-[8px] font-black uppercase tracking-widest text-yellow-300">Chamadas</p><strong className="mt-2 block text-2xl">{chamadas.length}</strong></div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4"><p className="text-[8px] font-black uppercase tracking-widest text-red-300">Em luta</p><strong className="mt-2 block text-2xl">{emAndamento.length}</strong></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Check-in pendente</p><strong className="mt-2 block text-2xl">{aguardandoCheckin.length}</strong></div>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4"><p className="text-[8px] font-black uppercase tracking-widest text-cyan-300">Atletas na baia</p><strong className="mt-2 block text-2xl">{baias.length}</strong></div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/10 p-12 text-center text-xs font-black uppercase tracking-widest text-zinc-500">Carregando cronograma...</div>
        ) : (
          <>
            {chamadas.length > 0 && <section><h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-yellow-300"><Megaphone size={15} /> Aguardando o mesário</h2><div className="grid gap-3 lg:grid-cols-2">{chamadas.map((luta) => card(luta, 'chamada'))}</div></section>}
            {baias.length > 0 && <section><h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-cyan-300"><Users size={15} /> Atletas na baia · adversário pendente</h2><div className="grid gap-3 lg:grid-cols-2">{baias.map((luta) => card(luta, 'baia'))}</div></section>}
            {prontas.length > 0 && <section><h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-300"><Users size={15} /> Prontas para chamar</h2><div className="grid gap-3 lg:grid-cols-2">{prontas.map((luta) => card(luta, 'pronta'))}</div></section>}
            {aguardandoCheckin.length > 0 && <section><h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500"><AlertCircle size={15} /> Aguardando liberação do check-in</h2><div className="grid gap-3 opacity-75 lg:grid-cols-2">{aguardandoCheckin.map((luta) => card(luta, 'aguardando'))}</div></section>}
            {chamadas.length === 0 && prontas.length === 0 && aguardandoCheckin.length === 0 && baias.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-xs font-black uppercase tracking-widest text-zinc-600">Nenhuma luta pendente no cronograma.</div>}
          </>
        )}
      </div>
    </main>
  );
}
