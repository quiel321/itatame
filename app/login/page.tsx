"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  
  // ESTADO APENAS PARA O CPF NO CADASTRO
  const [cpf, setCpf] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  // FUNÇÃO PARA APLICAR MÁSCARA DE CPF (000.000.000-00)
  const formatarCpf = (value: string) => {
    return value
      .replace(/\D/g, "") // Remove tudo o que não é dígito
      .replace(/(\d{3})(\d)/, "$1.$2") // Coloca ponto entre o terceiro e o quarto dígitos
      .replace(/(\d{3})(\d)/, "$1.$2") // Coloca ponto entre o sexto e o sétimo dígitos
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2") // Coloca hífen entre o nono e o décimo dígitos
      .substring(0, 14); // Limita o tamanho
  };

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");
    setMensagem("");

    if (isLogin) {
      // TENTA LOGAR
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        setErro("E-mail ou senha incorretos.");
      } else {
        window.location.href = "/perfil";
      }
    } else {
      // VALIDAÇÃO BÁSICA DO CPF
      if (cpf.length < 14) {
        setErro("Por favor, informe um CPF válido.");
        setLoading(false);
        return;
      }

      // TENTA CADASTRAR ENVIANDO APENAS O CPF NOS METADADOS
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            cpf: cpf,
          },
        },
      });

      if (error) {
        setErro(error.message);
      } else {
        setMensagem("Conta criada com sucesso! Já pode acessar a plataforma.");
        setIsLogin(true); // Volta para o Login
        setSenha("");
        setCpf("");
      }
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#0a0a0e] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* EFEITO GLOW NO FUNDO DO CARD */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-red-600/10 blur-3xl pointer-events-none"></div>

        {/* CABEÇALHO */}
        <div className="text-center mb-8 relative z-10">
          <h1 className="text-3xl font-black text-white mb-2">
            {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
          </h1>
          <p className="text-zinc-500 text-sm">
            {isLogin 
              ? "Acesse o iTatame para gerenciar suas inscrições." 
              : "Cadastro rápido para garantir sua vaga no tatame."}
          </p>
        </div>

        {/* ABAS (ALTERNÂNCIA) */}
        <div className="flex bg-black/50 p-1 rounded-xl mb-8 relative z-10 border border-white/5">
          <button 
            onClick={() => { setIsLogin(true); setErro(""); setMensagem(""); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isLogin ? "bg-white/10 text-white shadow-md" : "text-zinc-500 hover:text-white"}`}
          >
            Entrar
          </button>
          <button 
            onClick={() => { setIsLogin(false); setErro(""); setMensagem(""); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isLogin ? "bg-white/10 text-white shadow-md" : "text-zinc-500 hover:text-white"}`}
          >
            Cadastrar
          </button>
        </div>

        {/* FORMULÁRIO */}
        <form onSubmit={handleAuth} className="space-y-5 relative z-10">
          
          {/* CAMPO EXCLUSIVO DE CADASTRO: APENAS CPF */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">CPF</label>
              <div className="relative">
                <svg className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <input 
                  type="text" 
                  required
                  value={cpf}
                  onChange={(e) => setCpf(formatarCpf(e.target.value))}
                  placeholder="000.000.000-00" 
                  className="w-full bg-black/50 border border-white/5 focus:border-red-500/50 outline-none rounded-xl pl-12 pr-4 py-3.5 text-white transition-colors" 
                />
              </div>
            </div>
          )}

          {/* CAMPOS COMUNS (EMAIL E SENHA) */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">E-mail</label>
            <div className="relative">
              <svg className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path></svg>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com" 
                className="w-full bg-black/50 border border-white/5 focus:border-red-500/50 outline-none rounded-xl pl-12 pr-4 py-3.5 text-white transition-colors" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Senha</label>
            <div className="relative">
              <svg className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              <input 
                type="password" 
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres" 
                className="w-full bg-black/50 border border-white/5 focus:border-red-500/50 outline-none rounded-xl pl-12 pr-4 py-3.5 text-white transition-colors" 
              />
            </div>
          </div>

          {/* MENSAGENS */}
          {erro && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg text-center font-medium">{erro}</div>}
          {mensagem && <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg text-center font-medium">{mensagem}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)] mt-2 disabled:opacity-50"
          >
            {loading ? "Processando..." : (isLogin ? "Acessar Plataforma" : "Criar Conta Grátis")}
          </button>
        </form>

      </div>
    </main>
  );
}