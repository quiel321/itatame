"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type Parceiro = { fotografoId: string; nome: string; email: string; status: string };

export default function ParceirosAlbum({ eventoId }: { eventoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const chamar = useCallback(async (method: "GET" | "POST" | "DELETE", body?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sessão expirada.");
    const response = await fetch(`/api/fotos/fotografo/parceiros?eventoId=${eventoId}`, {
      method, headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify({ eventoId, ...body }) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível atualizar os parceiros.");
    return data;
  }, [eventoId]);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    void chamar("GET").then((data) => { if (ativo) setParceiros(data.parceiros || []); })
      .catch((error) => { if (ativo) setMensagem(error.message); });
    return () => { ativo = false; };
  }, [aberto, chamar]);

  async function atualizar(method: "POST" | "DELETE", body: object) {
    setOcupado(true);
    setMensagem("");
    try {
      await chamar(method, body);
      const data = await chamar("GET");
      setParceiros(data.parceiros || []);
      setEmail("");
      setMensagem(method === "POST" ? "Fotógrafo credenciado para este álbum." : "Acesso suspenso.");
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Falha ao atualizar o parceiro.");
    } finally { setOcupado(false); }
  }

  return <div className="mt-3 border-t border-white/10 pt-3 text-xs text-zinc-300">
    <button type="button" onClick={() => setAberto(!aberto)} className="rounded-lg border border-white/15 px-3 py-2 hover:border-retratt">{aberto ? "Fechar parceiros" : "Compartilhar com fotógrafo"}</button>
    {aberto && <div className="mt-3 space-y-3">
      <p className="text-[11px] text-zinc-400">O parceiro publica no mesmo álbum. Cada venda continua vinculada a quem enviou a mídia.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail do fotógrafo cadastrado" aria-label="E-mail do fotógrafo parceiro" className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-black px-3 text-white" />
        <button type="button" disabled={ocupado || !email.trim()} onClick={() => void atualizar("POST", { email })} className="rounded-lg bg-retratt px-4 py-2 font-bold text-black disabled:opacity-50">Credenciar</button>
      </div>
      {parceiros.filter((parceiro) => parceiro.status === "ativo").map((parceiro) => <div key={parceiro.fotografoId} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 p-2">
        <span className="truncate">{parceiro.nome} · {parceiro.email}</span>
        <button type="button" disabled={ocupado} onClick={() => void atualizar("DELETE", { fotografoId: parceiro.fotografoId })} className="shrink-0 text-red-300 disabled:opacity-50">Suspender</button>
      </div>)}
      {mensagem && <p role="status" className="text-retratt">{mensagem}</p>}
    </div>}
  </div>;
}
