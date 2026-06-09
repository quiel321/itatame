'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, Map, Play, RefreshCw, Search, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { obterTempoRegulamentar } from '../../lib/cronograma';
import { processarAvancosAutomaticosChaves } from '../../lib/chaves-auto-avanco';

type Evento = { id: string | number; nome: string };
type Luta = {
  id: string | number;
  categoria: string;
  faixa: string;
  fase?: string | null;
  ordem?: number | null;
  ordem_tatame?: number | null;
  tatame?: string | null;
  status_luta?: string | null;
  vencedor?: string | null;
  horario_estimado?: string | null;
  atleta_1?: string | null;
  atleta_2?: string | null;
};

type CategoriaTatame = {
  idUnico: string;
  nome: string;
  faixa: string;
  tatameAtual: string;
  totalLutas: number;
  lutasConcluidas: number;
  proximaHora?: string | null;
};

function limpar(value?: string | null) {
  return String(value || '').trim();
}

function normalizar(value?: string | null) {
  return limpar(value).toUpperCase();
}

function isFantasma(nome?: string | null) {
  const clean = normalizar(nome);
  return clean === '' || clean === 'BYE' || clean === 'TBD' || clean.includes('SEM OPONENTE');
}

function isLutaReal(luta: Luta) {
  return !isFantasma(luta.atleta_1) && !isFantasma(luta.atleta_2);
}

function statusConcluido(luta: Luta) {
  return luta.status_luta === 'concluida' || Boolean(luta.vencedor);
}

