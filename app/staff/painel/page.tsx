'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRightLeft, CheckCircle, Clock, Filter, LogOut, Play, RefreshCw, Search, Trophy, X, Edit3, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { obterTempoRegulamentar } from '../../lib/cronograma';
import { processarAvancosAutomaticosChaves } from '../../lib/chaves-auto-avanco';

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
  vencedor?: string | null;
  metodo_vitoria?: string | null;
  proxima_luta?: string | number | null;
  horario_estimado?: string | null;
};

type ModalTransferencia = {
  visivel: boolean;
  luta: Luta | null;
};

type CheckinRow = {
  atleta_id: number | null;
  status_checkin: string | null;
};

function normalizar(value?: string | null) {
  return String(value || '').trim();
}

function nomeUpper(value?: string | null) {
  return normalizar(value).toUpperCase();
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

export default function PainelMesario() {
  const router = useRouter();
  const [sessao, setSessao] = useState<StaffSession | null>(null);
  const [lutas, setLutas] = useState<Luta[]>([]);
  const [todasLutasEvento, setTodasLutasEvento] = useState<Luta[]>([]); // 🔥 Para buscar os oponentes da Baia
  const [tatamesDisponiveis, setTatamesDisponiveis] = useState<string[]>([]);
  const [modalTransferencia, setModalTransferencia] = useState<ModalTransferencia>({ visivel: false, luta: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acaoId, setAcaoId] = useState<string | number | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'fila' | 'concluidas'>('fila');
  const [buscaNome, setBuscaNome] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'peso' | 'absoluto'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [aviso, setAviso] = useState('');

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

    const { data } = await supabase
      .from('staff_eventos')
      .select('identificacao')
      .eq('evento_id', sessao.evento_id)
      .eq('funcao', 'mesario');

    if (data) {
      const nomes = Array.from(new Set(data.map((item) => normalizar(item.identificacao)).filter(Boolean)));
      setTatamesDisponiveis(nomes.sort((a, b) => a.localeCompare(b)));
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

    const houveAvanco = await processarAvancosAutomaticosChaves(supabase, sessao.evento_id);
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

  const categoriasUnicas = useMemo(() => Array.from(new Set(lutas.map((luta) => luta.categoria))).sort(), [lutas]);

  const lutasFiltradas = useMemo(() => {
    const termo = buscaNome.trim().toLowerCase();

    return lutas.filter((luta) => {
      const matchAba = abaAtiva === 'fila' ? luta.status_luta !== 'concluida' : luta.status_luta === 'concluida';
      const matchBusca = !termo
        || normalizar(luta.atleta_1).toLowerCase().includes(termo)
        || normalizar(luta.atleta_2).toLowerCase().includes(termo)
        || normalizar(luta.categoria).toLowerCase().includes(termo);
      const isAbsoluto = normalizar(luta.categoria).toLowerCase().includes('absoluto');
      const matchTipo = filtroTipo === 'todos' || (filtroTipo === 'peso' ? !isAbsoluto : isAbsoluto);
      const matchCategoria = !filtroCategoria || luta.categoria === filtroCategoria;
      return matchAba && matchBusca && matchTipo && matchCategoria;
    });
  }, [abaAtiva, buscaNome, filtroCategoria, filtroTipo, lutas]);

  // 🔥 SEPARA LUTAS PRONTAS (COM 2 ATLETAS) E LUTAS DA BAIA (COM 1 ATLETA)
  const lutasProntas = useMemo(() => lutasFiltradas.filter(l => isAtletaValido(l.atleta_1) && isAtletaValido(l.atleta_2)), [lutasFiltradas]);
  
  const lutaAtual = useMemo(() => lutasProntas.find((luta) => luta.status_luta === 'em_andamento') || null, [lutasProntas]);
  const proximasLutas = useMemo(() => lutasProntas.filter((luta) => luta.status_luta !== 'em_andamento'), [lutasProntas]);
  const concluidas = useMemo(() => lutasFiltradas.filter((luta) => luta.status_luta === 'concluida').sort(ordenarLutas), [lutasFiltradas]);

  const atletasNaBaia = useMemo(() => lutasFiltradas.filter(luta =>
    luta.status_luta !== 'concluida' &&
    luta.status_luta !== 'em_andamento' &&
    ((isAtletaValido(luta.atleta_1) && !isAtletaValido(luta.atleta_2)) || (!isAtletaValido(luta.atleta_1) && isAtletaValido(luta.atleta_2)))
  ).sort(ordenarLutas), [lutasFiltradas]);

  // Descobre de onde vem o oponente do atleta que está na Baia
  const getTextoBaia = (lutaWait: Luta) => {
    const lutasAlimentadoras = todasLutasEvento.filter(l => String(l.proxima_luta) === String(lutaWait.id_visual));
    if (lutasAlimentadoras.length > 0) {
      const atletaPresente = isAtletaValido(lutaWait.atleta_1) ? lutaWait.atleta_1 : lutaWait.atleta_2;
      const feederOponente = lutasAlimentadoras.find(l => normalizar(l.vencedor) !== normalizar(atletaPresente));
      if (feederOponente) {
        if (feederOponente.status_luta === 'concluida') return `Aguardando o sistema fechar a Luta ${feederOponente.id_visual}`;
        return `Aguardando Vencedor da Luta ${feederOponente.id_visual}`;
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
    { id: luta.atleta_1_id, nome: displayNome(luta.atleta_1) },
    { id: luta.atleta_2_id, nome: displayNome(luta.atleta_2) },
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
          `${atleta.nome}, compareça agora ao ${tatame}. Sua luta vai iniciar em instantes.`
        );
        localStorage.setItem(key, new Date().toISOString());
      }
    }

    const fila = proximasLutas.filter((item) => item.id !== lutaChamada.id).slice(0, 3);

    for (const [index, proxima] of fila.entries()) {
      const posicao = index + 1;
      const agoraMs = new Date().getTime();
      const minutos = calcularMinutosAteLuta(proxima, posicao, agoraMs);
      const textoPosicao = posicao === 1 ? 'você é a próxima luta' : `faltam ${posicao} lutas para a sua`;

      for (const atleta of atletasDaLuta(proxima)) {
        const key = chavePush(proxima.id, `fila_${posicao}_${atleta.id}`);
        if (!localStorage.getItem(key)) {
          await enviarPushAtleta(
            atleta.id,
            'Prepare-se para lutar',
            `${atleta.nome}, ${textoPosicao} no ${tatame}. Tempo aproximado: ${minutos} minutos.`
          );
          localStorage.setItem(key, new Date().toISOString());
        }
      }
    }
  };

  const chamarLuta = async (luta: Luta) => {
    if (!sessao) return;
    setAcaoId(luta.id);
    setAviso('Chamando luta e enviando avisos aos atletas...');

    try {
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

      await enviarAvisosDeFila(luta);
      router.push(`/staff/placar/${luta.id}`);
    } catch (error) {
      console.error(error);
      setAviso(error instanceof Error ? error.message : 'Não foi possível chamar a luta.');
      setAcaoId(null);
    }
  };

  const executarTransferenciaTatame = async (novoTatame: string) => {
    if (!modalTransferencia.luta) return;
    setAcaoId(modalTransferencia.luta.id);
    await supabase.from('chaves').update({ tatame: novoTatame }).eq('id', modalTransferencia.luta.id);
    setModalTransferencia({ visivel: false, luta: null });
    await carregarPainel();
    setAcaoId(null);
  };

  const fazerLogout = async () => {
    localStorage.removeItem('itatame_staff_session');
    await supabase.auth.signOut();
    router.replace('/staff/login');
  };

  // 🔥 CARD ESPECIAL PARA A BAIA (APENAS INFORMATIVO)
  const renderBaiaCard = (luta: Luta) => {
    const isA1 = isAtletaValido(luta.atleta_1);
    const nomeAtl = isA1 ? normalizar(luta.atleta_1) : normalizar(luta.atleta_2);
    const equipeAtl = isA1 ? luta.equipe_1 : luta.equipe_2;
    const textoStatus = getTextoBaia(luta);
    const statusCheckin = statusCheckinLabel(isA1 ? luta.checkin_1 : luta.checkin_2);

    return (
      <div key={`baia-${luta.id}`} className="bg-gradient-to-r from-[#0a0a0e] to-black border border-yellow-500/20 rounded-lg p-2.5 flex flex-col sm:flex-row items-center sm:items-stretch gap-3 relative overflow-hidden transition-all opacity-90 hover:opacity-100 hover:border-yellow-500/40">
        <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
        <div className="w-full sm:w-[25%] shrink-0 sm:border-r border-white/5 pr-2 pl-2 flex flex-col text-center sm:text-left justify-center">
          <span className="text-[8px] text-yellow-500/70 font-black uppercase tracking-widest">{luta.fase} • Luta {luta.id_visual}</span>
          <span className="text-[10px] font-black text-white leading-tight mt-0.5 truncate" title={luta.categoria}>{luta.categoria}</span>
          <span className="text-[9px] text-zinc-400 font-bold uppercase mt-0.5">{luta.faixa}</span>
        </div>
        <div className="flex-1 flex flex-col min-w-0 pl-1 justify-center items-center sm:items-start text-center sm:text-left w-full">
          <span className="text-[12px] font-black uppercase text-white truncate">{nomeAtl}</span>
          <span className="text-[9px] text-zinc-500 uppercase truncate">{equipeAtl || 'Sem Equipe'}</span>
          <div className="mt-1.5 flex flex-wrap items-center justify-center sm:justify-start gap-2 w-full">
            <span className={`inline-flex rounded border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest ${statusCheckin.className}`}>{statusCheckin.label}</span>
            <span className="text-[9px] font-black text-yellow-500 flex items-center gap-1.5 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20"><Clock size={10}/> {textoStatus}</span>
          </div>
        </div>
      </div>
    );
  }

  // 🔥 RENDERIZAÇÃO DA LUTA NORMAL
  const renderLutaCard = (luta: Luta) => {
    const atleta1Real = isAtletaValido(luta.atleta_1);
    const atleta2Real = isAtletaValido(luta.atleta_2);
    const nome1Formatado = displayNome(luta.atleta_1);
    const nome2Formatado = displayNome(luta.atleta_2);
    
    const status1 = statusCheckinLabel(luta.checkin_1);
    const status2 = statusCheckinLabel(luta.checkin_2);
    
    const temTbd = nomeUpper(luta.atleta_1) === 'TBD' || nomeUpper(luta.atleta_2) === 'TBD';
    const temCheckinPendente = luta.checkin_1 === 'pendente' || luta.checkin_2 === 'pendente';
    const temReprovado = String(luta.checkin_1 || '').includes('desclassificado') || String(luta.checkin_2 || '').includes('desclassificado');
    
    const lutaBloqueada = temTbd || (temCheckinPendente && !temReprovado);

    return (
      <div key={luta.id} className={`bg-[#0a0a0e] border rounded-lg p-2 md:p-2.5 flex flex-col sm:flex-row items-center gap-2 relative overflow-hidden transition-all ${luta.status_luta === 'em_andamento' ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/10 hover:border-white/20'}`}>
        <div className={`absolute top-0 left-0 w-1 h-full ${luta.status_luta === 'concluida' ? 'bg-green-600' : luta.status_luta === 'em_andamento' ? 'bg-red-600' : 'bg-zinc-800'}`}></div>

        <div className="w-full sm:w-[25%] shrink-0 sm:border-r border-white/5 pb-1 sm:pb-0 sm:pr-2 pl-2 flex flex-col text-center sm:text-left">
          <span className="text-[7px] md:text-[8px] text-zinc-500 font-black uppercase tracking-widest">{luta.fase} • Luta {luta.id_visual || luta.id}</span>
          <span className="text-[9px] md:text-[10px] font-black text-white leading-tight mt-0.5 truncate" title={luta.categoria}>{luta.categoria}</span>
          <span className="text-[8px] md:text-[9px] text-zinc-400 font-bold uppercase mt-0.5">{luta.faixa}</span>
        </div>

        <div className="flex-1 w-full min-w-0 flex items-center justify-between gap-1 px-1">
           <div className="flex-1 min-w-0 flex flex-col items-end text-right">
              <span className={`text-[10px] md:text-[11px] font-black uppercase truncate w-full block ${atleta1Real ? (luta.vencedor === luta.atleta_1 ? 'text-green-400' : 'text-blue-400') : 'text-zinc-600 italic'}`}>{nome1Formatado}</span>
              {atleta1Real && abaAtiva === 'fila' && <div className="mt-0.5 flex justify-end w-full"><span className={`inline-flex rounded border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest ${status1.className}`}>{status1.label}</span></div>}
           </div>
           <div className="shrink-0 bg-black/60 border border-white/5 rounded px-1 py-0.5 text-[7px] font-black text-zinc-500 mx-1">VS</div>
           <div className="flex-1 min-w-0 flex flex-col items-start text-left">
              <span className={`text-[10px] md:text-[11px] font-black uppercase truncate w-full block ${atleta2Real ? (luta.vencedor === luta.atleta_2 ? 'text-green-400' : 'text-red-400') : 'text-zinc-600 italic'}`}>{nome2Formatado}</span>
              {atleta2Real && abaAtiva === 'fila' && <div className="mt-0.5 flex justify-start w-full"><span className={`inline-flex rounded border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest ${status2.className}`}>{status2.label}</span></div>}
           </div>
        </div>

        <div className="w-full sm:w-auto shrink-0 mt-2 sm:mt-0 px-1 sm:px-0 flex items-center justify-center gap-1.5">
          {abaAtiva === 'fila' && (
            <button onClick={() => setModalTransferencia({ visivel: true, luta })} title="Transferir Tatame" className="cursor-pointer p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white rounded-md transition-colors">
              <ArrowRightLeft size={12} />
            </button>
          )}

          {abaAtiva === 'concluidas' ? (
            <button onClick={() => router.push(`/staff/placar/${luta.id}`)} className="cursor-pointer w-full sm:w-[100px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 py-1.5 rounded-md font-black uppercase tracking-widest text-[8px] md:text-[9px] flex items-center justify-center gap-1 transition-colors"><Edit3 size={12} /> Editar</button>
          ) : temReprovado ? (
            <button onClick={() => router.push(`/staff/placar/${luta.id}`)} className="cursor-pointer w-full sm:w-[100px] bg-red-950 hover:bg-red-900 border border-red-500/50 text-red-400 py-1.5 rounded-md font-black uppercase tracking-widest text-[8px] md:text-[9px] flex items-center justify-center gap-1 transition-colors"><XCircle size={12} /> W.O. Balança</button>
          ) : (
            <button 
              onClick={() => chamarLuta(luta)} 
              disabled={lutaBloqueada || acaoId === luta.id} 
              className={`cursor-pointer w-full sm:w-[100px] py-1.5 rounded-md font-black uppercase tracking-widest text-[8px] md:text-[9px] flex items-center justify-center gap-1 transition-all active:scale-95 ${lutaBloqueada ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700' : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_10px_rgba(255,255,255,0.2)]'}`}
            >
              {acaoId === luta.id ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
              {lutaBloqueada ? (temTbd ? 'AGUARDANDO' : 'BLOQUEADO') : luta.status_luta === 'em_andamento' ? 'Retomar' : 'Chamar'}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!sessao) return null;

  return (
    <main className="min-h-screen bg-[#050505] pb-24 text-white selection:bg-red-500/30">
      <style dangerouslySetInnerHTML={{ __html: `.hide-global-nav > header:first-of-type, .hide-global-nav nav:first-of-type { display: none !important; } body.hide-global-nav > main, body.hide-global-nav > div > main { padding-top: 0 !important; margin-top: 0 !important; }` }} />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur-md">
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

        <div className="mx-auto grid max-w-7xl grid-cols-2 px-3 md:px-6">
          <button onClick={() => setAbaAtiva('fila')} className={`border-b-2 py-3 text-[11px] font-black uppercase tracking-widest ${abaAtiva === 'fila' ? 'border-red-500 text-white' : 'border-transparent text-zinc-600'}`}>Fila do tatame</button>
          <button onClick={() => setAbaAtiva('concluidas')} className={`border-b-2 py-3 text-[11px] font-black uppercase tracking-widest ${abaAtiva === 'concluidas' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-600'}`}>Concluídas</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 p-3 md:p-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-[#0b0b10] p-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Na fila</span>
            <strong className="mt-2 block text-2xl font-black">{proximasLutas.length}</strong>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-red-300">Agora</span>
            <strong className="mt-2 block text-2xl font-black text-red-300">{lutaAtual ? 1 : 0}</strong>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">Concluídas</span>
            <strong className="mt-2 block text-2xl font-black text-emerald-300">{concluidas.length}</strong>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-cyan-300">Próxima</span>
            <strong className="mt-2 block text-sm font-black text-cyan-200">{proximasLutas[0] ? formatarHorario(proximasLutas[0].horario_estimado) : 'Livre'}</strong>
          </div>
        </section>

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
        ) : abaAtiva === 'concluidas' ? (
          concluidas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b0b10] p-12 text-center text-xs font-black uppercase tracking-widest text-zinc-500">Nenhuma luta concluída neste filtro.</div>
          ) : (
            <section className="grid gap-3 lg:grid-cols-2">
              {concluidas.map((luta) => <div key={luta.id}>{renderLutaCard(luta)}</div>)}
            </section>
          )
        ) : (
          <div className="space-y-4">
            {lutaAtual && (
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-300"><Clock size={14} /> Em andamento</h2>
                {renderLutaCard(lutaAtual)}
              </section>
            )}

            {/* 🔥 NOVO BLOCO DA BAIA PARA O MESÁRIO */}
            {atletasNaBaia.length > 0 && (
              <section className="mt-6 mb-6">
                <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-yellow-500 border-b border-yellow-500/20 pb-2">
                  <Clock size={14} /> Aguardando Oponente (Baia)
                </h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {atletasNaBaia.map((luta) => renderBaiaCard(luta))}
                </div>
              </section>
            )}

            {proximasLutas.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white"><CheckCircle size={14} className="text-emerald-400" /> Próximas chamadas</h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {proximasLutas.map((luta) => <div key={luta.id}>{renderLutaCard(luta)}</div>)}
                </div>
              </section>
            )}

            {!lutaAtual && proximasLutas.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b0b10] p-12 text-center mt-6">
                <AlertCircle size={32} className="mx-auto mb-3 text-zinc-700" />
                <h2 className="text-base font-black uppercase text-white">Fila vazia</h2>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-600">Nenhuma luta real aguardando neste tatame.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {modalTransferencia.visivel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0b0b10] p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black uppercase text-white">Transferir luta</h2>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Luta {modalTransferencia.luta?.id_visual || modalTransferencia.luta?.id}</p>
              </div>
              <button onClick={() => setModalTransferencia({ visivel: false, luta: null })} className="rounded-xl bg-white/5 p-2 text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-2">
              {tatamesDisponiveis.filter((tatame) => nomeUpper(tatame) !== nomeUpper(sessao.identificacao)).length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-zinc-500">Nenhum outro tatame configurado.</div>
              ) : (
                tatamesDisponiveis
                  .filter((tatame) => nomeUpper(tatame) !== nomeUpper(sessao.identificacao))
                  .map((tatame) => (
                    <button key={tatame} onClick={() => executarTransferenciaTatame(tatame)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-white hover:bg-red-600">
                      Enviar para {tatame}
                      <ArrowRightLeft size={14} />
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}