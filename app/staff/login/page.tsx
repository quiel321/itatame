'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, Key, Lock, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function StaffLogin() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // HACK PARA ESCONDER NAVBAR GLOBAL
  useEffect(() => {
    document.body.classList.add('hide-global-nav');
    return () => document.body.classList.remove('hide-global-nav');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setErro('Digite o código de acesso.');
      return;
    }

    setLoading(true);
    setErro('');

    // 1. Checa se o PIN existe e é válido
    const { data: staffData, error } = await supabase
      .from('staff_eventos')
      .select('*, eventos(nome)')
      .eq('pin_acesso', pin.trim().toUpperCase())
      .single();

    if (error || !staffData) {
      setErro('Código inválido ou não encontrado.');
      setLoading(false);
      return;
    }

    // =========================================================
    // 2. A MÁGICA DA SEGURANÇA: Criar uma Sessão Autenticada
    // =========================================================
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    
    if (authError) {
       setErro('Falha na autenticação segura. Contate o suporte.');
       setLoading(false);
       return;
    }

    // 3. Salvar os dados locais para a interface saber quem é o cara
    const sessaoStaff = {
      id: staffData.id,
      evento_id: staffData.evento_id,
      funcao: staffData.funcao,
      identificacao: staffData.identificacao,
      evento_nome: staffData.eventos?.nome,
      user_id: authData.user?.id // Guarda a chave gerada pelo banco
    };
    
    localStorage.setItem('itatame_staff_session', JSON.stringify(sessaoStaff));

    // 4. Redirecionar para o posto correto
    if (staffData.funcao === 'checkin') {
      router.push('/staff/checkin');
    } else if (staffData.funcao === 'mesario') {
      router.push('/staff/painel'); // Ajustei a rota para a o painel do mesário
    } else {
      setErro('Função de staff desconhecida.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] flex justify-center p-4 py-8 md:p-8 relative overflow-x-hidden font-sans">
      
      {/* EFEITOS DE LUZ NO FUNDO */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-900/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-[850px] my-auto flex flex-col md:flex-row bg-[#0a0a0e]/90 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] relative z-10">
        
        {/* LADO ESQUERDO: O MANIFESTO DO STAFF */}
        <div className="flex flex-col justify-center md:justify-between w-full md:w-1/2 p-6 md:p-8 lg:p-10 relative overflow-hidden bg-gradient-to-br from-[#0a0a0e] to-black border-b md:border-b-0 md:border-r border-white/5">
          {/* RESOLVIDO O ERRO DO BACKGROUND AQUI */}
          <div 
            className="absolute inset-0 opacity-5 pointer-events-none" 
            style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }}
          ></div>
          
          <div className="relative z-10 flex items-center justify-between md:items-start md:flex-col gap-4">
            <div>
              <h1 className="text-white font-black text-2xl md:text-3xl italic tracking-tighter mb-1 cursor-default leading-none">
                <span className="text-red-600">i</span>TATAME
              </h1>
              <span className="text-red-500 text-[8px] font-black uppercase tracking-widest block border border-red-500/30 bg-red-500/10 px-2 py-1 rounded w-max cursor-default mt-1">
                Equipe Oficial
              </span>
            </div>

            {/* SELO DE SEGURANÇA COMPACTO PARA O MOBILE */}
            <div className="md:hidden flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg">
               <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
               <span className="text-[8px] uppercase tracking-widest font-bold text-zinc-400 mt-0.5">Acesso Restrito</span>
            </div>
          </div>

          <div className="relative z-10 mt-5 md:mt-8 cursor-default">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white leading-[1.1] mb-2 md:mb-3 tracking-tight">
              O motor que faz o evento <span className="text-red-600">acontecer.</span>
            </h2>
            <p className="text-zinc-400 md:text-zinc-500 text-[10px] md:text-[11px] leading-relaxed max-w-sm font-medium">
              Acesso exclusivo para Mesários e Equipe de Check-in. Insira o código PIN de segurança fornecido pelo organizador para assumir o seu posto.
            </p>
          </div>

          <div className="hidden md:flex relative z-10 mt-10 cursor-default">
             <p className="text-zinc-600 text-[9px] uppercase font-bold tracking-widest flex items-center gap-2">
               <Lock className="w-3.5 h-3.5 text-zinc-500" />
               Ambiente Seguro Operacional
             </p>
          </div>
        </div>

        {/* LADO DIREITO: ÁREA DE LOGIN */}
        <div className="w-full md:w-1/2 p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-black/60 relative">
          
          <div className="text-center md:text-left mb-6">
            <h3 className="text-xl md:text-2xl font-black text-white tracking-tight mb-1">Entrar no Posto</h3>
            <p className="text-zinc-500 text-[10px] md:text-xs font-bold uppercase tracking-widest">
              Identificação via PIN
            </p>
          </div>

          {erro && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 animate-in fade-in shadow-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-red-400 text-[10px] md:text-xs font-bold leading-tight">{erro}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in">
            <div>
              <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block mb-1.5 ml-1">Código de Acesso</label>
              <div className="relative cursor-text">
                <Key className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  required 
                  value={pin} 
                  onChange={(e) => setPin(e.target.value.toUpperCase())} 
                  placeholder="EX: TAT001" 
                  className="w-full bg-[#050505] border border-white/10 rounded-lg pl-10 pr-3 py-3 outline-none focus:border-red-600 text-white transition-colors text-sm font-black tracking-widest placeholder:text-zinc-700 placeholder:font-medium placeholder:tracking-normal shadow-inner uppercase" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="cursor-pointer w-full mt-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] flex items-center justify-center gap-2 text-[10px] md:text-xs active:scale-95"
            >
              {loading ? "Verificando..." : "Acessar Sistema"} <ArrowRight size={16} />
            </button>
          </form>

          {/* ROTA DE FUGA */}
          <div className="mt-8 pt-4 border-t border-white/5 text-center md:text-left">
            <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest cursor-default">
              É um organizador de evento?
            </p>
            <Link href="/admin/login" className="cursor-pointer inline-block mt-1.5 text-zinc-400 hover:text-red-500 text-[10px] font-bold transition-colors">
              Ir para o Portal do Organizador →
            </Link>
          </div>

        </div>
      </div>
    </main>
  );
}