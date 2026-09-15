"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/app/lib/supabase";

type Evento = { id: string; nome?: string | null; data_evento?: string | null; organizador_id?: string | null };
type Inscricao = {
  id: string | number; atleta?: string | null; equipe?: string | null; categoria?: string | null;
  pagamento_ok?: boolean | null; valor_inscricao?: number | string | null; valor_total?: number | string | null;
  mp_payment_id?: string | null; estorno_status?: string | null; estorno_valor?: number | string | null;
  estorno_motivo?: string | null; estornado_em?: string | null; eventos?: Evento | Evento[] | null;
};

const moeda = (valor: unknown) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor || 0));
const eventoDa = (item: Inscricao) => Array.isArray(item.eventos) ? item.eventos[0] : item.eventos;

export default function EstornosInscricoesSuperAdminPage() {
  const [itens, setItens] = useState<Inscricao[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [selecionada, setSelecionada] = useState<Inscricao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true); setMensagem("");
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const response = await fetch("/api/inscricoes/estorno", { headers: { Authorization: `Bearer ${sessao.session?.access_token || ""}` } });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.error || "Não foi possível carregar as inscrições.");
      setItens(resultado.inscricoes || []);
    } catch (error) { setMensagem(error instanceof Error ? error.message : "Falha ao carregar inscrições."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const inicio = window.setTimeout(() => { void carregar(); }, 0);
    return () => window.clearTimeout(inicio);
  }, [carregar]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((item) => !termo || [item.atleta, item.equipe, item.categoria, item.mp_payment_id, eventoDa(item)?.nome].some((v) => String(v || "").toLowerCase().includes(termo)));
  }, [busca, itens]);

  async function estornar() {
    if (!selecionada) return;
    setProcessando(true); setMensagem("Solicitando estorno ao Mercado Pago...");
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const response = await fetch("/api/inscricoes/estorno", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessao.session?.access_token || ""}` },
        body: JSON.stringify({ inscricaoId: selecionada.id, motivo, confirmacao }),
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.error || "Não foi possível concluir o estorno.");
      setMensagem(resultado.exigeRegenerarChaves ? "Estorno concluído. Avise o organizador para gerar as chaves novamente." : "Estorno concluído e registrado na auditoria.");
      setSelecionada(null); setMotivo(""); setConfirmacao(""); await carregar();
    } catch (error) { setMensagem(error instanceof Error ? error.message : "Não foi possível concluir o estorno."); }
    finally { setProcessando(false); }
  }

  return <main className="min-h-screen bg-[#050505] p-4 text-white md:p-8">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center">
        <div><Link href="/super-admin" className="mb-3 inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-white"><ArrowLeft size={14}/> Voltar ao Super Admin</Link><p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-red-400"><ShieldCheck size={13}/> Controle Master</p><h1 className="mt-1 text-2xl font-black md:text-4xl">Estornos de inscrições</h1><p className="mt-2 text-sm text-zinc-500">Consulte pagamentos de todos os organizadores e execute devoluções integrais auditadas.</p></div>
        <button onClick={carregar} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase disabled:opacity-40"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Atualizar</button>
      </header>
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-black p-3"><Search size={16} className="text-zinc-600"/><input value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Buscar atleta, evento, equipe ou ID Mercado Pago"/></div>
      {mensagem && <p role="status" className="mb-5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">{mensagem}</p>}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        {loading ? <p className="p-10 text-center text-sm text-zinc-500">Carregando...</p> : filtradas.length === 0 ? <p className="p-10 text-center text-sm text-zinc-500">Nenhum pagamento de inscrição encontrado.</p> : <div className="divide-y divide-white/5">{filtradas.map((item) => {
          const evento = eventoDa(item); const estornado = item.estorno_status === "estornado";
          return <article key={item.id} className="grid gap-4 p-4 md:grid-cols-[1.3fr_1.2fr_0.8fr_0.8fr] md:items-center">
            <div><h2 className="font-black">{item.atleta || "Atleta não informado"}</h2><p className="mt-1 text-xs text-zinc-500">{item.equipe || "Sem equipe"} · {item.categoria || "Sem categoria"}</p></div>
            <div><p className="text-sm font-bold">{evento?.nome || "Evento não informado"}</p><p className="mt-1 text-[10px] text-zinc-600">MP {item.mp_payment_id}</p></div>
            <div><p className="font-black">{moeda(item.valor_total || item.valor_inscricao)}</p><span className={`mt-1 inline-block rounded-md border px-2 py-1 text-[9px] font-black uppercase ${estornado ? "border-orange-500/20 text-orange-300" : item.pagamento_ok ? "border-emerald-500/20 text-emerald-300" : "border-zinc-700 text-zinc-500"}`}>{estornado ? "Estornado" : item.pagamento_ok ? "Pago" : "Não pago"}</span></div>
            <button onClick={() => { setSelecionada(item); setMotivo(""); setConfirmacao(""); }} disabled={!item.pagamento_ok || estornado} className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-[10px] font-black uppercase text-red-300 disabled:opacity-30"><RotateCcw size={13}/> Estornar</button>
          </article>;
        })}</div>}
      </section>
    </div>
    {selecionada && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-[#0a0a0e] p-6"><div className="flex justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-widest text-red-400">Devolução irreversível</p><h2 className="mt-1 text-xl font-black">Estorno integral</h2></div><button onClick={() => setSelecionada(null)} className="rounded-lg border border-white/10 p-2 text-zinc-400"><X size={16}/></button></div><p className="mt-4 text-sm text-zinc-300"><strong>{selecionada.atleta}</strong> · {eventoDa(selecionada)?.nome} · {moeda(selecionada.valor_total || selecionada.valor_inscricao)}</p><p className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs leading-relaxed text-yellow-100">O valor será devolvido pelo Mercado Pago. O split será revertido proporcionalmente e a conta do organizador precisa ter saldo.</p><label className="mt-4 block text-xs font-bold text-zinc-400">Motivo<textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black p-3 text-white outline-none"/></label><label className="mt-4 block text-xs font-bold text-zinc-400">Digite ESTORNAR<input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value.toUpperCase())} className="mt-2 w-full rounded-xl border border-red-500/30 bg-black p-3 font-black text-white outline-none"/></label><button onClick={estornar} disabled={processando || motivo.trim().length < 8 || confirmacao !== "ESTORNAR"} className="mt-5 w-full rounded-xl bg-red-600 px-4 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-40">{processando ? "Processando..." : "Confirmar estorno integral"}</button></div></div>}
  </main>;
}
