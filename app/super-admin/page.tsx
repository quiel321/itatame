"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, ChevronDown, FileText, Search, ShieldCheck } from "lucide-react";
import { carregarResponsaveisInscricoes } from '@/app/lib/responsaveis-inscricoes';
import { supabase } from "@/app/lib/supabase";
import { baixarCsv, exportarPdfRetratt, exportarPdfSuporte } from "@/app/lib/super-admin-relatorio";
import {
  buscarPaginas,
  dataCurta,
  eventoEmbutido,
  indiceOrganizadores,
  itemResumoDaInscricao,
  moeda,
  montarLinhaSuporte,
  resumirItatame,
  situacaoInscricao,
  whatsappDe,
  type EventoPainel,
  type InscricaoPainel,
  type OrganizadorPainel,
  type SituacaoInscricao,
} from "@/app/lib/super-admin-painel";

type Sistema = "itatame" | "retratt";

type ResumoRetratt = {
  faturamentoCentavos: number;
  comissaoItatameCentavos: number;
  royaltyEmAbertoCentavos: number;
  royaltyDisponivelCentavos: number;
  royaltyPagoCentavos: number;
  pedidosPagos: number;
  fotosVendidas: number;
};

type FinanceiroRetratt = {
  geral: ResumoRetratt & { ticketMedioCentavos: number; galerias: number; organizadores: number; fotografos: number };
  organizadores: Array<ResumoRetratt & { id: string; nome: string; galerias: number }>;
  pedidosRecentes: Array<{
    id: string;
    data: string;
    galeria: string;
    fotografo: string;
    organizador: string;
    totalCentavos: number;
    comissaoItatameCentavos: number;
    royaltyCentavos: number;
    repasseStatus: string;
    fotos: number;
  }>;
};

const rotuloRepasse: Record<string, string> = {
  pendente: "Pendente",
  aguardando_liberacao: "Aguardando liberação",
  disponivel: "Disponível",
  pago: "Pago",
  estornado: "Estornado",
  nao_aplicavel: "Sem royalty",
};

function centavos(valor?: number | null) {
  return moeda((valor || 0) / 100);
}

