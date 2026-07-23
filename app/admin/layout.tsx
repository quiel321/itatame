"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase"; // Ajuste o caminho se necessário

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [autorizado, setAutorizado] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function verificarAcesso() {
      // 1. Verifica se tem alguém logado
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push("/login-organizador"); // Não tem login, manda para o login correto
        return;
      }

      const resposta = await fetch('/api/organizador/acesso', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const acesso = await resposta.json() as { destino?: string; plano?: string };

      if (acesso.destino === 'admin') {
        if (pathname.startsWith('/admin/tatames') && acesso.plano !== 'completo') {
          router.replace('/admin?plano=restrito');
          return;
        }
        setAutorizado(true);
        return;
      }
      if (acesso.destino === 'super-admin') {
        router.replace('/super-admin');
        return;
      }
      router.replace('/login-organizador');
    }

    verificarAcesso();
  }, [pathname, router]);

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
