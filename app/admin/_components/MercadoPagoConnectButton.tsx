"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";

type Props = {
  conectado: boolean;
  returnTo?: string;
  perfil?: "organizador" | "fotografo";
  className?: string;
};

export default function MercadoPagoConnectButton({ conectado, returnTo = "/admin", perfil = "organizador", className = "" }: Props) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function conectar() {
    setCarregando(true);
    setErro("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Entre novamente para conectar sua conta.");

      const response = await fetch("/api/mercado-pago/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ perfil, returnTo }),
      });
      const resultado = await response.json();
      if (!response.ok || !resultado.url) throw new Error(resultado.error || "Não foi possível iniciar a conexão.");
      window.location.assign(resultado.url);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao conectar Mercado Pago.");
      setCarregando(false);
    }
  }

  return <div>
    <button type="button" onClick={conectar} disabled={carregando} className={`cursor-pointer disabled:opacity-60 ${className}`}>
      {carregando ? "Abrindo Mercado Pago..." : conectado ? "Revisar conexão" : "Conectar Mercado Pago"}
    </button>
    {erro && <p role="alert" className="mt-2 text-xs font-bold text-red-400">{erro}</p>}
  </div>;
}
