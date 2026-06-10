"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { ChevronRight, Medal, Search, Trophy, Clock } from "lucide-react";
import { calcularResultadosChaves, isCompetidorReal } from "../lib/ranking-eventos";

export default function RankingPage() {
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<"atletas" | "equipes" | "academias">("atletas");
  const [filtroFaixa, setFiltroFaixa] = useState("Todas");
  
  const [eventos, setEventos] = useState<any[]>([]);
  const [filtroEvento, setFiltroEvento] = useState("Geral");
  const [todosAtletas, setTodosAtletas] = useState<any[]>([]);

  const [rankingAtletas, setRankingAtletas] = useState<any[]>([]);
  const [rankingEquipes, setRankingEquipes] = useState<any[]>([]);
  const [rankingAcademias, setRankingAcademias] = useState<any[]>([]);

  const [atletaSelecionado, setAtletaSelecionado] = useState<any>(null);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoEventos, setHistoricoEventos] = useState<any[]>([]);

  useEffect(() => {
    carregarDadosIniciais();
  }, []);

  async function carregarDadosIniciais() {
    setLoading(true);

    const { data: evts } = await supabase.from("eventos").select("id, nome, regras_pontuacao_equipes").order("data_evento", { ascending: false });
    if (evts) {
      setEventos(evts);
      const eventoParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("evento") : null;
      if (eventoParam && evts.some((evento: any) => String(evento.id) === String(eventoParam))) {
        setFiltroEvento(eventoParam);
      }
    }

    const { data: atls } = await supabase.from("atletas").select("*");
    if (atls) setTodosAtletas(atls);
    
    setLoading(false);
  }

  useEffect(() => {
    if (todosAtletas.length > 0) {
      calcularRanking();
    }
  }, [filtroEvento, todosAtletas, eventos]);

  async function calcularRanking() {
    try {
      setLoading(true);

      let query = supabase.from("chaves").select("*").eq("status_luta", "concluida");
      
      if (filtroEvento !== "Geral") {
        query = query.eq("evento_id", filtroEvento);
      }

      const { data: lutas, error } = await query;
      const lutasValidas = (!error && lutas) ? lutas : [];

      const regrasPorEvento = eventos.reduce((acc: Record<string, any>, evento: any) => {
        acc[String(evento.id)] = evento.regras_pontuacao_equipes || null;
        return acc;
      }, {});

      const resultado = calcularResultadosChaves(lutasValidas, regrasPorEvento);
      const num = (valor: any) => Number(valor || 0);
      const normalizeName = (name: any) => name ? String(name).trim().toUpperCase() : "";
      
      // MAPA MESTRE: Usa o nome padronizado para impedir duplicação
      const mapAtletas = new Map();

      // 1. Regista todo mundo que está no banco de dados primeiro
      todosAtletas.forEach(atleta => {
        if (!isCompetidorReal(atleta.nome)) return;
        const key = normalizeName(atleta.nome);
        mapAtletas.set(key, { 
          ...atleta, 
          ouro: num(atleta.ouro), 
          prata: num(atleta.prata), 
          bronze: num(atleta.bronze), 
          vitorias: num(atleta.vitorias), 
          lutas: num(atleta.lutas),
          vitorias_wo: 0, // Ignoramos o WO do BD porque os dados manuais estão corrompidos (ex: 149)
          pts_calculados: 0
        });
      });

      // 2. Cruza com os resultados lidos das chaves (Motor)
      resultado.atletas.forEach((r: any) => {
        if (!isCompetidorReal(r.nome)) return;
        const key = normalizeName(r.nome);

        if (mapAtletas.has(key)) {
          const base = mapAtletas.get(key);
          
          if (filtroEvento === "Geral") {
            // FUNDE OS DADOS (Maior valor prevalece no Ranking Global)
            base.ouro = Math.max(num(r.ouro), base.ouro);
            base.prata = Math.max(num(r.prata), base.prata);
            base.bronze = Math.max(num(r.bronze), base.bronze);
            base.vitorias = Math.max(num(r.vitorias), base.vitorias);
            base.vitorias_wo = num(r.vitorias_wo); // Só confia no Motor para W.O
            base.pts_calculados = num(r.pts);
          } else {
            // EVENTO ESPECÍFICO: Sobrepõe com os dados daquela luta apenas!
            base.ouro = num(r.ouro);
            base.prata = num(r.prata);
            base.bronze = num(r.bronze);
            base.vitorias = num(r.vitorias);
            base.vitorias_wo = num(r.vitorias_wo);
            base.pts_calculados = num(r.pts);
          }
        } else {
          // Atleta novo que lutou mas não está cadastrado formalmente
          mapAtletas.set(key, {
            ...r,
            foto_url: null,
            faixa: r.faixa || "",
            academia: "",
            equipe: r.equipe || "",
            user_id: null,
            pts_calculados: num(r.pts),
            vitorias_wo: num(r.vitorias_wo)
          });
        }
      });

      const atletasEnriquecidos: any[] = [];
      
      mapAtletas.forEach((atleta, key) => {
        // Se for filtro de evento, remove quem não participou do evento!
        if (filtroEvento !== "Geral") {
           const participou = resultado.atletas.find((res: any) => normalizeName(res.nome) === key);
           if (!participou) return; 
        }

        const ptsSalvos = (atleta.ouro * 9) + (atleta.prata * 3) + atleta.bronze;
        const pontosFinais = Math.max(atleta.pts_calculados || 0, ptsSalvos);

        // Só exibe quem pontuou de fato
        if (atleta.ouro > 0 || atleta.prata > 0 || atleta.bronze > 0 || atleta.vitorias > 0 || pontosFinais > 0) {
          atletasEnriquecidos.push({
            ...atleta,
            pontos: pontosFinais
          });
        }
      });

      processarRankings(atletasEnriquecidos, filtroEvento === "Geral" ? [] : resultado.equipes);
      
    } catch (e) {
      console.error("Erro no cálculo do ranking:", e);
    } finally {
      setLoading(false);
    }
  }

  function processarRankings(dados: any[], equipesCalculadas: any[] = []) {
    const atletasProcessados = dados.map(atleta => ({
      ...atleta, 
      pontos: atleta.pontos || 0, 
      ouro: atleta.ouro || 0, 
      prata: atleta.prata || 0, 
      bronze: atleta.bronze || 0, 
      vitorias: atleta.vitorias || 0, 
      vitorias_wo: atleta.vitorias_wo || 0, 
      lutas: atleta.lutas || 0 
    }));

    atletasProcessados.sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.ouro !== a.ouro) return b.ouro - a.ouro;
      if (b.prata !== a.prata) return b.prata - a.prata;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.vitorias - a.vitorias;
    });

    setRankingAtletas(atletasProcessados);

    if (equipesCalculadas.length > 0) {
      setRankingEquipes(equipesCalculadas);
    } else {
      const mapaEquipes: Record<string, any> = {};
      atletasProcessados.forEach(atleta => {
        const nomeEquipe = atleta.equipe ? atleta.equipe.trim().toUpperCase() : "";
        if (!nomeEquipe || nomeEquipe === "SEM EQUIPE") return;
        if (!mapaEquipes[nomeEquipe]) mapaEquipes[nomeEquipe] = { nome: nomeEquipe, pontos: 0, ouro: 0, prata: 0, bronze: 0, vitorias: 0, lutas: 0 };
        mapaEquipes[nomeEquipe].pontos += atleta.pontos;
        mapaEquipes[nomeEquipe].ouro += atleta.ouro;
        mapaEquipes[nomeEquipe].prata += atleta.prata;
        mapaEquipes[nomeEquipe].bronze += atleta.bronze;
        mapaEquipes[nomeEquipe].vitorias += atleta.vitorias;
        mapaEquipes[nomeEquipe].lutas += atleta.lutas;
      });
      setRankingEquipes(Object.values(mapaEquipes).sort((a: any, b: any) => {
        if (b.pontos !== a.pontos) return b.pontos - a.pontos;
        if (b.ouro !== a.ouro) return b.ouro - a.ouro;
        return b.prata - a.prata;
      }));
    }

    const mapaAcademias: Record<string, any> = {};
    atletasProcessados.forEach(atleta => {
      const nomeAcademia = atleta.academia ? atleta.academia.trim().toUpperCase() : "";
      if (!nomeAcademia) return;
      if (!mapaAcademias[nomeAcademia]) mapaAcademias[nomeAcademia] = { nome: nomeAcademia, equipeBase: atleta.equipe, pontos: 0, ouro: 0, prata: 0, bronze: 0, vitorias: 0, lutas: 0 };
      mapaAcademias[nomeAcademia].pontos += atleta.pontos;
      mapaAcademias[nomeAcademia].ouro += atleta.ouro;
      mapaAcademias[nomeAcademia].prata += atleta.prata;
      mapaAcademias[nomeAcademia].bronze += atleta.bronze;
      mapaAcademias[nomeAcademia].vitorias += atleta.vitorias;
      mapaAcademias[nomeAcademia].lutas += atleta.lutas;
    });

    const academiasArr = Object.values(mapaAcademias).sort((a: any, b: any) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.ouro !== a.ouro) return b.ouro - a.ouro;
      return b.prata - a.prata;
    });
    setRankingAcademias(academiasArr);
  }

  async function abrirPerfilAtleta(atleta: any) {
    if (abaAtiva !== "atletas") return; 
    setAtletaSelecionado(atleta);
    setHistoricoLoading(true);
    setHistoricoEventos([]);

    if (atleta.user_id) {
      const { data } = await supabase
        .from("inscricoes")
        .select("categoria, eventos(nome, data_evento)")
        .eq("user_id", atleta.user_id)
        .eq("pagamento_ok", true);
      
      if (data) setHistoricoEventos(data);
    }
    setHistoricoLoading(false);
  }

  function fecharPerfil() {
    setAtletaSelecionado(null);
  }

  const listaAtletasExibicao = rankingAtletas.filter(a => {
    if (filtroFaixa === "Todas") return true;
    return a.faixa?.toLowerCase() === filtroFaixa.toLowerCase();
  });

  const getListaAtual = () => {
    if (abaAtiva === "atletas") return listaAtletasExibicao;
    if (abaAtiva === "equipes") return rankingEquipes;
    return rankingAcademias;
  };

  const lista = getListaAtual();
  const top3 = lista.slice(0, 3);
  const restantes = lista.slice(3, 100); 

  const getCorFaixa = (nomeFaixa: string) => {
    if (!nomeFaixa) return "bg-zinc-800 text-zinc-400 border border-zinc-700";
    const f = nomeFaixa.toLowerCase();
    if (f.includes("branca")) return "bg-white text-black shadow-sm";
    if (f.includes("azul")) return "bg-blue-600 text-white shadow-sm";
    if (f.includes("roxa")) return "bg-purple-600 text-white shadow-sm";
    if (f.includes("marrom")) return "bg-amber-800 text-white shadow-sm";
    if (f.includes("preta")) return "bg-black text-white border border-zinc-700 shadow-sm";
    return "bg-zinc-800 text-zinc-300 border border-zinc-700";
  };

  const formatarData = (dataStr: string) => {
    if (!dataStr) return "";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <main className="min-h-screen bg-[#020202] text-white overflow-x-hidden font-sans selection:bg-red-500/30 pb-12">
      
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute top-40 left-0 w-[300px] h-[300px] bg-yellow-600/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10 px-4 md:px-6 pt-3 md:pt-5">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4 border-b border-white/5 pb-4">
          <div className="flex-1">
            <Link href="/" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-[9px] font-extrabold uppercase tracking-[0.2em] mb-2 transition-colors">
              <ChevronRight className="rotate-180" size={14} /> Voltar ao Início
            </Link>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight uppercase leading-none mb-1">
              Ranking Oficial
            </h1>
            <p className="text-zinc-400 text-[11px] md:text-xs max-w-sm font-medium leading-relaxed">
              Acompanhe a elite do circuito. Pontuação com base nas regras do evento selecionado.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 w-full md:w-auto shrink-0 mt-2 md:mt-0">
            <select
              value={filtroEvento}
              onChange={(e) => setFiltroEvento(e.target.value)}
              className="w-full md:w-[280px] bg-[#0a0a0e] border border-white/10 text-white rounded-xl px-4 py-2.5 outline-none focus:border-red-500 transition-colors shadow-inner text-[10px] font-extrabold uppercase tracking-widest cursor-pointer appearance-none"
            >
              <option value="Geral">Ranking Global (Todos)</option>
              {eventos.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.nome}</option>
              ))}
            </select>

            <div className="flex bg-black/60 p-1 rounded-xl border border-white/10 w-full shadow-inner">
              <button onClick={() => setAbaAtiva("atletas")} className={`flex-1 md:flex-none px-4 py-2 text-[9px] font-extrabold uppercase tracking-[0.15em] rounded-lg transition-all ${abaAtiva === "atletas" ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>Atletas</button>
              <button onClick={() => setAbaAtiva("equipes")} className={`flex-1 md:flex-none px-4 py-2 text-[9px] font-extrabold uppercase tracking-[0.15em] rounded-lg transition-all ${abaAtiva === "equipes" ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>Equipes</button>
              <button onClick={() => setAbaAtiva("academias")} className={`flex-1 md:flex-none px-4 py-2 text-[9px] font-extrabold uppercase tracking-[0.15em] rounded-lg transition-all ${abaAtiva === "academias" ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>Academias</button>
            </div>
          </div>
        </div>

        {abaAtiva === "atletas" && (
          <div className="flex overflow-x-auto gap-2 mb-6 pb-1 scrollbar-hide mask-edges">
            {["Todas", "Preta", "Marrom", "Roxa", "Azul", "Branca", "Verde", "Laranja", "Amarela", "Cinza"].map(faixa => (
              <button 
                key={faixa} 
                onClick={() => setFiltroFaixa(faixa)}
                className={`px-4 py-1.5 rounded-lg border text-[9px] font-extrabold uppercase tracking-widest whitespace-nowrap transition-all shrink-0 ${filtroFaixa === faixa ? 'bg-white text-black border-white shadow-sm' : 'bg-transparent border-white/10 text-zinc-400 hover:border-white/30 hover:text-white hover:bg-white/5'}`}
              >
                {faixa}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <svg className="w-6 h-6 animate-spin text-zinc-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span className="text-zinc-500 text-[9px] font-extrabold uppercase tracking-widest mt-3">Calculando...</span>
          </div>
        ) : lista.length === 0 ? (
          <div className="py-16 text-center bg-[#0a0a0e]/50 border border-dashed border-white/10 rounded-2xl max-w-xl mx-auto">
            <span className="text-2xl mb-2 block opacity-50">!</span>
            <h3 className="text-sm font-extrabold text-white mb-1.5">Sem registros no momento</h3>
            <p className="text-zinc-500 text-[11px] max-w-sm mx-auto leading-relaxed">Não há lutas concluídas ou dados suficientes para montar este ranking.</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            <div className="flex items-end justify-center gap-3 md:gap-4 mb-8 h-[200px] md:h-[230px] pt-4">
              
              {/* 2º LUGAR */}
              {top3[1] && (
                <div onClick={() => abrirPerfilAtleta(top3[1])} className={`w-[30%] max-w-[140px] flex flex-col items-center relative animate-in slide-in-from-bottom-8 duration-700 delay-100 group ${abaAtiva === 'atletas' ? 'cursor-pointer' : 'cursor-default'}`}>
                  <div className="absolute -top-10 z-10 flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-1.5">
                    {abaAtiva === "atletas" && top3[1].foto_url ? (
                      <img src={top3[1].foto_url} className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-zinc-400 bg-black shadow-[0_0_15px_rgba(161,161,170,0.15)]" />
                    ) : (
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-zinc-400 bg-[#0a0a0e] flex items-center justify-center text-sm font-extrabold text-zinc-400 shadow-[0_0_15px_rgba(161,161,170,0.15)]">{abaAtiva === "atletas" ? top3[1].nome.charAt(0) : (abaAtiva === "equipes" ? "EQ" : "AC")}</div>
                    )}
                  </div>
                  <div className="w-full h-[120px] md:h-[140px] bg-gradient-to-t from-white/[0.03] to-transparent border-t-2 border-zinc-400 rounded-t-xl flex flex-col items-center justify-end pb-4 px-2 text-center relative transition-colors duration-300 group-hover:from-white/[0.06]">
                    <span className="text-zinc-500/20 font-black text-4xl absolute top-3 pointer-events-none">2</span>
                    <h4 className="text-white font-extrabold text-[10px] md:text-[11px] uppercase tracking-tight line-clamp-2 leading-tight mb-1 relative z-10">{top3[1].nome}</h4>
                    {abaAtiva === "atletas" && <span className="text-zinc-500 text-[8px] uppercase tracking-widest truncate w-full relative z-10">{top3[1].equipe || "S/ Equipe"}</span>}
                    <span className="text-zinc-300 font-extrabold text-xs md:text-sm mt-2 relative z-10">{top3[1].pontos} pts</span>
                  </div>
                </div>
              )}

              {/* 1º LUGAR */}
              {top3[0] && (
                <div onClick={() => abrirPerfilAtleta(top3[0])} className={`w-[35%] max-w-[170px] flex flex-col items-center relative z-20 animate-in slide-in-from-bottom-12 duration-700 group ${abaAtiva === 'atletas' ? 'cursor-pointer' : 'cursor-default'}`}>
                  <div className="absolute -top-12 z-10 flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-1.5">
                    {abaAtiva === "atletas" && top3[0].foto_url ? (
                      <img src={top3[0].foto_url} className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-yellow-500 bg-black shadow-[0_0_20px_rgba(234,179,8,0.2)]" />
                    ) : (
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-yellow-500 bg-[#0a0a0e] flex items-center justify-center text-xl font-extrabold text-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.2)]">{abaAtiva === "atletas" ? top3[0].nome.charAt(0) : (abaAtiva === "equipes" ? "EQ" : "AC")}</div>
                    )}
                  </div>
                  <div className="w-full h-[160px] md:h-[180px] bg-gradient-to-t from-yellow-500/10 to-transparent border-t-2 border-yellow-500 rounded-t-xl flex flex-col items-center justify-end pb-4 px-2 text-center relative transition-colors duration-300 group-hover:from-yellow-500/20">
                    <span className="text-yellow-500/10 font-black text-6xl absolute top-2 pointer-events-none">1</span>
                    <h4 className="text-white font-extrabold text-[10px] md:text-xs uppercase tracking-tight line-clamp-2 leading-tight mb-1 relative z-10">{top3[0].nome}</h4>
                    {abaAtiva === "atletas" && <span className="text-yellow-500/70 text-[8px] uppercase tracking-widest truncate w-full relative z-10">{top3[0].equipe || "S/ Equipe"}</span>}
                    <span className="text-yellow-500 font-extrabold text-sm md:text-base mt-2 relative z-10">{top3[0].pontos} pts</span>
                  </div>
                </div>
              )}

              {/* 3º LUGAR */}
              {top3[2] && (
                <div onClick={() => abrirPerfilAtleta(top3[2])} className={`w-[30%] max-w-[140px] flex flex-col items-center relative animate-in slide-in-from-bottom-8 duration-700 delay-200 group ${abaAtiva === 'atletas' ? 'cursor-pointer' : 'cursor-default'}`}>
                  <div className="absolute -top-10 z-10 flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-1.5">
                    {abaAtiva === "atletas" && top3[2].foto_url ? (
                      <img src={top3[2].foto_url} className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-orange-600 bg-black shadow-[0_0_15px_rgba(234,88,12,0.15)]" />
                    ) : (
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-orange-600 bg-[#0a0a0e] flex items-center justify-center text-sm font-extrabold text-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.15)]">{abaAtiva === "atletas" ? top3[2].nome.charAt(0) : (abaAtiva === "equipes" ? "EQ" : "AC")}</div>
                    )}
                  </div>
                  <div className="w-full h-[100px] md:h-[120px] bg-gradient-to-t from-orange-500/5 to-transparent border-t-2 border-orange-600 rounded-t-xl flex flex-col items-center justify-end pb-4 px-2 text-center relative transition-colors duration-300 group-hover:from-orange-500/10">
                    <span className="text-orange-600/10 font-black text-4xl absolute top-3 pointer-events-none">3</span>
                    <h4 className="text-white font-extrabold text-[10px] md:text-[11px] uppercase tracking-tight line-clamp-2 leading-tight mb-1 relative z-10">{top3[2].nome}</h4>
                    {abaAtiva === "atletas" && <span className="text-orange-500/70 text-[8px] uppercase tracking-widest truncate w-full relative z-10">{top3[2].equipe || "S/ Equipe"}</span>}
                    <span className="text-orange-500 font-extrabold text-xs md:text-sm mt-2 relative z-10">{top3[2].pontos} pts</span>
                  </div>
                </div>
              )}
            </div>

            {/* LISTAGEM */}
            <div className="bg-[#0a0a0e]/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
              <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-white/10 bg-black/40 text-[9px] font-extrabold uppercase tracking-widest text-zinc-500">
                <div className="col-span-1 text-center">Pos</div>
                <div className="col-span-5">{abaAtiva === "atletas" ? "Atleta" : (abaAtiva === "equipes" ? "Bandeira / Equipe" : "Academia / CT")}</div>
                <div className="col-span-4 flex items-center justify-end gap-5 text-center">
                  <span className="w-8 text-yellow-500/70" title="Ouro">OURO</span>
                  <span className="w-8 text-zinc-400/70" title="Prata">PRATA</span>
                  <span className="w-8 text-orange-600/70" title="Bronze">BRONZE</span>
                </div>
                <div className="col-span-2 text-right">Pontuação</div>
              </div>

              <div className="flex flex-col">
                {restantes.map((item, index) => {
                  const pos = index + 4;
                  return (
                    <div key={index} onClick={() => abrirPerfilAtleta(item)} className={`grid grid-cols-1 md:grid-cols-12 gap-3 px-4 md:px-5 py-2.5 border-b border-white/5 transition-colors items-center group ${abaAtiva === 'atletas' ? 'cursor-pointer hover:bg-white/[0.03]' : 'hover:bg-white/[0.01]'}`}>
                      <div className="hidden md:flex col-span-1 justify-center"><span className="text-xs font-bold text-zinc-600 group-hover:text-zinc-400 transition-colors">{pos}º</span></div>
                      <div className="col-span-1 md:col-span-5 flex items-center gap-3 overflow-hidden">
                        <div className="md:hidden w-5 text-center text-[10px] font-bold text-zinc-600">{pos}º</div>
                        {abaAtiva === "atletas" ? (
                          <>
                            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-white/10 overflow-hidden shrink-0 group-hover:border-white/30 transition-colors">
                              {item.foto_url ? <img src={item.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-extrabold text-zinc-500">{item.nome.charAt(0)}</div>}
                            </div>
                            <div className="truncate flex-1">
                              <h4 className="text-[11px] font-extrabold text-zinc-200 uppercase tracking-tight truncate group-hover:text-white transition-colors">{item.nome}</h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {item.faixa && <span className="text-[7px] font-extrabold text-zinc-500 uppercase tracking-widest">{item.faixa} /</span>}
                                <span className="text-[7px] font-medium text-zinc-500 uppercase tracking-widest truncate">{item.equipe || "S/ Equipe"}</span>
                                {abaAtiva === "atletas" && item.vitorias_wo > 0 && <span className="text-[7px] font-extrabold text-cyan-500 uppercase tracking-widest">W.O. {item.vitorias_wo}</span>}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 truncate">
                            <div className="truncate flex-1">
                              <h4 className="text-[11px] font-extrabold text-zinc-200 uppercase tracking-tight truncate">{item.nome}</h4>
                              {abaAtiva === "academias" && item.equipeBase && <span className="text-[7px] font-medium text-zinc-500 uppercase tracking-widest truncate block mt-0.5">Bandeira: {item.equipeBase}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="col-span-1 md:col-span-4 flex items-center md:justify-end gap-5 ml-8 md:ml-0">
                        <div className="flex flex-col md:flex-row items-center gap-1 md:w-8 text-center"><span className="text-[7px] md:hidden text-yellow-600 uppercase font-bold">Ouro</span><span className="text-[11px] font-bold text-zinc-300 group-hover:text-yellow-500 transition-colors">{item.ouro}</span></div>
                        <div className="flex flex-col md:flex-row items-center gap-1 md:w-8 text-center"><span className="text-[7px] md:hidden text-zinc-500 uppercase font-bold">Prata</span><span className="text-[11px] font-bold text-zinc-400">{item.prata}</span></div>
                        <div className="flex flex-col md:flex-row items-center gap-1 md:w-8 text-center"><span className="text-[7px] md:hidden text-orange-700 uppercase font-bold">Bronze</span><span className="text-[11px] font-bold text-zinc-500">{item.bronze}</span></div>
                      </div>
                      <div className="col-span-1 md:col-span-2 text-right absolute right-4 md:static">
                        <span className="text-white font-extrabold text-xs">{item.pontos} <span className="text-[8px] text-zinc-500 uppercase font-medium">pts</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL PERFIL DO ATLETA */}
      {atletaSelecionado && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="absolute inset-0 cursor-pointer" onClick={fecharPerfil}></div>
          <div className="bg-[#0a0a0e] border border-white/10 rounded-[2rem] w-full max-w-sm shadow-2xl relative z-10 p-5 pt-8 flex flex-col items-center">
            <button onClick={fecharPerfil} className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-transparent hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer z-20"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            <div className="w-20 h-20 rounded-full border-4 border-[#161622] bg-zinc-900 overflow-hidden mb-3 shadow-[0_0_20px_rgba(0,0,0,0.8)] shrink-0">
              {atletaSelecionado.foto_url ? <img src={atletaSelecionado.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl font-extrabold text-zinc-600">{atletaSelecionado.nome.charAt(0)}</div>}
            </div>
            <h2 className="text-base font-extrabold text-white uppercase tracking-tight text-center leading-tight mb-1 w-full px-2">{atletaSelecionado.nome}</h2>
            <div className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest mt-1 mb-4 ${getCorFaixa(atletaSelecionado.faixa)}`}>Faixa {atletaSelecionado.faixa || "não informada"}</div>
            
            <div className="w-full grid grid-cols-2 gap-3 text-center border-y border-white/5 py-3 mb-4">
              <div className="flex flex-col items-center justify-center"><span className="block text-[8px] text-zinc-500 font-extrabold uppercase tracking-widest mb-1">Equipe Global</span><span className="block text-[11px] font-bold text-zinc-300 truncate w-full px-1">{atletaSelecionado.equipe || "-"}</span></div>
              <div className="flex flex-col items-center justify-center border-l border-white/5 pl-2"><span className="block text-[8px] text-zinc-500 font-extrabold uppercase tracking-widest mb-1">CT / Academia</span><span className="block text-[11px] font-bold text-zinc-300 truncate w-full px-1">{atletaSelecionado.academia || "-"}</span></div>
            </div>

            <div className="w-full mb-4">
              <h4 className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5"><Trophy size={12}/> Quadro de Medalhas</h4>
              <div className="grid grid-cols-5 gap-1.5">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2 text-center"><span className="block text-base font-extrabold text-yellow-500">{atletaSelecionado.ouro}</span><span className="block text-[7px] text-yellow-600 font-extrabold uppercase mt-0.5">Ouro</span></div>
                <div className="bg-zinc-400/10 border border-zinc-400/20 rounded-xl p-2 text-center"><span className="block text-base font-extrabold text-zinc-300">{atletaSelecionado.prata}</span><span className="block text-[7px] text-zinc-500 font-extrabold uppercase mt-0.5">Prata</span></div>
                <div className="bg-orange-600/10 border border-orange-600/20 rounded-xl p-2 text-center"><span className="block text-base font-extrabold text-orange-500">{atletaSelecionado.bronze}</span><span className="block text-[7px] text-orange-600 font-extrabold uppercase mt-0.5">Bronze</span></div>
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-2 text-center"><span className="block text-base font-extrabold text-cyan-400">{atletaSelecionado.vitorias_wo || 0}</span><span className="block text-[7px] text-cyan-600 font-extrabold uppercase mt-0.5">W.O.</span></div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center flex flex-col justify-center items-center"><span className="block text-xs font-extrabold text-white">{atletaSelecionado.pontos}</span><span className="block text-[7px] text-zinc-400 font-extrabold uppercase mt-0.5">Pts</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}