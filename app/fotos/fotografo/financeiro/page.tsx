"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, CheckCircle2, CircleDollarSign, Image as ImageIcon, Loader2, ReceiptText, RefreshCw, Store, WalletCards } from "lucide-react";
import FotosShell from "../../_components/FotosShell";
import { supabase } from "@/app/lib/supabase";

type Venda = {
  id: string;
  eventoId: string | null;
  galeria: string;
  data: string;
  fotos: number;
  brutoCentavos: number;
  itatameCentavos: number;
  royaltyCentavos: number;
  taxaMercadoPagoCentavos: number | null;
  liquidoCentavos: number | null;
  liquidoAntesTarifaCentavos: number;
  metodo: string | null;
  confirmadoPeloMercadoPago: boolean;
};

type Financeiro = {
  resumo: { vendas: number; fotos: number; brutoCentavos: number; itatameCentavos: number; royaltyCentavos: number; taxaMercadoPagoCentavos: number; liquidoCentavos: number };
  galerias: Array<{ id: string; nome: string; vendas: number; fotos: number; brutoCentavos: number; liquidoCentavos: number; pendentesDeConfirmacao: number }>;
  vendas: Venda[];
  reembolsos: { quantidade: number; valorCentavos: number };
  vendasSemConfirmacao: number;
  atualizadoEm: string;
};

function moeda(centavos: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(centavos || 0) / 100);
}

function dataHora(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
}