function formatarHorario(value?: string | null) {
  if (!value) return 'Sem horário';
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const fasePeso: Record<string, number> = {
  '32-AVOS': 1,
  '16-AVOS': 2,
  'OITAVAS': 3,
  'OITAVAS DE FINAL': 3,
  'QUARTAS': 4,
  'QUARTAS DE FINAL': 4,
  'SEMIFINAL': 5,
  'FINAL': 6,
};

function ordenarLutasCronograma(a: Luta, b: Luta) {
  const ordemTatameA = a.ordem_tatame ?? 9999;
  const ordemTatameB = b.ordem_tatame ?? 9999;
  if (ordemTatameA !== ordemTatameB) return ordemTatameA - ordemTatameB;
  if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
  if (a.faixa !== b.faixa) return a.faixa.localeCompare(b.faixa);
  const faseA = fasePeso[normalizar(a.fase)] || 99;
  const faseB = fasePeso[normalizar(b.fase)] || 99;
  if (faseA !== faseB) return faseA - faseB;
  return (a.ordem || 0) - (b.ordem || 0);
}

export default function GestaoTatames() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoSelecionado, setEventoSelecionado] = useState('');
  const [loadingInit, setLoadingInit] = useState(true);
  const [categorias, setCategorias] = useState<CategoriaTatame[]>([]);
  const [tatamesDisponiveis, setTatamesDisponiveis] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [loadingLutas, setLoadingLutas] = useState(false);
  const [salvando, setSaving] = useState<string | null>(null);
  const [showCronoModal, setShowCronoModal] = useState(false);
  const [cronoTatame, setCronoTatame] = useState('');
  const [cronoHora, setCronoHora] = useState('09:00');
  const [cronoTransicao, setCronoTransicao] = useState(2);
  const [gerandoCrono, setGerandoCrono] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    async function inicializar() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setLoadingInit(false);
        return;
      }

      const { data } = await supabase
        .from('eventos')
        .select('id, nome')
        .eq('organizador_id', authData.user.id)
        .order('id', { ascending: false });

      const meusEventos = (data || []) as Evento[];
      setEventos(meusEventos);
      if (meusEventos.length > 0) setEventoSelecionado(String(meusEventos[0].id));
      setLoadingInit(false);
    }

    inicializar();
  }, []);

  const carregarTatamesConfigurados = useCallback(async () => {
    if (!eventoSelecionado) return;

    const { data } = await supabase
      .from('staff_eventos')
      .select('identificacao')
      .eq('evento_id', eventoSelecionado)
      .eq('funcao', 'mesario');

    const nomes = Array.from(new Set((data || []).map((item) => limpar(item.identificacao)).filter(Boolean)));
    setTatamesDisponiveis(nomes.sort((a, b) => a.localeCompare(b)));
  }, [eventoSelecionado]);

  const carregarLutas = useCallback(async () => {
    if (!eventoSelecionado) return;
    setLoadingLutas(true);

    await processarAvancosAutomaticosChaves(supabase, eventoSelecionado);

    const { data: lutas, error } = await supabase
      .from('chaves')
      .select('id, categoria, faixa, fase, tatame, status_luta, vencedor, atleta_1, atleta_2, horario_estimado')
      .eq('evento_id', eventoSelecionado);

    if (error) {
      setMensagem(`Erro ao carregar chaves: ${error.message}`);
      setCategorias([]);
      setLoadingLutas(false);
      return;
    }

    const grupos: Record<string, CategoriaTatame> = {};

    ((lutas || []) as Luta[]).forEach((luta) => {
      const temAtletaReal = !isFantasma(luta.atleta_1) || !isFantasma(luta.atleta_2);
      if (!temAtletaReal) return;

      const chave = `${luta.categoria}__${luta.faixa}`;
      if (!grupos[chave]) {
        grupos[chave] = {
          idUnico: chave,
          nome: luta.categoria,
          faixa: luta.faixa,
          tatameAtual: luta.tatame || 'Não definido',
          totalLutas: 0,
          lutasConcluidas: 0,
          proximaHora: null,
        };
      }

      if (isLutaReal(luta)) grupos[chave].totalLutas += 1;
      if (isLutaReal(luta) && statusConcluido(luta)) grupos[chave].lutasConcluidas += 1;
      if (!statusConcluido(luta) && luta.horario_estimado && !grupos[chave].proximaHora) {
        grupos[chave].proximaHora = luta.horario_estimado;
      }
    });

    setCategorias(Object.values(grupos).filter((cat) => cat.totalLutas > 0 || cat.tatameAtual === 'Não definido').sort((a, b) => a.nome.localeCompare(b.nome)));
    setLoadingLutas(false);
  }, [eventoSelecionado]);

  useEffect(() => {
    if (!eventoSelecionado) return;
    void Promise.resolve().then(() => {
      void carregarLutas();
      void carregarTatamesConfigurados();
    });
  }, [carregarLutas, carregarTatamesConfigurados, eventoSelecionado]);

  const alterarTatame = async (categoriaObj: CategoriaTatame, novoTatame: string) => {
    setSaving(categoriaObj.idUnico);

    const { error } = await supabase
      .from('chaves')
      .update({ tatame: novoTatame })
      .eq('evento_id', eventoSelecionado)
      .eq('categoria', categoriaObj.nome)
      .eq('faixa', categoriaObj.faixa);

    if (error) {
      setMensagem(`Erro ao transferir categoria: ${error.message}`);
    } else {
      setCategorias((prev) => prev.map((cat) => cat.idUnico === categoriaObj.idUnico ? { ...cat, tatameAtual: novoTatame } : cat));
      setMensagem('Categoria transferida. O painel do mesário será atualizado em instantes.');
    }

    setSaving(null);
  };

  const gerarCronogramaTatame = async () => {
    if (!cronoTatame) {
      setMensagem('Selecione um tatame primeiro.');
      return;
    }

    setGerandoCrono(true);
    setMensagem('Gerando cronograma do tatame...');

    try {
      const { data: lutasDoEvento, error } = await supabase
        .from('chaves')
        .select('*')
        .eq('evento_id', eventoSelecionado);

      if (error || !lutasDoEvento) throw error || new Error('Nenhuma luta encontrada.');

      const tatameAlvo = normalizar(cronoTatame);
      const lutasReais = (lutasDoEvento as Luta[])
        .filter((luta) => normalizar(luta.tatame) === tatameAlvo)
        .filter((luta) => isLutaReal(luta))
        .filter((luta) => !statusConcluido(luta))
        .sort(ordenarLutasCronograma);

      if (lutasReais.length === 0) {
        setMensagem('Este tatame não tem lutas reais pendentes para cronograma.');
        setGerandoCrono(false);
        return;
      }

      const dataBase = new Date();
      const [horas, minutos] = cronoHora.split(':');
      dataBase.setHours(Number(horas), Number(minutos), 0, 0);
      const ponteiroTempo = new Date(dataBase);

      const updates = lutasReais.map((luta, index) => {
        const horarioEstimado = new Date(ponteiroTempo);
        const tempoLuta = obterTempoRegulamentar(luta.categoria, luta.faixa);
        ponteiroTempo.setMinutes(ponteiroTempo.getMinutes() + tempoLuta + cronoTransicao);

        return supabase
          .from('chaves')
          .update({ horario_estimado: horarioEstimado.toISOString(), ordem_tatame: index + 1 })
          .eq('id', luta.id);
      });

      await Promise.all(updates);
      setMensagem(`Cronograma do ${cronoTatame} gerado para ${lutasReais.length} lutas reais pendentes.`);
      setShowCronoModal(false);
      await carregarLutas();
    } catch (error) {
      console.error(error);
      setMensagem('Houve um erro ao gerar o cronograma.');
    } finally {
      setGerandoCrono(false);
    }
  };

  const categoriasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return categorias.filter((cat) => !termo || cat.nome.toLowerCase().includes(termo) || cat.faixa.toLowerCase().includes(termo) || cat.tatameAtual.toLowerCase().includes(termo));
  }, [busca, categorias]);

  const resumo = useMemo(() => {
    const total = categorias.reduce((acc, cat) => acc + cat.totalLutas, 0);
    const concluidas = categorias.reduce((acc, cat) => acc + cat.lutasConcluidas, 0);
    const semTatame = categorias.filter((cat) => cat.tatameAtual === 'Não definido').length;
    return { total, concluidas, semTatame };
  }, [categorias]);

  return (
    <main className="min-h-screen bg-[#050505] p-4 md:p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-white/10 pb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-red-400">Central de operação</span>
              <h1 className="mt-3 text-2xl md:text-4xl font-black uppercase tracking-tight">Gestão de tatames</h1>
              <p className="mt-2 max-w-2xl text-xs md:text-sm text-zinc-500">Distribua categorias, gere horários e mantenha mesários, painel ao vivo e atletas sincronizados.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 md:flex md:w-auto">
              <button onClick={() => setShowCronoModal(true)} disabled={loadingLutas || tatamesDisponiveis.length === 0} className="flex items-center justify-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-yellow-300 disabled:opacity-40">
                <Clock size={14} /> Horarios
              </button>
              <button onClick={() => { carregarLutas(); carregarTatamesConfigurados(); }} disabled={loadingLutas} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40">
                <RefreshCw size={14} className={loadingLutas ? 'animate-spin text-red-400' : ''} /> Sincronizar
              </button>
            </div>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-[#0b0b10] p-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Lutas reais</span>
            <strong className="mt-2 block text-xl md:text-2xl font-black">{resumo.total}</strong>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">Concluídas</span>
            <strong className="mt-2 block text-xl md:text-2xl font-black text-emerald-300">{resumo.concluidas}</strong>
          </div>
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-yellow-300">Sem tatame</span>
            <strong className="mt-2 block text-xl md:text-2xl font-black text-yellow-300">{resumo.semTatame}</strong>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-white/10 bg-[#0b0b10] p-4">
          <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
            <select value={eventoSelecionado} onChange={(event) => setEventoSelecionado(event.target.value)} disabled={loadingInit || eventos.length === 0} className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white outline-none">
              {loadingInit && <option>Carregando eventos...</option>}
              {!loadingInit && eventos.length === 0 && <option value="">Nenhum evento criado</option>}
              {eventos.map((evento) => <option key={evento.id} value={String(evento.id)}>{evento.nome}</option>)}
            </select>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black px-3 py-2.5">
              <Search size={16} className="text-zinc-600" />
              <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar categoria, faixa ou tatame" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-700" />
            </label>
          </div>
          {mensagem && <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs font-bold text-cyan-100">{mensagem}</div>}
        </section>

        {loadingInit || loadingLutas ? (
          <div className="rounded-2xl border border-white/10 bg-[#0b0b10] p-12 text-center text-xs font-black uppercase tracking-widest text-zinc-500">Mapeando lutas...</div>
        ) : categoriasFiltradas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b0b10] p-12 text-center">
            <AlertCircle size={34} className="mx-auto mb-3 text-zinc-700" />
            <h2 className="font-black uppercase text-white">Nenhuma chave mapeada</h2>
            <p className="mt-1 text-xs text-zinc-600">Gere as chaves ou ajuste o filtro.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categoriasFiltradas.map((cat) => {
              const progresso = Math.round((cat.lutasConcluidas / cat.totalLutas) * 100) || 0;
              const concluida = cat.totalLutas > 0 && cat.lutasConcluidas === cat.totalLutas;

              return (
                <article key={cat.idUnico} className={`rounded-2xl border bg-[#0b0b10] p-4 shadow-xl ${concluida ? 'border-emerald-500/20' : 'border-white/10 hover:border-white/20'}`}>
                  <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-black">
                    <div className={concluida ? 'h-full bg-emerald-500' : 'h-full bg-red-600'} style={{ width: `${progresso}%` }} />
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Faixa {cat.faixa}</span>
                      <h3 className="mt-1 line-clamp-2 text-sm md:text-base font-black uppercase text-white">{cat.nome}</h3>
                    </div>
                    <span className="shrink-0 rounded-lg border border-white/10 bg-black px-2 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-300">
                      <Users size={12} className="mr-1 inline text-red-400" /> {cat.lutasConcluidas}/{cat.totalLutas}
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/5 bg-black/50 p-3 text-xs text-zinc-400">
                    Próxima luta: <strong className="text-cyan-200">{formatarHorario(cat.proximaHora)}</strong>
                  </div>

                  <div className="mt-4 flex items-center gap-3 border-t border-white/5 pt-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-black ${cat.tatameAtual !== 'Não definido' ? 'border-red-500/30 text-red-400' : 'border-yellow-500/30 text-yellow-300'}`}>
                      {salvando === cat.idUnico ? <RefreshCw size={16} className="animate-spin" /> : <Map size={16} />}
                    </div>
                    <select value={cat.tatameAtual} onChange={(event) => alterarTatame(cat, event.target.value)} disabled={concluida || salvando === cat.idUnico} className="min-h-11 flex-1 rounded-xl border border-white/10 bg-black px-3 text-xs font-black uppercase tracking-widest text-white outline-none disabled:opacity-50">
                      <option value="Não definido" disabled>Escolher tatame</option>
                      {tatamesDisponiveis.map((tatame) => <option key={tatame} value={tatame}>{tatame}</option>)}
                    </select>
                    {cat.tatameAtual !== 'Não definido' && <CheckCircle size={16} className="text-emerald-400" />}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {showCronoModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b10] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-black/40 p-5">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black uppercase text-white"><Clock size={20} className="text-yellow-300" /> Motor de horários</h2>
                <p className="mt-1 text-xs text-zinc-500">Defina a hora de início e o intervalo médio entre lutas.</p>
              </div>
              <button onClick={() => setShowCronoModal(false)} className="rounded-xl bg-white/5 p-2 text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Tatame</label>
                <select value={cronoTatame} onChange={(event) => setCronoTatame(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white outline-none">
                  <option value="" disabled>Selecione um tatame</option>
                  {tatamesDisponiveis.map((tatame) => <option key={tatame} value={tatame}>{tatame}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Inicio</label>
                  <input type="time" value={cronoHora} onChange={(event) => setCronoHora(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-black text-white outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Transição</label>
                  <input type="number" min="0" max="10" value={cronoTransicao} onChange={(event) => setCronoTransicao(Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-black text-white outline-none" />
                </div>
              </div>

              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-xs leading-relaxed text-yellow-100">
                O cronograma ignora BYE/TBD e recalcula somente lutas reais pendentes. O painel do mesário, o ao vivo e os avisos push usam estes horários.
              </div>

              <button onClick={gerarCronogramaTatame} disabled={gerandoCrono || !cronoTatame} className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-3.5 text-xs font-black uppercase tracking-widest text-black disabled:opacity-50">
                {gerandoCrono ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                {gerandoCrono ? 'Gerando...' : 'Gerar linha do tempo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}