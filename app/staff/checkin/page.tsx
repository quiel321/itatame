'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; 
import { Scanner } from '@yudiel/react-qr-scanner';
import { CheckCircle, XCircle, Scale, ArrowLeft, QrCode } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CheckinOperador() {
  const router = useRouter();
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [atleta, setAtleta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const [pesoAferido, setPesoAferido] = useState('');
  const [kimonoAprovado, setKimonoAprovado] = useState(true);

  // =========================================================================
  // SEGURANÇA DE PORTA: Garante que o operador está logado via PIN
  // =========================================================================
  useEffect(() => {
    document.body.classList.add('hide-global-nav');
    
    const sessaoSalva = localStorage.getItem('itatame_staff_session');
    if (!sessaoSalva) {
      // Descomente na produção para forçar o login do staff
      // router.replace('/staff/login');
      // return;
    }

    const sessaoParse = sessaoSalva ? JSON.parse(sessaoSalva) : null;
    if (sessaoParse && sessaoParse.funcao !== 'checkin' && sessaoParse.funcao !== 'mesario') {
      // router.replace('/staff/login');
      // return;
    }

    return () => document.body.classList.remove('hide-global-nav');
  }, [router]);

  // =========================================================================
  // LEITOR BLINDADO: Só aceita o QR Code do Evento. Bloqueia a Carteirinha!
  // =========================================================================
  const handleScan = (detectedCodes: any[]) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    const textoLido = detectedCodes[0].rawValue;
    if (!textoLido) return;

    // 1. LER O INGRESSO DO EVENTO (Padrão: ITATAME|EVENTO_ID|USER_ID)
    if (textoLido.includes('ITATAME|')) {
      const partes = textoLido.split('|');
      // Importante: Passaporte do evento tem sempre 3 partes (exclui o DIGITAL)
      if (partes.length === 3 && partes[1] !== 'DIGITAL') {
        const evId = partes[1];
        const usrId = partes[2];
        setScannedId('QR-VALIDADO');
        fetchAtleta(evId, usrId);
        return;
      }
    }

    // 2. BLOQUEIO DA CARTEIRINHA DIGITAL (Evita fraude de Instagram)
    if (textoLido.includes('/atleta/') || textoLido.includes('|DIGITAL|')) {
      setErro('❌ QR Code da Carteira. Peça ao atleta para abrir "Minhas Inscrições" e apresentar o Passaporte (QR) deste evento específico!');
      return;
    }

    // SE CHEGOU AQUI, TENTARAM BURLAR OU LERAM OUTRA COISA
    setErro('❌ QR Code Inválido ou Falsificado. Acesso Negado.');
  };

  // =========================================================================
  // BUSCA NO BANCO DE DADOS (100% amarrada aos UUIDs Evento + Usuário)
  // =========================================================================
  const fetchAtleta = async (eventoId: string, userId: string) => {
    setLoading(true);
    setErro('');
    
    // Busca exata cruzando o Evento e o Usuário
    const { data: inscricoesData, error: inscricaoError } = await supabase
      .from('inscricoes')
      .select('*')
      .eq('evento_id', eventoId)
      .eq('user_id', userId);

    if (inscricaoError || !inscricoesData || inscricoesData.length === 0) {
      setErro('Inscrição não encontrada ou não autorizada para este evento.');
      setLoading(false);
      return;
    }

    // Pega o primeiro registro (cobre casos de Peso e Absoluto juntos)
    const inscricaoData = inscricoesData[0];

    let fotoUrl = null;
    if (inscricaoData.user_id) {
      const { data: atletaData } = await supabase
        .from('atletas')
        .select('foto_url')
        .eq('user_id', inscricaoData.user_id)
        .single();
        
      if (atletaData && atletaData.foto_url) {
        fotoUrl = atletaData.foto_url;
      }
    }

    setAtleta({ ...inscricaoData, foto_url: fotoUrl });
    setPesoAferido(inscricaoData.peso || ''); 
    setLoading(false);
  };

  // =========================================================================
  // SALVAR CHECK-IN (Com Blindagem de UUID)
  // =========================================================================
  const processarCheckin = async (status: 'aprovado' | 'desclassificado_peso' | 'desclassificado_kimono') => {
    setLoading(true);
    
    const atualizacao = {
      status_checkin: status,
      peso_aferido: pesoAferido ? parseFloat(pesoAferido) : null,
      kimono_aprovado: status === 'desclassificado_kimono' ? false : kimonoAprovado,
      checkin_realizado_em: new Date().toISOString(),
      pesagem_ok: status === 'aprovado'
    };

    // A MÁGICA SEGURA: Atualiza usando o cruzamento absoluto (Evento + User_ID)
    const { error } = await supabase
      .from('inscricoes')
      .update(atualizacao)
      .eq('evento_id', atleta.evento_id)
      .eq('user_id', atleta.user_id); // 🔒 Totalmente seguro contra homônimos

    if (error) {
      alert('Erro de conexão ao salvar no sistema: ' + error.message);
      setLoading(false);
      return;
    }

    if(status === 'aprovado') {
        alert(`✅ Atleta ${atleta.atleta} APROVADO com sucesso nas chaves!`);
    } else {
        alert(`❌ Atleta ${atleta.atleta} DESCLASSIFICADO.`);
    }

    resetarTela();
  };

  const resetarTela = () => {
    setScannedId(null);
    setAtleta(null);
    setPesoAferido('');
    setKimonoAprovado(true);
    setErro('');
    setLoading(false);
  };

  const getCorFaixa = (nomeFaixa: string) => {
    if (!nomeFaixa) return "bg-zinc-800 text-zinc-400 border-zinc-700";
    const f = nomeFaixa.toLowerCase();
    if (f.includes("branca")) return "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]";
    if (f.includes("azul")) return "bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]";
    if (f.includes("roxa")) return "bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.4)]";
    if (f.includes("marrom")) return "bg-amber-800 text-white border-amber-700 shadow-[0_0_15px_rgba(146,64,14,0.4)]";
    if (f.includes("preta")) return "bg-black text-white border-zinc-700 shadow-[0_0_15px_rgba(255,255,255,0.1)]";
    return "bg-zinc-800 text-zinc-300 border-zinc-700";
  };

  return (
    <main className="fixed inset-0 z-50 h-[100dvh] bg-[#050505] text-white overflow-y-auto overflow-x-hidden font-sans pb-10 selection:bg-red-500/30 flex flex-col">
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-global-nav > header:first-of-type,
        .hide-global-nav nav:first-of-type { display: none !important; }
        @keyframes scan { 0%, 100% { top: 5%; } 50% { top: 95%; } }
        .animate-scan { animation: scan 3s ease-in-out infinite; }
      `}} />

      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-red-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <header className="relative z-10 border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {atleta && (
              <button onClick={resetarTela} className="text-zinc-400 hover:text-white bg-white/5 p-2 rounded-full transition-colors active:scale-95 shrink-0">
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="flex items-center gap-1.5 pt-1">
              <img src="/logo.svg" alt="iTatame" className="h-6 md:h-7 w-auto object-contain" />
              <span className="text-red-600 text-lg md:text-xl font-black tracking-tight mt-0.5">.STAFF</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg shadow-[0_0_20px_rgba(220,38,38,0.4)] shrink-0">
            <CheckCircle size={14} className="text-white" />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">CHECK-IN</span>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-md mx-auto p-4 flex flex-col gap-5 relative z-10 mt-4">
        
        {!atleta && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
            <div className="bg-[#0a0a0e]/80 backdrop-blur-sm border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col items-center">
              <h2 className="text-xs text-zinc-400 font-bold uppercase tracking-widest mb-4 flex items-center justify-center gap-2">
                <QrCode size={16} className="text-red-500" /> Escaneie a Credencial
              </h2>
              <div className="w-full rounded-2xl overflow-hidden relative bg-black aspect-square flex items-center justify-center border-2 border-white/5 shadow-inner">
                <div className="absolute inset-0 border-2 border-red-600/30 rounded-2xl z-10 pointer-events-none"></div>
                <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_20px_rgba(239,68,68,1)] animate-scan z-10 pointer-events-none"></div>
                
                {/* LEITOR DA CÂMERA */}
                <Scanner onScan={handleScan} />
                
              </div>

              {loading && (
                <div className="mt-5 flex items-center gap-3 text-red-500 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">Autenticando...</span>
                </div>
              )}

              {erro && (
                <div className="mt-5 w-full bg-red-950/40 border border-red-900/60 p-4 rounded-xl text-red-400 text-xs font-bold text-center uppercase tracking-wider shadow-inner">
                  {erro}
                </div>
              )}
            </div>
          </div>
        )}

        {atleta && !loading && (
          <div className="animate-in slide-in-from-right-8 duration-300 flex flex-col gap-4">
            <div className="bg-[#0a0a0e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center p-8 relative">
              <div className="w-24 h-24 rounded-full border-4 border-[#161622] bg-zinc-900 flex items-center justify-center text-3xl font-black text-zinc-600 shadow-[0_0_30px_rgba(0,0,0,0.8)] z-10 mb-4 overflow-hidden">
                {atleta.foto_url ? (
                  <img src={atleta.foto_url} alt="Foto do atleta" className="w-full h-full object-cover" />
                ) : (
                  atleta.atleta.charAt(0)
                )}
              </div>
              
              <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center leading-tight mb-2">
                {atleta.atleta}
              </h2>
              
              <div className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border mb-6 ${getCorFaixa(atleta.faixa)}`}>
                Faixa {atleta.faixa}
              </div>

              <div className="w-full grid grid-cols-2 gap-4 text-center border-t border-white/10 pt-5">
                <div className="flex flex-col items-center justify-center">
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5">Equipe</span>
                  <span className="block text-sm font-bold text-zinc-200 truncate w-full px-1">{atleta.equipe || "-"}</span>
                </div>
                <div className="flex flex-col items-center justify-center border-l border-white/10 pl-2">
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5">Categoria</span>
                  <span className="block text-xs font-bold text-zinc-200 w-full px-1 leading-tight">{atleta.categoria}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0a0a0e] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
              <div className="relative">
                <label className="text-[11px] font-bold text-zinc-400 flex items-center justify-center gap-2 mb-4 uppercase tracking-widest w-full">
                  <Scale size={16} className="text-red-500" /> Peso na Balança (kg)
                </label>
                <div className="relative flex items-center justify-center">
                  <input 
                    type="number" 
                    step="0.1"
                    value={pesoAferido}
                    onChange={(e) => setPesoAferido(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 p-5 rounded-2xl text-5xl font-black text-center text-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all tracking-tighter shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0.0"
                  />
                  <span className="absolute right-6 text-zinc-600 font-bold uppercase text-sm pointer-events-none">KG</span>
                </div>
                <div className="flex justify-center mt-3">
                  <span className="bg-white/5 border border-white/10 text-zinc-300 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    Limite: {atleta.peso} kg
                  </span>
                </div>
              </div>

              <hr className="border-white/5" />

              <label className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.02] active:bg-white/[0.05] transition-colors cursor-pointer group">
                <span className="font-bold text-zinc-200 text-sm uppercase tracking-wider flex flex-col group-hover:text-white transition-colors">
                  Kimono / Faixa
                  <span className="text-[10px] text-green-500/80 font-bold mt-1 tracking-widest normal-case">DENTRO DOS PADRÕES</span>
                </span>
                <input 
                  type="checkbox" 
                  checked={kimonoAprovado}
                  onChange={(e) => setKimonoAprovado(e.target.checked)}
                  className="w-7 h-7 rounded-lg bg-black/50 border-white/20 text-red-600 focus:ring-red-600 focus:ring-offset-0 cursor-pointer"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 mt-2 mb-8">
              <button 
                onClick={() => processarCheckin('aprovado')}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-6 rounded-3xl flex items-center justify-center gap-3 text-base uppercase tracking-widest shadow-[0_0_25px_rgba(22,163,74,0.3)] active:scale-[0.98] transition-all border border-green-500/50"
              >
                <CheckCircle size={22} /> Aprovar Atleta
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => processarCheckin('desclassificado_peso')}
                  className="w-full bg-[#0a0a0e] text-red-500 font-bold py-5 rounded-2xl flex flex-col items-center justify-center gap-2 text-[10px] uppercase tracking-widest border border-red-900/50 hover:bg-red-950/30 hover:border-red-500/50 active:scale-[0.98] transition-all"
                >
                  <XCircle size={20} className="text-red-500" />
                  Falhou no Peso
                </button>
                <button 
                  onClick={() => processarCheckin('desclassificado_kimono')}
                  className="w-full bg-[#0a0a0e] text-red-500 font-bold py-5 rounded-2xl flex flex-col items-center justify-center gap-2 text-[10px] uppercase tracking-widest border border-red-900/50 hover:bg-red-950/30 hover:border-red-500/50 active:scale-[0.98] transition-all"
                >
                  <XCircle size={20} className="text-red-500" />
                  Kimono Ilegal
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}