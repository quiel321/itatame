'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { Play, AlertCircle, CheckCircle, Clock, XCircle, RefreshCw, Edit3, SkipForward, Trophy, Search, Filter, LogOut, ArrowRightLeft, X } from 'lucide-react';
import Link from 'next/link';

export default function PainelMesario() {
  const router = useRouter();
  const [sessao, setSessao] = useState<any>(null); 
  
  const [lutasOriginais, setLutasOriginais] = useState<any[]>([]);
  const [lutasExibidas, setLutasExibidas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'pendentes' | 'concluidas'>('pendentes');
  const [todasAsLutasDoEvento, setTodasAsLutasDoEvento] = useState<any[]>([]);

  const [tatamesDisponiveis, setTatamesDisponiveis] = useState<string[]>([]);
  const [modalTransferencia, setModalTransferencia] = useState<{ visivel: boolean, luta: any | null }>({ visivel: false, luta: null });

  const [buscaNome, setBuscaNome] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'peso' | 'absoluto'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');

  useEffect(() => {
    document.body.classList.add('hide-global-nav');
    const sessaoSalva = localStorage.getItem('itatame_staff_session');
    if (!sessaoSalva) { router.replace('/staff/login'); return; }
    const sessaoParse = JSON.parse(sessaoSalva);
    if (sessaoParse.funcao !== 'mesario') { router.replace('/staff/login'); return; }

    setSessao(sessaoParse);
    return () => document.body.classList.remove('hide-global-nav');
  }, [router]);

  useEffect(() => {
    if (!sessao) return;
    const carregarTatames = async () => {
      const { data } = await supabase.from('staff_eventos').select('identificacao').eq('evento_id', sessao.evento_id).eq('funcao', 'mesario');
      if (data) {
        const nomes = Array.from(new Set(data.map(t => t.identificacao.trim()))).filter(n => n !== "");
        setTatamesDisponiveis(nomes.sort());
      }
    };
    carregarTatames();
  }, [sessao]);

  const isGhost = (nome: string | null) => {
    const clean = String(nome || "").trim().toUpperCase();
    return clean === "" || clean === "BYE" || clean === "TBD";
  };

  const displayNome = (nome: string | null) => {
    const clean = String(nome || "").trim().toUpperCase();
    if (clean === "BYE") return "SEM OPONENTE";
    if (clean === "TBD" || clean === "") return "AGUARDANDO OPONENTE";
    return nome;
  };

  const isAtletaValido = (nome: string | null) => !isGhost(nome);

  const carregarPainel = useCallback(async (isSilent = false) => {
    if (!sessao) return; 
    if (!isSilent) setLoading(true);
    setRefreshing(true);

    const { data: todasAsLutasData, error } = await supabase.from('chaves').select('*').eq('evento_id', sessao.evento_id).order('ordem', { ascending: true });
    if (error || !todasAsLutasData) {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
      return;
    }

    const isStrictGhost = (n: string | null) => {
      const c = String(n || "").trim().toUpperCase();
      return c === "BYE" || c === "";
    };

    const deadBranches = todasAsLutasData.filter(l => l.status_luta !== 'concluida' && isStrictGhost(l.atleta_1) && isStrictGhost(l.atleta_2));

    if (deadBranches.length > 0) {
      for (const dead of deadBranches) {
        await supabase.from('chaves').update({ status_luta: 'concluida', vencedor: 'BYE', metodo_vitoria: 'wo', finalizada_em: new Date().toISOString() }).eq('id', dead.id);
        if (dead.proxima_luta) {
          const prox = todasAsLutasData.find(l => l.categoria === dead.categoria && l.faixa === dead.faixa && String(l.id_visual) === String(dead.proxima_luta));
          if (prox) {
            const isImpar = Number(dead.id_visual) % 2 !== 0;
            const updateData = isImpar ? { atleta_1: 'BYE', equipe_1: '', atleta_1_id: null } : { atleta_2: 'BYE', equipe_2: '', atleta_2_id: null };
            await supabase.from('chaves').update(updateData).eq('id', prox.id);
          }
        }
      }
      return carregarPainel(isSilent);
    }

    const chavesSemTatame = todasAsLutasData.filter(l => !l.tatame && (isAtletaValido(l.atleta_1) || isAtletaValido(l.atleta_2)));
    if (chavesSemTatame.length > 0) {
      for (const semTatame of chavesSemTatame) {
        const lutaComTatame = todasAsLutasData.find(l => l.categoria === semTatame.categoria && l.faixa === semTatame.faixa && l.tatame);
        const tatameAlvo = lutaComTatame ? lutaComTatame.tatame : sessao.identificacao.trim();
        await supabase.from('chaves').update({ tatame: tatameAlvo }).eq('id', semTatame.id);
      }
      return carregarPainel(isSilent);
    }

    setTodasAsLutasDoEvento(todasAsLutasData);

    const lutasDoMeuTatame = todasAsLutasData.filter(l => l.tatame && l.tatame.trim().toUpperCase() === sessao.identificacao.trim().toUpperCase());
    const lutasAtuais = lutasDoMeuTatame.filter(l => ['agendada', 'em_andamento', 'concluida'].includes(l.status_luta));

    // 🔥 BLINDAGEM MÁXIMA: Buscando e Cruzando pelo atleta_id e não pelo NOME
    const { data: inscricoesData } = await supabase.from('inscricoes').select('atleta_id, status_checkin').eq('evento_id', sessao.evento_id);

    const lutasComCheckin = lutasAtuais.map((luta: any) => {
      const getStatus = (idNum: number | null, nomeAtleta: string) => {
        if (!idNum || isGhost(nomeAtleta)) return 'N/A';
        const inscricao = inscricoesData?.find((i: any) => i.atleta_id === idNum);
        return inscricao ? inscricao.status_checkin : 'pendente';
      };
      return { ...luta, checkin_1: getStatus(luta.atleta_1_id, luta.atleta_1), checkin_2: getStatus(luta.atleta_2_id, luta.atleta_2) };
    });

    const lutasReais = lutasComCheckin.filter((l: any) => !(isGhost(l.atleta_1) && isGhost(l.atleta_2)));
    setLutasOriginais(lutasReais);
    
    if (!isSilent) setLoading(false);
    setRefreshing(false);
  }, [sessao]);

  useEffect(() => {
    if (sessao) {
      carregarPainel();
      const interval = setInterval(() => carregarPainel(true), 15000);
      return () => clearInterval(interval);
    }
  }, [sessao, carregarPainel]);

  useEffect(() => {
    let filtradas = lutasOriginais.filter(l => abaAtiva === 'pendentes' ? l.status_luta !== 'concluida' : l.status_luta === 'concluida');
    if (buscaNome.trim() !== '') {
      const termo = buscaNome.toLowerCase();
      filtradas = filtradas.filter(l => (l.atleta_1 && l.atleta_1.toLowerCase().includes(termo)) || (l.atleta_2 && l.atleta_2.toLowerCase().includes(termo)));
    }
    if (filtroTipo !== 'todos') {
      filtradas = filtradas.filter(l => {
        const isAbsoluto = l.categoria.toLowerCase().includes('absoluto');
        return filtroTipo === 'peso' ? !isAbsoluto : isAbsoluto;
      });
    }
    if (filtroCategoria !== '') filtradas = filtradas.filter(l => l.categoria === filtroCategoria);
    setLutasExibidas(filtradas);
  }, [lutasOriginais, abaAtiva, buscaNome, filtroTipo, filtroCategoria]);

  const updateEstatistica = async (idAtletaNum: number, coluna: string, incremento: number) => {
    if (!idAtletaNum) return;
    const { data } = await supabase.from("atletas").select(`id, ${coluna}`).eq("id", idAtletaNum).single();
    if (data) {
      const valorAtual = (data as any)[coluna] || 0;
      await supabase.from("atletas").update({ [coluna]: Math.max(0, valorAtual + incremento) }).eq("id", idAtletaNum);
    }
  };

  const executarTransferenciaTatame = async (novoTatame: string) => {
    if (!modalTransferencia.luta) return;
    if (confirm(`Confirmar envio permanente desta luta para o ${novoTatame}?`)) {
      setRefreshing(true);
      const idLuta = modalTransferencia.luta.id;
      setModalTransferencia({ visivel: false, luta: null });
      await supabase.from('chaves').update({ tatame: novoTatame }).eq('id', idLuta);
      await carregarPainel();
    }
  };

  const avancarFaseUnica = async (lutaAtual: any, vencedorOficial: string, equipeVencedor: string, vencedorId: number | null) => {
    if (!confirm(`Avançar [ ${vencedorOficial} ] de fase por ausência de oponente?`)) return;
    setRefreshing(true);
    await supabase.from('chaves').update({ 
      status_luta: 'concluida', 
      vencedor: vencedorOficial, 
      vencedor_id: vencedorId, 
      metodo_vitoria: 'wo', 
      finalizada_em: new Date().toISOString() 
    }).eq('id', lutaAtual.id);
    
    if (vencedorId) await updateEstatistica(vencedorId, "vitorias_wo", 1);
    
    const isFinal = !lutaAtual.proxima_luta || String(lutaAtual.id_visual) === "999";
    if (isFinal) {
      if (vencedorId) await updateEstatistica(vencedorId, "ouro", 1); 
      alert(`🏆 ${vencedorOficial} FOI DECLARADO CAMPEÃO!`);
    } else if (lutaAtual.proxima_luta) {
      const proxIdBanco = todasAsLutasDoEvento.find(l => l.evento_id === lutaAtual.evento_id && l.categoria === lutaAtual.categoria && l.faixa === lutaAtual.faixa && String(l.id_visual) === String(lutaAtual.proxima_luta));
      if (proxIdBanco) {
        const isImpar = Number(lutaAtual.id_visual) % 2 !== 0;
        const updateData = isImpar ? { atleta_1: vencedorOficial, equipe_1: equipeVencedor, atleta_1_id: vencedorId, tatame: lutaAtual.tatame } : { atleta_2: vencedorOficial, equipe_2: equipeVencedor, atleta_2_id: vencedorId, tatame: lutaAtual.tatame };
        await supabase.from('chaves').update(updateData).eq('id', proxIdBanco.id);
      } else { alert("Atenção: A próxima luta não foi localizada no sistema."); }
    }
    await carregarPainel();
  };

  const coroarCampeaoDireto = async (lutaInicial: any, vencedorOficial: string, equipeVencedor: string, vencedorId: number | null) => {
    if (!confirm(`🏆 ATENÇÃO!\nO atleta [ ${vencedorOficial} ] é o ÚNICO na chave inteira.\nDeseja varrer a chave e declarar CAMPEÃO DIRETO?`)) return;
    setRefreshing(true);
    let atual = lutaInicial;
    while (atual) {
      await supabase.from('chaves').update({ 
        status_luta: 'concluida', 
        vencedor: vencedorOficial, 
        vencedor_id: vencedorId, 
        metodo_vitoria: 'wo', 
        finalizada_em: new Date().toISOString() 
      }).eq('id', atual.id);
      
      const isFinal = !atual.proxima_luta || String(atual.id_visual) === "999";
      if (isFinal) {
        if (vencedorId) {
          await updateEstatistica(vencedorId, "vitorias_wo", 1);
          await updateEstatistica(vencedorId, "ouro", 1); 
        }
        alert(`🏆 ${vencedorOficial} COROADO CAMPEÃO!`);
        break; 
      }
      if (atual.proxima_luta) {
        const prox = todasAsLutasDoEvento.find(l => l.evento_id === atual.evento_id && l.categoria === atual.categoria && l.faixa === atual.faixa && String(l.id_visual) === String(atual.proxima_luta));
        if (prox) {
          const isImpar = Number(atual.id_visual) % 2 !== 0;
          const updateData = isImpar ? { atleta_1: vencedorOficial, equipe_1: equipeVencedor, atleta_1_id: vencedorId, tatame: atual.tatame } : { atleta_2: vencedorOficial, equipe_2: equipeVencedor, atleta_2_id: vencedorId, tatame: atual.tatame };
          await supabase.from('chaves').update(updateData).eq('id', prox.id);
          atual = { ...prox, ...updateData }; 
        } else { break; }
      } else { break; }
    }
    await carregarPainel();
  };

  const renderStatusCheckin = (status: string) => {
    switch (status) {
      case 'aprovado': return <span className="flex items-center gap-1 text-[8px] md:text-[9px] font-black text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded uppercase tracking-widest w-max"><CheckCircle size={10} /> Liberado</span>;
      case 'pendente': return <span className="flex items-center gap-1 text-[8px] md:text-[9px] font-black text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded uppercase tracking-widest w-max"><Clock size={10} /> Pendente</span>;
      case 'desclassificado_peso':
      case 'desclassificado_kimono': return <span className="flex items-center gap-1 text-[8px] md:text-[9px] font-black text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded uppercase tracking-widest w-max"><AlertCircle size={10} /> Reprovado</span>;
      default: return null;
    }
  };

  const fazerLogout = () => {
    localStorage.removeItem('itatame_staff_session');
    router.replace('/staff/login');
  };

  const categorizeLuta = (luta: any) => {
    if (luta.status_luta === 'concluida') return 'concluida';
    const cleanN1 = String(luta.atleta_1 || "").trim().toUpperCase();
    const cleanN2 = String(luta.atleta_2 || "").trim().toUpperCase();
    const temTbd = cleanN1 === "TBD" || cleanN2 === "TBD" || cleanN1 === "" || cleanN2 === "";
    if (temTbd) return 'aguardando';
    const temBye = cleanN1 === "BYE" || cleanN2 === "BYE";
    if (temBye) return 'wo';
    return 'prontas';
  };

  const lutasProntas = lutasExibidas.filter(l => categorizeLuta(l) === 'prontas');
  const lutasWO = lutasExibidas.filter(l => categorizeLuta(l) === 'wo');
  const lutasAguardando = lutasExibidas.filter(l => categorizeLuta(l) === 'aguardando');
  const categoriasUnicas = Array.from(new Set(lutasOriginais.map(l => l.categoria))).sort();

  const renderLutaCard = (luta: any, tipoLista: 'prontas'|'wo'|'aguardando'|'concluida') => {
    const atleta1Real = isAtletaValido(luta.atleta_1);
    const atleta2Real = isAtletaValido(luta.atleta_2);
    const nome1Formatado = displayNome(luta.atleta_1);
    const nome2Formatado = displayNome(luta.atleta_2);
    const cleanN1 = String(luta.atleta_1 || "").trim().toUpperCase();
    const cleanN2 = String(luta.atleta_2 || "").trim().toUpperCase();

    const vencedorOficial = atleta1Real ? luta.atleta_1 : luta.atleta_2;
    const equipeVencedor = atleta1Real ? luta.equipe_1 : luta.equipe_2;
    const vencedorId = atleta1Real ? luta.atleta_1_id : luta.atleta_2_id;

    const temBye = (cleanN1 === "BYE" || cleanN2 === "BYE") && !(luta.status_luta === 'concluida');
    const isByeAvancavel = temBye && (atleta1Real || atleta2Real);
    const temTbd = (cleanN1 === "TBD" || cleanN2 === "TBD" || cleanN1 === "" || cleanN2 === "");
    const temReprovado = luta.checkin_1?.includes('desclassificado') || luta.checkin_2?.includes('desclassificado');
    
    const checkinPendente = (luta.checkin_1 === 'pendente' || luta.checkin_2 === 'pendente');
    const lutaBloqueada = (!temBye && temTbd) || (!isByeAvancavel && checkinPendente);

    const outrasLutasDaMesmaCategoria = todasAsLutasDoEvento.filter(l => l.categoria === luta.categoria && l.faixa === luta.faixa && l.id !== luta.id);
    const temOutroAtletaRealNaCategoria = outrasLutasDaMesmaCategoria.some(l => (isAtletaValido(l.atleta_1) && l.atleta_1 !== vencedorOficial) || (isAtletaValido(l.atleta_2) && l.atleta_2 !== vencedorOficial));
    const isSozinhoNoMundo = isByeAvancavel && !temOutroAtletaRealNaCategoria;

    const isAguardando = tipoLista === 'aguardando';

    return (
      <div key={luta.id} className={`bg-[#0a0a0e] border rounded-xl p-3 md:p-4 flex flex-col sm:flex-row items-center gap-3 relative overflow-hidden transition-all ${luta.status_luta === 'em_andamento' ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-white/10 hover:border-white/20'} ${isAguardando ? 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0' : ''}`}>
        <div className={`absolute top-0 left-0 w-1 md:w-1.5 h-full ${luta.status_luta === 'concluida' ? 'bg-green-600' : luta.status_luta === 'em_andamento' ? 'bg-red-600' : 'bg-zinc-800'}`}></div>

        <div className="w-full sm:w-[28%] shrink-0 sm:border-r border-white/5 pb-2 sm:pb-0 sm:pr-3 pl-2 flex flex-col text-center sm:text-left">
          <span className="text-[8px] md:text-[9px] text-zinc-500 font-black uppercase tracking-widest">{luta.fase} • Luta {luta.id_visual}</span>
          <span className="text-[10px] md:text-xs font-black text-white leading-tight mt-0.5 truncate" title={luta.categoria}>{luta.categoria}</span>
          <span className="text-[9px] md:text-[10px] text-zinc-400 font-bold uppercase mt-1">{luta.faixa}</span>
        </div>

        <div className="flex-1 w-full min-w-0 flex items-center justify-between gap-1 md:gap-2 px-1">
           <div className="flex-1 min-w-0 flex flex-col items-end text-right">
              <span className={`text-[11px] md:text-xs font-black uppercase truncate w-full block ${atleta1Real ? (luta.vencedor === luta.atleta_1 ? 'text-green-400' : 'text-blue-400') : 'text-zinc-600 italic'}`}>{nome1Formatado}</span>
              {atleta1Real && abaAtiva === 'pendentes' && <div className="mt-1 flex justify-end w-full">{renderStatusCheckin(luta.checkin_1)}</div>}
           </div>
           <div className="shrink-0 bg-black/60 border border-white/5 rounded px-1.5 py-0.5 text-[8px] font-black text-zinc-500">VS</div>
           <div className="flex-1 min-w-0 flex flex-col items-start text-left">
              <span className={`text-[11px] md:text-xs font-black uppercase truncate w-full block ${atleta2Real ? (luta.vencedor === luta.atleta_2 ? 'text-green-400' : 'text-red-400') : 'text-zinc-600 italic'}`}>{nome2Formatado}</span>
              {atleta2Real && abaAtiva === 'pendentes' && <div className="mt-1 flex justify-start w-full">{renderStatusCheckin(luta.checkin_2)}</div>}
           </div>
        </div>

        <div className="w-full sm:w-auto shrink-0 mt-3 sm:mt-0 px-1 sm:px-0 flex items-center justify-center gap-2">
          {abaAtiva === 'pendentes' && (
            <button onClick={() => setModalTransferencia({ visivel: true, luta })} title="Transferir de Tatame" className="cursor-pointer p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors">
              <ArrowRightLeft size={14} />
            </button>
          )}

          {abaAtiva === 'concluidas' ? (
            <button onClick={() => router.push(`/staff/placar/${luta.id}`)} className="cursor-pointer w-full sm:w-[120px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 py-2.5 rounded-lg font-black uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-1.5 transition-colors"><Edit3 size={14} /> Editar</button>
          ) : isSozinhoNoMundo ? (
            <button onClick={() => coroarCampeaoDireto(luta, vencedorOficial, equipeVencedor, vencedorId)} className="cursor-pointer w-full sm:w-[120px] bg-yellow-500/20 hover:bg-yellow-500/40 border border-yellow-500/50 text-yellow-500 py-2.5 rounded-lg font-black uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)]"><Trophy size={14} /> Coroar</button>
          ) : isByeAvancavel ? (
            <button onClick={() => avancarFaseUnica(luta, vencedorOficial, equipeVencedor, vencedorId)} className="cursor-pointer w-full sm:w-[120px] bg-blue-900/30 hover:bg-blue-600/50 border border-blue-500/30 text-blue-400 py-2.5 rounded-lg font-black uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-1 transition-colors shadow-lg"><SkipForward size={14} fill="currentColor" /> Avançar</button>
          ) : temReprovado ? (
            <button onClick={() => router.push(`/staff/placar/${luta.id}`)} className="cursor-pointer w-full sm:w-[120px] bg-red-950 hover:bg-red-900 border border-red-500/50 text-red-400 py-2.5 rounded-lg font-black uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-1.5 transition-colors"><XCircle size={14} /> W.O. Balança</button>
          ) : (
            <button onClick={() => router.push(`/staff/placar/${luta.id}`)} disabled={lutaBloqueada} className={`cursor-pointer w-full sm:w-[120px] py-2.5 rounded-lg font-black uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-1.5 transition-all active:scale-95 ${lutaBloqueada ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700' : 'bg-white text-black hover:bg-zinc-200'}`}>
              {lutaBloqueada ? (checkinPendente ? '⚠ PENDENTE' : temTbd ? 'AGUARDANDO' : 'BLOQUEADO') : (<><Play size={14} fill="currentColor" /> {luta.status_luta === 'em_andamento' ? 'Retomar' : 'Placar'}</>)}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!sessao) return null; 

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30 pb-20 relative">
      <style dangerouslySetInnerHTML={{__html: `.hide-global-nav > header:first-of-type, .hide-global-nav nav:first-of-type { display: none !important; } body.hide-global-nav > main, body.hide-global-nav > div > main { padding-top: 0 !important; margin-top: 0 !important; }`}} />

      <header className="bg-black/95 backdrop-blur-md border-b border-white/10 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="cursor-pointer hover:opacity-80 transition-opacity">
              <span className="text-white text-xl font-black italic tracking-tighter"><span className="text-red-600">i</span>TATAME</span>
            </Link>
            <div className="hidden md:flex h-5 w-px bg-zinc-800"></div>
            <span className="text-red-500 text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Trophy size={16} /> {sessao.identificacao}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => carregarPainel()} className="cursor-pointer flex items-center gap-2 text-xs bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white px-3 py-2 md:px-4 rounded-lg uppercase font-black tracking-widest transition-all active:scale-95">
              <RefreshCw size={14} className={refreshing ? "animate-spin text-red-500" : ""} /> <span className="hidden md:inline">Atualizar</span>
            </button>
            <button onClick={fazerLogout} className="cursor-pointer bg-red-950/30 hover:bg-red-900/50 border border-red-900 text-red-500 p-2 rounded-lg transition-colors" title="Sair"><LogOut size={16} /></button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-6 pt-1">
          <button onClick={() => setAbaAtiva('pendentes')} className={`cursor-pointer pb-3 text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'pendentes' ? 'text-white border-b-2 border-red-500' : 'text-zinc-600 hover:text-zinc-400'}`}>Fila do Tatame</button>
          <button onClick={() => setAbaAtiva('concluidas')} className={`cursor-pointer pb-3 text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'concluidas' ? 'text-white border-b-2 border-green-500' : 'text-zinc-600 hover:text-zinc-400'}`}>Concluídas</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 py-6">
        <div className="bg-[#0a0a0e] border border-white/10 rounded-2xl p-4 mb-8 shadow-xl flex flex-col md:flex-row gap-3 md:gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-zinc-500" /></div>
            <input type="text" placeholder="Buscar Atleta..." value={buscaNome} onChange={(e) => setBuscaNome(e.target.value)} className="w-full bg-black/60 border border-zinc-800 focus:border-red-500 text-white text-sm rounded-xl pl-10 pr-4 py-3 outline-none transition-all placeholder:text-zinc-600" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 flex-1">
            <div className="flex-1 relative">
              <select value={filtroTipo} onChange={(e) => { setFiltroTipo(e.target.value as any); setFiltroCategoria(''); }} className="w-full bg-black/60 border border-zinc-800 focus:border-red-500 text-white text-sm rounded-xl px-4 py-3 outline-none transition-all appearance-none cursor-pointer">
                <option value="todos">Todas Modalidades</option>
                <option value="peso">Só Categorias de Peso</option>
                <option value="absoluto">Só Absolutos</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
            </div>
            <div className="flex-1 relative">
              <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="w-full bg-black/60 border border-zinc-800 focus:border-red-500 text-white text-sm rounded-xl px-4 py-3 outline-none transition-all appearance-none cursor-pointer truncate">
                <option value="">Qualquer Peso/Faixa</option>
                {categoriasUnicas.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Buscando Tatame...</p>
          </div>
        ) : lutasExibidas.length === 0 ? (
          <div className="text-center py-20 bg-[#0a0a0e] rounded-2xl border border-white/5 border-dashed">
            <Search size={32} className="mx-auto text-zinc-700 mb-3" />
            <h2 className="text-base md:text-lg font-black text-white uppercase">Fila Vazia</h2>
            <p className="text-zinc-600 text-[10px] md:text-xs font-bold uppercase mt-1">{abaAtiva === 'pendentes' ? 'Nenhum atleta real aguardando luta.' : 'Nenhuma luta concluída encontrada.'}</p>
          </div>
        ) : abaAtiva === 'concluidas' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            {lutasExibidas.map(l => renderLutaCard(l, 'concluida'))}
          </div>
        ) : (
          <div className="space-y-10">
            
            {lutasProntas.length > 0 && (
              <section>
                <h3 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
                  <span className="text-red-500">🔥</span> Prontas para o Tatame
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                  {lutasProntas.map(l => renderLutaCard(l, 'prontas'))}
                </div>
              </section>
            )}

            {lutasWO.length > 0 && (
              <section>
                <h3 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
                  <span className="text-yellow-500">⚡</span> Avanços Rápidos (W.O. / Sem Oponente)
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                  {lutasWO.map(l => renderLutaCard(l, 'wo'))}
                </div>
              </section>
            )}

            {lutasAguardando.length > 0 && (
              <section>
                <h3 className="text-zinc-500 font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
                  <span className="text-zinc-600">⏳</span> Aguardando Chaveamento
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                  {lutasAguardando.map(l => renderLutaCard(l, 'aguardando'))}
                </div>
              </section>
            )}

          </div>
        )}
      </div>

      {modalTransferencia.visivel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#0a0a0e] border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl p-6 relative flex flex-col">
            <button onClick={() => setModalTransferencia({ visivel: false, luta: null })} className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer">
              <X size={18} />
            </button>
            <div className="mb-6 flex flex-col items-center text-center mt-2">
              <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mb-3">
                <ArrowRightLeft size={20} className="text-zinc-300" />
              </div>
              <h2 className="text-lg font-black uppercase tracking-tight text-white mb-1">Transferir Luta</h2>
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Luta {modalTransferencia.luta?.id_visual} • {modalTransferencia.luta?.fase}</p>
            </div>
            <div className="flex flex-col gap-2.5">
              {tatamesDisponiveis.filter(t => t.toUpperCase() !== sessao?.identificacao.trim().toUpperCase()).length === 0 ? (
                <div className="text-center p-4 border border-dashed border-white/10 rounded-xl bg-white/5 text-zinc-500 text-xs font-medium">Nenhum outro tatame configurado para este evento.</div>
              ) : (
                tatamesDisponiveis.filter(t => t.toUpperCase() !== sessao?.identificacao.trim().toUpperCase()).map(tatame => (
                  <button key={tatame} onClick={() => executarTransferenciaTatame(tatame)} className="cursor-pointer w-full bg-zinc-900 hover:bg-red-600 text-zinc-300 hover:text-white border border-white/5 hover:border-red-500 py-3.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-between px-5 shadow-sm group">
                    <span>Enviar para {tatame}</span><ArrowRightLeft size={14} className="opacity-50 group-hover:opacity-100" />
                  </button>
                ))
              )}
            </div>
            <button onClick={() => setModalTransferencia({ visivel: false, luta: null })} className="cursor-pointer mt-4 w-full text-zinc-500 hover:text-white py-2 text-[10px] font-bold uppercase tracking-widest transition-colors">Cancelar</button>
          </div>
        </div>
      )}

    </main>
  );
}