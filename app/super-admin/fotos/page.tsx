"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Banknote,
  Camera,
  CircleDollarSign,
  Clock3,
  Images,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";

type ResumoFinanceiro = {
  faturamentoCentavos: number;
  comissaoItatameCentavos: number;
  royaltyGeradoCentavos: number;
  royaltyEmAbertoCentavos: number;
  royaltyAguardandoCentavos: number;
  royaltyDisponivelCentavos: number;
  royaltyPagoCentavos: number;
  fotografoAntesTarifaCentavos: number;
  pedidosPagos: number;
  fotosVendidas: number;
};

type FinanceiroFotos = {
  atualizadoEm: string;
  geral: ResumoFinanceiro & {
    ticketMedioCentavos: number;
    galerias: number;
    organizadores: number;
    fotografos: number;
    pedidosPorStatus: Record<string, number>;
  };
  organizadores: Array<ResumoFinanceiro & { id: string; nome: string; slug: string | null; galerias: number }>;
  galerias: Array<ResumoFinanceiro & { id: string; nome: string; status: string | null; organizadorId: string | null; organizadorNome: string; dataEvento: string | null }>;
  pedidosRecentes: Array<{
    id: string;
    data: string;
    galeria: string;
    fotografo: string;
    organizador: string;
    totalCentavos: number;
    comissaoItatameCentavos: number;
    royaltyCentavos: number;
    royaltyPercentual: number;
    repasseStatus: string;
    fotos: number;
  }>;
};

type PedidoRecente = FinanceiroFotos["pedidosRecentes"][number];

