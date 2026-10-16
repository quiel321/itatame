'use client';

import { obterEventoOrganizador, guardarEventoOrganizador } from '@/app/lib/evento-organizador';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AvisosProgramacao from '@/app/components/AvisosProgramacao';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle, Clock, Play, RefreshCw, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ehFaseChaveDeTres, ordemOperacionalChaveTriangular } from '@/app/lib/chave-de-tres';
import { compararCategoriasIdadePeso, lutaIniciadaSequencia, metadadosCategoriaSequencia, planejarSequenciaTatames } from '@/app/lib/sequencia-tatames';
import { dataHoraLocalParaIso, fusoHorarioEvento, paraInputDateTimeEvento } from '@/app/lib/evento-datas';
import { planejarHorariosCategorias, lutaPendenteProgramacao } from '@/app/lib/programacao-categorias';
import type { CategoriaCompeticao } from '@/app/lib/categorias-competicao';
import { rotuloCategoriaAoVivo } from '@/app/lib/categorias-competicao';
import { tatameOficial, tatamesOficiais } from '@/app/lib/tatames-oficiais';

type Evento = { id: string | number; nome: string; data_evento?: string | null; estado?: string | null };
type Luta = {
  tempo_minutos?: number | null;
  id: string | number;
  categoria: string;
  categoria_id?: string | null;
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
  atleta_1_id?: number | null;
  atleta_2_id?: number | null;
};

