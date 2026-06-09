"use client";

import { useState, useEffect, useRef } from "react";

export default function PlacarDigital() {
  // CONFIGURAÇÕES DA LUTA
  const [configOpen, setConfigOpen] = useState(true);
  const [showResumo, setShowResumo] = useState(false);
  
  const [atletaAzul, setAtletaAzul] = useState("");
  const [atletaVermelho, setAtletaVermelho] = useState("");
  const [tempoMinutos, setTempoMinutos] = useState(5);

  // ESTADOS DO PLACAR
  const [tempoRestante, setTempoRestante] = useState(tempoMinutos * 60);
  const [timerAtivo, setTimerAtivo] = useState(false);

  const [pontosAzul, setPontosAzul] = useState(0);
  const [vantagensAzul, setVantagensAzul] = useState(0);
  const [punicoesAzul, setPunicoesAzul] = useState(0);

  const [pontosVermelho, setPontosVermelho] = useState(0);
  const [vantagensVermelho, setVantagensVermelho] = useState(0);
  const [punicoesVermelho, setPunicoesVermelho] = useState(0);

  // ESTADO: VENCEDOR DA LUTA
  const [vencedor, setVencedor] = useState<"azul" | "vermelho" | "empate" | null>(null);

  // ESTATÍSTICAS PARA O RESUMO FINAL
  const [stats, setStats] = useState({
    azul: { quedas: 0, passagens: 0, montadas: 0 },
    vermelho: { quedas: 0, passagens: 0, montadas: 0 }
  });

  const placarRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ==========================================
  // ESTADOS: ARRASTE E ZOOM (APENAS MOBILE)
  // ==========================================
  const [isMobile, setIsMobile] = useState(false);
  const [clockPos, setClockPos] = useState({ x: 0, y: 0 });
  const [clockScale, setClockScale] = useState(1);
  
  const dragRef = useRef({ startX: 0, startY: 0, isDragging: false });
  const pinchRef = useRef({ startDist: 0, startScale: 1 });
  
  // Ref para monitorar se a tela girou
  const orientationRef = useRef(true); 

  // ==========================================
  // OCULTAR A BARRA DE NAVEGAÇÃO GLOBAL & DETECTAR MOBILE
  // ==========================================
  useEffect(() => {
    document.body.classList.add('ocultar-nav-global');
    document.documentElement.classList.add('ocultar-nav-global');

    const handleResize = () => {
      // Aumentado para 1024 para cobrir celulares modernos deitados
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);

      const currentPortrait = window.innerHeight > window.innerWidth;

      // Só reajusta a posição e o zoom se o celular girar ou abrir a tela pela primeira vez
      if (mobile && currentPortrait !== orientationRef.current) {
        orientationRef.current = currentPortrait;
        if (currentPortrait) {
          setClockScale(0.55); // Vertical: Mantido como estava
          setClockPos({ x: 0, y: 0 });
        } else {
          setClockScale(0.35); // Horizontal: Bem menor para não tampar a tela
          setClockPos({ x: 0, y: -45 }); // Horizontal: Subiu um pouco
        }
      }
    };

    // Força a validação na primeira carga da página
    if (window.innerWidth <= 1024) {
      const isPort = window.innerHeight > window.innerWidth;
      orientationRef.current = isPort;
      setIsMobile(true);
      if (isPort) {
        setClockScale(0.55);
        setClockPos({ x: 0, y: 0 });
      } else {
        setClockScale(0.35);
        setClockPos({ x: 0, y: -45 });
      }
    }

    window.addEventListener("resize", handleResize);

    return () => {
      document.body.classList.remove('ocultar-nav-global');
      document.documentElement.classList.remove('ocultar-nav-global');
      window.removeEventListener("resize", handleResize);
    };
  }, []); // Array VAZIO! Assim a lógica não conflita quando o usuário der zoom manual

  // ==========================================
  // LÓGICA DE TOUCH (ARRASTAR E ZOOM)
  // ==========================================
  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    if (e.touches.length === 1) {
      dragRef.current = {
        startX: e.touches[0].clientX - clockPos.x,
        startY: e.touches[0].clientY - clockPos.y,
        isDragging: true
      };
    } else if (e.touches.length === 2) {
      dragRef.current.isDragging = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchRef.current = { startDist: dist, startScale: clockScale };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;
    if (e.touches.length === 1 && dragRef.current.isDragging) {
      setClockPos({
        x: e.touches[0].clientX - dragRef.current.startX,
        y: e.touches[0].clientY - dragRef.current.startY
      });
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const newScale = pinchRef.current.startScale * (dist / pinchRef.current.startDist);
      setClockScale(Math.min(Math.max(newScale, 0.3), 1.2)); // Limita o Zoom entre 30% e 120%
    }
  };

  const onTouchEnd = () => {
    dragRef.current.isDragging = false;
  };

  // ==========================================
  // MOTOR DE ÁUDIO DE ESTÁDIO
  // ==========================================
  const tocarSom = (tipo: 'inicio' | 'fim' | 'pause') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (tipo === 'inicio') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else if (tipo === 'pause') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } else if (tipo === 'fim') {
        const tocarNota = (frequencia: number, inicio: number, duracao: number) => {
          const nota = ctx.createOscillator();
          const envelope = ctx.createGain();
          nota.type = 'sine';
          nota.frequency.setValueAtTime(frequencia, ctx.currentTime + inicio);
          envelope.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
          envelope.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + inicio + 0.03);
          envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracao);
          nota.connect(envelope);
          envelope.connect(ctx.destination);
          nota.start(ctx.currentTime + inicio);
          nota.stop(ctx.currentTime + inicio + duracao + 0.03);
        };
        tocarNota(523.25, 0, 0.28);
        tocarNota(659.25, 0.24, 0.32);
        tocarNota(783.99, 0.52, 0.45);
      }
    } catch (error) {
      console.log("Áudio não suportado", error);
    }
  };

  // ==========================================
  // LÓGICA DO CRONÔMETRO E FIM DE LUTA
  // ==========================================
  useEffect(() => {
    let intervalo: NodeJS.Timeout;
    if (timerAtivo && tempoRestante > 0) {
      intervalo = setInterval(() => {
        setTempoRestante((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(intervalo);
  }, [timerAtivo, tempoRestante]);

  useEffect(() => {
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
    }
  }, [tempoRestante, timerAtivo, pontosAzul, pontosVermelho, vantagensAzul, vantagensVermelho, punicoesAzul, punicoesVermelho]);

  const toggleTimer = () => {
    if (!timerAtivo && tempoRestante > 0) {
      tocarSom('inicio');
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
    setPontosAzul(0); setVantagensAzul(0); setPunicoesAzul(0);
    setPontosVermelho(0); setVantagensVermelho(0); setPunicoesVermelho(0);
    setVencedor(null); 
    setStats({
      azul: { quedas: 0, passagens: 0, montadas: 0 },
      vermelho: { quedas: 0, passagens: 0, montadas: 0 }
    });
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

  const updatePontos = (lado: "azul" | "vermelho", tipo: "pontos" | "vantagens" | "punicoes", valor: number, acao: "quedas" | "passagens" | "montadas" | null = null) => {
    if (lado === "azul") {
      if (tipo === "pontos") {
        setPontosAzul(p => Math.max(0, p + valor));
        if (acao && valor > 0) setStats(s => ({ ...s, azul: { ...s.azul, [acao]: s.azul[acao] + 1 } }));
      }
      if (tipo === "vantagens") setVantagensAzul(p => Math.max(0, p + valor));
      if (tipo === "punicoes") setPunicoesAzul(p => Math.max(0, p + valor));
    } else {
      if (tipo === "pontos") {
        setPontosVermelho(p => Math.max(0, p + valor));
        if (acao && valor > 0) setStats(s => ({ ...s, vermelho: { ...s.vermelho, [acao]: s.vermelho[acao] + 1 } }));
      }
      if (tipo === "vantagens") setVantagensVermelho(p => Math.max(0, p + valor));
      if (tipo === "punicoes") setPunicoesVermelho(p => Math.max(0, p + valor));
    }
  };

  // ==========================================
  // DECLARAR VENCEDOR POR FINALIZAÇÃO / W.O.
  // ==========================================
  const declararFinalizacao = (lado: "azul" | "vermelho") => {
    if (vencedor || showResumo) return; 
    
    tocarSom('fim');
    setTimerAtivo(false);
    setVencedor(lado);
    setTimeout(() => setShowResumo(true), 3500);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .ocultar-nav-global header:not(.header-placar),
        .ocultar-nav-global nav { display: none !important; }
        .ocultar-nav-global body > div, .ocultar-nav-global body > main, .ocultar-nav-global #__next { padding-top: 0 !important; margin-top: 0 !important; height: 100vh; overflow: hidden; }

        /* ========================================== */
        /* CSS EXCLUSIVO MOBILE VERTICAL (PORTRAIT)   */
        /* ========================================== */
        @media screen and (max-width: 768px) and (orientation: portrait) {
          .placar-wrapper { flex-direction: column !important; }
          .placar-side { width: 100% !important; height: 50% !important; border: none !important; padding: 1rem !important; }
          .placar-side-azul { border-bottom: 3px solid #000 !important; }
          .placar-side-verm { border-top: 3px solid #000 !important; }
          
          .nome-container { padding: 0 !important; text-align: center !important; margin: 0 !important; }
          .atleta-nome { font-size: 2.5rem !important; text-align: center !important; }
          
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

        /* ========================================== */
        /* CSS EXCLUSIVO MOBILE HORIZONTAL (LANDSCAPE)*/
        /* ========================================== */
        @media screen and (max-height: 500px) and (orientation: landscape) {
          .placar-side { padding: 0.5rem 1rem !important; }
          .nome-container { padding-right: 5% !important; padding-left: 5% !important; }
          .atleta-nome { font-size: 2.2rem !important; }
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

        {/* ========================================== */}
        {/* MODAL DE CONFIGURAÇÃO                      */}
        {/* ========================================== */}
        {configOpen && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="modal-config bg-[#111] border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-center gap-2 mb-8">
                <span className="text-white font-black text-2xl italic tracking-tighter"><span className="text-red-600">i</span>TATAME</span>
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest bg-zinc-800 px-2 py-1 rounded">Scoreboard</span>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1 pl-1">Lutador Azul</label>
                  <input 
                    type="text" 
                    placeholder="Nome do Atleta Azul..."
                    value={atletaAzul} 
                    onChange={(e) => setAtletaAzul(e.target.value)} 
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white font-bold outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-600" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1 pl-1">Lutador Vermelho</label>
                  <input 
                    type="text" 
                    placeholder="Nome do Atleta Vermelho..."
                    value={atletaVermelho} 
                    onChange={(e) => setAtletaVermelho(e.target.value)} 
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white font-bold outline-none focus:border-red-500 transition-colors placeholder:text-zinc-600" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">Tempo de Luta</label>
                  <div className="flex items-center gap-4">
                    <input type="range" min="1" max="10" value={tempoMinutos} onChange={(e) => setTempoMinutos(Number(e.target.value))} className="w-full accent-white cursor-pointer" />
                    <span className="text-lg font-black text-white w-12 text-center bg-zinc-800 py-1 rounded-md">{tempoMinutos}m</span>
                  </div>
                </div>
                <button onClick={iniciarLuta} className="cursor-pointer w-full bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-widest py-3.5 rounded-lg transition-colors mt-4">
                  Iniciar Combate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* ILHA DO CRONÔMETRO                         */}
        {/* ========================================== */}
        <div 
          className="clock-island absolute z-[60] flex flex-col items-center"
          style={isMobile ? {
            left: '50%',
            top: '42%',
            transform: `translate(calc(-50% + ${clockPos.x}px), calc(-50% + ${clockPos.y}px)) scale(${clockScale})`,
            touchAction: 'none'
          } : {
            left: '50%',
            top: '42%',
            transform: 'translate(-50%, -50%)'
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* 🔥 ILHA REDUZIDA LIGEIRAMENTE NO PADDING PARA NÃO ATRAPALHAR OS NÚMEROS DO PLACAR */}
          <div className="bg-[#09090b]/95 backdrop-blur-xl px-5 py-3 md:px-8 md:py-5 rounded-[2rem] border border-zinc-800 shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col items-center">
            
            {/* FONTE REDUZIDA DO RELÓGIO */}
            <span className={`text-[5rem] md:text-[6.5rem] lg:text-[7.5rem] leading-none font-black font-mono tracking-tighter drop-shadow-[0_0_25px_rgba(255,215,0,0.6)] text-[#FFD700] ${tempoRestante <= 60 && tempoRestante > 0 ? 'animate-pulse' : ''}`}>
              {formatarTempo(tempoRestante)}
            </span>
            
            <div className="flex gap-2 md:gap-4 mt-2 md:mt-3 w-full justify-center">
              <button onClick={toggleTimer} className={`cursor-pointer flex-1 py-2 md:py-2.5 rounded-xl flex items-center justify-center font-black text-sm md:text-lg uppercase tracking-widest transition-transform active:scale-95 shadow-lg ${timerAtivo ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-green-500 text-black hover:bg-green-400'}`}>
                {timerAtivo ? 'PAUSAR' : 'INICIAR'}
              </button>
              <button onClick={() => setTempoRestante(tempoMinutos * 60)} className="cursor-pointer w-10 h-10 md:w-12 md:h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition-transform active:scale-95 shadow-lg border border-zinc-600">
                <svg className="w-4 h-4 md:w-5 md:h-5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              </button>
              <button onClick={() => setConfigOpen(true)} className="cursor-pointer w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-transform active:scale-95 border border-white/10">
                <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button onClick={toggleFullscreen} className="cursor-pointer w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-transform active:scale-95 border border-white/5">
                <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  {isFullscreen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  )}
                </svg>
              </button>
            </div>

            <div className="mt-3 opacity-60">
              <span className="text-white font-black text-[10px] md:text-xs italic tracking-widest pointer-events-none">
                <span className="text-red-600">i</span>TATAME
              </span>
            </div>
            
          </div>
        </div>

        {/* ========================================== */}
        {/* LADO AZUL                                  */}
        {/* ========================================== */}
        <div className={`placar-side placar-side-azul w-1/2 h-full bg-[#05142b] border-r-[2px] border-black flex flex-col pt-6 md:pt-10 px-6 md:px-8 pb-6 relative z-10 transition-all duration-1000 ${vencedor === 'vermelho' ? 'opacity-20 grayscale' : vencedor === 'azul' ? 'brightness-125' : ''}`}>
          
          <button 
            onClick={() => declararFinalizacao("azul")}
            className="absolute top-1/2 -translate-y-1/2 left-2 md:left-6 z-50 bg-black/60 border border-white/30 text-white font-bold uppercase w-16 h-16 md:w-20 md:h-20 rounded-full flex flex-col items-center justify-center opacity-40 hover:opacity-100 hover:border-blue-500 hover:scale-110 transition-all duration-300 cursor-pointer shadow-[0_0_15px_rgba(0,0,0,0.5)]"
          >
            <span className="text-[8px] md:text-[10px] leading-tight">Finalizar</span>
            <span className="text-[10px] md:text-[13px] leading-tight text-blue-400 mt-0.5">W.O.</span>
          </button>

          {vencedor === 'azul' && (
            <div className="vencedor-overlay absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="bg-black/90 px-8 py-4 md:px-12 md:py-6 rounded-[3rem] border-4 border-blue-500 shadow-[0_0_100px_rgba(59,130,246,0.8)] -rotate-12 animate-pulse">
                <span className="text-blue-400 font-black text-5xl md:text-7xl lg:text-[7rem] uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(59,130,246,1)]">🏆 Venceu</span>
              </div>
            </div>
          )}

          {/* 🔥 ESPAÇAMENTO AJUSTADO PARA O NOME NÃO ABREVIAR TÃO CEDO */}
          <div className="nome-container w-full text-center px-2 md:pl-2 md:pr-12 shrink-0 pt-2">
            <h2 title={atletaAzul || "ATLETA AZUL"} className="atleta-nome text-3xl md:text-5xl lg:text-6xl leading-none pb-2 font-black uppercase text-white truncate drop-shadow-md w-full block">
              {atletaAzul || "ATLETA AZUL"}
            </h2>
          </div>
          
          <div className="pontos-container flex-1 flex items-center justify-center w-full min-h-[0]">
            {/* 🔥 FONTES DO PLACAR SÃO DINÂMICAS: DIMINUEM SE PASSAR DE 9 PONTOS PARA NÃO ENCOSTAR NO RELÓGIO */}
            <span className={`pontos-gigantes font-black text-white leading-none tracking-tighter drop-shadow-lg transition-all ${pontosAzul > 9 ? 'text-[8rem] md:text-[11rem] lg:text-[12rem]' : 'text-[10rem] md:text-[14rem] lg:text-[15rem]'}`}>
              {pontosAzul}
            </span>
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

        {/* ========================================== */}
        {/* LADO VERMELHO                              */}
        {/* ========================================== */}
        <div className={`placar-side placar-side-verm w-1/2 h-full bg-[#2f0404] border-l border-black flex flex-col pt-6 md:pt-10 px-6 md:px-8 pb-6 relative z-10 transition-all duration-1000 ${vencedor === 'azul' ? 'opacity-20 grayscale' : vencedor === 'vermelho' ? 'brightness-125' : ''}`}>
          
          <button 
            onClick={() => declararFinalizacao("vermelho")}
            className="absolute top-1/2 -translate-y-1/2 right-2 md:right-6 z-50 bg-black/60 border border-white/30 text-white font-bold uppercase w-16 h-16 md:w-20 md:h-20 rounded-full flex flex-col items-center justify-center opacity-40 hover:opacity-100 hover:border-red-500 hover:scale-110 transition-all duration-300 cursor-pointer shadow-[0_0_15px_rgba(0,0,0,0.5)]"
          >
            <span className="text-[8px] md:text-[10px] leading-tight">Finalizar</span>
            <span className="text-[10px] md:text-[13px] leading-tight text-red-400 mt-0.5">W.O.</span>
          </button>

          {vencedor === 'vermelho' && (
            <div className="vencedor-overlay absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="bg-black/90 px-8 py-4 md:px-12 md:py-6 rounded-[3rem] border-4 border-red-500 shadow-[0_0_100px_rgba(239,68,68,0.8)] -rotate-12 animate-pulse">
                <span className="text-red-500 font-black text-5xl md:text-7xl lg:text-[7rem] uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(239,68,68,1)]">🏆 Venceu</span>
              </div>
            </div>
          )}

          {/* 🔥 ESPAÇAMENTO AJUSTADO PARA O NOME NÃO ABREVIAR TÃO CEDO */}
          <div className="nome-container w-full text-center px-2 md:pr-2 md:pl-12 shrink-0 pt-2">
            <h2 title={atletaVermelho || "ATLETA VERMELHO"} className="atleta-nome text-3xl md:text-5xl lg:text-6xl leading-none pb-2 font-black uppercase text-white truncate drop-shadow-md w-full block">
              {atletaVermelho || "ATLETA VERMELHO"}
            </h2>
          </div>
          
          <div className="pontos-container flex-1 flex items-center justify-center w-full min-h-[0]">
            {/* 🔥 FONTES DO PLACAR SÃO DINÂMICAS: DIMINUEM SE PASSAR DE 9 PONTOS PARA NÃO ENCOSTAR NO RELÓGIO */}
            <span className={`pontos-gigantes font-black text-white leading-none tracking-tighter drop-shadow-lg transition-all ${pontosVermelho > 9 ? 'text-[8rem] md:text-[11rem] lg:text-[12rem]' : 'text-[10rem] md:text-[14rem] lg:text-[15rem]'}`}>
              {pontosVermelho}
            </span>
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

        {/* ========================================== */}
        {/* MODAL DE RESUMO (FIM DE LUTA)              */}
        {/* ========================================== */}
        {showResumo && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="resumo-modal bg-[#0c1220] border border-white/10 rounded-3xl p-8 w-full max-w-4xl shadow-[0_0_80px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-10 duration-500">
              <div className="text-center mb-6">
                <p className="text-yellow-400 font-black uppercase tracking-[0.25em] text-[10px] mb-2">Resumo da luta</p>
                <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">Fim de Combate</h2>
              </div>

              <div className="bg-black/35 border border-white/10 rounded-2xl overflow-hidden">
                <div className={"px-5 py-3 text-center font-black uppercase tracking-[0.25em] text-xs " + (vencedor === 'azul' ? 'bg-blue-600 text-white' : vencedor === 'vermelho' ? 'bg-red-600 text-white' : 'bg-zinc-700 text-white')}>
                  {vencedor === 'empate' ? 'Empate' : 'Vencedor'}
                </div>

                <div className="p-5 md:p-7 grid grid-cols-1 md:grid-cols-[140px_1fr] gap-5 items-center">
                  <div className={"mx-auto w-28 h-28 md:w-32 md:h-32 rounded-full border-4 flex items-center justify-center shadow-[0_0_35px_rgba(234,179,8,0.2)] " + (vencedor === 'azul' ? 'bg-blue-950 border-blue-400' : vencedor === 'vermelho' ? 'bg-red-950 border-red-400' : 'bg-zinc-900 border-zinc-500')}>
                    <span className="text-5xl font-black text-white">{(vencedor === 'azul' ? (atletaAzul || 'A') : vencedor === 'vermelho' ? (atletaVermelho || 'V') : 'E').charAt(0)}</span>
                  </div>

                  <div className="text-center md:text-left">
                    <h3 className="text-3xl md:text-5xl font-black text-white uppercase leading-none mb-2">
                      {vencedor === 'azul' ? (atletaAzul || 'Atleta Azul') : vencedor === 'vermelho' ? (atletaVermelho || 'Atleta Vermelho') : 'Empate'}
                    </h3>
                    <p className="text-zinc-400 text-sm md:text-base font-bold uppercase tracking-widest mb-4">
                      {vencedor === 'empate' ? 'Decisao empatada pelos criterios informados' : 'Resultado do combate'}
                    </p>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                        <span className="block text-[9px] text-zinc-500 font-black uppercase tracking-widest">Pontos</span>
                        <strong className="text-2xl text-white">{vencedor === 'azul' ? pontosAzul : vencedor === 'vermelho' ? pontosVermelho : pontosAzul + ' x ' + pontosVermelho}</strong>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                        <span className="block text-[9px] text-zinc-500 font-black uppercase tracking-widest">Vant.</span>
                        <strong className="text-2xl text-yellow-400">{vencedor === 'azul' ? vantagensAzul : vencedor === 'vermelho' ? vantagensVermelho : vantagensAzul + ' x ' + vantagensVermelho}</strong>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                        <span className="block text-[9px] text-zinc-500 font-black uppercase tracking-widest">Pun.</span>
                        <strong className="text-2xl text-red-400">{vencedor === 'azul' ? punicoesAzul : vencedor === 'vermelho' ? punicoesVermelho : punicoesAzul + ' x ' + punicoesVermelho}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-t border-white/10 text-xs">
                  <div className="p-4 bg-blue-950/30 border-r border-white/10">
                    <p className="font-black text-blue-300 uppercase truncate">{atletaAzul || 'Atleta Azul'}</p>
                    <p className="text-zinc-400 mt-1">{pontosAzul} pts | {vantagensAzul} vant. | {punicoesAzul} pun.</p>
                  </div>
                  <div className="p-4 bg-red-950/30">
                    <p className="font-black text-red-300 uppercase truncate">{atletaVermelho || 'Atleta Vermelho'}</p>
                    <p className="text-zinc-400 mt-1">{pontosVermelho} pts | {vantagensVermelho} vant. | {punicoesVermelho} pun.</p>
                  </div>
                </div>
              </div>

              <button onClick={() => { setShowResumo(false); setConfigOpen(true); }} className="cursor-pointer w-full mt-8 bg-white hover:bg-zinc-200 text-black py-4 rounded-xl font-black uppercase tracking-widest transition-colors shadow-xl">
                Preparar Próxima Luta
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}