'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRightLeft, CheckCircle, Clock, Filter, LogOut, Play, RefreshCw, Search, Trophy, X, Edit3, XCircle, LayoutGrid, Radio, Wifi, Megaphone, Pause } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { obterTempoRegulamentar } from '../../lib/cronograma';
import { processarAvancosAutomaticosChaves } from '../../lib/chaves-auto-avanco';
import { rotuloLuta } from '../../lib/lutas-rotulos';
import { garantirVinculoStaff } from '../../lib/staff-sessao';
import { ordemOperacionalChaveTriangular, textoAguardandoChaveDeTres } from '@/app/lib/chave-de-tres';
import { semFaixaDuplicada } from '@/app/lib/categorias-competicao';
import { sugestoesCategoriaPorTatame } from '@/app/lib/sugestao-categoria-tatame';
import { alertaProximaLuta, corrigirResultadoLuta, METODOS_RESULTADO, rotuloMetodo, type MetodoResultado } from '@/app/lib/corrigir-resultado';

type StaffSession = {
  evento_id: string | number;
  funcao: string;
  identificacao: string;
};

type Luta = {
  id: string | number;
  evento_id: string | number;
  categoria: string;
  faixa: string;
  fase?: string | null;
  id_visual?: string | number | null;
  ordem?: number | null;
  ordem_tatame?: number | null;
  tatame?: string | null;
  atleta_1?: string | null;
  atleta_2?: string | null;
  equipe_1?: string | null;
  equipe_2?: string | null;
  atleta_1_id?: number | null;
  atleta_2_id?: number | null;
  checkin_1?: string | null;
  checkin_2?: string | null;
  status_luta?: string | null;
  iniciada_em?: string | null;
  vencedor?: string | null;
  vencedor_id?: number | null;
  metodo_vitoria?: string | null;
  proxima_luta?: string | number | null;
  horario_estimado?: string | null;
  finalizada_em?: string | null;
};

type ModalTransferencia = {
  visivel: boolean;
  luta: Luta | null;
};

type CheckinRow = {
  atleta_id: number | null;
  status_checkin: string | null;
};

type TatameLivre = {
  tatame: string;
  identificacao: string;
  expiraEm: number;
};

function normalizar(value?: string | null) {
  return String(value || '').trim();
}

function nomeUpper(value?: string | null) {
  return normalizar(value).toUpperCase();
}

function ehRotuloPlaceholderTatame(nome?: string | null) {
  return /^TATAME\s*\d+$/i.test(normalizar(nome));
}

function isGhost(nome?: string | null) {
  const clean = nomeUpper(nome);
  return clean === '' || clean === 'BYE' || clean === 'TBD' || clean.includes('SEM OPONENTE');
}

function isAtletaValido(nome?: string | null) {
  return !isGhost(nome);
}

function displayNome(nome?: string | null) {
  const clean = nomeUpper(nome);
  if (clean === "BYE" || clean.includes("SEM OPONENTE")) return "SEM OPONENTE";
  if (clean === "TBD" || clean === "") return "AGUARDANDO OPONENTE";
  return normalizar(nome);
}

function ordenarLutas(a: Luta, b: Luta) {
  if (a.categoria === b.categoria && (a.faixa || '') === (b.faixa || '')) {
    const triangularA = ordemOperacionalChaveTriangular(a);
    const triangularB = ordemOperacionalChaveTriangular(b);
    if (triangularA != null && triangularB != null && triangularA !== triangularB) return triangularA - triangularB;
  }
  const ordemA = a.ordem_tatame ?? a.ordem ?? 9999;
  const ordemB = b.ordem_tatame ?? b.ordem ?? 9999;
  if (ordemA !== ordemB) return ordemA - ordemB;
  return Number(a.id_visual || 0) - Number(b.id_visual || 0);
}

