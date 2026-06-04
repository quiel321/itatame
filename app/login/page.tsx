"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirecionarPara = searchParams.get("redirect");

  const [isLogin, setIsLogin] = useState(true);
  
  // ESTADOS DO FORMULÁRIO
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cpf, setCpf] = useState("");
  
  // ESTADO PARA DEFINIR O TIPO DE CONTA (ATLETA OU PROFESSOR)
  const [tipoConta, setTipoConta] = useState<"atleta" | "professor">("atleta");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  // MÁSCARA DE CPF
  const formatarCpf = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .substring(0, 14);
  };

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");
    setMensagem("");

    if (isLogin) {
      // ==========================================
      // LÓGICA DE LOGIN
      // ==========================================
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        setErro("E-mail ou senha incorretos.");
      } else {
        if (redirecionarPara) {
          router.push(redirecionarPara);
        } else {
          router.push("/perfil");
        }
      }
    } else {
      // ==========================================
      // LÓGICA DE CADASTRO (ATLETA / PROFESSOR)
      // ==========================================
      if (cpf.length < 14) {
        setErro("Por favor, informe um CPF válido.");
        setLoading(false);
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            cpf: cpf,
            role: tipoConta, 
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("User already registered")) {
          setErro("Este e-mail já está cadastrado. Por favor, faça login.");
        } else {
          setErro(signUpError.message);
        }
      } else {
        if (signUpData?.user) {
          await supabase.from("atletas").insert([
            {
              user_id: signUpData.user.id,
              email: email,
              cpf: cpf,
              role: tipoConta, 
              nome: "", 
              equipe: "Independente"
            }
          ]);
        }

        setMensagem(tipoConta === "professor" 
          ? "Conta criada! Acesse para gerenciar sua equipe." 
          : "Conta criada com sucesso! Já pode acessar."
        );
        
        setTimeout(() => {
          if (redirecionarPara) {
            router.push(redirecionarPara); 
          } else {
            setIsLogin(true); 
            setSenha("");
            setCpf("");
          }
        }, 2000);
      }
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-3 md:p-6 relative overflow-hidden font-sans">
      
      {/* EFEITOS DE LUZ NO FUNDO */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-red-600/5 blur-[100px] rounded-full pointer-events-none"></div>

      {/* CONTAINER DIMINUÍDO */}
      <div className="w-full max-w-sm bg-[#0a0a0e]/90 backdrop-blur-2xl border border-white/5 rounded-3xl p-5 md:p-7 shadow-[0_0_80px_rgba(0,0,0,0.8)] relative z-10">
        
        {/* LOGO SIMPLIFICADA NO TOPO */}
        <div className="text-center mb-6 relative z-10">
          <Link href="/" className="inline-block text-white font-black text-xl italic tracking-tighter mb-3 cursor-pointer hover:scale-105 transition-transform">
            <span className="text-red-600">i</span>TATAME
          </Link>
          <h1 className="text-xl font-black text-white mb-1.5 tracking-tight">
            {isLogin ? "Acesso à Plataforma" : "Crie a sua Conta"}
          </h1>
          <p className="text-zinc-500 text-[10px] md:text-xs">
            {isLogin 
              ? "Bem-vindo de volta! Insira suas credenciais." 
              : "Junte-se à maior rede de competidores."}
          </p>
          {redirecionarPara && (
            <p className="text-red-400 font-bold text-[9px] uppercase tracking-widest mt-2.5 bg-red-500/10 p-1.5 rounded-md border border-red-500/20">
              Entre para continuar sua inscrição!
            </p>
          )}
        </div>

        {/* ABAS (ALTERNÂNCIA LOGIN / CADASTRO) */}
        <div className="flex bg-black/60 p-1 rounded-lg border border-white/10 mb-6 relative shadow-inner">
          <button 
            type="button"
            onClick={() => { setIsLogin(true); setErro(""); setMensagem(""); }}
            className={`relative z-10 flex-1 cursor-pointer py-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all rounded-md ${isLogin ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "text-zinc-500 hover:text-white"}`}
          >
            Fazer Login
          </button>
          <button 
            type="button"
            onClick={() => { setIsLogin(false); setErro(""); setMensagem(""); }}
            className={`relative z-10 flex-1 cursor-pointer py-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all rounded-md ${!isLogin ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "text-zinc-500 hover:text-white"}`}
          >
            Criar Cadastro
          </button>
        </div>

        {/* FEEDBACKS DE ERRO/SUCESSO */}
        {erro && (
          <div className="mb-5 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 animate-in fade-in shadow-lg">
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span className="text-red-400 text-[10px] md:text-xs font-bold leading-tight">{erro}</span>
          </div>
        )}
        
        {mensagem && (
          <div className="mb-5 p-2.5 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-2.5 animate-in fade-in shadow-lg">
            <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a2 2 0 11-4 0 2 2 0 014 0zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-green-400 text-[10px] md:text-xs font-bold leading-tight">{mensagem}</span>
          </div>
        )}

        {/* FORMULÁRIO */}
        <form onSubmit={handleAuth} className="space-y-4 relative z-10">
          
          {/* ======================================================== */}
          {/* PERGUNTA VIP NO CADASTRO: VOCÊ É ATLETA OU PROFESSOR?    */}
          {/* ======================================================== */}
          {!isLogin && (
            <div className="mb-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Tipo de Conta</label>
              <div className="grid grid-cols-2 gap-2">
                
                {/* OPÇÃO 1: ATLETA */}
                <label className={`cursor-pointer border p-2.5 rounded-lg flex flex-col gap-1 transition-all ${tipoConta === 'atleta' ? 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/5 bg-black/40 hover:border-white/20'}`}>
                  <input type="radio" className="hidden" checked={tipoConta === 'atleta'} onChange={() => setTipoConta('atleta')} />
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <svg className={`w-3.5 h-3.5 ${tipoConta === 'atleta' ? 'text-red-500' : 'text-zinc-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                      <span className={`font-black uppercase tracking-widest text-[9px] ${tipoConta === 'atleta' ? 'text-red-500' : 'text-zinc-300'}`}>Atleta</span>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full border-2 flex items-center justify-center transition-colors ${tipoConta === 'atleta' ? 'border-red-500' : 'border-zinc-700'}`}>
                      {tipoConta === 'atleta' && <div className="w-1 h-1 rounded-full bg-red-500"></div>}
                    </div>
                  </div>
                  <span className="text-[8px] text-zinc-500 font-medium mt-0.5 leading-tight">Competir e ver histórico.</span>
                </label>

                {/* OPÇÃO 2: PROFESSOR (MESTRE) */}
                <label className={`cursor-pointer border p-2.5 rounded-lg flex flex-col gap-1 transition-all ${tipoConta === 'professor' ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-white/5 bg-black/40 hover:border-white/20'}`}>
                  <input type="radio" className="hidden" checked={tipoConta === 'professor'} onChange={() => setTipoConta('professor')} />
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <svg className={`w-3.5 h-3.5 ${tipoConta === 'professor' ? 'text-yellow-500' : 'text-zinc-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                      <span className={`font-black uppercase tracking-widest text-[9px] ${tipoConta === 'professor' ? 'text-yellow-500' : 'text-zinc-300'}`}>Professor</span>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full border-2 flex items-center justify-center transition-colors ${tipoConta === 'professor' ? 'border-yellow-500' : 'border-zinc-700'}`}>
                      {tipoConta === 'professor' && <div className="w-1 h-1 rounded-full bg-yellow-500"></div>}
                    </div>
                  </div>
                  <span className="text-[8px] text-zinc-500 font-medium mt-0.5 leading-tight">Gerir sua academia.</span>
                </label>
              </div>

              {/* AVISO IMPORTANTE PARA RESPONSÁVEIS DE MENORES */}
              <div className="mt-3 bg-cyan-900/10 border border-cyan-500/20 rounded-lg p-2.5 flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p className="text-[9px] text-zinc-400 leading-relaxed">
                  <strong className="text-cyan-400 block mb-0.5">É responsável por um menor?</strong>
                  Crie como "Atleta" usando os <span className="text-white">seus dados</span>. Dentro do painel você adiciona dependentes.
                </p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* AVISO DE LOGIN PARA PAIS/RESPONSÁVEIS                    */}
          {/* ======================================================== */}
          {isLogin && (
            <div className="mb-3 animate-in fade-in duration-300">
              <div className="bg-cyan-900/10 border border-cyan-500/20 rounded-lg p-2.5 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-cyan-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                <p className="text-[9px] text-zinc-400 leading-tight">
                  <strong className="text-cyan-400">Responsáveis:</strong> Façam login com a conta titular para gerir dependentes.
                </p>
              </div>
            </div>
          )}

          {/* CAMPO: CPF (APENAS CADASTRO) */}
          {!isLogin && (
            <div className="animate-in fade-in duration-300">
              <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 ml-1">Documento (CPF)</label>
              <div className="relative">
                <svg className="w-3.5 h-3.5 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg>
                <input 
                  type="text" 
                  required
                  value={cpf}
                  onChange={(e) => setCpf(formatarCpf(e.target.value))}
                  placeholder="000.000.000-00" 
                  className="w-full bg-black/60 border border-white/10 focus:border-red-500 outline-none rounded-lg pl-9 pr-3 py-2.5 text-white transition-colors text-xs font-bold placeholder:text-zinc-700 shadow-inner" 
                />
              </div>
            </div>
          )}

          {/* CAMPOS COMUNS (E-MAIL E SENHA) */}
          <div>
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 ml-1">E-mail</label>
            <div className="relative">
              <svg className="w-3.5 h-3.5 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path></svg>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com" 
                className="w-full bg-black/60 border border-white/10 focus:border-red-500 outline-none rounded-lg pl-9 pr-3 py-2.5 text-white transition-colors text-xs font-bold placeholder:text-zinc-700 shadow-inner" 
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Senha</label>
            </div>
            <div className="relative">
              <svg className="w-3.5 h-3.5 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              <input 
                type="password" 
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••" 
                className="w-full bg-black/60 border border-white/10 focus:border-red-500 outline-none rounded-lg pl-9 pr-3 py-2.5 text-white transition-colors text-xs font-bold placeholder:text-zinc-700 shadow-inner" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full text-white font-black text-[10px] md:text-xs uppercase tracking-widest py-3 rounded-lg transition-all mt-3 flex items-center justify-center gap-2 ${
              loading 
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                : (!isLogin && tipoConta === 'professor')
                  ? "bg-yellow-600 hover:bg-yellow-500 shadow-[0_0_15px_rgba(202,138,4,0.3)] text-black"
                  : "bg-red-600 hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            }`}
          >
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Aguarde...</>
            ) : isLogin ? (
              "Acessar Plataforma"
            ) : tipoConta === 'professor' ? (
              "Criar Conta de Professor"
            ) : (
              "Criar Conta de Atleta"
            )}
          </button>
        </form>
        
        {/* ROTA DE FUGA - ORGANIZADOR */}
        <div className="mt-6 pt-5 border-t border-white/5 text-center relative z-10">
          <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest cursor-default">
            É dono de um evento / federação?
          </p>
          <Link href="/login-organizador" className="inline-block mt-1.5 text-zinc-400 text-[10px] font-black uppercase tracking-widest hover:text-yellow-500 transition-colors border border-transparent hover:border-yellow-500/30 bg-white/5 hover:bg-yellow-500/10 px-3 py-1.5 rounded-md">
            Acessar Área do Organizador →
          </Link>
        </div>

      </div>
    </main>
  );
}