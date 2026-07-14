"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import FotosShell from "@/app/fotos/_components/FotosShell";

type PerfilFotosRecuperacao = "comprador" | "fotografo" | "organizador";

function normalizarPerfilFotos(valor: string | null): PerfilFotosRecuperacao {
  return valor === "fotografo" || valor === "organizador" ? valor : "comprador";
}

export default function NovaSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [destinoAposRecuperacao, setDestinoAposRecuperacao] = useState("/perfil");
  const [recuperacaoFotos, setRecuperacaoFotos] = useState(false);

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search);
    const origemFotos = parametros.get("origem") === "fotos";
    const perfilFotos = normalizarPerfilFotos(parametros.get("perfil"));
    queueMicrotask(() => {
      setRecuperacaoFotos(origemFotos);
      setDestinoAposRecuperacao(origemFotos ? `/fotos/login?perfil=${perfilFotos}` : "/perfil");
    });

    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log("Modo de recuperação ativado.");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");

    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: senha
    });

    if (error) {
      setErro("Erro ao atualizar a senha. O link pode ter expirado.");
    } else {
      alert("Senha atualizada com sucesso! Você já pode acessar sua conta.");
      router.push(destinoAposRecuperacao);
    }
    setLoading(false);
  };

  const conteudo = (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 selection:bg-cyan-500/30">
      <div className="max-w-md w-full bg-[#0a0a0e] border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-cyan-800"></div>
        
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">{recuperacaoFotos ? "Nova senha do iTatame Fotos" : "Criar Nova Senha"}</h1>
        <p className="text-zinc-400 text-xs mb-8">Digite sua nova senha de acesso abaixo. Lembre-se de guardá-la em um local seguro.</p>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 pl-1">Nova Senha</label>
            <input 
              type="password" 
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          {erro && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl text-center">{erro}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="cursor-pointer w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3.5 rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50 mt-2 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );

  return recuperacaoFotos ? <FotosShell>{conteudo}</FotosShell> : conteudo;
}
