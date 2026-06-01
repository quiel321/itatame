"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase"; // Ajuste o caminho se necessário

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [autorizado, setAutorizado] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function verificarAcesso() {
      // 1. Verifica se tem alguém logado
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push("/login-organizador"); // Não tem login, manda para o login correto
        return;
      }

      // 2. PRIMEIRA CHECAGEM: Tabela nova de Organizadores
      // Usamos maybeSingle() para não dar erro vermelho caso o usuário não exista nessa tabela
      const { data: orgData } = await supabase
        .from("organizadores")
        .select("status")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (orgData) {
        if (orgData.status === "aprovado" || orgData.status === "super-admin") {
          setAutorizado(true); // Catraca Liberada!
          return;
        } else {
          // Se estiver pendente ou bloqueado, joga para a tela de aviso no login
          router.push("/login-organizador");
          return;
        }
      }

      // 3. SEGUNDA CHECAGEM (Fallback): Tabela antiga de Atletas (Para o Super Admin mestre)
      const { data: atlData } = await supabase
        .from("atletas")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (atlData && (atlData.role === "organizador" || atlData.role === "super-admin")) {
        setAutorizado(true); // Catraca Liberada!
        return;
      }

      // 4. Se não for organizador em nenhuma das tabelas, é um atleta comum tentando bisbilhotar
      router.push("/perfil"); 
    }

    verificarAcesso();
  }, [router]);

  // Tela de carregamento enquanto o "Segurança" checa a identidade
  if (!autorizado) {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center">
        <span className="text-zinc-500 font-black tracking-widest uppercase text-xs animate-pulse flex items-center gap-2">
          <svg className="w-4 h-4 text-red-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          Validando Acesso VIP...
        </span>
      </div>
    );
  }

  // Acesso Liberado! Mostra a página do painel.
  return <>{children}</>;
}