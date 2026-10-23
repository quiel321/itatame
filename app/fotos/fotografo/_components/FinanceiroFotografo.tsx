"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouterFotos as useRouter } from "@/app/fotos/_components/useRouterFotos";
import { RefreshCw } from "lucide-react";
import PainelFotografo from "../_components/PainelFotografo";
import FinanceiroTabela from "../_components/FinanceiroTabela";
import s from "../_components/gestao.module.css";
import VendasDiariaFotografos from '../../_components/VendasDiariaFotografos';
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

const assinarHash = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };
const lerHash = () => window.location.hash;

export default function FinanceiroFotografo({ semPainel = false, ativo = true }: { semPainel?: boolean; ativo?: boolean }) {
  const router = useRouter();
  const hash = useSyncExternalStore(assinarHash, lerHash, () => "");
  const diaria = hash === "#vendas-diaria";
  const [dados, setDados] = useState<Financeiro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
    const { data: sessao } = await supabase.auth.getSession();
    const token = sessao.session?.access_token;
    if (!token) {
      router.replace("/fotos/login?perfil=fotografo&next=/fotos/fotografo/financeiro");
      return;
    }
      const response = await fetch("/api/fotos/fotografo/financeiro", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store", signal: AbortSignal.timeout(55000),
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
    if (!ativo || diaria || dados) return;
    const timer = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(timer);
  }, [carregar, diaria, ativo, dados]);

  const conteudo = <>
    <nav className={s.abas} aria-label="Forma de recebimento"><a href="#recebimento-direto" aria-current={!diaria ? 'page' : undefined}>Direto na minha conta</a><a href="#vendas-diaria" aria-current={diaria ? 'page' : undefined}>Pelo organizador · Diária</a></nav>
    <div hidden={!diaria} id="vendas-diaria" style={{ scrollMarginTop: 260 }}><VendasDiariaFotografos perfil="fotografo" ativo={ativo && diaria} /></div><div hidden={diaria} id="recebimento-direto" style={{ scrollMarginTop: 260 }}>{carregando && !dados ? <p role="status" className={s.vazio}>Conferindo vendas e tarifas no Mercado Pago…</p> : erro ? <p role="alert" className={s.aviso}>{erro}</p> : dados && <FinanceiroTabela dados={dados} />}</div>

  </>;
  if (semPainel) return <>{!diaria && <div className="mb-4 flex justify-end"><button type="button" onClick={() => void carregar()} disabled={carregando} className={s.botao}><RefreshCw size={14} /> Atualizar extrato</button></div>}{conteudo}</>;
  return <PainelFotografo pagina="financeiro" titulo="Financeiro">{conteudo}</PainelFotografo>;
}