function statusCheckinLabel(status?: string | null) {
  if (status === 'aprovado') return { label: 'Liberado', className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' };
  if (status === 'pendente') return { label: 'Check-in pendente', className: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20' };
  if (status?.includes('desclassificado')) return { label: 'Reprovado', className: 'text-red-300 bg-red-500/10 border-red-500/20' };
  return { label: 'Sem check-in', className: 'text-zinc-400 bg-white/5 border-white/10' };
}

function formatarHorario(value?: string | null) {
  if (!value) return 'Sem horário';
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function tituloCategoria(luta: Luta) {
  return semFaixaDuplicada(luta.categoria || '', luta.faixa || '') || luta.categoria || 'Categoria';
}

export default function PainelMesario() {
  const router = useRouter();
  const [sessao, setSessao] = useState<StaffSession | null>(null);
  const [lutas, setLutas] = useState<Luta[]>([]);
  const [todasLutasEvento, setTodasLutasEvento] = useState<Luta[]>([]); // 🔥 Para buscar os oponentes da Baia
  const [tatamesDisponiveis, setTatamesDisponiveis] = useState<string[]>([]);
  const [modalTransferencia, setModalTransferencia] = useState<ModalTransferencia>({ visivel: false, luta: null });
  const [modalCorrecao, setModalCorrecao] = useState<{ luta: Luta; lado: 1 | 2 | null; metodo: MetodoResultado } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acaoId, setAcaoId] = useState<string | number | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'fila' | 'geral' | 'concluidas'>('fila');
  const [buscaNome, setBuscaNome] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'peso' | 'absoluto'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [aviso, setAviso] = useState('');
  const [temChamador, setTemChamador] = useState(false);
  const [disponivelParaReceber, setDisponivelParaReceber] = useState(false);
  const [tatamesLivres, setTatamesLivres] = useState<Record<string, TatameLivre>>({});
  const canalOperacaoRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    document.body.classList.add('hide-global-nav');
    const sessaoSalva = localStorage.getItem('itatame_staff_session');
    if (!sessaoSalva) {
      router.replace('/staff/login');
      return;
    }

    const sessaoParse = JSON.parse(sessaoSalva) as StaffSession;
    if (sessaoParse.funcao !== 'mesario') {
      router.replace('/staff/login');
      return;
    }

    void Promise.resolve().then(() => setSessao(sessaoParse));
    return () => document.body.classList.remove('hide-global-nav');
  }, [router]);

  const buscarTatames = useCallback(async () => {
    if (!sessao) return;

    // staff_eventos só é legível para o posto vinculado ao evento.
    await garantirVinculoStaff();

    const { data } = await supabase
      .from('staff_eventos')
      .select('funcao, identificacao')
      .eq('evento_id', sessao.evento_id)
      .in('funcao', ['mesario', 'chamador']);

    if (data) {
      const nomes = Array.from(new Set(data.filter((item) => item.funcao === 'mesario').map((item) => normalizar(item.identificacao)).filter(Boolean)));
      setTatamesDisponiveis(nomes.sort((a, b) => a.localeCompare(b)));
      setTemChamador(data.some((item) => item.funcao === 'chamador'));
    }
  }, [sessao]);

  const carregarPainel = useCallback(async (silencioso = false) => {
    if (!sessao) return;
    if (!silencioso) setLoading(true);
    setRefreshing(true);

    const resultado = await supabase
      .from('chaves')
      .select('*')
      .eq('evento_id', sessao.evento_id)
      .order('ordem_tatame', { ascending: true })
      .order('ordem', { ascending: true });
    let todas = resultado.data;
    const error = resultado.error;

    if (error || !todas) {
      setAviso('Não foi possível carregar as lutas deste tatame.');
      if (!silencioso) setLoading(false);
      setRefreshing(false);
      return;
    }

    const houveAvanco = await processarAvancosAutomaticosChaves(supabase, sessao.evento_id).catch(() => false);
    if (houveAvanco) {
      const { data: atualizadas } = await supabase
        .from('chaves')
        .select('*')
        .eq('evento_id', sessao.evento_id)
        .order('ordem_tatame', { ascending: true })
        .order('ordem', { ascending: true });
      if (atualizadas) todas = atualizadas;
    }

    setTodasLutasEvento(todas as Luta[]); // 🔥 Salva todas para o motor da Baia poder rastrear lutas anteriores

    const tatameAtual = nomeUpper(sessao.identificacao);
    
    // 🔥 AGORA PUXA AS LUTAS MESMO QUE TENHA SÓ UM ATLETA (Para exibir na Baia)
    const lutasDoTatame = (todas as Luta[])
      .filter((luta) => nomeUpper(luta.tatame) === tatameAtual)
      .filter((luta) => {
        const temPeloMenosUmAtleta = isAtletaValido(luta.atleta_1) || isAtletaValido(luta.atleta_2);
        return temPeloMenosUmAtleta || luta.status_luta === 'concluida';
      })
      .sort(ordenarLutas);

    const idsAtletas = Array.from(new Set(lutasDoTatame.flatMap((luta) => [luta.atleta_1_id, luta.atleta_2_id]).filter(Boolean)));
    const { data: inscricoes } = idsAtletas.length > 0
      ? await supabase.from('inscricoes').select('atleta_id, status_checkin').eq('evento_id', sessao.evento_id).in('atleta_id', idsAtletas)
      : { data: [] as CheckinRow[] };

    const comCheckin = lutasDoTatame.map((luta) => {
      const getStatus = (id?: number | null) => {
        if (!id) return 'N/A';
        return inscricoes?.find((item) => item.atleta_id === id)?.status_checkin || 'pendente';
      };

      return {
        ...luta,
        checkin_1: getStatus(luta.atleta_1_id),
        checkin_2: getStatus(luta.atleta_2_id),
      };
    });

    setLutas(comCheckin);
    setAviso('');
    if (!silencioso) setLoading(false);
    setRefreshing(false);
  }, [sessao]);

  useEffect(() => {
    if (!sessao) return;
    void Promise.resolve().then(() => {
      void buscarTatames();
      void carregarPainel();
    });
    const interval = window.setInterval(() => carregarPainel(true), 15000);
    return () => window.clearInterval(interval);
  }, [buscarTatames, carregarPainel, sessao]);

  useEffect(() => {
    if (!sessao) return;

    const removerTatameLivre = (tatame?: string) => {
      const chave = nomeUpper(tatame);
      if (!chave) return;
      setTatamesLivres((atual) => {
        const proximo = { ...atual };
        delete proximo[chave];
        return proximo;
      });
    };

    const canal = supabase
      .channel(`operacao-tatames-${sessao.evento_id}`, { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'tatame_disponivel' }, (mensagem) => {
        const payload = mensagem.payload as Partial<TatameLivre>;
        const chave = nomeUpper(payload.tatame);
        if (!chave || !payload.tatame || Number(payload.expiraEm || 0) <= Date.now()) return;
        setTatamesLivres((atual) => ({
          ...atual,
          [chave]: {
            tatame: payload.tatame as string,
            identificacao: String(payload.identificacao || payload.tatame),
            expiraEm: Number(payload.expiraEm),
          },
        }));
      })
      .on('broadcast', { event: 'tatame_ocupado' }, (mensagem) => {
        const payload = mensagem.payload as { tatame?: string };
        removerTatameLivre(payload.tatame);
      })
      .on('broadcast', { event: 'luta_transferida' }, (mensagem) => {
        const payload = mensagem.payload as { tatame?: string; origem?: string };
        removerTatameLivre(payload.tatame);
        if (nomeUpper(payload.tatame) === nomeUpper(sessao.identificacao)) {
          setDisponivelParaReceber(false);
          setAviso(`Nova luta recebida de ${payload.origem || 'outro tatame'}. A disponibilidade foi encerrada automaticamente.`);
        }
        void carregarPainel(true);
      })
      .on('broadcast', { event: 'luta_chamada' }, () => { void carregarPainel(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chaves', filter: `evento_id=eq.${sessao.evento_id}` }, () => { void carregarPainel(true); })
      .subscribe();

    canalOperacaoRef.current = canal;
    const limparExpirados = window.setInterval(() => {
      const agora = Date.now();
      setTatamesLivres((atual) => Object.fromEntries(Object.entries(atual).filter(([, item]) => item.expiraEm > agora)));
    }, 5000);

    return () => {
      window.clearInterval(limparExpirados);
      canalOperacaoRef.current = null;
      void supabase.removeChannel(canal);
    };
  }, [carregarPainel, sessao]);

  useEffect(() => {
    if (!sessao || !disponivelParaReceber) return;
    const enviar = () => {
      void canalOperacaoRef.current?.send({
        type: 'broadcast',
        event: 'tatame_disponivel',
        payload: {
          tatame: sessao.identificacao,
          identificacao: sessao.identificacao,
          expiraEm: Date.now() + 16000,
        },
      });
    };
    enviar();
    const heartbeat = window.setInterval(enviar, 5000);
    return () => window.clearInterval(heartbeat);
  }, [disponivelParaReceber, sessao]);

  const categoriasUnicas = useMemo(() => Array.from(new Set(lutas.map((luta) => luta.categoria))).sort(), [lutas]);

  const lutasComFiltro = useMemo(() => {
    const termo = buscaNome.trim().toLowerCase();
    return lutas.filter((luta) => {
      const matchBusca = !termo
        || normalizar(luta.atleta_1).toLowerCase().includes(termo)
        || normalizar(luta.atleta_2).toLowerCase().includes(termo)
        || normalizar(luta.categoria).toLowerCase().includes(termo);
      const isAbsoluto = normalizar(luta.categoria).toLowerCase().includes('absoluto');
      const matchTipo = filtroTipo === 'todos' || (filtroTipo === 'peso' ? !isAbsoluto : isAbsoluto);
      const matchCategoria = !filtroCategoria || luta.categoria === filtroCategoria;
      return matchBusca && matchTipo && matchCategoria;
    });
  }, [buscaNome, filtroCategoria, filtroTipo, lutas]);

  const lutasProntas = useMemo(() => lutasComFiltro.filter((luta) => luta.status_luta !== 'concluida' && isAtletaValido(luta.atleta_1) && isAtletaValido(luta.atleta_2)), [lutasComFiltro]);
  const lutaAtual = useMemo(() => lutasProntas.find((luta) => luta.status_luta === 'em_andamento') || null, [lutasProntas]);
  const proximasLutas = useMemo(() => lutasProntas.filter((luta) => luta.status_luta !== 'em_andamento'), [lutasProntas]);
  const lutasChamadas = useMemo(() => proximasLutas.filter((luta) => Boolean(luta.iniciada_em)), [proximasLutas]);
  const lutasNaFila = useMemo(() => proximasLutas.filter((luta) => !luta.iniciada_em), [proximasLutas]);
  const concluidas = useMemo(() => lutasComFiltro.filter((luta) => luta.status_luta === 'concluida').sort(ordenarLutas), [lutasComFiltro]);
  const totalConcluidas = useMemo(() => lutas.filter((luta) => luta.status_luta === 'concluida').length, [lutas]);
  const totalFila = useMemo(() => lutas.filter((luta) => luta.status_luta !== 'concluida' && luta.status_luta !== 'em_andamento' && isAtletaValido(luta.atleta_1) && isAtletaValido(luta.atleta_2)).length, [lutas]);
  const temLutaAgora = lutas.some((luta) => luta.status_luta === 'em_andamento');

  const tatamesLivresLista = useMemo(() => Object.values(tatamesLivres).sort((a, b) => a.tatame.localeCompare(b.tatame)), [tatamesLivres]);
  const podeDisponibilizar = true;
  const resumoTodosTatames = useMemo(() => {
    const grupos = new Map<string, Luta[]>();
    todasLutasEvento
      .filter((luta) => isAtletaValido(luta.atleta_1) || isAtletaValido(luta.atleta_2))
      .sort(ordenarLutas)
      .forEach((luta) => {
        const tatame = normalizar(luta.tatame);
        if (!tatame) return;
        grupos.set(tatame, [...(grupos.get(tatame) || []), luta]);
      });
    const resumo = Array.from(grupos.entries()).map(([tatame, itens]) => ({
      tatame,
      concluidas: itens.filter((luta) => luta.status_luta === 'concluida').length,
      emAndamento: itens.find((luta) => luta.status_luta === 'em_andamento') || null,
      proximas: itens.filter((luta) => luta.status_luta !== 'concluida' && luta.status_luta !== 'em_andamento').slice(0, 6),
      total: itens.length,
    }));
    const temTatameReal = resumo.some((grupo) => !ehRotuloPlaceholderTatame(grupo.tatame));
    return resumo.filter((grupo) => {
      const temFila = Boolean(grupo.emAndamento) || grupo.proximas.length > 0;
      if (temTatameReal && ehRotuloPlaceholderTatame(grupo.tatame) && !temFila) return false;
      return true;
    }).sort((a, b) => a.tatame.localeCompare(b.tatame));
  }, [todasLutasEvento]);

  const atletasNaBaia = useMemo(() => lutasComFiltro.filter(luta =>
    luta.status_luta !== 'concluida' &&
    luta.status_luta !== 'em_andamento' &&
    ((isAtletaValido(luta.atleta_1) && !isAtletaValido(luta.atleta_2)) || (!isAtletaValido(luta.atleta_1) && isAtletaValido(luta.atleta_2)))
  ).sort(ordenarLutas), [lutasComFiltro]);

  // Descobre de onde vem o oponente do atleta que está na Baia
  const getTextoBaia = (lutaWait: Luta) => {
    const textoTres = textoAguardandoChaveDeTres(lutaWait);
    if (textoTres) return textoTres;
    const lutasAlimentadoras = todasLutasEvento.filter(l => String(l.proxima_luta) === String(lutaWait.id_visual));
    if (lutasAlimentadoras.length > 0) {
      const atletaPresente = isAtletaValido(lutaWait.atleta_1) ? lutaWait.atleta_1 : lutaWait.atleta_2;
      const feederOponente = lutasAlimentadoras.find(l => normalizar(l.vencedor) !== normalizar(atletaPresente));
      if (feederOponente) {
        if (feederOponente.status_luta === 'concluida') return `Aguardando o sistema fechar a ${rotuloLuta(feederOponente)}`;
        return `Aguardando vencedor da ${rotuloLuta(feederOponente)}`;
      }
    }
    return "Avanço Direto / Aguardando Definição";
  };

  const enviarPushAtleta = async (atletaId: number | null | undefined, titulo: string, mensagem: string) => {
    if (!atletaId || !sessao) return;

    const response = await fetch('/api/notificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        atleta_id: atletaId,
        titulo,
        mensagem,
        url: `/evento/${sessao.evento_id}/ao-vivo`,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || 'Erro ao enviar push.');
    }
  };

  const atletasDaLuta = (luta: Luta) => [
    { id: luta.atleta_1_id, nome: displayNome(luta.atleta_1), oponente: displayNome(luta.atleta_2) },
    { id: luta.atleta_2_id, nome: displayNome(luta.atleta_2), oponente: displayNome(luta.atleta_1) },
  ].filter((atleta) => atleta.id && isAtletaValido(atleta.nome));

  const calcularMinutosAteLuta = (luta: Luta, posicaoFila: number, agoraMs: number) => {
    const horarioEstimado = luta.horario_estimado ? new Date(luta.horario_estimado).getTime() : 0;
    const diffMinutos = horarioEstimado ? Math.ceil((horarioEstimado - agoraMs) / 60000) : 0;
    const tempoRegulamentar = obterTempoRegulamentar(luta.categoria || '', luta.faixa || '');
    const estimativaFila = Math.max(5, posicaoFila * (tempoRegulamentar + 2));
    return Math.max(5, diffMinutos, estimativaFila);
  };

  const chavePush = (lutaId: string | number, tipo: string) => `itatame_push_${sessao?.evento_id}_${lutaId}_${tipo}`;

  const enviarAvisosDeFila = async (lutaChamada: Luta) => {
    if (!sessao) return;
    const tatame = lutaChamada.tatame || sessao.identificacao;

    for (const atleta of atletasDaLuta(lutaChamada)) {
      const key = chavePush(lutaChamada.id, `chamada_${atleta.id}`);
      if (!localStorage.getItem(key)) {
        await enviarPushAtleta(
          atleta.id,
          'Sua luta foi chamada',
          `${atleta.nome}, sua luta contra ${atleta.oponente} foi chamada. Compareça agora ao ${tatame}.`
        );
        localStorage.setItem(key, new Date().toISOString());
      }
    }

    const fila = proximasLutas.filter((item) => item.id !== lutaChamada.id).slice(0, 3);

    for (const [index, proxima] of fila.entries()) {
      const posicao = index + 1;
      const agoraMs = new Date().getTime();
      const minutos = calcularMinutosAteLuta(proxima, posicao, agoraMs);
      const horarioPrevisto = new Date(agoraMs + minutos * 60_000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const previsaoHorario = minutos > 5 ? ` Previsão local: ${horarioPrevisto}.` : '';
      const textoPosicao = posicao === 1 ? 'você é a próxima luta' : `faltam ${posicao} lutas para a sua`;

      for (const atleta of atletasDaLuta(proxima)) {
        const key = chavePush(proxima.id, `fila_${posicao}_${atleta.id}`);
        if (!localStorage.getItem(key)) {
          await enviarPushAtleta(
            atleta.id,
            'Prepare-se para lutar',
            `${atleta.nome}, sua luta contra ${atleta.oponente}: ${textoPosicao} no ${tatame}. Tempo aproximado: ${minutos} minutos.${previsaoHorario}`
          );
          localStorage.setItem(key, new Date().toISOString());
        }
      }
    }
  };

  const chamarLuta = async (luta: Luta) => {
    if (!sessao) return;
    if (temChamador && !luta.iniciada_em && luta.status_luta !== 'em_andamento') {
      setAviso('Esta luta ainda precisa ser liberada pelo Chamador.');
      return;
    }

    const idsAtuais = new Set([luta.atleta_1_id, luta.atleta_2_id].filter(Boolean).map(Number));
    if (idsAtuais.size > 0) {
      const { data: outrasLutas, error: erroConflito } = await supabase
        .from('chaves')
        .select('id, id_visual, fase, ordem, proxima_luta, tatame, atleta_1_id, atleta_2_id, status_luta, iniciada_em, pontuacao_atleta_1, pontuacao_atleta_2')
        .eq('evento_id', sessao.evento_id)
        .neq('id', luta.id)
        .neq('status_luta', 'concluida');
      if (erroConflito) {
        setAviso(`Não foi possível validar a disponibilidade dos atletas: ${erroConflito.message}`);
        return;
      }
      const conflito = (outrasLutas || []).find((outra: any) => {
        const compartilha = [outra.atleta_1_id, outra.atleta_2_id].filter(Boolean).map(Number).some((id) => idsAtuais.has(id));
        const p1 = outra.pontuacao_atleta_1 || {};
        const p2 = outra.pontuacao_atleta_2 || {};
        const reservada = outra.status_luta === 'em_andamento' || Boolean(outra.iniciada_em) || Boolean(p1.chamador_presente) || Boolean(p2.chamador_presente);
        return compartilha && reservada;
      });
      if (conflito) {
        setAviso(`Atleta já reservado na ${rotuloLuta(conflito)}, no ${conflito.tatame || 'tatame definido'}. Finalize ou libere essa luta antes de iniciar outra.`);
        return;
      }
    }
    setAcaoId(luta.id);
    setAviso(luta.iniciada_em ? 'Iniciando luta chamada...' : 'Chamando luta e enviando avisos aos atletas...');

    try {
      const jaAvisadaPeloChamador = Boolean(luta.iniciada_em);
      if (luta.status_luta !== 'em_andamento') {
        await supabase
          .from('chaves')
          .update({
            status_luta: 'em_andamento',
            iniciada_em: new Date().toISOString(),
            tatame: luta.tatame || sessao.identificacao,
          })
          .eq('id', luta.id);
      }

      if (!jaAvisadaPeloChamador) await enviarAvisosDeFila(luta);
      router.push(`/staff/placar/${luta.id}`);
    } catch (error) {
      console.error(error);
      setAviso(error instanceof Error ? error.message : 'Não foi possível chamar a luta.');
      setAcaoId(null);
    }
  };

  const executarTransferenciaTatame = async (novoTatame: string) => {
    if (!modalTransferencia.luta || !sessao) return;
    setAcaoId(modalTransferencia.luta.id);
    const { error } = await supabase
      .from('chaves')
      .update({ tatame: novoTatame })
      .eq('id', modalTransferencia.luta.id)
      .eq('evento_id', sessao.evento_id)
      .neq('status_luta', 'concluida');
    if (error) {
      setAviso(`Não foi possível transferir a luta: ${error.message}`);
      setAcaoId(null);
      return;
    }
    if (tatamesLivres[nomeUpper(novoTatame)]) {
      void canalOperacaoRef.current?.send({ type: 'broadcast', event: 'tatame_ocupado', payload: { tatame: novoTatame } });
      void canalOperacaoRef.current?.send({ type: 'broadcast', event: 'luta_transferida', payload: { tatame: novoTatame, origem: sessao.identificacao, luta_id: modalTransferencia.luta.id } });
    }
    setModalTransferencia({ visivel: false, luta: null });
    await carregarPainel();
    setAviso(`Luta transferida para ${novoTatame}.`);
    setAcaoId(null);
  };

  const alternarDisponibilidade = () => {
    if (!sessao) return;
    if (!disponivelParaReceber && !podeDisponibilizar) {
      setAviso('Conclua ou transfira as lutas pendentes deste tatame antes de anunciá-lo como livre.');
      return;
    }

    const novoEstado = !disponivelParaReceber;
    setDisponivelParaReceber(novoEstado);
    setAviso(novoEstado ? 'Tatame anunciado como livre para todos os operadores.' : 'Disponibilidade encerrada.');
    if (!novoEstado) {
      void canalOperacaoRef.current?.send({ type: 'broadcast', event: 'tatame_ocupado', payload: { tatame: sessao.identificacao } });
    }
  };

  const fazerLogout = async () => {
    localStorage.removeItem('itatame_staff_session');
    document.cookie = 'itatame_staff_access=; Path=/; Max-Age=0; SameSite=Lax';
    await supabase.auth.signOut();
    router.replace('/staff/login');
  };

  const abrirCorrecao = (luta: Luta) => {
    const ladoAtual: 1 | 2 | null = luta.vencedor === luta.atleta_1 ? 1 : luta.vencedor === luta.atleta_2 ? 2 : null;
    const metodoAtual = (METODOS_RESULTADO.find((item) => item.id === luta.metodo_vitoria)?.id
      || (luta.metodo_vitoria === 'ausencia' ? 'wo' : luta.metodo_vitoria === 'decisao' ? 'decisao_arbitro' : 'pontos')) as MetodoResultado;
    setModalCorrecao({ luta, lado: ladoAtual, metodo: metodoAtual });
  };

  const salvarCorrecao = async () => {
    if (!modalCorrecao?.luta || !modalCorrecao.lado || !sessao) return;
    setAcaoId(modalCorrecao.luta.id);
    try {
      const vinculo = await garantirVinculoStaff();
      if (!vinculo.ok) {
        setAviso(vinculo.erro || 'Posto sem autorização para corrigir o resultado.');
        setAcaoId(null);
        return;
      }
      const alerta = await corrigirResultadoLuta(supabase, todasLutasEvento, modalCorrecao.luta, modalCorrecao.lado, modalCorrecao.metodo);
      setModalCorrecao(null);
      await carregarPainel(true);
      setAviso(alerta || `Resultado de ${rotuloLuta(modalCorrecao.luta)} corrigido. A chave foi atualizada.`);
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'Não foi possível corrigir o resultado.');
    }
    setAcaoId(null);
  };

  const renderBaiaCard = (luta: Luta) => {
    const isA1 = isAtletaValido(luta.atleta_1);
    const nomeAtl = isA1 ? normalizar(luta.atleta_1) : normalizar(luta.atleta_2);
    const equipeAtl = isA1 ? luta.equipe_1 : luta.equipe_2;
    const textoStatus = getTextoBaia(luta);
    const statusCheckin = statusCheckinLabel(isA1 ? luta.checkin_1 : luta.checkin_2);

    return (
      <article className="flex min-w-0 max-w-full flex-col gap-2 overflow-hidden rounded-xl border border-yellow-500/25 bg-yellow-500/5 p-3 sm:flex-row sm:items-center">
        <div className="min-w-0 sm:w-40">
          <p className="truncate text-[8px] font-black uppercase tracking-widest text-yellow-400">{rotuloLuta(luta)}</p>
          <p className="mt-0.5 break-words text-[11px] font-black uppercase leading-tight text-white">{tituloCategoria(luta)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black uppercase text-white">{nomeAtl}</p>
          <p className="truncate text-[9px] uppercase text-zinc-500">{equipeAtl || 'Sem equipe'}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded border px-1.5 py-0.5 text-[7px] font-black uppercase ${statusCheckin.className}`}>{statusCheckin.label}</span>
            <span className="inline-flex items-center gap-1 rounded border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-[9px] font-black text-yellow-400"><Clock size={10} /> {textoStatus}</span>
          </div>
        </div>
      </article>
    );
  };

  const renderLutaCard = (luta: Luta, destaque: 'agora' | 'chamada' | 'fila' | 'concluida' = 'fila') => {
    const atleta1Real = isAtletaValido(luta.atleta_1);
    const atleta2Real = isAtletaValido(luta.atleta_2);
    const temTbd = nomeUpper(luta.atleta_1) === 'TBD' || nomeUpper(luta.atleta_2) === 'TBD';
    const temCheckinPendente = luta.checkin_1 === 'pendente' || luta.checkin_2 === 'pendente';
    const temReprovado = String(luta.checkin_1 || '').includes('desclassificado') || String(luta.checkin_2 || '').includes('desclassificado');
    const aguardandoChamador = temChamador && !luta.iniciada_em && luta.status_luta !== 'em_andamento';
    const lutaBloqueada = temTbd || (temCheckinPendente && !temReprovado) || aguardandoChamador;
    const venceu1 = luta.vencedor === luta.atleta_1;
    const venceu2 = luta.vencedor === luta.atleta_2;

    return (
      <article className={`flex min-w-0 max-w-full flex-col overflow-hidden rounded-xl border p-3 md:flex-row md:items-center md:gap-3 ${destaque === 'agora' ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.12)]' : destaque === 'chamada' ? 'border-yellow-500/40 bg-yellow-500/10' : destaque === 'concluida' ? 'border-emerald-500/20 bg-[#0b0b10]' : 'border-white/10 bg-[#0b0b10]'}`}>
        <div className="min-w-0 md:w-44 md:shrink-0">
          <p className={`truncate text-[8px] font-black uppercase tracking-widest ${destaque === 'agora' ? 'text-red-300' : destaque === 'chamada' ? 'text-yellow-300' : destaque === 'concluida' ? 'text-emerald-300' : 'text-zinc-500'}`}>{rotuloLuta(luta)}{luta.horario_estimado ? ` · ${formatarHorario(luta.horario_estimado)}` : ''}</p>
          <p className="mt-0.5 break-words text-[11px] font-black uppercase leading-tight text-white md:text-xs">{tituloCategoria(luta)}</p>
          <p className="truncate text-[8px] font-bold uppercase text-zinc-500">{luta.faixa}</p>
        </div>

        <div className="mt-2 grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 md:mt-0">
          <div className="min-w-0 text-right">
            <p className={`truncate text-[11px] font-black uppercase md:text-sm ${venceu1 ? 'text-emerald-300' : atleta1Real ? 'text-blue-300' : 'text-zinc-600'}`}>{displayNome(luta.atleta_1)}</p>
            {atleta1Real && destaque !== 'concluida' && <span className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[7px] font-black uppercase ${statusCheckinLabel(luta.checkin_1).className}`}>{statusCheckinLabel(luta.checkin_1).label}</span>}
            {venceu1 && <span className="mt-1 block text-[8px] font-black uppercase text-emerald-400">Venceu</span>}
          </div>
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-black text-zinc-500">VS</span>
          <div className="min-w-0 text-left">
            <p className={`truncate text-[11px] font-black uppercase md:text-sm ${venceu2 ? 'text-emerald-300' : atleta2Real ? 'text-red-300' : 'text-zinc-600'}`}>{displayNome(luta.atleta_2)}</p>
            {atleta2Real && destaque !== 'concluida' && <span className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[7px] font-black uppercase ${statusCheckinLabel(luta.checkin_2).className}`}>{statusCheckinLabel(luta.checkin_2).label}</span>}
            {venceu2 && <span className="mt-1 block text-[8px] font-black uppercase text-emerald-400">Venceu</span>}
          </div>
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap items-center justify-end gap-1.5 md:mt-0 md:w-auto md:shrink-0">
          {destaque === 'concluida' ? (
            <>
              <span className="mr-auto rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[8px] font-black uppercase text-emerald-300 md:mr-0">{rotuloMetodo(luta.metodo_vitoria)}</span>
              <button onClick={() => abrirCorrecao(luta)} className="h-10 min-w-0 flex-1 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 text-[9px] font-black uppercase text-yellow-200 md:flex-none"><Edit3 size={12} className="mr-1 inline" /> Corrigir</button>
              <button onClick={() => router.push(`/staff/placar/${luta.id}`)} className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-[9px] font-black uppercase text-zinc-300 md:flex-none">Placar</button>
            </>
          ) : (
            <>
              <button onClick={() => setModalTransferencia({ visivel: true, luta })} title="Transferir tatame" className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-zinc-400"><ArrowRightLeft size={14} /></button>
              {temReprovado ? (
                <button onClick={() => router.push(`/staff/placar/${luta.id}`)} className="h-10 min-w-0 flex-1 rounded-lg border border-red-500/40 bg-red-950 px-3 text-[9px] font-black uppercase text-red-300 md:w-36 md:flex-none"><XCircle size={12} className="mr-1 inline" /> W.O. balança</button>
              ) : (
                <button onClick={() => chamarLuta(luta)} disabled={lutaBloqueada || acaoId === luta.id} className={`h-10 min-w-0 flex-1 rounded-lg px-3 text-[9px] font-black uppercase md:w-36 md:flex-none ${lutaBloqueada ? 'cursor-not-allowed border border-zinc-700 bg-zinc-800 text-zinc-500' : destaque === 'agora' ? 'bg-red-500 text-white' : 'bg-white text-black'}`}>
                  {acaoId === luta.id ? <RefreshCw size={12} className="mr-1 inline animate-spin" /> : luta.status_luta === 'em_andamento' ? <Pause size={12} className="mr-1 inline" /> : <Play size={12} className="mr-1 inline" fill="currentColor" />}
                  {aguardandoChamador ? 'Aguardando chamador' : lutaBloqueada ? (temTbd ? 'Aguardando' : 'Bloqueado') : luta.status_luta === 'em_andamento' ? 'Retomar placar' : luta.iniciada_em ? 'Iniciar luta' : 'Chamar'}
                </button>
              )}
            </>
          )}
        </div>
      </article>
    );
  };

  if (!sessao) return null;

  const alertaCorrecao = modalCorrecao ? alertaProximaLuta(todasLutasEvento, modalCorrecao.luta) : '';

  return (
    <main className="min-h-screen max-w-full overflow-x-hidden bg-[#050505] pb-28 text-white selection:bg-red-500/30 md:pb-8">
      <style dangerouslySetInnerHTML={{ __html: `body.hide-global-nav header:not(.header-mesario), body.hide-global-nav nav:not(.nav-mesario), body.hide-global-nav .nav-global-mobile { display: none !important; } body.hide-global-nav > main, body.hide-global-nav > div > main { padding-top: 0 !important; margin-top: 0 !important; }` }} />

      <header className="header-mesario sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 md:px-6">
          <div className="min-w-0">
            <Link href="/" className="block text-lg font-black italic tracking-tighter text-white"><span className="text-red-600">i</span>TATAME</Link>
            <div className="mt-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-400">
              <Trophy size={13} /> <span className="truncate">{sessao.identificacao}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            
            {/* 🔥 BOTÃO AO VIVO NO MESÁRIO */}
            <Link 
              href={`/evento/${sessao.evento_id}/ao-vivo`} 
              target="_blank" 
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 md:p-3 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.1)]"
              title="Abrir Tela Ao Vivo"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
              </span>
              <span className="hidden sm:inline">Ao Vivo</span>
            </Link>

            <button onClick={() => carregarPainel()} className="rounded-xl border border-white/10 bg-white/5 p-3 text-white hover:bg-white/10" title="Atualizar">
              <RefreshCw size={16} className={refreshing ? 'animate-spin text-red-400' : ''} />
            </button>
            <button onClick={fazerLogout} className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-300 hover:bg-red-500/20" title="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <div className="mx-auto hidden max-w-7xl grid-cols-3 gap-2 px-6 pb-3 md:grid">
          <button onClick={() => setAbaAtiva('fila')} className={`rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest ${abaAtiva === 'fila' ? 'bg-red-500 text-white' : 'border border-white/10 text-zinc-500'}`}>1. Meu tatame</button>
          <button onClick={() => setAbaAtiva('concluidas')} className={`rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest ${abaAtiva === 'concluidas' ? 'bg-emerald-500 text-black' : 'border border-white/10 text-zinc-500'}`}>2. Lutas concluídas</button>
          <button onClick={() => setAbaAtiva('geral')} className={`rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest ${abaAtiva === 'geral' ? 'bg-cyan-500 text-black' : 'border border-white/10 text-zinc-500'}`}>3. Outros tatames</button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4 p-3 md:p-6">
        {lutas.length > 0 && (() => { const sugestao = sugestoesCategoriaPorTatame(lutas)[0]; return sugestao && <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4"><h2 className="text-xs font-black uppercase text-cyan-200">Próxima categoria neste tatame</h2><p className="mt-1 text-sm font-bold text-white">{tituloCategoria(sugestao.proxima)}</p><p className="mt-1 text-[10px] text-zinc-400">{sugestao.aguardarHorario ? `Aguardar início previsto: ${formatarHorario(sugestao.proxima.horario_estimado)}` : sugestao.proxima.iniciada_em ? 'Luta chamada; aguardando início no placar' : `Próxima na ordem definida · ${formatarHorario(sugestao.proxima.horario_estimado)}`}</p></section>; })()}
        <section className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <button type="button" onClick={() => setAbaAtiva('fila')} className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0b0b10] px-2 py-3 text-left md:rounded-2xl md:p-4">
            <span className="block truncate text-[8px] font-black uppercase tracking-widest text-zinc-500 md:text-[9px]">Na fila</span>
            <strong className="mt-1 block text-xl md:mt-2 md:text-2xl">{totalFila}</strong>
          </button>
          <button type="button" onClick={() => setAbaAtiva('fila')} className="min-w-0 overflow-hidden rounded-xl border border-red-500/20 bg-red-500/10 px-2 py-3 text-left md:rounded-2xl md:p-4">
            <span className="block truncate text-[8px] font-black uppercase tracking-widest text-red-300 md:text-[9px]">Agora</span>
            <strong className="mt-1 block text-xl text-red-300 md:mt-2 md:text-2xl">{temLutaAgora ? 1 : 0}</strong>
          </button>
          <button type="button" onClick={() => setAbaAtiva('concluidas')} className={`min-w-0 overflow-hidden rounded-xl border px-2 py-3 text-left md:rounded-2xl md:p-4 ${abaAtiva === 'concluidas' ? 'border-emerald-400 bg-emerald-500 text-black' : 'border-emerald-500/20 bg-emerald-500/10'}`}>
            <span className={`block truncate text-[8px] font-black uppercase tracking-widest md:text-[9px] ${abaAtiva === 'concluidas' ? 'text-black' : 'text-emerald-300'}`}>Concluídas</span>
            <strong className={`mt-1 block text-xl md:mt-2 md:text-2xl ${abaAtiva === 'concluidas' ? 'text-black' : 'text-emerald-300'}`}>{totalConcluidas}</strong>
          </button>
          <div className="min-w-0 overflow-hidden rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-2 py-3 md:rounded-2xl md:p-4">
            <span className="block truncate text-[8px] font-black uppercase tracking-widest text-cyan-300 md:text-[9px]">Próxima</span>
            <strong className="mt-1 block truncate text-sm font-black text-cyan-200 md:mt-2">{lutasChamadas[0] || proximasLutas[0] ? formatarHorario((lutasChamadas[0] || proximasLutas[0]).horario_estimado) : 'Livre'}</strong>
          </div>
        </section>

        <section className={`rounded-2xl border p-4 ${disponivelParaReceber ? 'animate-pulse border-emerald-300 bg-emerald-500/15 shadow-[0_0_32px_rgba(16,185,129,0.45)]' : 'border-white/10 bg-[#0b0b10]'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className={`rounded-xl p-2.5 ${disponivelParaReceber ? 'bg-emerald-500 text-black' : 'bg-white/5 text-zinc-400'}`}><Wifi size={18} /></div>
              <div>
                <h2 className="text-sm font-black uppercase">{disponivelParaReceber ? 'Seu tatame está disponível' : 'Seu tatame ficou livre?'}</h2>
                <p className="mt-1 text-[10px] font-bold text-zinc-500">Avise os outros mesários para receber uma luta por vez.</p>
              </div>
            </div>
            <button onClick={alternarDisponibilidade} disabled={!disponivelParaReceber && !podeDisponibilizar} className={`rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${disponivelParaReceber ? 'bg-emerald-500 text-black hover:bg-emerald-400' : podeDisponibilizar ? 'bg-white text-black hover:bg-zinc-200' : 'cursor-not-allowed bg-zinc-900 text-zinc-600'}`}>
              {disponivelParaReceber ? 'Encerrar disponibilidade' : 'Avisar tatame livre'}
            </button>
          </div>
        </section>

        {tatamesLivresLista.length > 0 && (
          <section className="rounded-2xl border border-cyan-300 bg-cyan-500/10 p-4 shadow-[0_0_30px_rgba(34,211,238,0.35)]">
            <div className="mb-3 flex items-center gap-2 text-cyan-200"><Radio size={16} className="animate-pulse" /><h2 className="text-xs font-black uppercase tracking-widest">Tatames livres agora</h2></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tatamesLivresLista.map((item) => (
                <div key={nomeUpper(item.tatame)} className="rounded-xl border border-cyan-400/20 bg-black/30 px-3 py-2.5">
                  <strong className="block text-xs uppercase text-white">{item.tatame}</strong>
                  <span className="mt-1 block text-[9px] font-bold uppercase tracking-widest text-cyan-300">Apto a receber 1 luta</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-[#0b0b10] p-3 md:p-4">
          <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_1fr]">
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black px-3 py-2.5">
              <Search size={16} className="text-zinc-600" />
              <input value={buscaNome} onChange={(event) => setBuscaNome(event.target.value)} placeholder="Buscar atleta ou categoria" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-700" />
            </label>
            <label className="relative flex items-center rounded-xl border border-white/10 bg-black">
              <select value={filtroTipo} onChange={(event) => { setFiltroTipo(event.target.value as 'todos' | 'peso' | 'absoluto'); setFiltroCategoria(''); }} className="w-full appearance-none bg-transparent px-3 py-3 text-sm text-white outline-none">
                <option value="todos">Todas modalidades</option>
                <option value="peso">Categorias de peso</option>
                <option value="absoluto">Absolutos</option>
              </select>
              <Filter size={15} className="pointer-events-none absolute right-3 text-zinc-600" />
            </label>
            <select value={filtroCategoria} onChange={(event) => setFiltroCategoria(event.target.value)} className="rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none">
              <option value="">Todas categorias</option>
              {categoriasUnicas.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
            </select>
          </div>
          {aviso && <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs font-bold text-yellow-100">{aviso}</div>}
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#0b0b10] p-12 text-center text-xs font-black uppercase tracking-widest text-zinc-500">Carregando fila...</div>
        ) : abaAtiva === 'geral' ? (
          resumoTodosTatames.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b0b10] p-12 text-center text-xs font-black uppercase tracking-widest text-zinc-500">Nenhum tatame com lutas neste evento.</div>
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              {resumoTodosTatames.map((grupo) => (
                <article key={grupo.tatame} className="rounded-2xl border border-white/10 bg-[#0b0b10] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div>
                      <h2 className="text-sm font-black uppercase text-white">{grupo.tatame}</h2>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">{grupo.concluidas} de {grupo.total} concluídas</p>
                    </div>
                    {tatamesLivres[nomeUpper(grupo.tatame)] ? <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[8px] font-black uppercase text-black">Livre</span> : grupo.emAndamento ? <span className="rounded-full bg-red-500 px-2.5 py-1 text-[8px] font-black uppercase text-white">Em luta</span> : <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[8px] font-black uppercase text-zinc-400">Em espera</span>}
                  </div>
                  {grupo.emAndamento && (
                    <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                      <span className="text-[8px] font-black uppercase tracking-widest text-red-300">Agora</span>
                      <p className="mt-1 truncate text-[11px] font-black uppercase text-white">{displayNome(grupo.emAndamento.atleta_1)} × {displayNome(grupo.emAndamento.atleta_2)}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {grupo.proximas.length === 0 ? <p className="py-4 text-center text-[10px] font-bold uppercase text-zinc-600">Sem lutas aguardando</p> : grupo.proximas.map((luta, index) => (
                      <div key={luta.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/30 px-3 py-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[9px] font-black text-zinc-400">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] font-black uppercase text-white">{displayNome(luta.atleta_1)} × {displayNome(luta.atleta_2)}</p>
                          <p className="mt-0.5 truncate text-[8px] font-bold uppercase text-zinc-600">{luta.categoria}</p>
                        </div>
                        {luta.iniciada_em && luta.status_luta !== 'em_andamento' && <Megaphone size={13} className="shrink-0 text-yellow-400" />}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          )
        ) : abaAtiva === 'concluidas' ? (
          <section className="min-w-0 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-emerald-300">Lutas concluídas</h2>
                <p className="mt-1 text-[11px] font-bold text-zinc-500">Toque em corrigir para trocar o vencedor ou o método. A chave avança de novo com o resultado certo.</p>
              </div>
              <button onClick={() => setAbaAtiva('fila')} className="h-10 rounded-xl border border-white/10 px-4 text-[10px] font-black uppercase text-zinc-300">Voltar à fila</button>
            </div>
            {concluidas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b0b10] p-10 text-center text-xs font-black uppercase tracking-widest text-zinc-500">Nenhuma luta concluída neste filtro.</div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
                {concluidas.map((luta) => <div key={luta.id}>{renderLutaCard(luta, 'concluida')}</div>)}
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-5">
            {lutaAtual && (
              <section className="min-w-0">
                <h2 className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-300 md:text-xs"><Clock size={14} /> 1. Agora no tatame</h2>
                {renderLutaCard(lutaAtual, 'agora')}
              </section>
            )}

            {lutasChamadas.length > 0 && (
              <section className="min-w-0">
                <h2 className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-yellow-300 md:text-xs"><Megaphone size={14} /> 2. Chamada · iniciar no placar</h2>
                <div className="grid min-w-0 grid-cols-1 gap-3">
                  {lutasChamadas.map((luta) => <div key={luta.id}>{renderLutaCard(luta, 'chamada')}</div>)}
                </div>
              </section>
            )}

            {lutasNaFila.length > 0 && (
              <section className="min-w-0">
                <h2 className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white md:text-xs"><Play size={14} className="text-emerald-400" /> {lutaAtual || lutasChamadas.length > 0 ? '3. Fila deste tatame' : '1. Fila deste tatame'}</h2>
                <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
                  {lutasNaFila.map((luta) => <div key={luta.id}>{renderLutaCard(luta, 'fila')}</div>)}
                </div>
              </section>
            )}

            {atletasNaBaia.length > 0 && (
              <section className="min-w-0">
                <h2 className="mb-2 flex items-center gap-2 border-b border-yellow-500/20 pb-2 text-[10px] font-black uppercase tracking-widest text-yellow-500 md:text-xs">
                  <Clock size={14} /> Baia · adversário ainda não definido
                </h2>
                <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
                  {atletasNaBaia.map((luta) => <div key={`baia-${luta.id}`}>{renderBaiaCard(luta)}</div>)}
                </div>
              </section>
            )}

            {!lutaAtual && proximasLutas.length === 0 && (
              <div className="mt-2 rounded-2xl border border-dashed border-white/10 bg-[#0b0b10] p-10 text-center">
                <AlertCircle size={32} className="mx-auto mb-3 text-zinc-700" />
                <h2 className="text-base font-black uppercase text-white">Fila vazia</h2>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-600">Nenhuma luta com dois atletas aguardando neste tatame.</p>
                {totalConcluidas > 0 && <button onClick={() => setAbaAtiva('concluidas')} className="mt-4 rounded-xl bg-emerald-500 px-4 py-2.5 text-[10px] font-black uppercase text-black">Ver lutas concluídas</button>}
              </div>
            )}
          </div>
        )}
      </div>

      <nav className="nav-mesario fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/95 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-3 gap-2">
          <button onClick={() => setAbaAtiva('fila')} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[8px] font-black uppercase tracking-widest ${abaAtiva === 'fila' ? 'bg-red-500 text-white' : 'text-zinc-600'}`}><Play size={15} /> Tatame</button>
          <button onClick={() => setAbaAtiva('concluidas')} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[8px] font-black uppercase tracking-widest ${abaAtiva === 'concluidas' ? 'bg-emerald-500 text-black' : 'text-zinc-600'}`}><CheckCircle size={15} /> Concluídas</button>
          <button onClick={() => setAbaAtiva('geral')} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[8px] font-black uppercase tracking-widest ${abaAtiva === 'geral' ? 'bg-cyan-500 text-black' : 'text-zinc-600'}`}><LayoutGrid size={15} /> Todos</button>
        </div>
      </nav>

      {modalTransferencia.visivel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0b0b10] p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black uppercase text-white">Transferir luta</h2>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{modalTransferencia.luta ? rotuloLuta(modalTransferencia.luta) : "Confronto"}</p>
              </div>
              <button onClick={() => setModalTransferencia({ visivel: false, luta: null })} className="rounded-xl bg-white/5 p-2 text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-2">
              {tatamesDisponiveis.filter((tatame) => nomeUpper(tatame) !== nomeUpper(sessao.identificacao)).length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-zinc-500">Nenhum outro tatame configurado.</div>
              ) : (
                tatamesDisponiveis
                  .filter((tatame) => nomeUpper(tatame) !== nomeUpper(sessao.identificacao))
                  .sort((a, b) => Number(!tatamesLivres[nomeUpper(a)]) - Number(!tatamesLivres[nomeUpper(b)]) || a.localeCompare(b))
                  .map((tatame) => (
                    <button key={tatame} onClick={() => executarTransferenciaTatame(tatame)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-white ${tatamesLivres[nomeUpper(tatame)] ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-600' : 'border-white/10 bg-white/5 hover:bg-red-600'}`}>
                      <span>Enviar para {tatame}{tatamesLivres[nomeUpper(tatame)] && <small className="mt-1 block text-[8px] text-emerald-300">Livre agora</small>}</span>
                      <ArrowRightLeft size={14} />
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {modalCorrecao && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/85 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b10] p-4 shadow-2xl md:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black uppercase text-white">Corrigir resultado</h2>
                <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-widest text-zinc-500">{rotuloLuta(modalCorrecao.luta)} · {tituloCategoria(modalCorrecao.luta)}</p>
              </div>
              <button onClick={() => setModalCorrecao(null)} className="rounded-xl bg-white/5 p-2 text-zinc-400"><X size={18} /></button>
            </div>
            <p className="mb-3 text-[11px] font-bold text-zinc-400">Escolha o vencedor certo e o método. Isso atualiza a chave automaticamente.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([1, 2] as const).map((lado) => {
                const nome = lado === 1 ? modalCorrecao.luta.atleta_1 : modalCorrecao.luta.atleta_2;
                const equipe = lado === 1 ? modalCorrecao.luta.equipe_1 : modalCorrecao.luta.equipe_2;
                const ativo = modalCorrecao.lado === lado;
                return (
                  <button key={lado} onClick={() => setModalCorrecao({ ...modalCorrecao, lado })} disabled={!isAtletaValido(nome)} className={`min-w-0 rounded-xl border p-3 text-left ${ativo ? (lado === 1 ? 'border-blue-400 bg-blue-500/20' : 'border-red-400 bg-red-500/20') : 'border-white/10 bg-black/40'} ${!isAtletaValido(nome) ? 'opacity-40' : ''}`}>
                    <span className={`text-[8px] font-black uppercase tracking-widest ${lado === 1 ? 'text-blue-300' : 'text-red-300'}`}>{lado === 1 ? 'Azul' : 'Vermelho'}</span>
                    <strong className="mt-1 block truncate text-sm font-black uppercase text-white">{displayNome(nome)}</strong>
                    <span className="mt-0.5 block truncate text-[9px] uppercase text-zinc-500">{equipe || 'Sem equipe'}</span>
                  </button>
                );
              })}
            </div>
            <label className="mt-3 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Método
              <select value={modalCorrecao.metodo} onChange={(event) => setModalCorrecao({ ...modalCorrecao, metodo: event.target.value as MetodoResultado })} className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none">
                {METODOS_RESULTADO.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            {alertaCorrecao && <p className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-[11px] font-bold text-yellow-100">{alertaCorrecao}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setModalCorrecao(null)} className="h-11 rounded-xl border border-white/10 text-[10px] font-black uppercase text-zinc-400">Cancelar</button>
              <button onClick={salvarCorrecao} disabled={!modalCorrecao.lado || acaoId === modalCorrecao.luta.id} className="h-11 rounded-xl bg-emerald-500 text-[10px] font-black uppercase text-black disabled:opacity-40">{acaoId === modalCorrecao.luta.id ? 'Salvando...' : 'Salvar correção'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