type CategoriaTatame = {
  categoriaId?: string | null;
  inicioPrevisto?: string | null;
  idUnico: string;
  nome: string;
  faixa: string;
  tatameAtual: string;
  totalLutas: number;
  lutasConcluidas: number;
  proximaHora?: string | null;
  ordem: number;
  idadeMin?: number;
  pesoMin?: number;
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
  return tatameOficial(nome, oficiais) || 'Não definido';
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

function formatarHorario(value?: string | null, estado?: string | null) {
  if (!value) return 'Sem horário';
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: fusoHorarioEvento(estado) });
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
  const router = useRouter();
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
  const [cronoHora, setCronoHora] = useState('');
  const [cronoTransicao, setCronoTransicao] = useState(2);
  const [cronoMargem, setCronoMargem] = useState(5);
  const [cronoReservaFinal, setCronoReservaFinal] = useState(10);
  const [cronoDescanso, setCronoDescanso] = useState(true);
  const [cronoInicios, setCronoInicios] = useState<Record<string, string>>({});
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
        .select('id, nome, data_evento, estado')
        .eq('organizador_id', authData.user.id)
        .order('id', { ascending: false });

      const meusEventos = (data || []) as Evento[];
      setEventos(meusEventos);
      if (meusEventos.length > 0) setEventoSelecionado(obterEventoOrganizador(meusEventos) || String(meusEventos[0].id));
      setLoadingInit(false);
    }

    inicializar();
  }, []);

  const carregarLutas = useCallback(async () => {
    if (!eventoSelecionado) return;
    setLoadingLutas(true);

    // A consulta de planejamento é somente leitura; avanços pertencem à operação.

    const [{ data: lutas, error }, { data: categoriasEvento }, mesarios] = await Promise.all([supabase
      .from('chaves')
      .select('id, categoria, categoria_id, faixa, fase, id_visual, proxima_luta, ordem, ordem_tatame, tatame, status_luta, vencedor, atleta_1, atleta_2, atleta_1_id, atleta_2_id, horario_estimado, iniciada_em, tempo_minutos')
      .eq('evento_id', eventoSelecionado),
      supabase.from('categorias_evento').select('*').eq('evento_id', eventoSelecionado),
      supabase.from('staff_eventos').select('identificacao').eq('evento_id', eventoSelecionado).eq('funcao', 'mesario')]);

    if (error) {
      setMensagem(`Erro ao carregar chaves: ${error.message}`);
      setCategorias([]);
      setLutasOperacao([]);
      setLoadingLutas(false);
      return;
    }
    if (mesarios.error) {
      setMensagem('Não foi possível conferir as áreas cadastradas. Atualize antes de distribuir os tatames.');
      setCategorias([]); setLutasOperacao([]); setTatamesDisponiveis([]); setLoadingLutas(false); return;
    }
    const oficiais = tatamesOficiais((mesarios.data || []).map(m => m.identificacao));
    setTatamesDisponiveis(oficiais);

    const lutasCarregadas = (lutas || []) as Luta[];
    setLutasOperacao(lutasCarregadas);
    const grupos: Record<string, CategoriaTatame> = {};

    lutasCarregadas.forEach((luta) => {
      const temAtletaReal = !isFantasma(luta.atleta_1) || !isFantasma(luta.atleta_2);
      if (!temAtletaReal && ![luta.atleta_1, luta.atleta_2].some(nome => normalizar(nome) === 'TBD')) return;

      const chave = `${luta.categoria}__${luta.faixa}`;
      if (!grupos[chave]) {
        grupos[chave] = {
          categoriaId: luta.categoria_id,
          inicioPrevisto: categoriasEvento?.find(c => c.id === luta.categoria_id)?.inicio_lutas_previsto || null,
          idUnico: chave,
          nome: luta.categoria,
          faixa: luta.faixa,
          tatameAtual: nomeOficialTatame(luta.tatame || '', oficiais),
          totalLutas: 0,
          lutasConcluidas: 0,
          proximaHora: null,
          ordem: luta.ordem_tatame ?? Infinity,
          ...metadadosCategoriaSequencia(luta, (categoriasEvento || []) as CategoriaCompeticao[]),
        };
      }
      grupos[chave].ordem = Math.min(grupos[chave].ordem, luta.ordem_tatame ?? Infinity);

      if (![luta.atleta_1, luta.atleta_2].some(nome => normalizar(nome) === 'BYE') || ehFaseChaveDeTres(luta.fase)) grupos[chave].totalLutas += 1;
      if (isLutaReal(luta) && statusConcluido(luta)) grupos[chave].lutasConcluidas += 1;
      if (!statusConcluido(luta) && luta.horario_estimado && (!grupos[chave].proximaHora || luta.horario_estimado < grupos[chave].proximaHora!)) {
        grupos[chave].proximaHora = luta.horario_estimado;
      }
    });

    setCategorias(Object.values(grupos).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)));
    setTemAlteracoesPendentes(lutasCarregadas.some(l => Boolean(l.tatame) && (!tatameOficial(l.tatame, oficiais) || l.ordem_tatame == null) && !lutaIniciadaSequencia(l)));
    setTatamesCronometrados([]);
    setLoadingLutas(false);
  }, [eventoSelecionado]);

  useEffect(() => {
    if (!eventoSelecionado) return;
    void Promise.resolve().then(() => {
      void carregarLutas();
    });
  }, [carregarLutas, eventoSelecionado]);

  const alterarTatame = (categoriaObj: CategoriaTatame, novoTatame: string) => {
    if (novoTatame !== 'Não definido' && !tatameOficial(novoTatame, tatamesDisponiveis)) return;
    if (tatameBloqueado(categoriaObj.tatameAtual) || tatameBloqueado(novoTatame)) return;
    setCategorias((prev) => prev.map((cat) => cat.idUnico === categoriaObj.idUnico ? { ...cat, tatameAtual: novoTatame } : cat));
    setTemAlteracoesPendentes(true);
    setMensagem('Categoria movida. Salve a sequência e depois defina os horários.');
  };

  const tatameBloqueado = (tatame: string) => lutasOperacao.some(l => chaveTatame(l.tatame) === chaveTatame(tatame === 'Não definido' ? '' : tatame) && lutaIniciadaSequencia(l));
  const moverCategoria = (cat: CategoriaTatame, direcao: -1 | 1) => {
    if (tatameBloqueado(cat.tatameAtual)) return;
    const fila = categorias.filter(c => chaveTatame(c.tatameAtual) === chaveTatame(cat.tatameAtual));
    const outra = fila[fila.findIndex(c => c.idUnico === cat.idUnico) + direcao];
    if (!outra) return;
    setCategorias(atuais => { const lista = [...atuais]; const i = lista.findIndex(c => c.idUnico === cat.idUnico); const j = lista.findIndex(c => c.idUnico === outra.idUnico); [lista[i], lista[j]] = [lista[j], lista[i]]; return lista; });
    setTemAlteracoesPendentes(true);
    setMensagem('Ordem ajustada. Salve para atualizar a fila do chamador. Os horários deste tatame serão recalculados após salvar.');
  };
  const ordenarIdadePeso = (tatame: string) => {
    if (tatameBloqueado(tatame)) return;
    setCategorias(atuais => {
      const fila = atuais.filter(c => chaveTatame(c.tatameAtual) === chaveTatame(tatame)).sort(compararCategoriasIdadePeso);
      let i = 0;
      return atuais.map(c => chaveTatame(c.tatameAtual) === chaveTatame(tatame) ? fila[i++] : c);
    });
    setTemAlteracoesPendentes(true);
    setMensagem('Mais novos primeiro; dentro da idade, mais leves primeiro. Confira e salve a sequência.');
  };

  const salvarPlanejamento = async (linhas: unknown[]) => {
    const { error } = await supabase.rpc('salvar_planejamento_tatames', { p_evento: eventoSelecionado, p_lutas: linhas });
    if (error) throw new Error(error.code === 'PGRST202'
      ? 'Instale a função de planejamento dos tatames no Supabase antes de salvar. Nenhuma alteração foi gravada.' : error.message);
  };

  const salvarAlteracoes = async () => {
    if (!eventoSelecionado || categorias.length === 0) return;
    setSaving('todos');
    setMensagem('Salvando distribuição e sequência...');
    try {
      const linhas = planejarSequenciaTatames(lutasOperacao, categorias.map(c => ({ ...c, tatameAtual: c.tatameAtual === 'Não definido' ? c.tatameAtual : nomeOficialTatame(c.tatameAtual, tatamesDisponiveis) })));
      await salvarPlanejamento(linhas);
      await carregarLutas();
      setMensagem('Sequência salva. O chamador e o mesário já recebem esta ordem. Defina novamente os horários dos tatames alterados.');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally {
      setSaving(null);
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
        .sort(ordenarLutasCronograma);

      if (!lutasReais.some(l => !statusConcluido(l) && ![l.atleta_1, l.atleta_2].some(nome => normalizar(nome) === 'BYE'))) {
        setMensagem('Este tatame não tem lutas reais pendentes para cronograma.');
        setGerandoCrono(false);
        return;
      }

      const evento = eventos.find((item) => String(item.id) === eventoSelecionado);
      const dataEvento = String(evento?.data_evento || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEvento)) throw new Error('Defina a data do campeonato antes dos horários.');
      if (tatameBloqueado(cronoTatame)) throw new Error('Este tatame já iniciou a operação. Horários preservados.');
      if (!Number.isInteger(cronoTransicao) || cronoTransicao < 0 || cronoTransicao > 10) throw new Error('O intervalo deve ser de 0 a 10 minutos.');
      const ponteiroTempo = new Date(dataHoraLocalParaIso(`${dataEvento}T${cronoHora}`, evento?.estado)!);
      const inicios = categorias.filter(c => chaveTatame(c.tatameAtual) === chaveTatame(cronoTatame) && c.categoriaId).filter((c, i, todas) => todas.findIndex(x => x.categoriaId === c.categoriaId) === i).map(c => ({
        categoria_id: c.categoriaId!, inicio_previsto: dataHoraLocalParaIso(cronoInicios[c.categoriaId!] || '', evento?.estado), inicio_anterior: c.inicioPrevisto || null,
      }));
      const plano = planejarHorariosCategorias(lutasReais, ponteiroTempo.toISOString(), cronoTransicao, inicios, { reservarDescanso: cronoDescanso, margemCategorias: cronoMargem, reservaFinal: cronoReservaFinal });
      const { error: erroProgramacao } = await supabase.rpc('salvar_programacao_categorias', { p_evento: eventoSelecionado, p_lutas: plano.updates, p_categorias: inicios });
      if (erroProgramacao) throw new Error(erroProgramacao.code === 'PGRST202' ? 'A programação ainda não está disponível. Atualize a página ou procure o suporte.' : erroProgramacao.message);
      setMensagem(`Programação do ${cronoTatame} salva. ${plano.avisos.length ? 'Atenção: há categorias cuja previsão ultrapassa o horário anunciado; confira o resumo.' : 'Horários das categorias e das lutas atualizados.'}`);
      setTatamesCronometrados((atuais) => Array.from(new Set([...atuais, cronoTatame])));
      const proximoTatame = tatamesPendentesCrono.find((tatame) => tatame !== cronoTatame);
      if (proximoTatame) selecionarTatameCrono(proximoTatame);
      await carregarLutas();
    } catch (error) {
      console.error(error);
      setMensagem(error instanceof Error ? error.message : 'Houve um erro ao gerar o cronograma.');
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

  const nomesColunasTatame = useMemo(() => unicosTatame(
    categoriasVisiveis.map((cat) => cat.tatameAtual),
    tatamesDisponiveis,
  ), [categoriasVisiveis, tatamesDisponiveis]);

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
  const colunasTatame = nomesColunasTatame.map((tatame) => ({
    tatame,
    categorias: categoriasFiltradas.filter((cat) => chaveTatame(cat.tatameAtual) === chaveTatame(tatame)),
    operacao: operacaoPorTatame.find((grupo) => chaveTatame(grupo.tatame) === chaveTatame(tatame)) || null,
    temHorario: chavesComHorario.has(chaveTatame(tatame)),
  })).filter((coluna) => coluna.categorias.length > 0);
  const passoAtual = resumo.semTatame > 0 || temAlteracoesPendentes ? 1 : tatamesPendentesCrono.length > 0 || tatamesUsados.length === 0 ? 2 : 3;

  const abrirHorarios = () => {
    if (temAlteracoesPendentes) {
      setMensagem('Salve a distribuição dos tatames antes de configurar os horários.');
      return;
    }
    selecionarTatameCrono(tatamesPendentesCrono[0] || tatamesUsados[0] || tatamesDisponiveis[0] || '');
    const evento = eventos.find(e => String(e.id) === eventoSelecionado);
    setCronoInicios(Object.fromEntries(categorias.filter(c => c.categoriaId).map(c => {
      const salvo = paraInputDateTimeEvento(c.inicioPrevisto, evento?.estado);
      return [c.categoriaId!, salvo ? `${String(evento?.data_evento || '').slice(0, 10)}T${salvo.slice(11, 16)}` : ''];
    })));
    setMensagem('');
    setShowCronoModal(true);
  };

  const concluirProgramacao = () => {
    if (gerandoCrono || loadingLutas || salvando || temAlteracoesPendentes
      || resumo.semTatame > 0 || !tatamesUsados.length || tatamesPendentesCrono.length) return;
    setShowCronoModal(false);
    const evento = encodeURIComponent(eventoSelecionado);
    router.push(`/admin?evento=${evento}&programacao_concluida=${evento}`);
  };

  const eventoCrono = eventos.find(e => String(e.id) === eventoSelecionado);
  const selecionarTatameCrono = (nome: string) => {
    setCronoTatame(nome);
    const primeira = lutasOperacao.filter(l => chaveTatame(l.tatame) === chaveTatame(nome) && lutaPendenteProgramacao(l) && l.horario_estimado).sort(ordenarLutasCronograma)[0];
    setCronoHora(paraInputDateTimeEvento(primeira?.horario_estimado, eventoCrono?.estado).slice(11, 16));
  };
  const previaCrono = (() => {
    if (!showCronoModal || !cronoTatame) return null;
    try {
      const inicio = dataHoraLocalParaIso(`${String(eventoCrono?.data_evento || '').slice(0, 10)}T${cronoHora}`, eventoCrono?.estado);
      const inicios = categorias.filter(c => chaveTatame(c.tatameAtual) === chaveTatame(cronoTatame) && c.categoriaId).filter((c, i, todas) => todas.findIndex(x => x.categoriaId === c.categoriaId) === i).map(c => ({ categoria_id: c.categoriaId!, inicio_previsto: dataHoraLocalParaIso(cronoInicios[c.categoriaId!] || '', eventoCrono?.estado) }));
      return { plano: planejarHorariosCategorias(lutasOperacao.filter(l => chaveTatame(l.tatame) === chaveTatame(cronoTatame)), inicio || '', cronoTransicao, inicios, { reservarDescanso: cronoDescanso, margemCategorias: cronoMargem, reservaFinal: cronoReservaFinal }), erro: '' };
    } catch (e) { return { plano: null, erro: e instanceof Error ? e.message : 'Confira os horários.' }; }
  })();

  const seletorTatame = (cat: CategoriaTatame, destaque = false) => {
    const concluida = cat.totalLutas > 0 && cat.lutasConcluidas === cat.totalLutas;
    return (
      <label className="block">
        <span className={`mb-1 block text-[10px] font-bold uppercase tracking-widest ${destaque ? 'text-yellow-300' : 'text-zinc-500'}`}>{destaque ? 'Escolha o tatame' : 'Mover para'}</span>
        <select value={cat.tatameAtual} onChange={(event) => alterarTatame(cat, event.target.value)} disabled={concluida || tatameBloqueado(cat.tatameAtual) || Boolean(salvando)} className={`min-h-11 w-full rounded-xl px-3 text-sm font-bold text-white outline-none disabled:opacity-50 ${destaque ? 'border-2 border-yellow-400 bg-black' : 'border border-white/10 bg-black/60'}`}>
          <option value="Não definido">Ainda sem tatame</option>
          {nomesTatame.map((tatame) => <option key={chaveTatame(tatame)} value={tatame} disabled={tatameBloqueado(tatame)}>{tatame}</option>)}
        </select>
      </label>
    );
  };

  return (
    <main className="min-h-screen bg-[#050505] p-4 pb-60 md:p-8 md:pb-36 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 border-b border-white/10 pb-6">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight">Organizar tatames</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">Escolha o tatame, organize as categorias na ordem desejada e defina o horário de início.</p>
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
          <button onClick={() => carregarLutas()} disabled={temAlteracoesPendentes || Boolean(salvando)} className="self-end rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-400 hover:text-white disabled:opacity-40" title="Atualizar"><RefreshCw size={16} /></button>
        </section>

        <AvisosProgramacao eventoId={String(eventoSelecionado||'')} bloqueado={temAlteracoesPendentes||Boolean(salvando)} />

        <ol className="mb-6 grid gap-3 md:grid-cols-2">
          <li className={`rounded-2xl border p-4 ${passoAtual === 1 ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-white/10 bg-[#0b0b10]'}`}>
            <p className="text-[11px] font-black uppercase tracking-widest text-yellow-300">Passo 1</p>
            <p className="mt-1 font-bold text-white">Escolha o tatame e a sequência das categorias.</p>
            <p className="mt-1 text-sm text-zinc-400">{resumo.semTatame === 0 ? 'Todas as categorias já têm tatame.' : `${resumo.semTatame} categoria(s) ainda sem tatame.`}</p>
          </li>
          <li className={`rounded-2xl border p-4 ${passoAtual === 2 ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-white/10 bg-[#0b0b10]'}`}>
            <p className="text-[11px] font-black uppercase tracking-widest text-yellow-300">Passo 2</p>
            <p className="mt-1 font-bold text-white">Defina os horários do tatame e das categorias.</p>
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
                  <button onClick={() => ordenarIdadePeso(coluna.tatame)} disabled={tatameBloqueado(coluna.tatame) || Boolean(salvando) || coluna.categorias.length < 2} className="min-h-11 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 text-xs font-bold text-cyan-200 disabled:opacity-40">Ordenar por idade e peso</button>
                  {coluna.categorias.length > 0 && coluna.operacao && (
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${coluna.operacao.atual ? 'bg-red-500 text-white' : coluna.operacao.chamadas.length ? 'bg-yellow-400 text-black' : 'bg-emerald-500/80 text-black'}`}>
                      {coluna.operacao.atual ? 'Lutando agora' : coluna.operacao.chamadas.length ? 'Atleta chamado' : 'Livre'}
                    </span>
                  )}
                </div>

                {coluna.categorias.length > 0 && (
                  <>
                    <p className="mt-3 text-xs leading-relaxed text-zinc-400">{tatameBloqueado(coluna.tatame) ? 'Operação iniciada: sequência protegida.' : 'Do primeiro ao último. Use as setas para ajustar; depois salve. Categorias sem idade/peso identificados ficam ao final da ordenação automática.'}</p>
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
                      {coluna.categorias.map((cat) => {
                        const filaCompleta = categoriasVisiveis.filter(c => chaveTatame(c.tatameAtual) === chaveTatame(coluna.tatame));
                        const index = filaCompleta.findIndex(c => c.idUnico === cat.idUnico);
                        return (
                        <div key={cat.idUnico} className="grid gap-3 rounded-xl border border-white/10 bg-black/40 p-3 sm:grid-cols-[1fr_200px] sm:items-center">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-sm font-black text-cyan-200">{index + 1}</span>
                            <div className="min-w-0"><p className="break-words text-sm font-bold text-white">{cat.nome}</p>
                            <p className="text-xs text-zinc-500">Faixa {cat.faixa} · {cat.lutasConcluidas}/{cat.totalLutas} lutas · {formatarHorario(cat.proximaHora, eventos.find(e => String(e.id) === eventoSelecionado)?.estado)}</p>
                            {cat.inicioPrevisto && <p className="mt-1 text-xs text-amber-200">Início previsto da categoria: {formatarHorario(cat.inicioPrevisto, eventoCrono?.estado)}</p>}
                            <div className="mt-2 flex gap-2">
                              <button aria-label={`Subir ${cat.nome}`} onClick={() => moverCategoria(cat, -1)} disabled={index === 0 || tatameBloqueado(coluna.tatame) || Boolean(salvando)} className="flex min-h-11 items-center gap-1 rounded-lg border border-white/15 px-3 text-xs font-bold disabled:opacity-30"><ArrowUp size={16} /> Subir</button>
                              <button aria-label={`Descer ${cat.nome}`} onClick={() => moverCategoria(cat, 1)} disabled={index === filaCompleta.length - 1 || tatameBloqueado(coluna.tatame) || Boolean(salvando)} className="flex min-h-11 items-center gap-1 rounded-lg border border-white/15 px-3 text-xs font-bold disabled:opacity-30"><ArrowDown size={16} /> Descer</button>
                            </div></div>
                          </div>
                          {seletorTatame(cat)}
                        </div>
                      ); })}
                    </div>
                  </>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {!loadingInit && !loadingLutas && categorias.length > 0 && (
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-white/10 bg-[#050505]/95 p-3 backdrop-blur md:bottom-0 md:p-4">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row">
            <button onClick={salvarAlteracoes} disabled={Boolean(salvando) || !temAlteracoesPendentes} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 py-4 text-xs font-black uppercase tracking-widest text-black disabled:opacity-40">
              {salvando ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />} {temAlteracoesPendentes ? 'Salvar sequência e tatames' : 'Sequência salva'}
            </button>
            <button onClick={abrirHorarios} disabled={tatamesUsados.length === 0 || temAlteracoesPendentes} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-500 px-5 py-4 text-xs font-black uppercase tracking-widest text-black disabled:opacity-40">
              <Clock size={16} /> {temAlteracoesPendentes ? 'Salve antes dos horários' : 'Definir horários'}
            </button>
          </div>
        </div>
      )}

      {showCronoModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label="Programação por categoria" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0b10] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-black/40 p-5">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-white"><Clock size={20} className="text-yellow-300" /> Programação das lutas</h2>
                <p className="mt-1 text-sm text-zinc-400">Informe o início do tatame. O sistema sugere os horários das categorias na sequência salva.</p>
              </div>
              <button aria-label="Fechar horários" onClick={() => setShowCronoModal(false)} className="min-h-11 min-w-11 rounded-xl bg-white/5 p-2 text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-4 p-5">
              {mensagem && <p role="status" className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">{mensagem}</p>}
              <p className="rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-zinc-300">
                {tatamesPendentesCrono.length > 0 ? `Falta horário em ${tatamesPendentesCrono.length} tatame(s).` : 'Todos os tatames já têm horário. Você pode gerar de novo se mudar a ordem.'}
              </p>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-zinc-500">Qual tatame?</label>
                <select aria-label="Tatame da programação" value={cronoTatame} onChange={(event) => selecionarTatameCrono(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white outline-none">
                  <option value="" disabled>Selecione</option>
                  {(tatamesUsados.length > 0 ? tatamesUsados : nomesTatame).map((tatame) => <option key={chaveTatame(tatame)} value={tatame} disabled={tatameBloqueado(tatame)}>{tatame}{chavesComHorario.has(chaveTatame(tatame)) ? ' · já tem horário' : ''}</option>)}
                </select>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-zinc-500">Primeira luta</label>
                  <div className="flex gap-2"><input aria-label="Início do tatame" type="time" value={cronoHora} onChange={(event) => setCronoHora(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 py-3 text-sm font-black text-white outline-none" /><button type="button" onClick={() => setCronoHora(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: fusoHorarioEvento(eventoCrono?.estado) }))} className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 text-[10px] font-bold uppercase text-cyan-200">Agora</button></div>
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">Cálculo atual: {cronoTransicao} min entre lutas, {cronoMargem} min de margem entre categorias e {cronoReservaFinal} min de reserva no encerramento. {cronoDescanso ? 'Descanso dos atletas incluído.' : 'Sem reserva de descanso.'}</p>
                <details className="rounded-xl border border-white/15 p-3">
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-zinc-300">Ajustar o cálculo</summary>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="mb-1 block text-xs text-zinc-400">Transição entre lutas (min)</span>
                  <input aria-label="Minutos entre lutas" type="number" min="0" max="10" value={cronoTransicao} onChange={(event) => setCronoTransicao(Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-black text-white outline-none" />
                  </label>
                  <label className="block"><span className="mb-1 block text-xs text-zinc-400">Margem entre categorias (min)</span><input aria-label="Margem entre categorias" type="number" min="0" max="60" value={cronoMargem} onChange={e => setCronoMargem(Number(e.target.value))} className="min-h-11 w-full rounded-xl border border-white/15 bg-black px-3 text-sm" /></label>
                  <label className="block"><span className="mb-1 block text-xs text-zinc-400">Reserva no encerramento (min)</span><input aria-label="Reserva no encerramento" type="number" min="0" max="60" value={cronoReservaFinal} onChange={e => setCronoReservaFinal(Number(e.target.value))} className="min-h-11 w-full rounded-xl border border-white/15 bg-black px-3 text-sm" /></label>
                  </div>
                  <label className="mt-3 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={cronoDescanso} onChange={e => setCronoDescanso(e.target.checked)} className="h-5 w-5" />Reservar descanso entre lutas do mesmo atleta</label>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">Referência: um tempo de luta até a semifinal e dois antes da final. Confira se corresponde ao regulamento do seu campeonato. A reserva é uma previsão; o operador acompanha o descanso real.</p>
                </details>
              </div>

              <details className="rounded-xl border border-white/15 p-3">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-zinc-300">Ajustar horários manualmente{Object.values(cronoInicios).some(Boolean) ? ' · há horários definidos' : ''}</summary>
                <section className="mt-2 space-y-3" aria-label="Horários das categorias">
                <p className="text-xs leading-relaxed text-zinc-400">Opcional. Data do campeonato: {String(eventoCrono?.data_evento || '').slice(0, 10).split('-').reverse().join('/')}. Preencha só a hora das exceções; em branco, segue a sugestão automática.</p>
                <button type="button" onClick={() => setCronoInicios(v => ({ ...v, ...Object.fromEntries(categorias.filter(c => chaveTatame(c.tatameAtual) === chaveTatame(cronoTatame) && c.categoriaId).map(c => [c.categoriaId!, ''])) }))} className="min-h-11 rounded-lg border border-white/15 px-3 text-xs font-bold">Usar somente sugestões automáticas neste tatame</button>
                {categorias.filter(c => chaveTatame(c.tatameAtual) === chaveTatame(cronoTatame)).map(c => <label key={c.idUnico} className="block rounded-xl border border-white/15 bg-black/30 p-3">
                  <span className="mb-2 block break-words text-xs font-bold text-zinc-200">{c.nome}</span>
                  <input aria-label={`Início previsto de ${c.nome}`} type="time" value={cronoInicios[c.categoriaId || '']?.slice(11, 16) || ''} disabled={!c.categoriaId || tatameBloqueado(cronoTatame) || gerandoCrono} onChange={e => setCronoInicios(v => ({ ...v, [c.categoriaId!]: e.target.value ? `${String(eventoCrono?.data_evento || '').slice(0, 10)}T${e.target.value}` : '' }))} className="min-h-11 w-full min-w-0 rounded-lg border border-white/20 bg-black px-2 text-sm text-white disabled:opacity-40" />
                  {!c.categoriaId && <span className="text-xs text-amber-200">Chave antiga sem vínculo com categoria; usa a previsão da fila.</span>}
                </label>)}
                </section>
              </details>
              {previaCrono?.erro && <p role="alert" className="text-sm text-red-300">{previaCrono.erro}</p>}
              {previaCrono?.plano && <section aria-label="Prévia do cronograma" className="rounded-xl border border-white/15 p-3 text-xs">
                <h3 className="font-bold">Horários sugeridos</h3>
                {previaCrono.plano.categorias.map((c, i) => <div key={i} className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3"><p className="break-words font-bold text-white">{rotuloCategoriaAoVivo(c.categoria)}</p><p className="mt-1 text-amber-200">{formatarHorario(c.inicio, eventoCrono?.estado)} até {formatarHorario(c.fim, eventoCrono?.estado)} · {c.lutas} luta(s)</p>{c.descansoMinutos > 0 && <p className="mt-1 text-zinc-400">Inclui {c.descansoMinutos} min adicionais para descanso.</p>}</div>)}
                {previaCrono.plano.fimComMargem && <p className="mt-3 rounded-lg bg-white/5 p-3 font-bold text-white">Última luta até {formatarHorario(previaCrono.plano.fim, eventoCrono?.estado)} · reserva até {formatarHorario(previaCrono.plano.fimComMargem, eventoCrono?.estado)}</p>}
                {previaCrono.plano.avisos.map((a, i) => <p role="status" key={i} className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200">{a.categoria}: anunciado {formatarHorario(a.previsto, eventoCrono?.estado)}, mas a fila estima {formatarHorario(a.estimado, eventoCrono?.estado)} ({a.atrasoMinutos} min depois). O horário anunciado será preservado.</p>)}
                <p className="mt-3 text-zinc-400">Estimativa com tempo máximo de luta, transição e as reservas acima. Premiação fora do tatame; paralisações longas exigem tempo adicional. Somente aplicar grava os horários.</p>
              </section>}

              <p className="text-sm leading-relaxed text-zinc-400">Horário local do campeonato. A sequência salva é mantida, incluindo as próximas fases e decisões das chaves de 3 ou 6. Os horários são estimativas.</p>

              <button onClick={gerarCronogramaTatame} disabled={gerandoCrono || !cronoTatame || tatameBloqueado(cronoTatame) || Boolean(previaCrono?.erro)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-3.5 text-xs font-black uppercase tracking-widest text-black disabled:opacity-50">
                {gerandoCrono ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                {gerandoCrono ? 'Gerando...' : 'Aplicar horário neste tatame'}
              </button>
              {tatamesPendentesCrono.length === 0 && tatamesUsados.length > 0 && <button onClick={concluirProgramacao} disabled={gerandoCrono || loadingLutas || Boolean(salvando) || temAlteracoesPendentes || resumo.semTatame > 0} className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-300 disabled:opacity-50">Concluir</button>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

