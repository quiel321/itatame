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
  // OCULTAR A BARRA DE NAVEGAÇÃO GLOBAL
  // ==========================================
  useEffect(() => {
    document.body.classList.add('ocultar-nav-global');
    document.documentElement.classList.add('ocultar-nav-global');
    return () => {
      document.body.classList.remove('ocultar-nav-global');
      document.documentElement.classList.remove('ocultar-nav-global');
    };
  }, []);

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
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.8, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 3.0);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 3.0);
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

      // CÁLCULO AUTOMÁTICO DO VENCEDOR (Regras do Jiu-Jitsu)
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

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .ocultar-nav-global header:not(.header-placar),
        .ocultar-nav-global nav { display: none !important; }
        .ocultar-nav-global body > div, .ocultar-nav-global body > main, .ocultar-nav-global #__next { padding-top: 0 !important; margin-top: 0 !important; height: 100vh; overflow: hidden; }
      `}} />

      <div ref={placarRef} className="bg-black h-screen w-screen flex flex-row font-sans select-none text-white relative overflow-hidden">

        {/* ========================================== */}
        {/* MODAL DE CONFIGURAÇÃO                      */}
        {/* ========================================== */}
        {configOpen && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-[#111] border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
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
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center">
          <div className="bg-[#09090b]/95 backdrop-blur-xl px-6 py-4 md:px-10 md:py-6 rounded-[2rem] border border-zinc-800 shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col items-center transition-all duration-700">
            
            <span className={`text-[5rem] md:text-[6rem] lg:text-[7rem] leading-none font-black font-mono tracking-tighter drop-shadow-[0_0_25px_rgba(255,215,0,0.6)] text-[#FFD700] ${tempoRestante <= 60 && tempoRestante > 0 ? 'animate-pulse' : ''}`}>
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
                <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button onClick={toggleFullscreen} className="cursor-pointer w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-transform active:scale-95 border border-white/5">
                <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  {isFullscreen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  )}
                </svg>
              </button>
            </div>

            <div className="mt-4 opacity-60">
              <span className="text-white font-black text-xs md:text-sm italic tracking-widest pointer-events-none">
                <span className="text-red-600">i</span>TATAME
              </span>
            </div>
            
          </div>
        </div>

        {/* ========================================== */}
        {/* LADO AZUL                                  */}
        {/* ========================================== */}
        <div className={`w-1/2 h-full bg-[#05142b] border-r-[2px] border-black flex flex-col pt-6 md:pt-10 px-6 md:px-8 pb-6 relative z-10 transition-all duration-1000 ${vencedor === 'vermelho' ? 'opacity-20 grayscale' : vencedor === 'azul' ? 'brightness-125' : ''}`}>
          
          {vencedor === 'azul' && (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="bg-black/90 px-8 py-4 md:px-12 md:py-6 rounded-[3rem] border-4 border-blue-500 shadow-[0_0_100px_rgba(59,130,246,0.8)] -rotate-12 animate-pulse">
                <span className="text-blue-400 font-black text-5xl md:text-7xl lg:text-[7rem] uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(59,130,246,1)]">🏆 Venceu</span>
              </div>
            </div>
          )}

          {/* ADICIONADO shrink-0, pt-2 e leading-normal PARA IMPEDIR O CORTE */}
          <div className="w-full text-left pr-4 md:pr-8 shrink-0 pt-2">
            <h2 title={atletaAzul || "ATLETA AZUL"} className="text-3xl md:text-5xl lg:text-[3.8rem] xl:text-[3.77rem] leading-normal pb-2 font-black uppercase text-white truncate drop-shadow-md w-full block">
              {atletaAzul || "ATLETA AZUL"}
            </h2>
          </div>
          
          {/* ADICIONADO min-h-[0] para organizar a flexbox interna do número */}
          <div className="flex-1 flex items-center justify-center w-full min-h-[0]">
            <span className="text-[10rem] md:text-[14rem] lg:text-[15rem] font-black text-white leading-none tracking-tighter drop-shadow-lg">
              {pontosAzul}
            </span>
          </div>

          {/* ADICIONADO shrink-0 PARA O PAINEL DE CONTROLES */}
          <div className="flex flex-col gap-4 md:gap-6 w-full max-w-[600px] mx-auto mt-4 shrink-0">
            <div className="grid grid-cols-4 gap-3 md:gap-4">
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

            <div className="flex justify-between gap-4 md:gap-6">
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
        <div className={`w-1/2 h-full bg-[#2f0404] border-l border-black flex flex-col pt-6 md:pt-10 px-6 md:px-8 pb-6 relative z-10 transition-all duration-1000 ${vencedor === 'azul' ? 'opacity-20 grayscale' : vencedor === 'vermelho' ? 'brightness-125' : ''}`}>
          
          {vencedor === 'vermelho' && (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="bg-black/90 px-8 py-4 md:px-12 md:py-6 rounded-[3rem] border-4 border-red-500 shadow-[0_0_100px_rgba(239,68,68,0.8)] -rotate-12 animate-pulse">
                <span className="text-red-500 font-black text-5xl md:text-7xl lg:text-[7rem] uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(239,68,68,1)]">🏆 Venceu</span>
              </div>
            </div>
          )}

          {/* ADICIONADO shrink-0, pt-2 e leading-normal PARA IMPEDIR O CORTE */}
          <div className="w-full text-right pl-4 md:pl-8 shrink-0 pt-2">
            <h2 title={atletaVermelho || "ATLETA VERMELHO"} className="text-3xl md:text-5xl lg:text-[3.8rem] xl:text-[3.77rem] leading-normal pb-2 font-black uppercase text-white truncate drop-shadow-md w-full block">
              {atletaVermelho || "ATLETA VERMELHO"}
            </h2>
          </div>
          
          <div className="flex-1 flex items-center justify-center w-full min-h-[0]">
            <span className="text-[10rem] md:text-[14rem] lg:text-[15rem] font-black text-white leading-none tracking-tighter drop-shadow-lg">
              {pontosVermelho}
            </span>
          </div>

          <div className="flex flex-col gap-4 md:gap-6 w-full max-w-[600px] mx-auto mt-4 shrink-0">
            <div className="grid grid-cols-4 gap-3 md:gap-4">
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

            <div className="flex justify-between gap-4 md:gap-6">
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
            <div className="bg-[#0c1220] border border-white/10 rounded-3xl p-8 w-full max-w-4xl shadow-[0_0_80px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-10 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Fim de Combate</h2>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm mt-1">Estatísticas Oficiais</p>
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* Resumo Azul - Borda destaca se foi campeão */}
                <div className={`bg-[#05142b]/80 border ${vencedor === 'azul' ? 'border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)]' : 'border-blue-500/30'} rounded-2xl p-6 relative overflow-hidden transition-all`}>
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                  <h3 className="text-xl font-black text-white uppercase truncate mb-4">{vencedor === 'azul' && "🏆 "} {atletaAzul || "ATLETA AZUL"}</h3>
                  <div className="text-6xl font-black text-blue-500 mb-6 drop-shadow-md">{pontosAzul} <span className="text-lg text-zinc-500 tracking-widest uppercase">Pts</span></div>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-zinc-400">Montadas / Costas:</span> <span className="text-white bg-blue-600 px-2 py-0.5 rounded">{stats.azul.montadas}</span></li>
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-zinc-400">Passagens de Guarda:</span> <span className="text-white bg-blue-600 px-2 py-0.5 rounded">{stats.azul.passagens}</span></li>
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-zinc-400">Quedas / Rasp / Joelho:</span> <span className="text-white bg-blue-600 px-2 py-0.5 rounded">{stats.azul.quedas}</span></li>
                    <li className="flex justify-between items-center text-sm font-bold pt-3 border-t border-white/10"><span className="text-yellow-500">Vantagens:</span> <span className="text-yellow-500">{vantagensAzul}</span></li>
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-red-500">Punições:</span> <span className="text-red-500">{punicoesAzul}</span></li>
                  </ul>
                </div>

                {/* Resumo Vermelho - Borda destaca se foi campeão */}
                <div className={`bg-[#2f0404]/80 border ${vencedor === 'vermelho' ? 'border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)]' : 'border-red-500/30'} rounded-2xl p-6 relative overflow-hidden transition-all`}>
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                  <h3 className="text-xl font-black text-white uppercase truncate mb-4">{vencedor === 'vermelho' && "🏆 "} {atletaVermelho || "ATLETA VERMELHO"}</h3>
                  <div className="text-6xl font-black text-red-500 mb-6 drop-shadow-md">{pontosVermelho} <span className="text-lg text-zinc-500 tracking-widest uppercase">Pts</span></div>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-zinc-400">Montadas / Costas:</span> <span className="text-white bg-red-600 px-2 py-0.5 rounded">{stats.vermelho.montadas}</span></li>
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-zinc-400">Passagens de Guarda:</span> <span className="text-white bg-red-600 px-2 py-0.5 rounded">{stats.vermelho.passagens}</span></li>
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-zinc-400">Quedas / Rasp / Joelho:</span> <span className="text-white bg-red-600 px-2 py-0.5 rounded">{stats.vermelho.quedas}</span></li>
                    <li className="flex justify-between items-center text-sm font-bold pt-3 border-t border-white/10"><span className="text-yellow-500">Vantagens:</span> <span className="text-yellow-500">{vantagensVermelho}</span></li>
                    <li className="flex justify-between items-center text-sm font-bold"><span className="text-red-500">Punições:</span> <span className="text-red-500">{punicoesVermelho}</span></li>
                  </ul>
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