export default function FinanceiroFotografoPage() {
  const router = useRouter();
  const [dados, setDados] = useState<Financeiro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    const { data: sessao } = await supabase.auth.getSession();
    const token = sessao.session?.access_token;
    if (!token) {
      router.replace("/fotos/login?perfil=fotografo&next=/fotos/fotografo/financeiro");
      return;
    }
    try {
      const response = await fetch("/api/fotos/fotografo/financeiro", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o financeiro.");
      setDados(payload as Financeiro);
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar o financeiro.");
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white">
        <section className="border-b border-white/5 bg-[radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.17),transparent_34%),linear-gradient(180deg,#101014,#050505)]">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-emerald-300"><CircleDollarSign size={13} /> Financeiro do fotógrafo</p>
                <h1 className="mt-4 text-3xl font-black uppercase tracking-tight sm:text-4xl md:text-5xl">Seus ganhos, sem estimativas.</h1>
                <p className="mt-3 max-w-2xl text-xs leading-5 text-zinc-400 md:text-sm">O líquido usa o valor efetivamente recebido informado pelo Mercado Pago, depois da comissão Itatame, do royalty do organizador e da tarifa do pagamento.</p>
              </div>
              <div className="flex gap-2">
                <Link href="/fotos/fotografo/dashboard" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 sm:flex-none"><ArrowLeft size={14} /> Dashboard</Link>
                <button type="button" onClick={() => void carregar()} disabled={carregando} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-[9px] font-black uppercase tracking-widest text-black disabled:opacity-50 sm:flex-none"><RefreshCw size={14} className={carregando ? "animate-spin" : ""} /> Atualizar</button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8">
          {carregando && !dados ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-white/5 bg-[#0a0a0e] text-center">
              <Loader2 size={38} className="animate-spin text-emerald-400" />
              <p className="mt-4 text-xs font-black uppercase tracking-widest">Conferindo vendas e tarifas reais</p>
              <p className="mt-2 text-[10px] text-zinc-500">A primeira consulta pode levar alguns segundos.</p>
            </div>
          ) : erro ? (
            <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">{erro}</div>
          ) : dados && (
            <>
              {dados.vendasSemConfirmacao > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-5 text-amber-100">{dados.vendasSemConfirmacao} venda(s) aguardam confirmação de tarifa no Mercado Pago. Elas aparecem no histórico, mas não entram no total líquido até a confirmação.</div>
              )}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                {[
                  [ReceiptText, "Vendas pagas", String(dados.resumo.vendas), "text-white"],
                  [ImageIcon, "Fotos vendidas", String(dados.resumo.fotos), "text-cyan-400"],
                  [WalletCards, "Faturamento bruto", moeda(dados.resumo.brutoCentavos), "text-white"],
                  [Camera, "Comissão Itatame", `- ${moeda(dados.resumo.itatameCentavos)}`, "text-red-400"],
                  [Store, "Royalties", `- ${moeda(dados.resumo.royaltyCentavos)}`, "text-amber-400"],
                  [CircleDollarSign, "Líquido recebido", moeda(dados.resumo.liquidoCentavos), "text-emerald-400"],
                ].map(([Icon, rotulo, valor, cor]) => {
                  const Icone = Icon as typeof Camera;
                  return <div key={rotulo as string} className="rounded-2xl border border-white/5 bg-[#0a0a0e] p-4 shadow-xl"><p className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-zinc-500"><Icone size={13} /> {rotulo as string}</p><p className={`mt-3 break-words text-xl font-black sm:text-2xl ${cor as string}`}>{valor as string}</p></div>;
                })}
              </div>

              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 md:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-emerald-300">Composição do líquido</p><p className="mt-2 text-xs text-zinc-400">Bruto {moeda(dados.resumo.brutoCentavos)} · Itatame -{moeda(dados.resumo.itatameCentavos)} · Royalties -{moeda(dados.resumo.royaltyCentavos)} · Mercado Pago -{moeda(dados.resumo.taxaMercadoPagoCentavos)}</p></div>
                  <div className="shrink-0 rounded-2xl border border-emerald-400/20 bg-black/40 px-5 py-3 text-right"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Recebido pelo fotógrafo</p><p className="mt-1 text-2xl font-black text-emerald-400">{moeda(dados.resumo.liquidoCentavos)}</p></div>
                </div>
              </div>

              <div>
                <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-widest text-cyan-400">Controle por galeria</p><h2 className="mt-1 text-xl font-black uppercase">Resultado de cada trabalho</h2></div></div>
                {dados.galerias.length === 0 ? <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-xs text-zinc-500">Nenhuma venda paga ainda.</div> : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{dados.galerias.map((galeria) => <article key={galeria.id} className="rounded-2xl border border-white/5 bg-[#0a0a0e] p-5"><p className="line-clamp-2 text-sm font-black uppercase">{galeria.nome}</p><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-black/50 p-2"><p className="text-lg font-black">{galeria.vendas}</p><p className="text-[7px] font-black uppercase tracking-widest text-zinc-600">Vendas</p></div><div className="rounded-xl bg-black/50 p-2"><p className="text-lg font-black">{galeria.fotos}</p><p className="text-[7px] font-black uppercase tracking-widest text-zinc-600">Fotos</p></div><div className="rounded-xl bg-emerald-500/10 p-2"><p className="text-base font-black text-emerald-400">{moeda(galeria.liquidoCentavos)}</p><p className="text-[7px] font-black uppercase tracking-widest text-emerald-500/60">Líquido</p></div></div></article>)}</div>
                )}
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Extrato de vendas</p>
                <h2 className="mt-1 text-xl font-black uppercase">Valor ganho por venda</h2>
                <div className="mt-4 space-y-3">
                  {dados.vendas.map((venda) => <article key={venda.id} className="rounded-2xl border border-white/5 bg-[#0a0a0e] p-4 md:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black uppercase">{venda.galeria}</p>{venda.confirmadoPeloMercadoPago && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[7px] font-black uppercase tracking-wider text-emerald-300"><CheckCircle2 size={10} /> Confirmado</span>}</div><p className="mt-1 text-[9px] uppercase tracking-wider text-zinc-500">{dataHora(venda.data)} · {venda.fotos} {venda.fotos === 1 ? "foto" : "fotos"} · {venda.metodo || "Tarifa em consulta"}</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:min-w-[600px]"><div className="rounded-xl bg-black/50 p-2.5"><p className="text-[7px] font-black uppercase text-zinc-600">Bruto</p><p className="mt-1 text-sm font-black">{moeda(venda.brutoCentavos)}</p></div><div className="rounded-xl bg-black/50 p-2.5"><p className="text-[7px] font-black uppercase text-zinc-600">Itatame</p><p className="mt-1 text-sm font-black text-red-400">-{moeda(venda.itatameCentavos)}</p></div><div className="rounded-xl bg-black/50 p-2.5"><p className="text-[7px] font-black uppercase text-zinc-600">Royalty</p><p className="mt-1 text-sm font-black text-amber-400">-{moeda(venda.royaltyCentavos)}</p></div><div className="rounded-xl bg-black/50 p-2.5"><p className="text-[7px] font-black uppercase text-zinc-600">Mercado Pago</p><p className="mt-1 text-sm font-black text-zinc-300">{venda.taxaMercadoPagoCentavos === null ? "Consultando" : `-${moeda(venda.taxaMercadoPagoCentavos)}`}</p></div><div className="col-span-2 rounded-xl bg-emerald-500/10 p-2.5 sm:col-span-1"><p className="text-[7px] font-black uppercase text-emerald-500/60">Líquido</p><p className="mt-1 text-sm font-black text-emerald-400">{venda.liquidoCentavos === null ? "Pendente" : moeda(venda.liquidoCentavos)}</p></div></div></div></article>)}
                  {dados.vendas.length === 0 && <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-xs text-zinc-500">As vendas pagas aparecerão aqui automaticamente.</div>}
                </div>
              </div>

              {dados.reembolsos.quantidade > 0 && <p className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-[10px] leading-5 text-zinc-500">Reembolsos excluídos dos ganhos: {dados.reembolsos.quantidade} pedido(s), total de {moeda(dados.reembolsos.valorCentavos)}.</p>}
            </>
          )}
        </section>
      </main>
    </FotosShell>
  );
}
