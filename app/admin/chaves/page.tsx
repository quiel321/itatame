"use client"

import { obterEventoOrganizador, guardarEventoOrganizador } from '@/app/lib/evento-organizador';

import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { criarChavesImpressao, chaveGrupoPDF, type LutaImpressao } from '../../lib/chaves-impressao';
import { criarKitContingenciaPDF } from "../../lib/kit-contingencia-pdf"
import { rotuloLuta } from "../../lib/lutas-rotulos"
import { semFaixaDuplicada } from "../../lib/categorias-competicao"

type EventoOrganizador = {
  id: string | number;
  nome: string;
  data_fim_inscricoes?: string | null;
  lote1_data_fim?: string | null;
  lote2_data_fim?: string | null;
  lote3_data_fim?: string | null;
  data_fim_checagem?: string | null;
  data_divulgacao_chaves?: string | null;
};

export default function GerarChavesPage() {
  const router = useRouter()
  
  const [chavesImpressao, setChavesImpressao] = useState<LutaImpressao[]>([]);
  const [grupoImpressao, setGrupoImpressao] = useState('');
  const [eventos, setEventos] = useState<EventoOrganizador[]>([])
  const [eventoId, setEventoId] = useState("")
  useEffect(() => { if (eventoId && eventoId !== 'todos') guardarEventoOrganizador(eventoId); }, [eventoId]);
  const [loading, setLoading] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" })
  
  const [previa, setPrevia] = useState<{ assinatura: string; grupos: { categoria: string; atletas: number; equipesAcimaDoLimite: { nome: string; total: number }[] }[] } | null>(null);
  const [tipoGeracao, setTipoGeracao] = useState("peso") 
  const [ignorarPagamento, setIgnorarPagamento] = useState(false)

  const eventoSelecionado = eventos.find((evento) => evento.id.toString() === eventoId)
  const fimInscricoesSelecionado = obterFimInscricoes(eventoSelecionado)
  const chaveamentoBloqueado = Boolean(fimInscricoesSelecionado && new Date() < fimInscricoesSelecionado)

  function obterFimInscricoes(evento?: EventoOrganizador) {
    const dataFim = evento?.data_fim_inscricoes || evento?.lote3_data_fim || evento?.lote2_data_fim || evento?.lote1_data_fim
    return dataFim ? new Date(dataFim) : null
  }

  function alterarConfiguracao(changes: { eventoId?: string; tipo?: string; ignorarPagamento?: boolean }) {
    if (changes.eventoId !== undefined) setEventoId(changes.eventoId);
    if (changes.tipo !== undefined) setTipoGeracao(changes.tipo);
    if (changes.ignorarPagamento !== undefined) setIgnorarPagamento(changes.ignorarPagamento);
    setPrevia(null);
    setChavesImpressao([]);
    setGrupoImpressao('');
  }

  function formatarDataHora(valor: Date | null) {
    if (!valor) return "Data não definida"
    return valor.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  }

  // ==========================================
  // CARREGAMENTO DOS EVENTOS DO ORGANIZADOR
  // ==========================================
  useEffect(() => {
    async function carregarMeusEventos() {
      const { data: authData } = await supabase.auth.getUser();
      
      if (!authData.user) {
        router.push("/login-organizador");
        return;
      }

      const { data, error } = await supabase
        .from("eventos")
        .select("id, nome, data_fim_inscricoes, lote1_data_fim, lote2_data_fim, lote3_data_fim, data_fim_checagem, data_divulgacao_chaves")
        .eq("organizador_id", authData.user.id)
        .order("id", { ascending: false })

      if (!error && data) {
        setEventos(data)
        if (data.length > 0) {
          setEventoId(obterEventoOrganizador(data))
        } else {
          setMensagem({ tipo: "erro", texto: "Nenhum evento criado por este organizador." })
        }
      }
    }
    carregarMeusEventos()
  }, [router])

  async function gerarChaves() {
    setLoading(true); setMensagem({ tipo: '', texto: '' });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resposta = await fetch('/api/organizador/chaves', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ eventoId, tipo: tipoGeracao, ignorarPagamento, confirmar: previa?.assinatura }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error || 'Falha no chaveamento.');
      if (dados.previa) { setPrevia(dados.previa); }
      else { setPrevia(null); setMensagem({ tipo: 'sucesso', texto: `${dados.total} lutas geradas. Chaves anteriores substituídas com segurança.` }); }
    } catch (error) { setPrevia(null); setMensagem({ tipo: 'erro', texto: (error as Error).message }); }
    finally { setLoading(false); }
  }

  // ==========================================
  // EXPORTACAO (MANTIDA)
  // ==========================================
  const buscarChavesParaExportacao = async () => {
    if (!eventoId) {
      alert("Selecione um evento primeiro.");
      return null;
    }
    
    setExportando(true);
    
    let query = supabase.from("chaves").select("*").eq("evento_id", eventoId);
    
    if (tipoGeracao === "absoluto") {
      query = query.ilike("categoria", "%Absoluto%");
    } else {
      query = query.not("categoria", "ilike", "%Absoluto%");
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      alert(`Nenhuma chave de ${tipoGeracao === 'peso' ? 'Categoria de Peso' : 'Absoluto'} encontrada! Gere o chaveamento primeiro.`);
      setExportando(false);
      return null;
    }
    
    const lutasReais = data.filter(l => !(l.atleta_1 === "BYE" && l.atleta_2 === "BYE"));
    lutasReais.sort((a, b) => Number(a.id_visual) - Number(b.id_visual));

    setExportando(false);
    return lutasReais;
  }

  async function carregarImpressao() {
    setExportando(true);
    const { data, error } = await supabase.from('chaves').select('*').eq('evento_id', eventoId);
    if (error) setMensagem({ tipo: 'erro', texto: 'Não foi possível carregar as chaves.' });
    else setChavesImpressao((data || []).filter(l => tipoGeracao === 'absoluto' ? String(l.categoria).includes('Absoluto') : !String(l.categoria).includes('Absoluto')));
    setExportando(false);
  }
  function imprimirChaves(todas: boolean) {
    try {
      const lutas = todas ? chavesImpressao : chavesImpressao.filter(l => chaveGrupoPDF(l) === grupoImpressao);
      criarChavesImpressao({ eventoNome: eventoSelecionado?.nome || 'Campeonato', lutas }).save(todas ? 'chaves-completas.pdf' : 'chave-individual.pdf');
    } catch (error) { setMensagem({ tipo: 'erro', texto: (error as Error).message }); }
  }

  const formatarNome = (nome: string) => (nome === "BYE" || nome === "TBD") ? "SEM OPONENTE" : nome;
  const formatarEquipe = (nome: string, equipe: string) => (nome === "BYE" || nome === "TBD") ? "" : (equipe || "-");

  const exportarMesarioPDF = async () => {
    const lutas = await buscarChavesParaExportacao();
    if (!lutas) return;

    const nomeEventoAtual = eventos.find(e => e.id.toString() === eventoId)?.nome || "Evento";
    const nomeArquivoCompl = tipoGeracao === 'peso' ? 'Categorias' : 'Absoluto';
    const doc = criarKitContingenciaPDF({
      eventoNome: nomeEventoAtual,
      tipoChave: nomeArquivoCompl,
      lutas,
    });
    doc.save(`kit_contingencia_${nomeArquivoCompl}_${nomeEventoAtual.replace(/\s+/g, '_')}.pdf`);
  }

  const exportarMesarioCSV = async () => {
    const lutas = await buscarChavesParaExportacao();
    if (!lutas) return;

    const headers = ["Categoria", "Faixa", "Fase", "Identificação", "Atleta 1 (Vermelho)", "Equipe 1", "Atleta 2 (Azul)", "Equipe 2", "Vencedor"];
    
    const csvRows = lutas.map(l => [
      `"${l.categoria}"`,
      `"${l.faixa}"`,
      `"${l.fase}"`,
      `"${rotuloLuta(l)}"`,
      `"${formatarNome(l.atleta_1)}"`,
      `"${formatarEquipe(l.atleta_1, l.equipe_1)}"`,
      `"${formatarNome(l.atleta_2)}"`,
      `"${formatarEquipe(l.atleta_2, l.equipe_2)}"`,
      `""` 
    ].join(","));

    const csvContent = ["\uFEFF" + headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const nomeEventoAtual = eventos.find(e => e.id.toString() === eventoId)?.nome || "evento";
    const nomeArquivoCompl = tipoGeracao === 'peso' ? 'Categorias' : 'Absoluto';
    
    link.setAttribute("download", `chaveamento_${nomeArquivoCompl}_${nomeEventoAtual.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <main className="bg-[#050505] text-white p-4 pt-12 pb-12 md:pt-20 md:min-h-screen relative overflow-x-hidden">
      
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-xl mx-auto relative z-10">
        
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="cursor-pointer p-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white border border-white/5 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight leading-none">Gerador de Chaves</h1>
            <p className="text-zinc-500 text-[10px] md:text-xs mt-1 uppercase tracking-widest">Motor de sorteio de lutas</p>
          </div>
        </div>

        <div className="bg-[#0a0a0e]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl mb-6">
          
          <div className="flex gap-2 mb-5">
            <button onClick={() => alterarConfiguracao({ tipo: "peso" })} className={`cursor-pointer flex-1 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${tipoGeracao === "peso" ? "bg-[#57d8ff]/10 border-[#57d8ff]/50 text-[#57d8ff] shadow-[0_0_10px_rgba(87,216,255,0.1)]" : "bg-black/50 border-white/5 text-zinc-500 hover:text-white"}`}>
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
              Por Categorias
            </button>
            <button onClick={() => alterarConfiguracao({ tipo: "absoluto" })} className={`cursor-pointer flex-1 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${tipoGeracao === "absoluto" ? "bg-yellow-500/10 border-yellow-500/50 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.1)]" : "bg-black/50 border-white/5 text-zinc-500 hover:text-white"}`}>
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Absoluto Livre
            </button>
          </div>

          <div className="mb-5">
            <label className="block text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Selecione o Evento Alvo</label>
            <div className="relative">
              <select value={eventoId} onChange={(e) => alterarConfiguracao({ eventoId: e.target.value })} className="cursor-pointer w-full bg-black/50 border border-white/10 focus:border-red-500 outline-none rounded-xl px-4 py-3 text-white transition-all appearance-none font-bold text-xs md:text-sm">
                <option value="">Selecione um campeonato</option>
                {eventos.map(ev => <option key={ev.id} value={ev.id.toString()}>{ev.nome}</option>)}
              </select>
              <svg className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7-7-7-7"></path></svg>
            </div>
            <div className={`mt-3 rounded-xl border p-3 text-[10px] md:text-xs font-bold ${chaveamentoBloqueado ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-200" : "bg-green-500/10 border-green-500/20 text-green-300"}`}>
              {fimInscricoesSelecionado ? (
                chaveamentoBloqueado
                  ? <>Inscrições abertas até {formatarDataHora(fimInscricoesSelecionado)}. O chaveamento fica bloqueado até o encerramento.</>
                  : <>Inscrições encerradas. Chaveamento liberado para este evento.</>
              ) : (
                <>Data de encerramento não definida. Configure o evento antes de gerar as chaves.</>
              )}
            </div>
            {eventoSelecionado?.data_divulgacao_chaves && (
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-400 md:text-xs">
                Geração automática: após o fim da checagem ({formatarDataHora(eventoSelecionado.data_fim_checagem ? new Date(eventoSelecionado.data_fim_checagem) : null)}), as chaves são criadas na divulgação ({formatarDataHora(new Date(eventoSelecionado.data_divulgacao_chaves))}). O botão abaixo continua valendo para antecipar ou refazer, enquanto nenhuma luta tiver começado.
              </p>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <label className="flex items-center gap-3 cursor-pointer bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-colors group">
              <div className="relative flex items-center justify-center shrink-0">
                <input type="checkbox" checked={ignorarPagamento} onChange={(e) => alterarConfiguracao({ ignorarPagamento: e.target.checked })} className="peer appearance-none w-5 h-5 border-2 border-zinc-500 rounded bg-black/50 checked:bg-yellow-500 checked:border-yellow-500 transition-colors cursor-pointer"/>
                <svg className="absolute w-3.5 h-3.5 text-black opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <div>
                <h4 className="text-white font-black text-[10px] md:text-xs uppercase tracking-widest group-hover:text-yellow-400 transition-colors">Evento Gratuito / Isento</h4>
                <p className="text-zinc-500 text-[9px] md:text-[10px] mt-0.5 leading-relaxed">Ignora o bloqueio financeiro no sorteio.</p>
              </div>
            </label>

            <div className="relative bg-[#2f0404] border border-red-500/50 rounded-xl p-4 md:p-5 shadow-[0_0_20px_rgba(239,68,68,0.15)] overflow-hidden">
              <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none"></div>
              <div className="relative z-10 flex items-start gap-4">
                <div className="bg-red-500/20 p-2.5 rounded-full shrink-0">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <div>
                  <h4 className="text-red-500 font-black text-[11px] md:text-xs uppercase tracking-widest mb-1.5 drop-shadow-md">Conferência antes do sorteio</h4>
                  <p className="text-red-200/90 text-[10px] md:text-xs font-medium leading-relaxed">
                    Gere o chaveamento <strong>APENAS APÓS o encerramento das inscrições</strong>. O algoritmo incluirá apenas os atletas com <strong>Pagamento Confirmado</strong>. Você verá as divisões antes de confirmar. Eventos com lutas iniciadas ou resultados não podem ser regenerados.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <section className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[10px] leading-relaxed text-zinc-300 md:text-xs">
            <strong className="text-white">Separação de equipes:</strong> com até dois atletas da mesma equipe na divisão, eles são colocados em lados opostos e só podem se encontrar na final. Em chave de três atletas aplica-se a exceção própria desse formato. Com três ou mais atletas da mesma equipe, o sistema maximiza a distância entre eles e mostra o alerta na conferência.
          </section>
          {previa && <section className="mb-4 rounded-xl border border-cyan-500/30 p-4"><h2 className="font-bold mb-3">Confira as divisões</h2><ul className="space-y-3 text-xs">{previa.grupos.map(g => <li key={g.categoria}>{g.categoria}: <strong>{g.atletas} atleta(s)</strong>{g.atletas === 1 ? ' · Sem adversário' : ''}{g.equipesAcimaDoLimite.length > 0 && <div className="mt-1 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2 text-yellow-200">Atenção: {g.equipesAcimaDoLimite.map(e => `${e.nome} (${e.total})`).join(', ')}. Há mais de dois atletas da mesma equipe; o encontro antes da final pode ser inevitável.</div>}</li>)}</ul><button onClick={() => setPrevia(null)} className="mt-3 text-zinc-400 underline">Cancelar prévia</button></section>}
          <button onClick={gerarChaves} disabled={loading || !eventoId || chaveamentoBloqueado || !fimInscricoesSelecionado} className="cursor-pointer disabled:cursor-not-allowed w-full bg-red-600 hover:bg-red-500 text-white rounded-xl py-3.5 font-black text-xs md:text-sm uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            {loading ? "Processando Algoritmo..." : `${previa ? "Confirmar geração" : "Conferir inscritos"} - ${tipoGeracao === 'peso' ? 'Categoria' : 'Absoluto'}`}
          </button>
          
          {mensagem.texto && (
            <div className={`mt-4 border rounded-xl p-3 flex items-center justify-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider pointer-events-none ${mensagem.tipo === "sucesso" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
              {mensagem.tipo === "sucesso" ? "✅" : "⚠️"} {mensagem.texto}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-b from-[#111116] to-black border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            </div>
            <div>
              <h2 className="text-white font-black text-sm md:text-base uppercase tracking-widest leading-none">Plano B do Campeonato</h2>
              <p className="text-zinc-500 text-[9px] md:text-[10px] mt-1">Caderno simples para operar no papel, inclusive no plano Essencial e sem painéis de staff.</p>
            </div>
          </div>

          <section className="mb-5 space-y-3">
            <h3 className="font-bold text-sm">Chaves para impressão</h3>
            <button onClick={carregarImpressao} disabled={!eventoId || exportando} className="text-sm text-cyan-300">Carregar / atualizar chaves</button>
            <select aria-label="Categoria para impressão" value={grupoImpressao} onChange={e => setGrupoImpressao(e.target.value)} className="w-full rounded-xl bg-black border border-white/10 p-3 text-xs"><option value="">Selecione uma categoria</option>{Array.from(new Map(chavesImpressao.map(l => [chaveGrupoPDF(l), `${semFaixaDuplicada(l.categoria || '', l.faixa || '')} · ${l.faixa || 'Faixa não informada'}`])).entries()).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
            <div className="flex gap-2"><button disabled={!grupoImpressao} onClick={() => imprimirChaves(false)} className="rounded-lg border border-white/10 p-3 text-xs disabled:opacity-40">PDF individual</button><button disabled={!chavesImpressao.length} onClick={() => imprimirChaves(true)} className="rounded-lg bg-red-600 p-3 text-xs disabled:opacity-40">PDF de todas as chaves</button></div>
            <Link href={`/admin/resultados?evento=${eventoId}`} className="inline-block text-xs text-zinc-300 underline">Lançar resultados da súmula</Link>
          </section>
          <div className="flex gap-3">
            <button onClick={exportarMesarioPDF} disabled={exportando || !eventoId} className="cursor-pointer disabled:opacity-50 flex-1 flex flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl py-4 transition-colors">
              {exportando ? (
                <svg className="w-6 h-6 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <>
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Kit Offline PDF</span>
                </>
              )}
            </button>
            <button onClick={exportarMesarioCSV} disabled={exportando || !eventoId} className="cursor-pointer disabled:opacity-50 flex-1 flex flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl py-4 transition-colors">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Exportar CSV</span>
            </button>
          </div>
        </div>

      </div>
    </main>
  )
}
