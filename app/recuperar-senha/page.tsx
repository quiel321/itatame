"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import FotosShell from "@/app/fotos/_components/FotosShell";

type PerfilFotosRecuperacao = "comprador" | "fotografo" | "organizador";

function normalizarPerfilFotos(valor: string | null): PerfilFotosRecuperacao {
  return valor === "fotografo" || valor === "organizador" ? valor : "comprador";
}

export default function RecuperarSenha() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [origemFotos, setOrigemFotos] = useState(false);
  const [perfilFotos, setPerfilFotos] = useState<PerfilFotosRecuperacao>("comprador");

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      setOrigemFotos(parametros.get("origem") === "fotos");
      setPerfilFotos(normalizarPerfilFotos(parametros.get("perfil")));
    });
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensagem("");
    setErro("");

    const parametros = new URLSearchParams(window.location.search);
    const recuperacaoFotos = parametros.get("origem") === "fotos";
    const perfilRecuperacao = normalizarPerfilFotos(parametros.get("perfil"));
    const destinoNovaSenha = new URL("/nova-senha", window.location.origin);
    if (recuperacaoFotos) {
      destinoNovaSenha.searchParams.set("origem", "fotos");
      destinoNovaSenha.searchParams.set("perfil", perfilRecuperacao);
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: destinoNovaSenha.toString(),
    });

    if (error) {
      setErro("Erro ao enviar o e-mail. Verifique se digitou corretamente.");
    } else {
      setMensagem("Link enviado! Verifique sua caixa de entrada (e o Spam).");
      setEmail("");
    }
    setLoading(false);
  };

  const conteudo = (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 selection:bg-red-500/30">
      <div className="max-w-md w-full bg-[#0a0a0e] border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-900"></div>
        
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">{origemFotos ? "Recuperar senha do iTatame Fotos" : "Esqueci minha senha"}</h1>
        <p className="text-zinc-400 text-xs mb-8">Digite o e-mail cadastrado na sua conta. Vamos enviar um link seguro para criar uma senha nova.</p>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 pl-1">E-mail Cadastrado</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500 outline-none transition-colors"
              placeholder="atleta@email.com"
            />
          </div>

          {erro && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl text-center">{erro}</div>}
          {mensagem && <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-xl text-center animate-pulse">{mensagem}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="cursor-pointer w-full bg-red-600 hover:bg-red-500 text-white font-black py-3.5 rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50 mt-2 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
          >
            {loading ? "Enviando..." : "Enviar Link de Recuperação"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => router.push(origemFotos ? `/fotos/login?perfil=${perfilFotos}` : "/login")} className="cursor-pointer text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">
            {origemFotos ? "Voltar ao login do Fotos" : "Voltar para o Login"}
          </button>
        </div>
      </div>
    </div>
  );

  return origemFotos ? <FotosShell>{conteudo}</FotosShell> : conteudo;
} 