export default function SuperAdminMasterPage() {
  const router = useRouter();
  const [nomeDono, setNomeDono] = useState("Mestre");
  const [fotoUrl, setFotoUrl] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);
  const [sistema, setSistema] = useState<Sistema>("itatame");
  const [visaoItatame, setVisaoItatame] = useState<"geral" | "campeonato">("geral");
  const [organizadores, setOrganizadores] = useState<OrganizadorPainel[]>([]);
  const [eventos, setEventos] = useState<EventoPainel[]>([]);
  const [inscricoes, setInscricoes] = useState<InscricaoPainel[]>([]);
  const [retratt, setRetratt] = useState<FinanceiroRetratt | null>(null);
  const [erroRetratt, setErroRetratt] = useState("");
  const [carregandoRetratt, setCarregandoRetratt] = useState(true);
  const [busca, setBusca] = useState("");
  const [organizadorId, setOrganizadorId] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [faixa, setFaixa] = useState("");
  const [situacao, setSituacao] = useState<"todos" | SituacaoInscricao>("todos");
  const [semIdMp, setSemIdMp] = useState(false);
  const [limite, setLimite] = useState(80);
  const [buscaRetratt, setBuscaRetratt] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/login-organizador");
        return;
      }
      const [{ data: perfil }, { data: atleta }] = await Promise.all([
        supabase.from("perfis").select("nome").eq("id", authData.user.id).maybeSingle(),
        supabase.from("atletas").select("foto_url").eq("user_id", authData.user.id).maybeSingle(),
      ]);
      if (!ativo) return;
      if (perfil?.nome) setNomeDono(perfil.nome.split(" ")[0]);
      if (atleta?.foto_url) setFotoUrl(atleta.foto_url);

      try {
        const [listaOrganizadores, listaEventos, listaInscricoes] = await Promise.all([
          buscarPaginas<OrganizadorPainel>(async (inicio, fim) => {
            const resultado = await supabase
              .from("organizadores")
              .select("id, user_id, nome, academia, email, telefone, foto_url, status, plano_comercial, comissao_percentual, mp_connected_at, cidade, estado, documento, created_at")
              .order("created_at", { ascending: false })
              .range(inicio, fim);
            return { data: resultado.data as OrganizadorPainel[] | null, error: resultado.error };
          }),
          buscarPaginas<EventoPainel>(async (inicio, fim) => {
            const resultado = await supabase
              .from("eventos")
              .select("id, nome, data_evento, data_fim_inscricoes, organizador_id, cidade, estado, local")
              .order("data_evento", { ascending: false })
              .range(inicio, fim);
            return { data: resultado.data as EventoPainel[] | null, error: resultado.error };
          }),
          buscarPaginas<InscricaoPainel>(async (inicio, fim) => {
            const resultado = await supabase
              .from("inscricoes")
              .select("id, atleta_id, user_id, atleta, equipe, categoria, faixa, peso, idade, absoluto, pagamento_ok, pesagem_ok, valor_inscricao, valor_total, cupom_id, cupom_codigo, desconto_valor, cortesia, mp_payment_id, estorno_status, estorno_valor, created_at, evento_id, eventos(nome, organizador_id, data_evento, cidade)")
              .order("id", { ascending: false })
              .range(inicio, fim);
            return { data: resultado.data as InscricaoPainel[] | null, error: resultado.error };
          }),
        ]);
        const identificadas = await carregarResponsaveisInscricoes(listaInscricoes);
        if (!ativo) return;
        setOrganizadores(listaOrganizadores);
        setEventos(listaEventos);
        setInscricoes(identificadas);
      } catch (falha) {
        if (ativo) setErro(falha instanceof Error ? falha.message : "Não foi possível carregar o Itatame.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, [router]);

  useEffect(() => {
    if (sistema !== "retratt" || retratt) return;
    let ativo = true;
    async function carregarRetratt() {
      const { data: sessao } = await supabase.auth.getSession();
      const token = sessao.session?.access_token;
      if (!token) {
        if (ativo) {
          setErroRetratt("Sessão expirada para consultar a Retratt.");
          setCarregandoRetratt(false);
        }
        return;
      }
      try {
        const response = await fetch("/api/super-admin/fotos-financeiro", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const resultado = await response.json();
        if (!response.ok) throw new Error(resultado.error || "Falha ao carregar a Retratt.");
        if (ativo) setRetratt(resultado);
      } catch (falha) {
        if (ativo) setErroRetratt(falha instanceof Error ? falha.message : "Falha ao carregar a Retratt.");
      } finally {
        if (ativo) setCarregandoRetratt(false);
      }
    }
    void carregarRetratt();
    return () => {
      ativo = false;
    };
  }, [sistema, retratt]);

  const organizadoresPorUsuario = useMemo(() => indiceOrganizadores(organizadores), [organizadores]);
  const eventosPorId = useMemo(() => new Map(eventos.map((evento) => [String(evento.id), evento])), [eventos]);
  const resumoItatame = useMemo(
    () => resumirItatame(inscricoes.map((item) => itemResumoDaInscricao(item, organizadoresPorUsuario))),
    [inscricoes, organizadoresPorUsuario],
  );
  const campeonatoSelecionado = visaoItatame === "campeonato" ? eventosPorId.get(eventoId) : undefined;
  const inscricoesDoCampeonato = useMemo(
    () => visaoItatame === "campeonato" && eventoId ? inscricoes.filter((item) => String(item.evento_id) === eventoId) : [],
    [eventoId, inscricoes, visaoItatame],
  );
  const resumoCampeonato = useMemo(
    () => resumirItatame(inscricoesDoCampeonato.map((item) => itemResumoDaInscricao(item, organizadoresPorUsuario))),
    [inscricoesDoCampeonato, organizadoresPorUsuario],
  );
  const resumoAtivo = visaoItatame === "campeonato" ? resumoCampeonato : resumoItatame;
  const organizadorCampeonato = campeonatoSelecionado?.organizador_id
    ? organizadoresPorUsuario.get(campeonatoSelecionado.organizador_id)
    : undefined;

  const fila = organizadores.filter((item) => item.status === "pendente").length;
  const aprovados = organizadores.filter((item) => item.status === "aprovado");
  const semMercadoPago = aprovados.filter((item) => !item.mp_connected_at).length;

  const faixas = useMemo(
    () => Array.from(new Set(inscricoes.map((item) => item.faixa).filter(Boolean))) as string[],
    [inscricoes],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return inscricoes.filter((item) => {
      const evento = item.evento_id != null ? eventosPorId.get(String(item.evento_id)) : undefined;
      const embutido = eventoEmbutido(item);
      const userId = evento?.organizador_id || embutido?.organizador_id || "";
      const organizador = organizadoresPorUsuario.get(userId);
      if (organizadorId && userId !== organizadorId) return false;
      if (visaoItatame === "campeonato" && (!eventoId || String(item.evento_id) !== eventoId)) return false;
      if (faixa && item.faixa !== faixa) return false;
      const atual = situacaoInscricao(item);
      if (situacao !== "todos" && atual !== situacao) return false;
      if (semIdMp && (atual !== "pago" || Boolean(item.mp_payment_id))) return false;
      if (!termo) return true;
      return [item.atleta, item.equipe, item.categoria, item.mp_payment_id, organizador?.nome, organizador?.academia, organizador?.email, evento?.nome, embutido?.nome]
        .join(" ")
        .toLowerCase()
        .includes(termo);
    });
  }, [busca, eventoId, eventosPorId, faixa, inscricoes, organizadorId, organizadoresPorUsuario, semIdMp, situacao, visaoItatame]);

  const resumoFiltrado = useMemo(
    () => resumirItatame(filtradas.map((item) => itemResumoDaInscricao(item, organizadoresPorUsuario))),
    [filtradas, organizadoresPorUsuario],
  );

  const retrattFiltrado = useMemo(() => {
    const termo = buscaRetratt.trim().toLowerCase();
    return (retratt?.organizadores || []).filter((item) => !termo || item.nome.toLowerCase().includes(termo));
  }, [buscaRetratt, retratt]);

  function linhaDaInscricao(item: InscricaoPainel) {
    const evento = item.evento_id != null ? eventosPorId.get(String(item.evento_id)) : undefined;
    const userId = evento?.organizador_id || eventoEmbutido(item)?.organizador_id || "";
    return montarLinhaSuporte(item, organizadoresPorUsuario.get(userId), evento);
  }

  function mudarVisaoItatame(visao: "geral" | "campeonato") {
    setVisaoItatame(visao);
    setEventoId(visao === "campeonato" ? eventoId || String(eventos[0]?.id ?? "") : "");
    setOrganizadorId("");
    setSituacao("todos");
    setSemIdMp(false);
    setBusca("");
    setFaixa("");
    setLimite(80);
  }

  function exportarItatame(formato: "pdf" | "csv") {
    if (filtradas.length === 0) {
      alert("Nenhuma inscrição do Itatame neste filtro.");
      return;
    }
    const linhas = filtradas.map(linhaDaInscricao);
    const hoje = new Date().toLocaleString("pt-BR");
    if (formato === "csv") {
      baixarCsv(
        `itatame-suporte-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Nº inscrição", "Cupom / Desconto", "Organizador", "Academia", "Contato", "Plano", "Mercado Pago", "Evento", "Data do evento", "Atleta", "Responsável adulto", "Contato do responsável", "Inscrito em (Cuiabá)", "Equipe", "Categoria", "Faixa", "Peso", "Pacote", "Valor", "Pagamento", "Pesagem", "ID Mercado Pago"],
        linhas.map((linha) => [linha.inscricao, linha.cupom, linha.organizador, linha.academia, linha.contato, linha.plano, linha.mercadoPago, linha.evento, linha.dataEvento, linha.atleta, linha.responsavel, linha.contatoResponsavel, linha.dataInscricao, linha.equipe, linha.categoria, linha.faixa, linha.peso, linha.pacote, linha.valor, linha.pagamento, linha.pesagem, linha.mercadoPagoId]),
      );
      return;
    }
    exportarPdfSuporte({
      titulo: "Itatame — ficha de suporte",
      subtitulo: `Gerado em ${hoje}. ${visaoItatame === "campeonato" ? `Campeonato: ${campeonatoSelecionado?.nome || eventoId}. ` : "Visão geral. "}${filtradas.length} inscrições no filtro atual. Valores da Retratt não entram neste relatório.`,
      resumo: [
        ["Faturamento pago", moeda(resumoFiltrado.faturamento)],
        ["Comissão da plataforma", moeda(resumoFiltrado.comissao)],
        ["Repasse dos organizadores", moeda(resumoFiltrado.repasse)],
        ["Aguardando pagamento", moeda(resumoFiltrado.pendente)],
        ["Estornado", moeda(resumoFiltrado.estornado)],
        ["Pagas", String(resumoFiltrado.pagos)],
        ["Pendentes", String(resumoFiltrado.pendentes)],
        ["Estornos", String(resumoFiltrado.estornos)],
      ],
      linhas,
      nomeArquivo: `itatame-suporte-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }

  function exportarRetratt() {
    if (!retratt || retrattFiltrado.length === 0) {
      alert("Nenhum organizador da Retratt neste filtro.");
      return;
    }
    exportarPdfRetratt({
      subtitulo: `Gerado em ${new Date().toLocaleString("pt-BR")}. Somente pedidos pagos de foto. Inscrições de campeonato ficam no relatório do Itatame.`,
      resumo: [
        ["Vendas pagas", centavos(retratt.geral.faturamentoCentavos)],
        ["Comissão Itatame", centavos(retratt.geral.comissaoItatameCentavos)],
        ["Royalty em aberto", centavos(retratt.geral.royaltyEmAbertoCentavos)],
        ["Fotos vendidas", String(retratt.geral.fotosVendidas)],
      ],
      linhas: retrattFiltrado.map((item) => ({
        organizador: item.nome,
        galerias: String(item.galerias),
        vendas: centavos(item.faturamentoCentavos),
        comissao: centavos(item.comissaoItatameCentavos),
        royaltyAberto: centavos(item.royaltyEmAbertoCentavos),
        royaltyDisponivel: centavos(item.royaltyDisponivelCentavos),
        royaltyPago: centavos(item.royaltyPagoCentavos),
      })),
      nomeArquivo: `retratt-financeiro-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] text-xs font-black uppercase tracking-widest text-indigo-400">
        <Activity className="mb-4 h-8 w-8 animate-pulse" />
        Separando Itatame e Retratt...
      </div>
    );
  }

  const visiveis = filtradas.slice(0, limite);

  return (
    <main className="min-h-screen bg-[#090a0c] p-4 text-zinc-100 md:p-5 lg:p-6">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            {fotoUrl ? <img src={fotoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400"><ShieldCheck size={18} /></span>}
            <div>
              <p className="hidden text-xs text-zinc-400 md:block">{nomeDono}</p>
              <h1 className="text-lg font-semibold tracking-tight">Administração</h1>
            </div>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push("/"))}
            className="rounded-md border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
          >
            Sair
          </button>
        </header>

        <div className="grid min-w-0 gap-3 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-5">
          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <div className="flex items-center gap-2 lg:hidden">
              <button onClick={() => setSistema("itatame")} aria-pressed={sistema === "itatame"} className={`rounded-md px-3 py-2 text-xs ${sistema === "itatame" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>iTatame</button>
              <button onClick={() => setSistema("retratt")} aria-pressed={sistema === "retratt"} className={`rounded-md px-3 py-2 text-xs ${sistema === "retratt" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>Retratt</button>
              <button onClick={() => setMenuAberto(!menuAberto)} aria-expanded={menuAberto} aria-controls="menu-super-admin" className="ml-auto rounded-md border border-white/15 px-3 py-2 text-xs">Menu <ChevronDown size={12} className="inline" /></button>
            </div>
            <nav aria-label="Navegação do super-admin" id="menu-super-admin" className={`${menuAberto ? "grid" : "hidden"} mt-2 grid-cols-2 gap-1 rounded-lg border border-white/10 bg-[#101114] p-2 text-xs sm:grid-cols-3 lg:mt-0 lg:block lg:space-y-1`}>
              <p className="col-span-2 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:col-span-3 lg:col-span-1">iTatame</p>
              <button type="button" aria-current={sistema === "itatame" ? "page" : undefined} onClick={() => setSistema("itatame")} className={`block w-full rounded-md px-3 py-2 text-left ${sistema === "itatame" ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"}`}>Visão geral</button>
              <Link href="/super-admin/organizadores" className="block rounded-md px-3 py-2 text-zinc-400 hover:bg-white/5">Organizadores {fila > 0 && <span className="ml-1 text-amber-300">({fila})</span>}</Link>
              <Link href="/super-admin/suporte" className="block rounded-md px-3 py-2 text-zinc-400 hover:bg-white/5">Suporte</Link>
              <Link href="/super-admin/inscricoes" className="block rounded-md px-3 py-2 text-zinc-400 hover:bg-white/5">Inscrições e estornos</Link>
              <Link href="/super-admin/atletas" className="block rounded-md px-3 py-2 text-zinc-400 hover:bg-white/5">Auditoria de atletas</Link>
              <p className="col-span-2 border-t border-white/10 px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:col-span-3 lg:col-span-1">Retratt</p>
              <button type="button" aria-current={sistema === "retratt" ? "page" : undefined} onClick={() => setSistema("retratt")} className={`block w-full rounded-md px-3 py-2 text-left ${sistema === "retratt" ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"}`}>Visão geral</button>
              <Link href="/super-admin/fotos" className="block rounded-md px-3 py-2 text-zinc-400 hover:bg-white/5">Financeiro e reembolsos</Link>
            </nav>
          </aside>
          <div className="min-w-0">

        {sistema === "itatame" ? (
          <section>
            <div className="mb-3 hidden lg:block">
              <h2 className="text-lg font-semibold">iTatame</h2>
              <p className="text-xs text-zinc-500">Campeonatos, inscrições e suporte aos organizadores.</p>
            </div>
            {erro && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{erro}</p>}
            <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
              <div role="group" aria-label="Escopo do painel iTatame" className="inline-flex rounded-md border border-white/15 p-0.5 text-xs">
                <button type="button" aria-pressed={visaoItatame === "geral"} onClick={() => mudarVisaoItatame("geral")} className={`rounded px-3 py-1.5 ${visaoItatame === "geral" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"}`}>Visão geral</button>
                <button type="button" aria-pressed={visaoItatame === "campeonato"} onClick={() => mudarVisaoItatame("campeonato")} className={`rounded px-3 py-1.5 ${visaoItatame === "campeonato" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"}`}>Por campeonato</button>
              </div>
              {visaoItatame === "campeonato" && <label className="min-w-0 flex-1 text-xs text-zinc-400 sm:min-w-72 sm:max-w-xl">
                <span className="sr-only">Selecionar campeonato</span>
                <select value={eventoId} onChange={(event) => { setEventoId(event.target.value); setLimite(80); }} className="w-full rounded-md border border-white/15 bg-[#101114] px-3 py-2 text-sm text-white outline-none focus:border-red-400">
                  {eventos.length === 0 && <option value="">Nenhum campeonato cadastrado</option>}
                  {eventos.map((evento) => <option key={evento.id} value={String(evento.id)}>{evento.nome || "Sem nome"} · {dataCurta(evento.data_evento)} · {organizadoresPorUsuario.get(evento.organizador_id || "")?.nome || "Organizador não identificado"}</option>)}
                </select>
              </label>}
            </div>
            {visaoItatame === "campeonato" && campeonatoSelecionado && <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-400">
              <span><strong className="font-medium text-zinc-200">Campeonato:</strong> {campeonatoSelecionado.nome}</span>
              <span><strong className="font-medium text-zinc-200">Organizador:</strong> {organizadorCampeonato?.nome || "Não identificado"}</span>
              <span><strong className="font-medium text-zinc-200">Data:</strong> {dataCurta(campeonatoSelecionado.data_evento)}</span>
              {campeonatoSelecionado.cidade && <span>{campeonatoSelecionado.cidade}{campeonatoSelecionado.estado ? `, ${campeonatoSelecionado.estado}` : ""}</span>}
            </div>}
            <div className="mb-3 rounded-lg border border-white/10 bg-[#101114]">
              <div className="grid grid-cols-2 md:grid-cols-4">
                <ResumoItem titulo="Inscrições pagas" valor={moeda(resumoAtivo.faturamento)} detalhe={`${resumoAtivo.pagos} inscrições`} />
                <ResumoItem titulo="Comissão" valor={moeda(resumoAtivo.comissao)} detalhe={`Repasse ${moeda(resumoAtivo.repasse)}`} />
                <ResumoItem titulo="Aguardando pagamento" valor={moeda(resumoAtivo.pendente)} detalhe={`${resumoAtivo.pendentes} inscrições`} />
                {visaoItatame === "campeonato"
                  ? <ResumoItem titulo="Inscrições no campeonato" valor={String(resumoAtivo.inscricoes)} detalhe={`${resumoAtivo.estornos} estorno(s)`} />
                  : <ResumoItem titulo="Organizadores ativos" valor={String(aprovados.length)} detalhe={`${eventos.length} campeonatos`} />}
              </div>
              {(fila > 0 || semMercadoPago > 0) && <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-white/10 px-4 py-2 text-xs text-zinc-400">
                {fila > 0 && <Link href="/super-admin/organizadores" className="text-amber-300 hover:underline">{fila} organizador(es) para homologar</Link>}
                {semMercadoPago > 0 && <Link href="/super-admin/suporte" className="hover:underline">{semMercadoPago} sem Mercado Pago conectado</Link>}
              </div>}
            </div>

            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [&>button]:shrink-0">
              <button type="button" onClick={() => { setSituacao("pendente"); setSemIdMp(false); }} className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-[10px] font-medium text-yellow-200">
                {resumoAtivo.pendentes} pagamentos pendentes
              </button>
              <button type="button" onClick={() => { setSituacao("pago"); setSemIdMp(true); }} className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-200">
                <AlertTriangle size={12} className="mr-1 inline" /> Pagas sem ID Mercado Pago
              </button>
              <button type="button" onClick={() => { setSituacao("estornado"); setSemIdMp(false); }} className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-200">
                {resumoAtivo.estornos} estornos
              </button>
              <button type="button" onClick={() => { setSituacao("todos"); setSemIdMp(false); setOrganizadorId(""); setFaixa(""); setBusca(""); }} className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Limpar filtros
              </button>
          </div>

            <div className="rounded-lg border border-white/10 bg-[#101114] p-3 md:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                <div>
                  <h2 className="text-sm font-semibold"><span className="md:hidden">Inscrições</span><span className="hidden md:inline">{visaoItatame === "campeonato" ? "Inscrições do campeonato" : "Inscrições · visão geral"}</span></h2>
                  <p className="mt-1 hidden text-xs text-zinc-500 md:block">
                    {filtradas.length} inscrições · pago {moeda(resumoFiltrado.faturamento)} · pendente {moeda(resumoFiltrado.pendente)}
                  </p>
            </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => exportarItatame("csv")} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-300">CSV</button>
                  <button type="button" onClick={() => exportarItatame("pdf")} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-red-300">
                    <FileText size={13} /> PDF de suporte
                  </button>
            </div>
            </div>

              <div className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4 [&>div]:hidden md:[&>div]:block">
                <label className="relative col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
                  <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Atleta, equipe, organizador, e-mail ou ID MP" className="w-full rounded-xl border border-white/10 bg-black py-2.5 pl-9 pr-3 text-xs outline-none focus:border-red-500" />
                </label>
                {visaoItatame === "geral" && <SelectFiltro value={organizadorId} onChange={setOrganizadorId} placeholder="Todos os organizadores">
                  {Array.from(organizadoresPorUsuario.values())
                    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))
                    .map((item) => (
                      <option key={item.user_id} value={item.user_id || ""}>{item.nome || "Sem nome"} · {item.academia || item.status}</option>
                    ))}
                </SelectFiltro>}
                <SelectFiltro value={situacao} onChange={(valor) => setSituacao(valor as "todos" | SituacaoInscricao)} placeholder="">
                  <option value="todos">Pagamento: todos</option>
                  <option value="pago">Somente pagos</option>
                  <option value="pendente">Somente pendentes</option>
                  <option value="estornado">Somente estornados</option>
                </SelectFiltro>
            </div>
              <div className="mb-3 hidden max-w-xs md:block">
                <SelectFiltro value={faixa} onChange={setFaixa} placeholder="Todas as faixas">
                  {faixas.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectFiltro>
          </div>

              <details className="mb-3 md:hidden">
                <summary className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400">Filtrar inscrições</summary>
                <div className="mt-2 grid gap-2">
                  {visaoItatame === "geral" && <SelectFiltro value={organizadorId} onChange={setOrganizadorId} placeholder="Todos os organizadores">{Array.from(organizadoresPorUsuario.values()).sort((a,b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")).map(item => <option key={item.user_id} value={item.user_id || ""}>{item.nome || "Sem nome"}</option>)}</SelectFiltro>}
                  <SelectFiltro value={situacao} onChange={valor => setSituacao(valor as "todos" | SituacaoInscricao)} placeholder=""><option value="todos">Pagamento: todos</option><option value="pago">Somente pagos</option><option value="pendente">Somente pendentes</option><option value="estornado">Somente estornados</option></SelectFiltro>
                  <SelectFiltro value={faixa} onChange={setFaixa} placeholder="Todas as faixas">{faixas.map(item => <option key={item} value={item}>{item}</option>)}</SelectFiltro>
                </div>
              </details>
              <div className="divide-y divide-white/10 md:hidden">
                {visiveis.length === 0 ? <p className="py-6 text-center text-xs text-zinc-500">Nenhuma inscrição neste filtro.</p> : visiveis.map(item => {
                  const linha = linhaDaInscricao(item);
                  const evento = item.evento_id != null ? eventosPorId.get(String(item.evento_id)) : undefined;
                  const userId = evento?.organizador_id || eventoEmbutido(item)?.organizador_id || "";
                  const situacaoAtual = situacaoInscricao(item);
                  const zap = whatsappDe(organizadoresPorUsuario.get(userId)?.telefone);
                  return <article key={item.id} className="py-3 text-xs">
                    <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 font-semibold text-white">{linha.atleta}</h3>
<span className={`shrink-0 ${situacaoAtual === "pago" ? "text-emerald-400" : situacaoAtual === "estornado" ? "text-red-400" : "text-amber-300"}`}>{linha.pagamento} · {linha.valor}</span></div>
                    <p className="mt-1 text-[10px] text-zinc-400">Responsável: {linha.responsavel}{linha.contatoResponsavel ? ` · ${linha.contatoResponsavel}` : ""}</p>
                    <p className="text-[10px] text-zinc-500">Inscrito em {linha.dataInscricao} (Cuiabá)</p>
                    <p className="mt-1 text-zinc-400">{linha.evento}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{linha.organizador} · {linha.equipe}</p>
                    <details className="mt-2 text-zinc-400"><summary className="cursor-pointer text-[11px]">Categoria e pagamento</summary><p className="mt-2 leading-relaxed">{linha.categoria}<br />{linha.faixa} · {linha.peso} · {linha.pacote}<br />{linha.pesagem}<br />{item.mp_payment_id ? `MP ${item.mp_payment_id}` : "Sem ID Mercado Pago"}</p></details>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px]">{userId && <Link href={`/super-admin/suporte?org=${userId}`} className="text-yellow-300">Abrir suporte</Link>}{zap && <a href={zap} target="_blank" rel="noreferrer" className="text-emerald-400">WhatsApp</a>}{evento && <Link href={`/evento/${evento.id}`}>Campeonato ↗</Link>}</div>
                  </article>;
                })}
              </div>
              <div className="hidden overflow-x-auto rounded-xl border border-white/5 md:block">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="bg-black text-[9px] uppercase tracking-widest text-zinc-500">
                    <tr>
                      <th className="p-3">Organizador</th>
                      <th className="p-3">Atleta</th>
                      <th className="p-3">Responsável adulto</th>
                      <th className="p-3">Inscrito em (Cuiabá)</th>
                      <th className="p-3">Campeonato</th>
                      <th className="p-3">Chave</th>
                      <th className="p-3">Valor</th>
                      <th className="p-3">Situação</th>
                      <th className="p-3">Suporte</th>
                  </tr>
                </thead>
                  <tbody>
                    {visiveis.length === 0 ? (
                      <tr><td colSpan={9} className="p-10 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500">Nenhuma inscrição do Itatame neste filtro.</td></tr>
                    ) : visiveis.map((item) => {
                      const linha = linhaDaInscricao(item);
                      const evento = item.evento_id != null ? eventosPorId.get(String(item.evento_id)) : undefined;
                      const userId = evento?.organizador_id || eventoEmbutido(item)?.organizador_id || "";
                      const organizador = organizadoresPorUsuario.get(userId);
                      const zap = whatsappDe(organizador?.telefone);
                      const situacaoAtual = situacaoInscricao(item);
                      return (
                        <tr key={item.id} className="border-t border-white/5 align-top">
                          <td className="p-3">
                            <p className="font-bold text-white">{linha.organizador}</p>
                            <p className="text-[10px] text-zinc-500">{linha.academia}</p>
                            <p className="text-[10px] text-zinc-600">{linha.plano}</p>
                          </td>
                          <td className="p-3">
                            <p className="font-bold">{linha.atleta}</p>
                            <p className="text-[10px] text-zinc-500">{linha.equipe}</p>
                          </td>
                          <td className="p-3"><p>{linha.responsavel}</p><p className="text-[10px] text-zinc-500">{linha.contatoResponsavel}</p></td>
                          <td className="p-3 text-zinc-400">{linha.dataInscricao}</td>
                          <td className="p-3">
                            <p>{linha.evento}</p>
                            <p className="text-[10px] text-zinc-500">{linha.dataEvento}{evento?.cidade ? ` · ${evento.cidade}` : ""}</p>
                        </td>
                          <td className="p-3">
                            <p>{linha.categoria}</p>
                            <p className="text-[10px] text-zinc-500">{linha.faixa} · {linha.peso} · {linha.pacote}</p>
                        </td>
                          <td className="p-3 font-bold">{linha.valor}</td>
                          <td className="p-3">
                            <p className={situacaoAtual === "pago" ? "text-emerald-400" : situacaoAtual === "estornado" ? "text-red-400" : "text-yellow-300"}>{linha.pagamento}</p>
                            <p className="text-[10px] text-zinc-500">{linha.pesagem}</p>
                            <p className="text-[10px] text-zinc-600">{item.mp_payment_id ? `MP ${item.mp_payment_id}` : "Sem ID MP"}</p>
                        </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              {userId && <Link href={`/super-admin/suporte?org=${userId}`} className="text-[10px] font-bold uppercase tracking-widest text-yellow-300">Abrir painel</Link>}
                              {zap && <a href={zap} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">WhatsApp</a>}
                              {evento && <Link href={`/evento/${evento.id}`} className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Página pública</Link>}
                            </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtradas.length > limite && (
                <button type="button" onClick={() => setLimite((atual) => atual + 80)} className="mt-4 w-full rounded-xl border border-white/10 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300">
                  Mostrar mais {Math.min(80, filtradas.length - limite)} de {filtradas.length - limite}
                </button>
              )}
            </div>
          </section>
        ) : (
          <section>
            <div className="mb-3 hidden lg:block">
              <h2 className="text-lg font-semibold">Retratt</h2>
              <p className="text-sm text-zinc-500">Vendas de fotos, royalties e repasses.</p>
            </div>
            {erroRetratt && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{erroRetratt}</p>}
            <div className="mb-5 grid grid-cols-2 rounded-lg border border-white/10 bg-[#101114] md:grid-cols-4">
              <ResumoItem titulo="Vendas pagas" valor={carregandoRetratt ? "Carregando…" : centavos(retratt?.geral.faturamentoCentavos)} detalhe={`${retratt?.geral.pedidosPagos || 0} pedidos`} />
              <ResumoItem titulo="Comissão" valor={centavos(retratt?.geral.comissaoItatameCentavos)} detalhe="Vendas de fotos" />
              <ResumoItem titulo="Royalty em aberto" valor={centavos(retratt?.geral.royaltyEmAbertoCentavos)} detalhe={`Pago ${centavos(retratt?.geral.royaltyPagoCentavos)}`} />
              <ResumoItem titulo="Fotos vendidas" valor={String(retratt?.geral.fotosVendidas || 0)} detalhe={`${retratt?.geral.galerias || 0} galerias`} />
            </div>

            <div className="mb-5 flex flex-wrap gap-3 text-sm">
              <Link href="/super-admin/fotos" className="text-cyan-300 hover:underline">Ver financeiro completo e reembolsos →</Link>
              <button type="button" onClick={exportarRetratt} className="text-zinc-300 hover:underline">Baixar PDF dos royalties</button>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#101114] p-4 md:p-5">
              <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-lg font-black">Organizadores na Retratt</h2>
                  <p className="mt-1 text-xs text-zinc-500">Royalties de foto. Não inclui inscrição de campeonato.</p>
                </div>
                <label className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
                  <input value={buscaRetratt} onChange={(event) => setBuscaRetratt(event.target.value)} placeholder="Buscar organizador da Retratt" className="w-full rounded-xl border border-white/10 bg-black py-2.5 pl-9 pr-3 text-xs outline-none focus:border-cyan-500" />
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="text-[9px] uppercase tracking-widest text-zinc-500">
                    <tr>
                      <th className="p-3">Organizador</th>
                      <th className="p-3">Galerias</th>
                      <th className="p-3">Vendas</th>
                      <th className="p-3">Comissão</th>
                      <th className="p-3">Royalty aberto</th>
                      <th className="p-3">Já repassado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retrattFiltrado.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-zinc-500">{carregandoRetratt ? "Carregando Retratt..." : "Nenhum organizador encontrado."}</td></tr>
                    ) : retrattFiltrado.map((item) => (
                      <tr key={item.id} className="border-t border-white/5">
                        <td className="p-3 font-bold">{item.nome}</td>
                        <td className="p-3">{item.galerias}</td>
                        <td className="p-3">{centavos(item.faturamentoCentavos)}</td>
                        <td className="p-3">{centavos(item.comissaoItatameCentavos)}</td>
                        <td className="p-3 text-amber-300">{centavos(item.royaltyEmAbertoCentavos)}</td>
                        <td className="p-3 text-emerald-300">{centavos(item.royaltyPagoCentavos)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

              <h3 className="mb-3 mt-8 text-sm font-black uppercase tracking-widest text-zinc-400">Pedidos pagos recentes</h3>
              <div className="space-y-2">
                {(retratt?.pedidosRecentes || []).map((pedido) => (
                  <article key={pedido.id} className="grid gap-2 border-t border-white/10 py-3 text-xs md:grid-cols-5">
                    <div>
                      <p className="font-bold">{pedido.galeria}</p>
                      <p className="text-[10px] text-zinc-500">{dataCurta(pedido.data)} · {pedido.fotos} fotos</p>
                    </div>
                    <p className="text-zinc-300">{pedido.organizador}</p>
                    <p className="text-zinc-400">{pedido.fotografo}</p>
                    <p>{centavos(pedido.totalCentavos)} <span className="text-zinc-500">· comissão {centavos(pedido.comissaoItatameCentavos)}</span></p>
                    <p className="text-cyan-300">{rotuloRepasse[pedido.repasseStatus] || pedido.repasseStatus} · royalty {centavos(pedido.royaltyCentavos)}</p>
                  </article>
                ))}
          </div>
        </div>
          </section>
        )}
          </div>
        </div>
      </div>
    </main>
  );
}

function ResumoItem({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <div className="min-w-0 border-b border-r border-white/10 px-3 py-2.5 last:border-r-0 md:border-b-0">
      <p className="text-[10px] text-zinc-400">{titulo}</p>
      <p className="mt-1 truncate text-base font-semibold tabular-nums md:text-lg" title={valor}>{valor}</p>
      <p className="mt-0.5 truncate text-[10px] text-zinc-500" title={detalhe}>{detalhe}</p>
    </div>
  );
}

function SelectFiltro({ value, onChange, placeholder, children }: { value: string; onChange: (valor: string) => void; placeholder: string; children: ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full appearance-none rounded-xl border border-white/10 bg-black px-3 py-2.5 text-xs font-bold outline-none focus:border-red-500">
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
    </div>
  );
}
