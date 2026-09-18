'use client';

import { obterEventoOrganizador, guardarEventoOrganizador } from '@/app/lib/evento-organizador';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle, Clock, Play, RefreshCw, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { obterTempoRegulamentar } from '../../lib/cronograma';
import { processarAvancosAutomaticosChaves } from '../../lib/chaves-auto-avanco';
import { ehFaseChaveDeTres, ordemOperacionalChaveTriangular } from '@/app/lib/chave-de-tres';

type Evento = { id: string | number; nome: string; data_evento?: string | null };
type Luta = {
  tempo_minutos?: number | null;
  id: string | number;
  categoria: string;
  faixa: string;
  fase?: string | null;
  id_visual?: string | number | null;
  proxima_luta?: string | number | null;
  ordem?: number | null;
  ordem_tatame?: number | null;
  tatame?: string | null;
  status_luta?: string | null;
  vencedor?: string | null;
  horario_estimado?: string | null;
  iniciada_em?: string | null;
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

function chaveTatame(value?: string | null) {
  return normalizar(value);
}

function nomeOficialTatame(nome: string, oficiais: string[]) {
  const chave = chaveTatame(nome);
  if (!chave || chave === 'NÃO DEFINIDO') return 'Não definido';
  return oficiais.find((item) => chaveTatame(item) === chave) || limpar(nome);
}

function unicosTatame(nomes: string[], oficiais: string[] = []) {
  const mapa = new Map<string, string>();
  nomes.forEach((nome) => {
    const oficial = nomeOficialTatame(nome, oficiais);
    const chave = chaveTatame(oficial);
    if (!chave || chave === 'NÃO DEFINIDO') return;
    if (!mapa.has(chave)) mapa.set(chave, oficial);
  });
  return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
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
  const triangularA = ordemOperacionalChaveTriangular(a);
  const triangularB = ordemOperacionalChaveTriangular(b);
  if (triangularA != null || triangularB != null) {
    return (triangularA ?? 99) - (triangularB ?? 99) || (a.ordem || 0) - (b.ordem || 0);
  }
  const faseA = fasePeso[normalizar(a.fase)] || 99;
  const faseB = fasePeso[normalizar(b.fase)] || 99;
  if (faseA !== faseB) return faseA - faseB;
  return (a.ordem || 0) - (b.ordem || 0);
}

export default function GestaoTatames() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoSelecionado, setEventoSelecionado] = useState('');
  useEffect(() => { if (eventoSelecionado && eventoSelecionado !== 'todos') guardarEventoOrganizador(eventoSelecionado); }, [eventoSelecionado]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [categorias, setCategorias] = useState<CategoriaTatame[]>([]);
  const [lutasOperacao, setLutasOperacao] = useState<Luta[]>([]);
  const [tatamesDisponiveis, setTatamesDisponiveis] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [loadingLutas, setLoadingLutas] = useState(false);
  const [salvando, setSaving] = useState<string | null>(null);
  const [showCronoModal, setShowCronoModal] = useState(false);
  const [cronoTatame, setCronoTatame] = useState('');
  const [cronoHora, setCronoHora] = useState('09:00');
  const [cronoTransicao, setCronoTransicao] = useState(2);
  const [gerandoCrono, setGerandoCrono] = useState(false);
  const [tatamesCronometrados, setTatamesCronometrados] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [temAlteracoesPendentes, setTemAlteracoesPendentes] = useState(false);

  useEffect(() => {
    async function inicializar() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setLoadingInit(false);
        return;
      }

      const { data } = await supabase
        .from('eventos')
        .select('id, nome, data_evento')
        .eq('organizador_id', authData.user.id)
        .order('id', { ascending: false });

      const meusEventos = (data || []) as Evento[];
      setEventos(meusEventos);
      if (meusEventos.length > 0) setEventoSelecionado(obterEventoOrganizador(meusEventos));
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
      .select('id, categoria, faixa, fase, id_visual, proxima_luta, ordem, ordem_tatame, tatame, status_luta, vencedor, atleta_1, atleta_2, horario_estimado, iniciada_em, tempo_minutos')
      .eq('evento_id', eventoSelecionado);

    if (error) {
      setMensagem(`Erro ao carregar chaves: ${error.message}`);
      setCategorias([]);
      setLutasOperacao([]);
      setLoadingLutas(false);
      return;
    }

    const lutasCarregadas = (lutas || []) as Luta[];
    setLutasOperacao(lutasCarregadas);
    const grupos: Record<string, CategoriaTatame> = {};

    lutasCarregadas.forEach((luta) => {
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

      if (isLutaReal(luta) || ehFaseChaveDeTres(luta.fase)) grupos[chave].totalLutas += 1;
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

  const alterarTatame = (categoriaObj: CategoriaTatame, novoTatame: string) => {
    setCategorias((prev) => prev.map((cat) => cat.idUnico === categoriaObj.idUnico ? { ...cat, tatameAtual: novoTatame } : cat));
    setTemAlteracoesPendentes(true);
    setMensagem('Categoria movida. Toque em Salvar distribuição para o mesário e o chamador enxergarem.');
  };

  const salvarAlteracoes = async () => {
    if (!eventoSelecionado || categorias.length === 0) return;
    setSaving('todos');
    setMensagem('Salvando distribuição dos tatames...');
    const resultados = await Promise.all(categorias.map((categoria) => supabase
      .from('chaves')
      .update({ tatame: categoria.tatameAtual === 'Não definido' ? null : nomeOficialTatame(categoria.tatameAtual, tatamesDisponiveis) })
      .eq('evento_id', eventoSelecionado)
      .eq('categoria', categoria.nome)
      .eq('faixa', categoria.faixa)));
    const falha = resultados.find((resultado) => resultado.error)?.error;
    setMensagem(falha ? `Erro ao salvar alterações: ${falha.message}` : 'Alterações salvas. Mesários e Chamador receberão a nova distribuição.');
    setSaving(null);
    if (!falha) {
      setTemAlteracoesPendentes(false);
      await carregarLutas();
    }
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
        .filter((luta) => isLutaReal(luta) || ehFaseChaveDeTres(luta.fase))
        .filter((luta) => !statusConcluido(luta))
        .sort(ordenarLutasCronograma);

      if (lutasReais.length === 0) {
        setMensagem('Este tatame não tem lutas reais pendentes para cronograma.');
        setGerandoCrono(false);
        return;
      }

      const evento = eventos.find((item) => String(item.id) === eventoSelecionado);
      const dataEvento = String(evento?.data_evento || '').slice(0, 10);
      const dataBase = /^\d{4}-\d{2}-\d{2}$/.test(dataEvento)
        ? new Date(`${dataEvento}T00:00:00`)
        : new Date();
      const [horas, minutos] = cronoHora.split(':');
      dataBase.setHours(Number(horas), Number(minutos), 0, 0);
      const ponteiroTempo = new Date(dataBase);

      const updates = lutasReais.map((luta, index) => {
        const horarioEstimado = new Date(ponteiroTempo);
        const tempoLuta = (luta.tempo_minutos || obterTempoRegulamentar(luta.categoria, luta.faixa));
        ponteiroTempo.setMinutes(ponteiroTempo.getMinutes() + tempoLuta + cronoTransicao);

        return supabase
          .from('chaves')
          .update({ horario_estimado: horarioEstimado.toISOString(), ordem_tatame: index + 1 })
          .eq('id', luta.id);
      });

      await Promise.all(updates);
      setMensagem(`Cronograma do ${cronoTatame} gerado para ${lutasReais.length} lutas reais pendentes.`);
      setTatamesCronometrados((atuais) => Array.from(new Set([...atuais, cronoTatame])));
      const proximoTatame = tatamesPendentesCrono.find((tatame) => tatame !== cronoTatame);
      if (proximoTatame) setCronoTatame(proximoTatame);
      await carregarLutas();
    } catch (error) {
      console.error(error);
      setMensagem('Houve um erro ao gerar o cronograma.');
    } finally {
      setGerandoCrono(false);
    }
  };

  const categoriasVisiveis = useMemo(() => categorias.map((cat) => ({
    ...cat,
    tatameAtual: cat.tatameAtual === 'Não definido' ? 'Não definido' : nomeOficialTatame(cat.tatameAtual, tatamesDisponiveis),
  })), [categorias, tatamesDisponiveis]);

  const categoriasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return categoriasVisiveis.filter((cat) => !termo || cat.nome.toLowerCase().includes(termo) || cat.faixa.toLowerCase().includes(termo) || cat.tatameAtual.toLowerCase().includes(termo));
  }, [busca, categoriasVisiveis]);

  const nomesTatame = useMemo(() => unicosTatame([
    ...tatamesDisponiveis,
    ...categoriasVisiveis.map((cat) => cat.tatameAtual),
  ], tatamesDisponiveis), [categoriasVisiveis, tatamesDisponiveis]);

  const resumo = useMemo(() => {
    const total = categorias.reduce((acc, cat) => acc + cat.totalLutas, 0);
    const concluidas = categorias.reduce((acc, cat) => acc + cat.lutasConcluidas, 0);
    const semTatame = categorias.filter((cat) => cat.tatameAtual === 'Não definido').length;
    return { total, concluidas, semTatame };
  }, [categorias]);

  const operacaoPorTatame = useMemo(() => {
    const grupos = new globalThis.Map<string, { nome: string; itens: Luta[] }>();
    lutasOperacao.forEach((luta) => {
      const chave = chaveTatame(luta.tatame);
      if (!chave || (isFantasma(luta.atleta_1) && isFantasma(luta.atleta_2))) return;
      const nome = nomeOficialTatame(limpar(luta.tatame), tatamesDisponiveis);
      const atual = grupos.get(chave) || { nome, itens: [] };
      atual.itens.push(luta);
      grupos.set(chave, atual);
    });

    return Array.from(grupos.values()).map(({ nome, itens }) => {
      const ordenadas = [...itens].sort(ordenarLutasCronograma);
      const pendentes = ordenadas.filter((luta) => !statusConcluido(luta));
      const baias = pendentes.filter((luta) => isFantasma(luta.atleta_1) !== isFantasma(luta.atleta_2));
      const atual = pendentes.find((luta) => luta.status_luta === 'em_andamento') || null;
      const chamadas = pendentes.filter((luta) => luta.status_luta !== 'em_andamento' && Boolean(luta.iniciada_em));
      const proximas = pendentes.filter((luta) => isLutaReal(luta) && luta.status_luta !== 'em_andamento').slice(0, 3);
      return { tatame: nome, atual, chamadas, baias, proximas };
    }).sort((a, b) => a.tatame.localeCompare(b.tatame, 'pt-BR', { numeric: true }));
  }, [lutasOperacao, tatamesDisponiveis]);

  const tatamesUsados = unicosTatame(categoriasVisiveis.map((cat) => cat.tatameAtual), tatamesDisponiveis);
  const tatamesJaAgendados = unicosTatame(categoriasVisiveis.filter((cat) => Boolean(cat.proximaHora)).map((cat) => cat.tatameAtual), tatamesDisponiveis);
  const chavesComHorario = new Set([...tatamesJaAgendados, ...tatamesCronometrados].map(chaveTatame));
  const tatamesPendentesCrono = tatamesUsados.filter((tatame) => !chavesComHorario.has(chaveTatame(tatame)));

  const categoriasSemTatame = categoriasFiltradas.filter((cat) => cat.tatameAtual === 'Não definido');
  const colunasTatame = nomesTatame.map((tatame) => ({
    tatame,
    categorias: categoriasFiltradas.filter((cat) => chaveTatame(cat.tatameAtual) === chaveTatame(tatame)),
    operacao: operacaoPorTatame.find((grupo) => chaveTatame(grupo.tatame) === chaveTatame(tatame)) || null,
    temHorario: chavesComHorario.has(chaveTatame(tatame)),
  }));
  const passoAtual = resumo.semTatame > 0 || temAlteracoesPendentes ? 1 : tatamesPendentesCrono.length > 0 || tatamesUsados.length === 0 ? 2 : 3;

  const abrirHorarios = () => {
    if (temAlteracoesPendentes) {
      setMensagem('Salve a distribuição dos tatames antes de configurar os horários.');
      return;
    }
    setCronoTatame(tatamesPendentesCrono[0] || tatamesUsados[0] || tatamesDisponiveis[0] || '');
    setShowCronoModal(true);
  };

  const seletorTatame = (cat: CategoriaTatame, destaque = false) => {
    const concluida = cat.totalLutas > 0 && cat.lutasConcluidas === cat.totalLutas;
    return (
      <label className="block">
        <span className={`mb-1 block text-[10px] font-bold uppercase tracking-widest ${destaque ? 'text-yellow-300' : 'text-zinc-500'}`}>{destaque ? 'Escolha o tatame' : 'Mover para'}</span>
        <select value={cat.tatameAtual} onChange={(event) => alterarTatame(cat, event.target.value)} disabled={concluida || Boolean(salvando)} className={`min-h-11 w-full rounded-xl px-3 text-sm font-bold text-white outline-none disabled:opacity-50 ${destaque ? 'border-2 border-yellow-400 bg-black' : 'border border-white/10 bg-black/60'}`}>
          <option value="Não definido">Ainda sem tatame</option>
          {nomesTatame.map((tatame) => <option key={chaveTatame(tatame)} value={tatame}>{tatame}</option>)}
        </select>
      </label>
    );
  };

  return (
    <main className="min-h-screen bg-[#050505] p-4 pb-32 md:p-8 md:pb-36 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 border-b border-white/10 pb-6">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight">Organizar tatames</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">Duas tarefas: escolher em qual tatame cada categoria luta, depois dizer que horas cada tatame começa.</p>
        </header>

        <section className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-zinc-500">Campeonato</span>
            <select value={eventoSelecionado} onChange={(event) => setEventoSelecionado(event.target.value)} disabled={loadingInit || eventos.length === 0} className="w-full rounded-xl border border-white/10 bg-[#0b0b10] px-4 py-3 text-sm font-bold text-white outline-none">
              {loadingInit && <option>Carregando eventos...</option>}
              {!loadingInit && eventos.length === 0 && <option value="">Nenhum evento criado</option>}
              {eventos.map((evento) => <option key={evento.id} value={String(evento.id)}>{evento.nome}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-zinc-500">Buscar categoria</span>
            <span className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-3">
              <Search size={16} className="text-zinc-600" />
              <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome, faixa ou tatame" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600" />
            </span>
          </label>
          <button onClick={() => carregarLutas()} className="self-end rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-400 hover:text-white" title="Atualizar"><RefreshCw size={16} /></button>
        </section>

        <ol className="mb-6 grid gap-3 md:grid-cols-2">
          <li className={`rounded-2xl border p-4 ${passoAtual === 1 ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-white/10 bg-[#0b0b10]'}`}>
            <p className="text-[11px] font-black uppercase tracking-widest text-yellow-300">Passo 1</p>
            <p className="mt-1 font-bold text-white">Coloque cada categoria em um tatame e salve.</p>
            <p className="mt-1 text-sm text-zinc-400">{resumo.semTatame === 0 ? 'Todas as categorias já têm tatame.' : `${resumo.semTatame} categoria(s) ainda sem tatame.`}</p>
          </li>
          <li className={`rounded-2xl border p-4 ${passoAtual === 2 ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-white/10 bg-[#0b0b10]'}`}>
            <p className="text-[11px] font-black uppercase tracking-widest text-yellow-300">Passo 2</p>
            <p className="mt-1 font-bold text-white">Defina a hora de início de cada tatame.</p>
            <p className="mt-1 text-sm text-zinc-400">{tatamesUsados.length === 0 ? 'Salve a distribuição primeiro.' : tatamesPendentesCrono.length === 0 ? 'Todos os tatames já têm horário.' : `${tatamesPendentesCrono.length} tatame(s) ainda sem horário.`}</p>
          </li>
        </ol>

        <p className="mb-4 text-sm text-zinc-400">{resumo.total} luta(s) no evento · {resumo.concluidas} encerrada(s).</p>
        {mensagem && <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">{mensagem}</div>}
        {tatamesDisponiveis.length === 0 && (
          <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            Cadastre os mesários em <Link href="/admin" className="font-bold underline">Equipe de operação</Link>, com o nome do tatame (ex.: Tatame 1). Esses nomes aparecem aqui para você escolher.
          </div>
        )}

        {loadingInit || loadingLutas ? (
          <div className="rounded-2xl border border-white/10 bg-[#0b0b10] p-12 text-center text-sm text-zinc-500">Carregando categorias...</div>
        ) : categoriasFiltradas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b0b10] p-12 text-center">
            <AlertCircle size={34} className="mx-auto mb-3 text-zinc-700" />
            <h2 className="font-black text-white">Nenhuma categoria para organizar</h2>
            <p className="mt-2 text-sm text-zinc-500">Gere as chaves primeiro ou limpe a busca.</p>
            <Link href="/admin/chaves" className="mt-4 inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest">Ir para as chaves</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {categoriasSemTatame.length > 0 && (
              <section className="rounded-2xl border-2 border-dashed border-yellow-400 bg-yellow-500/10 p-5">
                <p className="text-[11px] font-black uppercase tracking-widest text-yellow-300">Precisa da sua decisão</p>
                <h2 className="mt-1 text-lg font-black text-yellow-50">Estas categorias ainda não têm tatame</h2>
                <p className="mt-1 text-sm text-yellow-100/80">Escolha onde cada uma vai lutar. Elas só entram na fila do mesário depois que você salvar.</p>
                <div className="mt-4 space-y-3">
                  {categoriasSemTatame.map((cat) => (
                    <div key={cat.idUnico} className="grid gap-3 rounded-2xl border border-yellow-400/40 bg-[#1a1408] p-4 sm:grid-cols-[1fr_220px] sm:items-center">
                      <div>
                        <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black uppercase text-black">Sem tatame</span>
                        <p className="mt-2 font-black uppercase text-white">{cat.nome}</p>
                        <p className="text-sm text-yellow-100/70">Faixa {cat.faixa} · {cat.totalLutas} luta(s)</p>
                      </div>
                      {seletorTatame(cat, true)}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <h2 className="pt-2 text-sm font-bold uppercase tracking-widest text-zinc-500">Fila de cada tatame</h2>
            {colunasTatame.map((coluna) => (
              <section key={chaveTatame(coluna.tatame)} className={`rounded-2xl p-4 ${coluna.categorias.length === 0 ? 'border border-dashed border-white/15 bg-transparent' : 'border border-white/10 bg-[#0b0b10]'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black uppercase text-white">{coluna.tatame}</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {coluna.categorias.length === 0
                        ? 'Vazio — nenhuma categoria aqui ainda.'
                        : `${coluna.categorias.length} categoria(s) neste tatame · ${coluna.temHorario ? 'horário definido' : 'falta definir o horário'}`}
                    </p>
                  </div>
                  {coluna.categorias.length > 0 && coluna.operacao && (
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${coluna.operacao.atual ? 'bg-red-500 text-white' : coluna.operacao.chamadas.length ? 'bg-yellow-400 text-black' : 'bg-emerald-500/80 text-black'}`}>
                      {coluna.operacao.atual ? 'Lutando agora' : coluna.operacao.chamadas.length ? 'Atleta chamado' : 'Livre'}
                    </span>
                  )}
                </div>

                {coluna.categorias.length > 0 && (
                  <>
                    {coluna.operacao?.atual && (
                      <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">Agora: {coluna.operacao.atual.atleta_1} × {coluna.operacao.atual.atleta_2}</p>
                    )}
                    {coluna.operacao && coluna.operacao.proximas.length > 0 && (
                      <p className="mt-2 text-sm text-zinc-400">Próxima luta: {coluna.operacao.proximas[0].atleta_1} × {coluna.operacao.proximas[0].atleta_2}</p>
                    )}
                    {coluna.operacao && coluna.operacao.baias.length > 0 && (
                      <p className="mt-1 text-sm text-cyan-300">Esperando adversário: {coluna.operacao.baias.slice(0, 2).map((luta) => isFantasma(luta.atleta_1) ? luta.atleta_2 : luta.atleta_1).join(', ')}</p>
                    )}
                    <div className="mt-3 space-y-2">
                      {coluna.categorias.map((cat) => (
                        <div key={cat.idUnico} className="grid gap-3 rounded-xl border border-white/10 bg-black/40 p-3 sm:grid-cols-[1fr_200px] sm:items-center">
                          <div>
                            <p className="font-bold uppercase text-white">{cat.nome}</p>
                            <p className="text-xs text-zinc-500">Faixa {cat.faixa} · {cat.lutasConcluidas}/{cat.totalLutas} lutas · {formatarHorario(cat.proximaHora)}</p>
                          </div>
                          {seletorTatame(cat)}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {!loadingInit && !loadingLutas && categorias.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#050505]/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row">
            <button onClick={salvarAlteracoes} disabled={Boolean(salvando) || !temAlteracoesPendentes} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 py-4 text-xs font-black uppercase tracking-widest text-black disabled:opacity-40">
              {salvando ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />} {temAlteracoesPendentes ? 'Salvar distribuição' : 'Distribuição salva'}
            </button>
            <button onClick={abrirHorarios} disabled={tatamesUsados.length === 0 || temAlteracoesPendentes} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-500 px-5 py-4 text-xs font-black uppercase tracking-widest text-black disabled:opacity-40">
              <Clock size={16} /> {temAlteracoesPendentes ? 'Salve antes dos horários' : 'Definir horários'}
            </button>
          </div>
        </div>
      )}

      {showCronoModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b10] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-black/40 p-5">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-white"><Clock size={20} className="text-yellow-300" /> Horário do tatame</h2>
                <p className="mt-1 text-sm text-zinc-400">Informe quando a primeira luta começa. O sistema preenche as seguintes.</p>
              </div>
              <button onClick={() => setShowCronoModal(false)} className="rounded-xl bg-white/5 p-2 text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-4 p-5">
              <p className="rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-zinc-300">
                {tatamesPendentesCrono.length > 0 ? `Falta horário em ${tatamesPendentesCrono.length} tatame(s).` : 'Todos os tatames já têm horário. Você pode gerar de novo se mudar a ordem.'}
              </p>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-zinc-500">Qual tatame?</label>
                <select value={cronoTatame} onChange={(event) => setCronoTatame(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white outline-none">
                  <option value="" disabled>Selecione</option>
                  {(tatamesUsados.length > 0 ? tatamesUsados : nomesTatame).map((tatame) => <option key={chaveTatame(tatame)} value={tatame}>{tatame}{chavesComHorario.has(chaveTatame(tatame)) ? ' · já tem horário' : ''}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-zinc-500">Primeira luta</label>
                  <div className="flex gap-2"><input type="time" value={cronoHora} onChange={(event) => setCronoHora(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 py-3 text-sm font-black text-white outline-none" /><button type="button" onClick={() => setCronoHora(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))} className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 text-[10px] font-bold uppercase text-cyan-200">Agora</button></div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-zinc-500">Minutos entre lutas</label>
                  <input type="number" min="0" max="10" value={cronoTransicao} onChange={(event) => setCronoTransicao(Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-black text-white outline-none" />
                </div>
              </div>

              <p className="text-sm leading-relaxed text-zinc-400">Entram lutas com dois atletas e, na chave de 3 ou 6, também a baia e as decisões, na ordem: luta 1, baia, decisão, final.</p>

              <button onClick={gerarCronogramaTatame} disabled={gerandoCrono || !cronoTatame} className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-3.5 text-xs font-black uppercase tracking-widest text-black disabled:opacity-50">
                {gerandoCrono ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                {gerandoCrono ? 'Gerando...' : 'Aplicar horário neste tatame'}
              </button>
              {tatamesPendentesCrono.length === 0 && <button onClick={() => setShowCronoModal(false)} className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-300">Concluir</button>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
