"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase"; // Ajuste o caminho se necessário

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [autorizado, setAutorizado] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function verificarAcessoMaster() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("atletas")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      // Libera EXCLUSIVAMENTE para a chave mestra
      if (data && data.role === "super-admin") {
        setAutorizado(true);
      } else {
        router.push("/"); // Alerta vermelho: manda o invasor pra página inicial
      }
    }

    verificarAcessoMaster();
  }, [router]);

  // Bloqueio rigoroso visual
  if (!autorizado) {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-red-600/10 blur-[100px] pointer-events-none"></div>
        <span className="text-red-600 font-black tracking-widest uppercase text-sm animate-pulse border border-red-600/30 bg-red-900/20 px-6 py-3 rounded-xl shadow-[0_0_30px_rgba(220,38,38,0.2)]">
          🔒 Área Restrita
        </span>
      </div>
    );
  }

  return <>{children}</>;
}