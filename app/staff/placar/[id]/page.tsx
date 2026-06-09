"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function PlacarMesarioDB() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  // ESTADOS DO BANCO DE DADOS
  const [lutaAtual, setLutaAtual] = useState<any>(null);
  const [todasLutasCategoria, setTodasLutasCategoria] = useState<any[]>([]);
  const [loadingDB, setLoadingDB] = useState(true);

  // CONFIGURAÇÕES DA LUTA
  const [configOpen, setConfigOpen] = useState(true);
  const [showResumo, setShowResumo] = useState(false);
  const [tempoMinutos, setTempoMinutos] = useState(5);

  // ESTADOS DO PLACAR
  const [tempoRestante, setTempoRestante] = useState(0);
  const [timerAtivo, setTimerAtivo] = useState(false);

  // Atleta 1 = AZUL | Atleta 2 = VERMELHO
  const [pontosAzul, setPontosAzul] = useState(0);
  const [vantagensAzul, setVantagensAzul] = useState(0);
  const [punicoesAzul, setPunicoesAzul] = useState(0);

  const [pontosVermelho, setPontosVermelho] = useState(0);
  const [vantagensVermelho, setVantagensVermelho] = useState(0);
  const [punicoesVermelho, setPunicoesVermelho] = useState(0);

  const [vencedor, setVencedor] = useState<"azul" | "vermelho" | "empate" | null>(null);

  const [stats, setStats] = useState({
    azul: { quedas: 0, passagens: 0, montadas: 0 },
    vermelho: { quedas: 0, passagens: 0, montadas: 0 }
  });

  const placarRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 🛡️ ESTADOS DE SEGURANÇA (CLIQUE TRIPLO)
  const [clicksFinalizarAzul, setClicksFinalizarAzul] = useState(0);
  const [clicksFinalizarVermelho, setClicksFinalizarVermelho] = useState(0);
  const timeoutAzulRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutVermelhoRef = useRef<NodeJS.Timeout | null>(null);

  // ESTADOS MOBILE
  const [isMobile, setIsMobile] = useState(false);
  const [clockPos, setClockPos] = useState({ x: 0, y: 0 });
  const [clockScale, setClockScale] = useState(1);
  const dragRef = useRef({ startX: 0, startY: 0, isDragging: false });
  const pinchRef = useRef({ startDist: 0, startScale: 1 });
  const orientationRef = useRef(true);

  // ==========================================
  // 1. CARREGAMENTO DO BANCO DE DADOS
  // ==========================================
  useEffect(() => {
    async function carregarLuta() {
      if (!matchId) return;

      const { data: luta, error } = await supabase
        .from("chaves")
        .select("*")
        .eq("id", matchId)
        .single();

      if (error || !luta) {
        alert("Luta não encontrada!");
        router.push("/staff/painel");
        return;
      }

      setLutaAtual(luta);

      if (luta.pontuacao_atleta_1) {
        setPontosAzul(luta.pontuacao_atleta_1.pontos || 0);
        setVantagensAzul(luta.pontuacao_atleta_1.vantagens || 0);
        setPunicoesAzul(luta.pontuacao_atleta_1.punicoes || 0);
      }
      if (luta.pontuacao_atleta_2) {
        setPontosVermelho(luta.pontuacao_atleta_2.pontos || 0);
        setVantagensVermelho(luta.pontuacao_atleta_2.vantagens || 0);
        setPunicoesVermelho(luta.pontuacao_atleta_2.punicoes || 0);
      }

      const { data: todas } = await supabase
        .from("chaves")
        .select("*")
        .eq("evento_id", luta.evento_id)
        .eq("categoria", luta.categoria)
        .eq("faixa", luta.faixa);

      if (todas) setTodasLutasCategoria(todas);
      setLoadingDB(false);
    }

    carregarLuta();
  }, [matchId, router]);

  // ==========================================
  // 2. ATUALIZAÇÃO NO SUPABASE (PLACAR AO VIVO)
  // ==========================================
  const salvarPontuacaoDB = async (lado: "azul" | "vermelho", pts: number, vts: number, pun: number) => {
    if (!lutaAtual) return;
    const campo = lado === "azul" ? "pontuacao_atleta_1" : "pontuacao_atleta_2";
    const payload = { pontos: pts, vantagens: vts, punicoes: pun };

    await supabase.from("chaves").update({ [campo]: payload }).eq("id", matchId);
  };

  const updatePontos = (lado: "azul" | "vermelho", tipo: "pontos" | "vantagens" | "punicoes", valor: number, acao: "quedas" | "passagens" | "montadas" | null = null) => {
    if (lado === "azul") {
      let nP = pontosAzul, nV = vantagensAzul, nPun = punicoesAzul;
      if (tipo === "pontos") { nP = Math.max(0, nP + valor); setPontosAzul(nP); if (acao && valor > 0) setStats(s => ({ ...s, azul: { ...s.azul, [acao]: s.azul[acao] + 1 } })); }
      if (tipo === "vantagens") { nV = Math.max(0, nV + valor); setVantagensAzul(nV); }
      if (tipo === "punicoes") { nPun = Math.max(0, nPun + valor); setPunicoesAzul(nPun); }
      salvarPontuacaoDB("azul", nP, nV, nPun);
    } else {
      let nP = pontosVermelho, nV = vantagensVermelho, nPun = punicoesVermelho;
      if (tipo === "pontos") { nP = Math.max(0, nP + valor); setPontosVermelho(nP); if (acao && valor > 0) setStats(s => ({ ...s, vermelho: { ...s.vermelho, [acao]: s.vermelho[acao] + 1 } })); }
      if (tipo === "vantagens") { nV = Math.max(0, nV + valor); setVantagensVermelho(nV); }
      if (tipo === "punicoes") { nPun = Math.max(0, nPun + valor); setPunicoesVermelho(nPun); }
      salvarPontuacaoDB("vermelho", nP, nV, nPun);
    }
  };

  // ==========================================
  // 3. ENCERRAMENTO E AVANÇO NA CHAVE
  // ==========================================
  const limparNome = (nome: string | null) => {
    if (!nome) return "";
    const strLimpa = String(nome).trim().toUpperCase();
    if (strLimpa === "BYE" || strLimpa === "TBD") return "";
    return String(nome);
  };

  const processarFimDeLuta = async (vencedorLado: "azul" | "vermelho" | "empate", metodo: string) => {
    if (!lutaAtual || vencedorLado === "empate") return;

    const nomeVencedor = vencedorLado === "azul" ? lutaAtual.atleta_1 : lutaAtual.atleta_2;
    const equipeVencedor = vencedorLado === "azul" ? lutaAtual.equipe_1 : lutaAtual.equipe_2;
    const idVencedor = vencedorLado === "azul" ? lutaAtual.atleta_1_id : lutaAtual.atleta_2_id;
    const idPerdedor = vencedorLado === "azul" ? lutaAtual.atleta_2_id : lutaAtual.atleta_1_id;

    await supabase.from("chaves").update({
      vencedor: nomeVencedor,
      vencedor_id: idVencedor,
      status_luta: "concluida",
      metodo_vitoria: metodo,
      finalizada_em: new Date().toISOString()
    }).eq("id", matchId);

    const ganhouPorWO = metodo === "wo";
    const isFinal = !lutaAtual.proxima_luta || String(lutaAtual.id_visual) === "999";
    const isSemifinal = String(lutaAtual.proxima_luta) === "999";

    const updateEstatistica = async (idAtletaNum: number, coluna: string, incremento: number) => {
      if (!idAtletaNum) return;
      const { data } = await supabase.from("atletas").select(`id, ${coluna}`).eq("id", idAtletaNum).single();
      if (data) {
        const valorAtual = (data as any)[coluna] || 0;
        await supabase.from("atletas").update({ [coluna]: Math.max(0, valorAtual + incremento) }).eq("id", idAtletaNum);
      }
    };

    if (ganhouPorWO && idVencedor) await updateEstatistica(idVencedor, "vitorias_wo", 1);

    if (isFinal) {
      if (idVencedor) await updateEstatistica(idVencedor, "ouro", 1);
      if (idPerdedor) await updateEstatistica(idPerdedor, "prata", 1);
    }

    if (isSemifinal) {
      if (idPerdedor) await updateEstatistica(idPerdedor, "bronze", 1);
    }

    if (lutaAtual.proxima_luta) {
      const proximaLuta = todasLutasCategoria.find(l => String(l.id_visual) === String(lutaAtual.proxima_luta));
      if (proximaLuta) {
        const isImpar = Number(lutaAtual.id_visual) % 2 !== 0;
        const updateData = isImpar
          ? { atleta_1: nomeVencedor, equipe_1: equipeVencedor, atleta_1_id: idVencedor, tatame: lutaAtual.tatame }
          : { atleta_2: nomeVencedor, equipe_2: equipeVencedor, atleta_2_id: idVencedor, tatame: lutaAtual.tatame };

        await supabase.from("chaves").update(updateData).eq("id", proximaLuta.id);
      }
    }
  };

  // NOVO: FUNÇÃO DO CLIQUE TRIPLO DE SEGURANÇA
  const handleFinalizarClick = (lado: "azul" | "vermelho") => {
    if (vencedor || showResumo) return;

    if (lado === "azul") {
      const novosClicks = clicksFinalizarAzul + 1;
      if (novosClicks >= 3) {
        if (timeoutAzulRef.current) clearTimeout(timeoutAzulRef.current);
        setClicksFinalizarAzul(0);
        declararFinalizacao("azul");
      } else {
        setClicksFinalizarAzul(novosClicks);
        if (timeoutAzulRef.current) clearTimeout(timeoutAzulRef.current);
        timeoutAzulRef.current = setTimeout(() => setClicksFinalizarAzul(0), 3000); // Reseta após 3 segundos
      }
    } else {
      const novosClicks = clicksFinalizarVermelho + 1;
      if (novosClicks >= 3) {
        if (timeoutVermelhoRef.current) clearTimeout(timeoutVermelhoRef.current);
        setClicksFinalizarVermelho(0);
        declararFinalizacao("vermelho");
      } else {
        setClicksFinalizarVermelho(novosClicks);
        if (timeoutVermelhoRef.current) clearTimeout(timeoutVermelhoRef.current);
        timeoutVermelhoRef.current = setTimeout(() => setClicksFinalizarVermelho(0), 3000); // Reseta após 3 segundos
      }
    }
  };

  const declararFinalizacao = async (lado: "azul" | "vermelho") => {
    tocarSom('fim');
    setTimerAtivo(false);
    setVencedor(lado);
    setTimeout(() => setShowResumo(true), 3500);
    await processarFimDeLuta(lado, "finalizacao");
  };

  useEffect(() => {
    document.body.classList.add('ocultar-nav-global');
    document.documentElement.classList.add('ocultar-nav-global');
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      const currentPortrait = window.innerHeight > window.innerWidth;
      if (mobile && currentPortrait !== orientationRef.current) {
        orientationRef.current = currentPortrait;
        if (currentPortrait) {
          setClockScale(0.55); setClockPos({ x: 0, y: 0 });
        } else {
          setClockScale(0.35); setClockPos({ x: 0, y: -45 });
        }
      }
    };
    if (window.innerWidth <= 1024) {
      const isPort = window.innerHeight > window.innerWidth;
      orientationRef.current = isPort;
      setIsMobile(true);
      if (isPort) { setClockScale(0.55); setClockPos({ x: 0, y: 0 }); }
      else { setClockScale(0.35); setClockPos({ x: 0, y: -45 }); }
    }
    window.addEventListener("resize", handleResize);
    return () => {
      document.body.classList.remove('ocultar-nav-global');
      document.documentElement.classList.remove('ocultar-nav-global');
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    if (e.touches.length === 1) {
      dragRef.current = { startX: e.touches[0].clientX - clockPos.x, startY: e.touches[0].clientY - clockPos.y, isDragging: true };
    } else if (e.touches.length === 2) {
      dragRef.current.isDragging = false;
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchRef.current = { startDist: dist, startScale: clockScale };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;
    if (e.touches.length === 1 && dragRef.current.isDragging) {
      setClockPos({ x: e.touches[0].clientX - dragRef.current.startX, y: e.touches[0].clientY - dragRef.current.startY });
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const newScale = pinchRef.current.startScale * (dist / pinchRef.current.startDist);
      setClockScale(Math.min(Math.max(newScale, 0.3), 1.2));
    }
  };

  const onTouchEnd = () => dragRef.current.isDragging = false;

  const tocarSom = (tipo: 'inicio' | 'fim' | 'pause') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      if (tipo === 'inicio') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
      } else if (tipo === 'pause') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(400, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
      } else if (tipo === 'fim') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.8, ctx.currentTime); gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 3.0);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 3.0);
      }
    } catch (error) { console.log("Áudio não suportado", error); }
  };

  useEffect(() => {
    let intervalo: NodeJS.Timeout;
    if (timerAtivo && tempoRestante > 0) {
      intervalo = setInterval(() => setTempoRestante((prev) => prev - 1), 1000);
    }
    return () => clearInterval(intervalo);
  }, [timerAtivo, tempoRestante]);

  useEffect(() => {
    const finalizarPorPontos = async () => {
      if (tempoRestante === 0 && timerAtivo) {
        tocarSom('fim');
        setTimerAtivo(false);

        let calcVencedor: "azul" | "vermelho" | "empate" = "empate";
        if (pontosAzul > pontosVermelho) calcVencedor = "azul";
        else if (pontosVermelho > pontosAzul) calcVencedor = "vermelho";
        else if (vantagensAzul > vantagensVermelho) calcVencedor = "azul";
        else if (vantagensVermelho > vantagensAzul) calcVencedor = "vermelho";
        else if (punicoesAzul < punicoesVermelho) calcVencedor = "azul";
        else if (punicoesVermelho < punicoesAzul) calcVencedor = "vermelho";

        setVencedor(calcVencedor);
        setTimeout(() => setShowResumo(true), 3500);
        await processarFimDeLuta(calcVencedor, "pontos");
      }
    };
    finalizarPorPontos();
  }, [tempoRestante, timerAtivo]);

  const toggleTimer = async () => {
    if (!timerAtivo && tempoRestante > 0) {
      tocarSom('inicio');
      if (tempoRestante === tempoMinutos * 60) {
        await supabase.from("chaves").update({
          status_luta: "em_andamento",
          iniciada_em: new Date().toISOString(),
          duracao_segundos: tempoMinutos * 60
        }).eq("id", matchId);
      }
    } else if (timerAtivo) {
      tocarSom('pause');
    }
    setTimerAtivo(!timerAtivo);
  };

  const formatarTempo = (segundos: number) => {
    const m = Math.floor(segundos / 60).toString().padStart(2, "0");
    const s = (segundos % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const iniciarLuta = () => {
    setTempoRestante(tempoMinutos * 60);
    setTimerAtivo(false);
    setConfigOpen(false);
    setShowResumo(false);
    tocarSom('pause');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      placarRef.current?.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loadingDB) {
    return <div className="h-screen bg-black flex items-center justify-center text-white text-xl font-bold animate-pulse">Carregando Luta do Banco de Dados...</div>;
  }

  const atletaAzul = lutaAtual?.atleta_1 || "TBD";
  const atletaVermelho = lutaAtual?.atleta_2 || "TBD";

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .ocultar-nav-global header:not(.header-placar),
        .ocultar-nav-global nav { display: none !important; }
        .ocultar-nav-global body > div, .ocultar-nav-global body > main, .ocultar-nav-global #__next { padding-top: 0 !important; margin-top: 0 !important; height: 100vh; overflow: hidden; }

        @media screen and (max-width: 768px) and (orientation: portrait) {
          .placar-wrapper { flex-direction: column !important; }
          .placar-side { width: 100% !important; height: 50% !important; border: none !important; padding: 1rem !important; }
          .placar-side-azul { border-bottom: 3px solid #000 !important; }
          .placar-side-verm { border-top: 3px solid #000 !important; }
          .nome-container { padding: 0 !important; text-align: center !important; margin: 0 !important; }
          .atleta-nome { font-size: 2.0rem !important; text-align: center !important; }
          .pontos-container { align-items: center !important; }
          .pontos-gigantes { font-size: 7.5rem !important; }
          .botoes-grid { gap: 0.5rem !important; }
          .botoes-grid button { padding: 0.4rem !important; }
          .botoes-grid span:first-child { font-size: 1.5rem !important; }
          .vantagens-punicoes { gap: 0.5rem !important; }
          .vantagens-punicoes > div { padding: 0.5rem !important; }
          .vantagens-punicoes span.text-5xl { font-size: 2.5rem !important; }
          .vantagens-punicoes button { width: 2rem !important; height: 2rem !important; font-size: 1.5rem !important; }
          .vencedor-overlay { transform: scale(0.6) !important; padding: 1rem 2rem !important; }
          .resumo-modal { transform: scale(0.7) !important; padding: 1.5rem !important; width: 95% !important; }
          .resumo-grid { grid-template-columns: 1fr !important; gap: 1rem !important; }
        }

        @media screen and (max-height: 500px) and (orientation: landscape) {
          .placar-side { padding: 0.5rem 1rem !important; }
          .nome-container { padding-right: 5% !important; padding-left: 5% !important; }
          .atleta-nome { font-size: 1.8rem !important; }
          .pontos-gigantes { font-size: 6.5rem !important; }
          .botoes-grid { gap: 0.25rem !important; }
          .botoes-grid button { padding: 0.25rem !important; }
          .botoes-grid span:first-child { font-size: 1.2rem !important; }
          .vantagens-punicoes { gap: 0.5rem !important; }
          .vantagens-punicoes > div { padding: 0.25rem !important; }
          .vantagens-punicoes span.text-5xl { font-size: 2rem !important; }
          .vantagens-punicoes button { width: 1.8rem !important; height: 1.8rem !important; font-size: 1.2rem !important; }
          .modal-config { transform: scale(0.7) !important; }
          .vencedor-overlay { transform: scale(0.5) !important; }
          .resumo-modal { transform: scale(0.65) !important; }
        }
      `}} />

      <div ref={placarRef} className="placar-wrapper bg-black h-screen w-screen flex flex-row font-sans select-none text-white relative overflow-hidden">

        {configOpen && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="modal-config bg-[#111] border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-white font-black text-2xl italic tracking-tighter"><span className="text-red-600">i</span>TATAME</span>
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest bg-zinc-800 px-2 py-1 rounded">Scoreboard Lincado</span>
              </div>

              <div className="bg-black/50 p-4 rounded-xl border border-white/5 mb-6 text-center">
                <p className="text-blue-400 font-bold uppercase">{atletaAzul}</p>
                <p className="text-zinc-500 text-xs font-black my-1">VS</p>
                <p className="text-red-500 font-bold uppercase">{atletaVermelho}</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">Tempo de Luta</label>
                  <div className="flex items-center gap-4">
                    <input type="range" min="1" max="10" value={tempoMinutos} onChange={(e) => setTempoMinutos(Number(e.target.value))} className="w-full accent-white cursor-pointer" />
                    <span className="text-lg font-black text-white w-12 text-center bg-zinc-800 py-1 rounded-md">{tempoMinutos}m</span>
                  </div>
                </div>
                <button onClick={iniciarLuta} className="cursor-pointer w-full bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-widest py-3.5 rounded-lg transition-colors mt-4 shadow-xl">
                  Iniciar Combate
                </button>
                <button onClick={() => router.push('/staff/painel')} className="cursor-pointer w-full bg-transparent text-zinc-500 py-2 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">
                  Cancelar e Voltar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="clock-island absolute z-[60] flex flex-col items-center" style={isMobile ? { left: '50%', top: '42%', transform: `translate(calc(-50% + ${clockPos.x}px), calc(-50% + ${clockPos.y}px)) scale(${clockScale})`, touchAction: 'none'} : { left: '50%', top: '42%', transform: 'translate(-50%, -50%)' }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="bg-[#09090b]/95 backdrop-blur-xl px-6 py-4 md:px-10 md:py-6 rounded-[2rem] border border-zinc-800 shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col items-center">
            <span className={`text-[5.5rem] md:text-[7.5rem] lg:text-[8.5rem] leading-none font-black font-mono tracking-tighter drop-shadow-[0_0_25px_rgba(255,215,0,0.6)] text-[#FFD700] ${tempoRestante <= 60 && tempoRestante > 0 ? 'animate-pulse' : ''}`}>
              {formatarTempo(tempoRestante)}
            </span>
            <div className="flex gap-2 md:gap-4 mt-2 md:mt-4 w-full justify-center">
              <button onClick={toggleTimer} className={`cursor-pointer flex-1 py-2.5 md:py-3 rounded-xl flex items-center justify-center font-black text-sm md:text-lg uppercase tracking-widest transition-transform active:scale-95 shadow-lg ${timerAtivo ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-green-500 text-black hover:bg-green-400'}`}>
                {timerAtivo ? 'PAUSAR' : 'INICIAR'}
              </button>
              <button onClick={() => setTempoRestante(tempoMinutos * 60)} className="cursor-pointer w-12 h-12 md:w-14 md:h-14 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition-transform active:scale-95 shadow-lg border border-zinc-600">
                <svg className="w-5 h-5 md:w-6 md:h-6 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              </button>
              <button onClick={() => setConfigOpen(true)} className="cursor-pointer w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-transform active:scale-95 border border-white/10">
                <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
              <button onClick={toggleFullscreen} className="cursor-pointer w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-transform active:scale-95 border border-white/5">
                <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">{isFullscreen ? (<path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />) : (<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />)}</svg>
              </button>
            </div>
          </div>
        </div>

        {/* LADO AZUL */}
        <div className={`placar-side placar-side-azul w-1/2 h-full bg-[#05142b] border-r-[2px] border-black flex flex-col pt-6 md:pt-10 px-6 md:px-8 pb-6 relative z-10 transition-all duration-1000 ${vencedor === 'vermelho' ? 'opacity-20 grayscale' : vencedor === 'azul' ? 'brightness-125' : ''}`}>

          {/* BOTÃO DE FINALIZAR - CLIQUE TRIPLO (AZUL) */}
          <button
            onClick={() => handleFinalizarClick("azul")}
            className={`absolute top-1/2 -translate-y-1/2 left-2 md:left-6 z-50 flex flex-col items-center justify-center text-center font-bold uppercase transition-all duration-300 cursor-pointer shadow-[0_0_15px_rgba(0,0,0,0.5)] px-2
              ${clicksFinalizarAzul === 0 ? 'bg-black/60 border border-white/30 text-white w-16 h-16 md:w-20 md:h-20 rounded-full opacity-40 hover:opacity-100 hover:border-blue-500 hover:scale-110' : ''}
              ${clicksFinalizarAzul === 1 ? 'bg-orange-600 border-2 border-orange-400 text-white w-32 md:w-40 h-16 md:h-20 rounded-2xl opacity-100 scale-110' : ''}
              ${clicksFinalizarAzul === 2 ? 'bg-red-700 border-2 border-red-500 text-white w-32 md:w-40 h-16 md:h-20 rounded-2xl opacity-100 scale-110 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.8)]' : ''}
            `}
          >
            {clicksFinalizarAzul === 0 && (
              <><span className="text-[8px] md:text-[10px] leading-tight">Finalizar</span><span className="text-[10px] md:text-[13px] leading-tight text-blue-400 mt-0.5">Luta</span></>
            )}
            {clicksFinalizarAzul === 1 && (
              <><span className="text-[8px] md:text-[10px] leading-tight">MAIS 2 CLIQUES</span><span className="text-[9px] md:text-[11px] leading-tight text-white mt-0.5">PARA CONFIRMAR</span></>
            )}
            {clicksFinalizarAzul === 2 && (
              <><span className="text-[9px] md:text-[11px] leading-tight text-white">MAIS 1 CLIQUE PARA</span><span className="text-[10px] md:text-[13px] leading-tight text-red-200 mt-0.5 font-black">ENCERRAR AGORA!</span></>
            )}
          </button>

          {vencedor === 'azul' && (
            <div className="vencedor-overlay absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="bg-black/90 px-8 py-4 md:px-12 md:py-6 rounded-[3rem] border-4 border-blue-500 shadow-[0_0_100px_rgba(59,130,246,0.8)] -rotate-12 animate-pulse">
                <span className="text-blue-400 font-black text-5xl md:text-7xl lg:text-[7rem] uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(59,130,246,1)]">Venceu</span>
              </div>
            </div>
          )}

          <div className="nome-container w-full text-center px-4 md:pl-8 md:pr-[20%] shrink-0 pt-2 flex flex-col items-center">
            <h2 className="atleta-nome text-3xl md:text-4xl lg:text-[3rem] xl:text-[3.5rem] leading-none pb-1 font-black uppercase text-white truncate drop-shadow-md w-full block">{atletaAzul}</h2>
            <span className="text-blue-400 text-[10px] md:text-xs font-bold uppercase tracking-widest truncate max-w-full">{lutaAtual?.equipe_1}</span>
          </div>

          <div className="pontos-container flex-1 flex items-center justify-center w-full min-h-[0] md:pr-12 lg:pr-20">
            <span className="pontos-gigantes text-[9rem] md:text-[12rem] lg:text-[13rem] font-black text-white leading-none tracking-tighter drop-shadow-lg">{pontosAzul}</span>
          </div>

          <div className="flex flex-col gap-4 md:gap-6 w-full max-w-[600px] mx-auto mt-4 shrink-0">
            <div className="botoes-grid grid grid-cols-4 gap-3 md:gap-4">
              <button onClick={() => updatePontos("azul", "pontos", 2, "quedas")} className="cursor-pointer bg-blue-600 hover:bg-blue-500 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">+2</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight w-full pointer-events-none">Queda / Rasp<br/>Joelho na Barriga</span>
              </button>
              <button onClick={() => updatePontos("azul", "pontos", 3, "passagens")} className="cursor-pointer bg-blue-600 hover:bg-blue-500 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">+3</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight w-full pointer-events-none">Passagem<br/>de Guarda</span>
              </button>
              <button onClick={() => updatePontos("azul", "pontos", 4, "montadas")} className="cursor-pointer bg-blue-600 hover:bg-blue-500 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">+4</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight w-full pointer-events-none">Montada<br/>Costas</span>
              </button>
              <button onClick={() => updatePontos("azul", "pontos", -1)} className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">-1</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight text-zinc-400 w-full pointer-events-none">Retirar<br/>Ponto</span>
              </button>
            </div>
            <div className="vantagens-punicoes flex justify-between gap-4 md:gap-6">
              <div className="flex-1 bg-black/40 rounded-2xl p-4 flex flex-col items-center border border-white/5 shadow-inner">
                <span className="text-yellow-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 pointer-events-none">Vantagens</span>
                <div className="flex items-center gap-4 md:gap-6 w-full justify-center">
                  <button onClick={() => updatePontos("azul", "vantagens", -1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">-</button>
                  <span className="text-5xl md:text-6xl font-black text-yellow-500 pointer-events-none">{vantagensAzul}</span>
                  <button onClick={() => updatePontos("azul", "vantagens", 1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">+</button>
                </div>
              </div>
              <div className="flex-1 bg-black/40 rounded-2xl p-4 flex flex-col items-center border border-white/5 shadow-inner">
                <span className="text-red-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 pointer-events-none">Punições</span>
                <div className="flex items-center gap-4 md:gap-6 w-full justify-center">
                  <button onClick={() => updatePontos("azul", "punicoes", -1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">-</button>
                  <span className="text-5xl md:text-6xl font-black text-red-500 pointer-events-none">{punicoesAzul}</span>
                  <button onClick={() => updatePontos("azul", "punicoes", 1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LADO VERMELHO */}
        <div className={`placar-side placar-side-verm w-1/2 h-full bg-[#2f0404] border-l border-black flex flex-col pt-6 md:pt-10 px-6 md:px-8 pb-6 relative z-10 transition-all duration-1000 ${vencedor === 'azul' ? 'opacity-20 grayscale' : vencedor === 'vermelho' ? 'brightness-125' : ''}`}>

          {/* BOTÃO DE FINALIZAR - CLIQUE TRIPLO (VERMELHO) */}
          <button
            onClick={() => handleFinalizarClick("vermelho")}
            className={`absolute top-1/2 -translate-y-1/2 right-2 md:right-6 z-50 flex flex-col items-center justify-center text-center font-bold uppercase transition-all duration-300 cursor-pointer shadow-[0_0_15px_rgba(0,0,0,0.5)] px-2
              ${clicksFinalizarVermelho === 0 ? 'bg-black/60 border border-white/30 text-white w-16 h-16 md:w-20 md:h-20 rounded-full opacity-40 hover:opacity-100 hover:border-red-500 hover:scale-110' : ''}
              ${clicksFinalizarVermelho === 1 ? 'bg-orange-600 border-2 border-orange-400 text-white w-32 md:w-40 h-16 md:h-20 rounded-2xl opacity-100 scale-110' : ''}
              ${clicksFinalizarVermelho === 2 ? 'bg-red-700 border-2 border-red-500 text-white w-32 md:w-40 h-16 md:h-20 rounded-2xl opacity-100 scale-110 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.8)]' : ''}
            `}
          >
            {clicksFinalizarVermelho === 0 && (
              <><span className="text-[8px] md:text-[10px] leading-tight">Finalizar</span><span className="text-[10px] md:text-[13px] leading-tight text-red-400 mt-0.5">Luta</span></>
            )}
            {clicksFinalizarVermelho === 1 && (
              <><span className="text-[8px] md:text-[10px] leading-tight">MAIS 2 CLIQUES</span><span className="text-[9px] md:text-[11px] leading-tight text-white mt-0.5">PARA CONFIRMAR</span></>
            )}
            {clicksFinalizarVermelho === 2 && (
              <><span className="text-[9px] md:text-[11px] leading-tight text-white">MAIS 1 CLIQUE PARA</span><span className="text-[10px] md:text-[13px] leading-tight text-red-200 mt-0.5 font-black">ENCERRAR AGORA!</span></>
            )}
          </button>

          {vencedor === 'vermelho' && (
            <div className="vencedor-overlay absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="bg-black/90 px-8 py-4 md:px-12 md:py-6 rounded-[3rem] border-4 border-red-500 shadow-[0_0_100px_rgba(239,68,68,0.8)] -rotate-12 animate-pulse">
                <span className="text-red-500 font-black text-5xl md:text-7xl lg:text-[7rem] uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(239,68,68,1)]">Venceu</span>
              </div>
            </div>
          )}

          <div className="nome-container w-full text-center px-4 md:pr-8 md:pl-[20%] shrink-0 pt-2 flex flex-col items-center">
            <h2 className="atleta-nome text-3xl md:text-4xl lg:text-[3rem] xl:text-[3.5rem] leading-none pb-1 font-black uppercase text-white truncate drop-shadow-md w-full block">{atletaVermelho}</h2>
            <span className="text-red-400 text-[10px] md:text-xs font-bold uppercase tracking-widest truncate max-w-full">{lutaAtual?.equipe_2}</span>
          </div>

          <div className="pontos-container flex-1 flex items-center justify-center w-full min-h-[0] md:pl-12 lg:pl-20">
            <span className="pontos-gigantes text-[9rem] md:text-[12rem] lg:text-[13rem] font-black text-white leading-none tracking-tighter drop-shadow-lg">{pontosVermelho}</span>
          </div>

          <div className="flex flex-col gap-4 md:gap-6 w-full max-w-[600px] mx-auto mt-4 shrink-0">
            <div className="botoes-grid grid grid-cols-4 gap-3 md:gap-4">
              <button onClick={() => updatePontos("vermelho", "pontos", 2, "quedas")} className="cursor-pointer bg-red-600 hover:bg-red-500 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">+2</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight w-full pointer-events-none">Queda / Rasp<br/>Joelho na Barriga</span>
              </button>
              <button onClick={() => updatePontos("vermelho", "pontos", 3, "passagens")} className="cursor-pointer bg-red-600 hover:bg-red-500 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">+3</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight w-full pointer-events-none">Passagem<br/>de Guarda</span>
              </button>
              <button onClick={() => updatePontos("vermelho", "pontos", 4, "montadas")} className="cursor-pointer bg-red-600 hover:bg-red-500 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">+4</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight w-full pointer-events-none">Montada<br/>Costas</span>
              </button>
              <button onClick={() => updatePontos("vermelho", "pontos", -1)} className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">-1</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight text-zinc-400 w-full pointer-events-none">Retirar<br/>Ponto</span>
              </button>
            </div>
            <div className="vantagens-punicoes flex justify-between gap-4 md:gap-6">
              <div className="flex-1 bg-black/40 rounded-2xl p-4 flex flex-col items-center border border-white/5 shadow-inner">
                <span className="text-yellow-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 pointer-events-none">Vantagens</span>
                <div className="flex items-center gap-4 md:gap-6 w-full justify-center">
                  <button onClick={() => updatePontos("vermelho", "vantagens", -1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">-</button>
                  <span className="text-5xl md:text-6xl font-black text-yellow-500 pointer-events-none">{vantagensVermelho}</span>
                  <button onClick={() => updatePontos("vermelho", "vantagens", 1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">+</button>
                </div>
              </div>
              <div className="flex-1 bg-black/40 rounded-2xl p-4 flex flex-col items-center border border-white/5 shadow-inner">
                <span className="text-red-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 pointer-events-none">Punições</span>
                <div className="flex items-center gap-4 md:gap-6 w-full justify-center">
                  <button onClick={() => updatePontos("vermelho", "punicoes", -1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">-</button>
                  <span className="text-5xl md:text-6xl font-black text-red-500 pointer-events-none">{punicoesVermelho}</span>
                  <button onClick={() => updatePontos("vermelho", "punicoes", 1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL DE RESUMO */}
        {showResumo && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="resumo-modal bg-[#0c1220] border border-white/10 rounded-3xl p-8 w-full max-w-4xl shadow-[0_0_80px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-10 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Fim de Combate</h2>
                <p className="text-green-500 font-bold uppercase tracking-widest text-sm mt-1">Resultados salvos no banco oficial</p>
              </div>

              <div className="resumo-grid grid grid-cols-2 gap-8">
                <div className={`resumo-card bg-[#05142b]/80 border ${vencedor === 'azul' ? 'border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)]' : 'border-blue-500/30'} rounded-2xl p-6 relative overflow-hidden transition-all`}>
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                  <h3 className="text-xl font-black text-white uppercase truncate mb-4">{vencedor === 'azul' && ""} {atletaAzul}</h3>
                  <div className="text-6xl font-black text-blue-500 mb-6 drop-shadow-md">{pontosAzul} <span className="text-lg text-zinc-500 tracking-widest uppercase">Pts</span></div>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-zinc-400">Montadas / Costas:</span> <span className="text-white bg-blue-600 px-2 py-0.5 rounded">{stats.azul.montadas}</span></li>
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-zinc-400">Passagens:</span> <span className="text-white bg-blue-600 px-2 py-0.5 rounded">{stats.azul.passagens}</span></li>
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-zinc-400">Quedas / Rasp:</span> <span className="text-white bg-blue-600 px-2 py-0.5 rounded">{stats.azul.quedas}</span></li>
                  </ul>
                </div>
                <div className={`resumo-card bg-[#2f0404]/80 border ${vencedor === 'vermelho' ? 'border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)]' : 'border-red-500/30'} rounded-2xl p-6 relative overflow-hidden transition-all`}>
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                  <h3 className="text-xl font-black text-white uppercase truncate mb-4">{vencedor === 'vermelho' && ""} {atletaVermelho}</h3>
                  <div className="text-6xl font-black text-red-500 mb-6 drop-shadow-md">{pontosVermelho} <span className="text-lg text-zinc-500 tracking-widest uppercase">Pts</span></div>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-zinc-400">Montadas / Costas:</span> <span className="text-white bg-red-600 px-2 py-0.5 rounded">{stats.vermelho.montadas}</span></li>
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-zinc-400">Passagens:</span> <span className="text-white bg-red-600 px-2 py-0.5 rounded">{stats.vermelho.passagens}</span></li>
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-zinc-400">Quedas / Rasp:</span> <span className="text-white bg-red-600 px-2 py-0.5 rounded">{stats.vermelho.quedas}</span></li>
                  </ul>
                </div>
              </div>

              <button onClick={() => router.push('/staff/painel')} className="cursor-pointer w-full mt-8 bg-white hover:bg-zinc-200 text-black py-4 rounded-xl font-black uppercase tracking-widest transition-colors shadow-xl">
                Voltar para o Chaveamento
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
