"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; 

export default function PPVLandingPage() {
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [pixGerado, setPixGerado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [qrCodeMP, setQrCodeMP] = useState("");
  const [copiaECola, setCopiaECola] = useState("");
  
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [erro, setErro] = useState("");

  // TRUQUE PARA OCULTAR A NAVBAR PRINCIPAL E O ESPAÇAMENTO DO LAYOUT
  useEffect(() => {
    document.body.classList.add('ocultar-nav-global');
    document.documentElement.classList.add('ocultar-nav-global');
    return () => {
      document.body.classList.remove('ocultar-nav-global');
      document.documentElement.classList.remove('ocultar-nav-global');
    };
  }, []);

  const handleGerarPix = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro("");

    const tokenSeguro = "tk_" + Math.random().toString(36).substring(2, 10);

    try {
      const mpResponse = await fetch('/api/gerar-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nome, tokenOriginal: tokenSeguro })
      });
      
      const mpData = await mpResponse.json();
      
      if (!mpData.success) throw new Error("Falha ao gerar o Pix. Tente novamente.");

      const { error } = await supabase
        .from('ppv_acessos')
        .upsert({
          email: email,
          whatsapp: whatsapp,
          token: tokenSeguro,
          status: 'pendente' 
        }, { onConflict: 'email' });

      if (error) throw new Error("Erro ao salvar pedido: " + error.message);

      fetch('/api/enviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nome, token: tokenSeguro })
      }).catch(err => console.log("Aviso: falha ao disparar e-mail", err));

      setQrCodeMP(mpData.qrCodeBase64);
      setCopiaECola(mpData.qrCodeCopiaECola);
      setPixGerado(true);

    } catch (err: any) {
      setErro(err.message || "Erro desconhecido ao gerar pedido.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] font-sans selection:bg-cyan-500/30 overflow-hidden relative">
      
      {/* INJEÇÃO DE CSS DE ALTO IMPACTO (HACK) */}
      <style dangerouslySetInnerHTML={{__html: `
        /* 1. Oculta o header e a nav global (exceto a nossa) */
        .ocultar-nav-global header,
        .ocultar-nav-global nav:not(.nav-exclusiva-ppv) {
          display: none !important;
        }
        
        /* 2. Remove o espaço preto (padding-top/margin-top) deixado pelo layout.tsx global */
        .ocultar-nav-global body > div,
        .ocultar-nav-global body > main,
        .ocultar-nav-global #__next {
          padding-top: 0 !important;
          margin-top: 0 !important;
        }
      `}} />

      {/* LUZES DE FUNDO ANIMADAS (ATMOSFERA) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/20 blur-[120px] rounded-full pointer-events-none animate-pulse mix-blend-screen" style={{ animationDuration: '4s' }}></div>
      <div className="absolute top-[40%] right-[-10%] w-[30%] h-[50%] bg-yellow-600/10 blur-[150px] rounded-full pointer-events-none mix-blend-screen"></div>

      {/* NAVBAR EXCLUSIVA DO PPV */}
      <nav className="nav-exclusiva-ppv w-full border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.location.href = "/"}>
            <span className="text-white font-black text-xl italic tracking-tighter transition-transform group-hover:scale-105">
              <span className="text-red-600">i</span>TATAME
            </span>
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest ml-2 border-l border-zinc-700 pl-2 group-hover:text-zinc-300 transition-colors">
              Pay-Per-View
            </span>
          </div>
          <button onClick={() => setCheckoutAberto(true)} className="hidden md:block cursor-pointer bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black uppercase tracking-wider text-[10px] px-5 py-2.5 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(234,179,8,0.4)] active:scale-95">
            Comprar Acesso — R$ 7,99
          </button>
        </div>
      </nav>

      {/* HERO SECTION COMPACTADA */}
      <main className="max-w-6xl mx-auto px-6 pt-10 md:pt-16 pb-16 grid md:grid-cols-2 gap-8 md:gap-12 items-center relative z-10">
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 w-fit px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping absolute"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 relative"></span>
            Transmissão Oficial Ao Vivo
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight drop-shadow-xl mt-2">
            COPA <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 bg-[length:200%_auto] animate-gradient">
              iTATAME OPEN
            </span>
          </h1>
          
          <div className="grid grid-cols-2 gap-3 mt-1 text-white">
             <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors duration-300 cursor-default group">
              <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest block mb-0.5 group-hover:text-cyan-400 transition-colors">Data do Evento</span>
              <span className="font-black text-base tracking-tight">15 de Agosto</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors duration-300 cursor-default group">
              <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest block mb-0.5 group-hover:text-cyan-400 transition-colors">Sede Oficial</span>
              <span className="font-black text-base tracking-tight">Campos de Júlio</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#1a1500] to-transparent border border-yellow-500/20 rounded-2xl p-5 md:p-6 mt-2 relative overflow-hidden group hover:border-yellow-500/40 transition-colors duration-500 max-w-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-[40px] group-hover:bg-yellow-500/20 transition-colors duration-700"></div>
            
            <span className="text-yellow-500 text-[9px] font-black uppercase tracking-widest block mb-1">Acesso Virtual Completo</span>
            <div className="text-4xl font-black text-white mb-5 drop-shadow-md">R$ 7,99</div>
            
            <button onClick={() => setCheckoutAberto(true)} className="w-full cursor-pointer bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black uppercase tracking-widest py-3.5 rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.4)] hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2 text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"></path></svg>
              Garantir Acesso
            </button>
          </div>
        </div>

        {/* PÔSTER INTERATIVO (FORMATO QUADRADO COM A ARTE OFICIAL) */}
        <div className="relative hidden md:block">
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-blue-600/10 blur-[60px] rounded-full mix-blend-screen"></div>
          <div className="relative bg-zinc-900/50 backdrop-blur-sm border border-white/10 p-2.5 rounded-[2rem] shadow-2xl rotate-2 hover:rotate-0 transition-all duration-700 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] group max-w-[340px] mx-auto">
            <div className="w-full aspect-square bg-black rounded-[1.5rem] border border-white/5 overflow-hidden relative">
                {/* 🔴 AQUI ESTÁ O LINK DO BANNER APLICADO */}
                <img src="https://i.postimg.cc/tJc325Zv/copa-open.png" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-transform duration-700 group-hover:scale-105" alt="Copa iTatame Open" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
            </div>
          </div>
        </div>
      </main>

      {/* CRONOGRAMA OFICIAL COMPACTO */}
      <section className="bg-black/40 py-16 border-t border-white/5 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-center gap-6 mb-12">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10"></div>
            <h2 className="text-white text-lg md:text-2xl font-black uppercase tracking-widest text-center">Cronograma de Transmissão</h2>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10"></div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#0a0a0e] border border-white/5 rounded-2xl p-6 shadow-xl transition-all duration-500 hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-[0_10px_30px_-10px_rgba(6,182,212,0.2)] group cursor-default">
              <div className="text-white font-black uppercase tracking-wider text-xs mb-6 flex items-center gap-3">
                <span className="bg-cyan-500 w-2 h-6 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)] group-hover:h-8 transition-all"></span> 
                <div>
                  <div className="text-zinc-500 text-[9px]">MANHÃ E TARDE</div>
                  Categorias de Peso
                </div>
              </div>
              <ul className="space-y-4 text-xs text-zinc-400 font-medium">
                <li className="flex gap-3 items-start"><span className="text-cyan-500 font-bold mt-0.5">•</span> <div><strong className="text-white block mb-0.5">09:00h - Categorias de Base</strong> Mirim ao Infanto-Juvenil</div></li>
                <li className="flex gap-3 items-start"><span className="text-cyan-500 font-bold mt-0.5">•</span> <div><strong className="text-white block mb-0.5">11:30h - Juvenil e Master</strong> Disputas eliminatórias e finais</div></li>
                <li className="flex gap-3 items-start"><span className="text-cyan-500 font-bold mt-0.5">•</span> <div><strong className="text-white block mb-0.5">14:00h - Adulto (Branca a Roxa)</strong> Chaves oficiais do peso</div></li>
              </ul>
            </div>

            <div className="bg-[#0a0a0e] border border-white/5 rounded-2xl p-6 shadow-xl transition-all duration-500 hover:-translate-y-1 hover:border-yellow-500/30 hover:shadow-[0_10px_30px_-10px_rgba(234,179,8,0.2)] group cursor-default">
              <div className="text-white font-black uppercase tracking-wider text-xs mb-6 flex items-center gap-3">
                <span className="bg-yellow-500 w-2 h-6 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)] group-hover:h-8 transition-all"></span> 
                <div>
                  <div className="text-zinc-500 text-[9px]">HORÁRIO NOBRE</div>
                  Elite & Absoluto
                </div>
              </div>
              <ul className="space-y-4 text-xs text-zinc-400 font-medium">
                <li className="flex gap-3 items-start"><span className="text-yellow-500 font-bold mt-0.5">•</span> <div><strong className="text-white block mb-0.5">17:00h - Elite Adulto</strong> Eliminatórias Faixa Marrom e Preta</div></li>
                <li className="flex gap-3 items-start"><span className="text-yellow-500 font-bold mt-0.5">•</span> <div><strong className="text-white block mb-0.5">19:00h - Disputa do Absoluto</strong> O choque dos melhores no tatame central</div></li>
                <li className="flex gap-3 items-start"><span className="text-yellow-500 font-bold mt-0.5">•</span> <div><strong className="text-white block mb-0.5">21:30h - Cerimônia de Premiação</strong> Entrega de medalhas e encerramento</div></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL COMPACTO */}
      <section className="py-16 md:py-20 relative overflow-hidden flex flex-col items-center text-center px-6 z-10">
        <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 to-transparent"></div>
        <div className="relative z-10 max-w-3xl flex flex-col items-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight uppercase drop-shadow-lg leading-tight">
            O Maior Evento <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">Em Qualquer Tela</span>
          </h2>
          <p className="text-zinc-400 text-sm md:text-base mb-6 max-w-xl mx-auto font-medium">
            Assista de onde estiver — celular, tablet, computador ou Smart TV — com qualidade premium e sem travamentos.
          </p>

          <div className="flex items-center justify-center gap-2 text-red-500/80 mb-8 text-[9px] font-black uppercase tracking-widest">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <p>Acesso pessoal e intransferível. O compartilhamento bloqueia a transmissão.</p>
          </div>
          
          <button onClick={() => setCheckoutAberto(true)} className="w-full md:w-auto cursor-pointer bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black uppercase tracking-widest text-sm md:text-base px-10 py-4 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] hover:-translate-y-1 active:scale-95 group">
            Comprar Acesso Agora
          </button>
        </div>
      </section>

      {/* MOBILE FLOATING CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#050816] via-[#050816] to-transparent z-40 pointer-events-none">
        <button onClick={() => setCheckoutAberto(true)} className="w-full cursor-pointer bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black uppercase tracking-widest py-3.5 text-xs rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.4)] pointer-events-auto active:scale-95 transition-transform border border-yellow-400/50">
          Comprar Acesso (R$ 7,99)
        </button>
      </div>

      {/* ========================================== */}
      {/* MODAL DE CHECKOUT ENXUTO                   */}
      {/* ========================================== */}
      {checkoutAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300 cursor-pointer"
            onClick={() => { setCheckoutAberto(false); setPixGerado(false); }}
          ></div>

          <div className="relative bg-[#080b16] border border-white/10 w-full max-w-[380px] rounded-[24px] p-6 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-yellow-500/10 blur-[40px] pointer-events-none"></div>

            <button 
              onClick={() => { setCheckoutAberto(false); setPixGerado(false); }}
              className="absolute top-4 right-4 cursor-pointer text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-full z-10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            {!pixGerado ? (
              <>
                <div className="mb-4 bg-white/5 border border-white/10 rounded-xl p-3.5 relative overflow-hidden group">
                  <div className="flex justify-between items-center mb-1.5 relative z-10">
                    <div>
                      <span className="text-yellow-500 text-[9px] font-black uppercase tracking-widest block">Acesso Oficial</span>
                      <h3 className="text-base font-black text-white uppercase leading-tight tracking-tight mt-0.5">Transmissão Ao Vivo</h3>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-[8px] font-black uppercase tracking-widest px-1.5 py-1 rounded flex items-center gap-1 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                      REC
                    </div>
                  </div>
                  
                  <div className="relative z-10 bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] px-2 py-1.5 mt-2.5 rounded-md animate-pulse flex items-center gap-1.5 font-bold uppercase">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <p className="leading-none tracking-wider mt-0.5">Não compartilhe o link, sob pena de derrubar.</p>
                  </div>
                  
                  <div className="flex items-end justify-between relative z-10 mt-3 pt-2.5 border-t border-white/5">
                    <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest mb-0.5">Valor Único</span>
                    <span className="text-xl font-black text-yellow-500 leading-none">R$ 7,99</span>
                  </div>
                </div>

                <form onSubmit={handleGerarPix} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1.5">Nome Completo</label>
                    <input required type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="w-full bg-[#050816] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all placeholder:text-zinc-600 font-medium" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1.5">E-mail (Seu Login)</label>
                    <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="w-full bg-[#050816] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all placeholder:text-zinc-600 font-medium" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1.5">WhatsApp</label>
                    <input required type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" className="w-full bg-[#050816] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all placeholder:text-zinc-600 font-medium" />
                  </div>

                  {erro && <div className="text-red-500 bg-red-500/10 p-2 rounded-lg text-[10px] text-center mb-1">{erro}</div>}

                  <button 
                    disabled={carregando}
                    className="w-full cursor-pointer bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black uppercase tracking-widest py-3 mt-1 rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.2)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-xs"
                  >
                    {carregando ? (
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    ) : (
                      "Gerar Pix Agora"
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center animate-in fade-in slide-in-from-bottom-4 pt-1">
                <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-1.5">Pedido Criado!</h3>
                <p className="text-zinc-400 text-xs mb-5 font-medium px-2">Abra o app do seu banco e escolha a opção "Pix Copia e Cola".</p>
                
                <div className="w-48 h-48 bg-white p-2.5 rounded-2xl mx-auto mb-5 shadow-[0_0_30px_rgba(255,255,255,0.1)] relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-yellow-500 rounded-tl-2xl"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-yellow-500 rounded-tr-2xl"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-yellow-500 rounded-bl-2xl"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-yellow-500 rounded-br-2xl"></div>
                  
                  {qrCodeMP ? (
                    <img src={`data:image/jpeg;base64,${qrCodeMP}`} className="w-full h-full rounded-lg" alt="QR Code PIX" />
                  ) : (
                     <div className="w-full h-full flex items-center justify-center text-black font-bold text-xs">A carregar...</div>
                  )}
                </div>

                {copiaECola && (
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(copiaECola);
                      alert("Código PIX copiado com sucesso!"); 
                    }}
                    className="w-full cursor-pointer bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] py-3 rounded-xl hover:bg-white/10 transition-colors mb-3 active:scale-[0.98] flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    Copiar Código Pix
                  </button>
                )}

                <div className="flex items-center justify-center gap-1.5">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
                  </div>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Aguardando pagamento...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}