function moeda(centavos?: number | null) {
  return ((centavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(valor?: string | null) {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("pt-BR");
}

function statusRepasse(status: string) {
  const mapa: Record<string, { texto: string; classe: string }> = {
    pendente: { texto: "Pendente", classe: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400" },
    aguardando_liberacao: { texto: "Aguardando liberação", classe: "border-amber-500/20 bg-amber-500/10 text-amber-400" },
    disponivel: { texto: "Disponível", classe: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400" },
    pago: { texto: "Pago", classe: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" },
    estornado: { texto: "Estornado", classe: "border-red-500/20 bg-red-500/10 text-red-400" },
    nao_aplicavel: { texto: "Sem royalty", classe: "border-white/5 bg-white/[0.03] text-zinc-600" },
  };
  return mapa[status] || mapa.pendente;
}

export default function SuperAdminFotosPage() {
  const [dados, setDados] = useState<FinanceiroFotos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [pedidoReembolso, setPedidoReembolso] = useState<PedidoRecente | null>(null);
  const [motivoReembolso, setMotivoReembolso] = useState("");
  const [confirmacaoReembolso, setConfirmacaoReembolso] = useState("");
  const [reembolsando, setReembolsando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    const { data: sessao } = await supabase.auth.getSession();
    const token = sessao.session?.access_token;
    if (!token) {
      setErro("Sessão expirada. Entre novamente no Super Admin.");
      setCarregando(false);
      return;
    }
    try {
      const response = await fetch("/api/super-admin/fotos-financeiro", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.error || "Falha ao carregar o financeiro.");
      setDados(resultado);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar o financeiro.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const termo = busca.trim().toLowerCase();
  const organizadoresFiltrados = useMemo(() => (dados?.organizadores || []).filter((item) => !termo || item.nome.toLowerCase().includes(termo)), [dados, termo]);
  const galeriasFiltradas = useMemo(() => (dados?.galerias || []).filter((item) => !termo || item.nome.toLowerCase().includes(termo) || item.organizadorNome.toLowerCase().includes(termo)), [dados, termo]);

  function abrirReembolso(pedido: PedidoRecente) {
    setPedidoReembolso(pedido);
    setMotivoReembolso("");
    setConfirmacaoReembolso("");
    setFeedback(null);
  }

  function fecharReembolso() {
    if (reembolsando) return;
    setPedidoReembolso(null);
    setMotivoReembolso("");
    setConfirmacaoReembolso("");
  }

  async function confirmarReembolso() {
    if (!pedidoReembolso || reembolsando) return;
    setReembolsando(true);
    setFeedback(null);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const token = sessao.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente no Super Admin.");
      const response = await fetch("/api/super-admin/fotos-reembolso", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: pedidoReembolso.id,
          motivo: motivoReembolso.trim(),
          confirmacao: confirmacaoReembolso.trim(),
        }),
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.error || "Não foi possível concluir o reembolso.");
      const valor = moeda(resultado.valorCentavos ?? pedidoReembolso.totalCentavos);
      setPedidoReembolso(null);
      setMotivoReembolso("");
      setConfirmacaoReembolso("");
      setFeedback({ tipo: "sucesso", texto: `Pedido reembolsado integralmente (${valor}). Os downloads e o royalty foram bloqueados.` });
      await carregar();
    } catch (error) {
      setFeedback({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível concluir o reembolso." });
    } finally {
      setReembolsando(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] p-4 text-white md:p-6 lg:p-8">
      <div className="pointer-events-none fixed right-0 top-0 h-[600px] w-[600px] rounded-full bg-cyan-900/10 blur-[150px]" />
      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4">
            <Link href="/super-admin" className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white" aria-label="Voltar ao Super Admin">
              <ArrowLeft size={17} />
            </Link>
            <div>
              <span className="inline-flex items-center gap-2 rounded-md bg-cyan-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-400"><ShieldCheck size={12} /> Controle Master</span>
              <h1 className="mt-3 text-2xl font-black tracking-tight md:text-4xl">Financeiro Itatame Fotos</h1>
              <p className="mt-2 max-w-2xl text-[11px] font-medium leading-relaxed text-zinc-500 md:text-xs">Comissões da plataforma, royalties dos organizadores e desempenho de cada galeria calculados exclusivamente sobre pedidos pagos.</p>
            </div>
          </div>
          <button onClick={carregar} disabled={carregando} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-5 text-[9px] font-black uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500 hover:text-black disabled:opacity-50">
            <RefreshCw size={14} className={carregando ? "animate-spin" : ""} /> Atualizar dados
          </button>
        </header>

        {feedback && (
          <div className={`mt-5 flex items-start justify-between gap-4 rounded-xl border p-4 text-[10px] font-bold leading-relaxed ${feedback.tipo === "sucesso" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" : "border-red-500/20 bg-red-500/5 text-red-300"}`}>
            <span>{feedback.texto}</span>
            <button type="button" onClick={() => setFeedback(null)} className="shrink-0 text-current opacity-60 hover:opacity-100" aria-label="Fechar mensagem"><X size={14} /></button>
          </div>
        )}

        {carregando && !dados ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-cyan-400">
            <Loader2 className="mb-4 animate-spin" size={34} />
            <p className="text-[10px] font-black uppercase tracking-widest">Consolidando vendas e repasses...</p>
          </div>
        ) : erro ? (
          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm font-bold text-red-300">{erro}</div>
        ) : dados ? (
          <>
            <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { titulo: "Vendas pagas", valor: moeda(dados.geral.faturamentoCentavos), apoio: `${dados.geral.pedidosPagos} pedidos`, icon: CircleDollarSign, cor: "text-cyan-400" },
                { titulo: "Comissão Itatame", valor: moeda(dados.geral.comissaoItatameCentavos), apoio: "Snapshot de cada venda", icon: Banknote, cor: "text-emerald-400" },
                { titulo: "Royalties em aberto", valor: moeda(dados.geral.royaltyEmAbertoCentavos), apoio: "Aguardando + disponível", icon: WalletCards, cor: "text-amber-400" },
                { titulo: "Fotos vendidas", valor: String(dados.geral.fotosVendidas), apoio: `Ticket médio ${moeda(dados.geral.ticketMedioCentavos)}`, icon: Images, cor: "text-fuchsia-400" },
              ].map(({ titulo, valor, apoio, icon: Icon, cor }) => (
                <article key={titulo} className="rounded-2xl border border-white/5 bg-[#0a0a0e] p-4 shadow-xl md:p-5">
                  <div className="flex items-center justify-between gap-3"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 md:text-[9px]">{titulo}</p><Icon size={17} className={cor} /></div>
                  <p className="mt-3 break-words text-lg font-black md:text-2xl">{valor}</p>
                  <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-zinc-600">{apoio}</p>
                </article>
              ))}
            </section>

            <section className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <article className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-5 md:p-6">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4"><WalletCards className="text-amber-400" size={20} /><div><h2 className="text-sm font-black uppercase">Posição dos royalties</h2><p className="mt-1 text-[9px] text-zinc-600">Não confunda valor gerado com valor já liberado.</p></div></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Aguardando liberação</p><p className="mt-2 text-lg font-black text-amber-400">{moeda(dados.geral.royaltyAguardandoCentavos)}</p></div>
                  <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Disponível para repasse</p><p className="mt-2 text-lg font-black text-cyan-400">{moeda(dados.geral.royaltyDisponivelCentavos)}</p></div>
                  <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Já repassado</p><p className="mt-2 text-lg font-black text-emerald-400">{moeda(dados.geral.royaltyPagoCentavos)}</p></div>
                </div>
              </article>
              <article className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-5 md:p-6">
                <div className="flex items-center gap-3"><Store className="text-cyan-400" size={20} /><h2 className="text-sm font-black uppercase">Estrutura monitorada</h2></div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-black/50 p-3"><p className="text-xl font-black">{dados.geral.galerias}</p><p className="mt-1 text-[7px] font-black uppercase tracking-widest text-zinc-600">Galerias</p></div>
                  <div className="rounded-xl bg-black/50 p-3"><p className="text-xl font-black">{dados.geral.organizadores}</p><p className="mt-1 text-[7px] font-black uppercase tracking-widest text-zinc-600">Organizadores</p></div>
                  <div className="rounded-xl bg-black/50 p-3"><p className="text-xl font-black">{dados.geral.fotografos}</p><p className="mt-1 text-[7px] font-black uppercase tracking-widest text-zinc-600">Fotógrafos</p></div>
                </div>
                <p className="mt-4 text-[9px] leading-relaxed text-zinc-600">O valor do fotógrafo é exibido antes da tarifa da instituição de pagamento. Essa tarifa não é receita do Itatame.</p>
              </article>
            </section>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-lg font-black uppercase tracking-tight">Royalties por organizador</h2><p className="mt-1 text-[9px] text-zinc-600">O saldo em aberto mostra quanto ainda precisa ser controlado para cada parceiro.</p></div>
              <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={15} /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar galeria ou organizador..." className="h-11 w-full rounded-xl border border-white/10 bg-black pl-9 pr-3 text-[10px] font-bold text-white outline-none focus:border-cyan-500/40" /></div>
            </div>

            <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {organizadoresFiltrados.map((organizador) => (
                <article key={organizador.id} className="rounded-2xl border border-white/5 bg-[#0a0a0e] p-5 transition-colors hover:border-amber-500/20">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black">{organizador.nome}</p><p className="mt-1 text-[8px] font-black uppercase tracking-widest text-zinc-600">{organizador.galerias} galeria(s) • {organizador.pedidosPagos} pedido(s)</p></div><Users size={17} className="shrink-0 text-amber-400" /></div>
                  <div className="mt-5 rounded-xl border border-amber-500/15 bg-amber-500/5 p-4"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Total a controlar</p><p className="mt-1 text-2xl font-black text-amber-400">{moeda(organizador.royaltyEmAbertoCentavos)}</p></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[9px]"><div className="rounded-lg bg-black/50 p-3 text-zinc-500">Royalty gerado<strong className="mt-1 block text-white">{moeda(organizador.royaltyGeradoCentavos)}</strong></div><div className="rounded-lg bg-black/50 p-3 text-zinc-500">Já repassado<strong className="mt-1 block text-emerald-400">{moeda(organizador.royaltyPagoCentavos)}</strong></div></div>
                </article>
              ))}
              {!organizadoresFiltrados.length && <p className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600">Nenhum organizador encontrado.</p>}
            </section>

            <section className="mt-10 rounded-3xl border border-white/5 bg-[#0a0a0e] p-4 md:p-6">
              <div className="mb-5 flex items-center gap-3"><Camera className="text-cyan-400" size={20} /><div><h2 className="text-sm font-black uppercase">Resultado por galeria</h2><p className="mt-1 text-[9px] text-zinc-600">Faturamento, comissão e royalty preservados por pedido.</p></div></div>
              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="w-full min-w-[920px] text-left text-[10px]">
                  <thead className="bg-black text-[8px] font-black uppercase tracking-widest text-zinc-600"><tr><th className="p-4">Galeria / Organizador</th><th className="p-4">Vendas</th><th className="p-4">Faturamento</th><th className="p-4">Comissão Itatame</th><th className="p-4">Royalty gerado</th><th className="p-4">Em aberto</th></tr></thead>
                  <tbody>
                    {galeriasFiltradas.map((galeria) => (
                      <tr key={galeria.id} className="border-t border-white/5 text-zinc-400 hover:bg-white/[0.02]"><td className="p-4"><p className="max-w-[260px] truncate font-black text-white">{galeria.nome}</p><p className="mt-1 text-[8px] text-zinc-600">{galeria.organizadorNome} • {dataCurta(galeria.dataEvento)}</p></td><td className="p-4">{galeria.fotosVendidas} foto(s)<span className="mt-1 block text-[8px] text-zinc-600">{galeria.pedidosPagos} pedido(s)</span></td><td className="p-4 font-black text-white">{moeda(galeria.faturamentoCentavos)}</td><td className="p-4 font-black text-emerald-400">{moeda(galeria.comissaoItatameCentavos)}</td><td className="p-4 font-black text-amber-400">{moeda(galeria.royaltyGeradoCentavos)}</td><td className="p-4 font-black text-cyan-400">{moeda(galeria.royaltyEmAbertoCentavos)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-white/5 bg-[#0a0a0e] p-4 md:p-6">
              <div className="mb-5 flex items-center gap-3"><Clock3 className="text-fuchsia-400" size={20} /><div><h2 className="text-sm font-black uppercase">Últimas vendas pagas</h2><p className="mt-1 text-[9px] text-zinc-600">Auditoria rápida dos 20 pedidos pagos mais recentes.</p></div></div>
              <div className="space-y-2">
                {dados.pedidosRecentes.map((pedido) => {
                  const status = statusRepasse(pedido.repasseStatus);
                  return (
                    <div key={pedido.id} className="grid gap-3 rounded-xl border border-white/5 bg-black/40 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-black text-white">{pedido.galeria}</p>
                        <p className="mt-1 text-[8px] text-zinc-600">{dataCurta(pedido.data)} • {pedido.fotografo} • {pedido.fotos} foto(s) • Ref. {pedido.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span className="font-black text-white">{moeda(pedido.totalCentavos)}</span>
                        <span className={`rounded-md border px-2 py-1 text-[7px] font-black uppercase tracking-widest ${status.classe}`}>{status.texto}</span>
                        {pedido.royaltyCentavos > 0 && <span className="text-[8px] font-black text-amber-400">Royalty {moeda(pedido.royaltyCentavos)}</span>}
                        <button type="button" onClick={() => abrirReembolso(pedido)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 text-[7px] font-black uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500 hover:text-white">
                          <RotateCcw size={11} /> Reembolsar
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!dados.pedidosRecentes.length && <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600">Ainda não existem vendas pagas.</p>}
              </div>
            </section>

            <p className="mt-6 text-center text-[8px] font-bold uppercase tracking-widest text-zinc-700">Atualizado em {new Date(dados.atualizadoEm).toLocaleString("pt-BR")} • Valores baseados nos snapshots financeiros gravados nos pedidos</p>
          </>
        ) : null}
      </div>

      {pedidoReembolso && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-reembolso" className="w-full max-w-lg overflow-hidden rounded-3xl border border-red-500/25 bg-[#0a0a0e] shadow-[0_0_80px_rgba(239,68,68,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/5 bg-red-500/[0.04] p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400"><AlertTriangle size={21} /></div>
                <div><p className="text-[8px] font-black uppercase tracking-widest text-red-400">Operação financeira irreversível</p><h2 id="titulo-reembolso" className="mt-1 text-lg font-black uppercase">Reembolso integral</h2></div>
              </div>
              <button type="button" onClick={fecharReembolso} disabled={reembolsando} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-500 hover:text-white disabled:opacity-40" aria-label="Fechar"><X size={16} /></button>
            </div>

            <div className="space-y-5 p-5 md:p-6">
              <div className="rounded-2xl border border-white/5 bg-black/60 p-4">
                <div className="flex items-center justify-between gap-4"><span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Valor a devolver</span><strong className="text-xl text-red-400">{moeda(pedidoReembolso.totalCentavos)}</strong></div>
                <p className="mt-3 truncate text-[10px] font-black text-white">{pedidoReembolso.galeria}</p>
                <p className="mt-1 text-[8px] text-zinc-600">Pedido {pedidoReembolso.id.toUpperCase()} • {pedidoReembolso.fotos} foto(s)</p>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-[9px] leading-relaxed text-amber-100/70">
                O valor total será devolvido pela conta conectada do fotógrafo. Novos downloads serão bloqueados e qualquer royalty do organizador será estornado. Arquivos já baixados no dispositivo do comprador não podem ser recolhidos.
              </div>

              {feedback?.tipo === "erro" && <p className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-[9px] font-bold text-red-300">{feedback.texto}</p>}

              <div>
                <label className="mb-2 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Motivo do reembolso</label>
                <textarea value={motivoReembolso} onChange={(event) => setMotivoReembolso(event.target.value)} maxLength={300} rows={3} placeholder="Descreva o motivo para o registro administrativo..." className="w-full resize-none rounded-xl border border-white/10 bg-black p-3 text-[11px] text-white outline-none placeholder:text-zinc-700 focus:border-red-500/40" />
                <p className="mt-1 text-right text-[7px] font-bold text-zinc-700">{motivoReembolso.trim().length}/300</p>
              </div>

              <div>
                <label className="mb-2 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Digite REEMBOLSAR para confirmar</label>
                <input value={confirmacaoReembolso} onChange={(event) => setConfirmacaoReembolso(event.target.value.toUpperCase())} autoComplete="off" placeholder="REEMBOLSAR" className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-[11px] font-black uppercase tracking-widest text-white outline-none placeholder:text-zinc-800 focus:border-red-500/40" />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={fecharReembolso} disabled={reembolsando} className="h-11 rounded-xl border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/10 disabled:opacity-40">Cancelar</button>
                <button type="button" onClick={confirmarReembolso} disabled={reembolsando || motivoReembolso.trim().length < 8 || confirmacaoReembolso.trim() !== "REEMBOLSAR"} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 text-[9px] font-black uppercase tracking-widest text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40">
                  {reembolsando ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  {reembolsando ? "Processando..." : "Confirmar reembolso"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
