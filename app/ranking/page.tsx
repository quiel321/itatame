"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RankingPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<"atletas" | "equipes" | "academias">("atletas");
  const [filtroFaixa, setFiltroFaixa] = useState("Todas");
  
  // Estados de Filtro Dinâmico
  const [eventos, setEventos] = useState<any[]>([]);
  const [filtroEvento, setFiltroEvento] = useState("Geral");
  const [todosAtletas, setTodosAtletas] = useState<any[]>([]);
  
  // NOVO: Estado para armazenar quem realmente está inscrito em eventos
  const [nomesInscritos, setNomesInscritos] = useState<string[]>([]);

  // Listas processadas
  const [rankingAtletas, setRankingAtletas] = useState<any[]>([]);
  const [rankingEquipes, setRankingEquipes] = useState<any[]>([]);
  const [rankingAcademias, setRankingAcademias] = useState<any[]>([]);

  // Estados do Modal/Popup de Perfil
  const [atletaSelecionado, setAtletaSelecionado] = useState<any>(null);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoEventos, setHistoricoEventos] = useState<any[]>([]);

  // Regra Oficial de Pontuação (Padrão CBJJ)
  const PTS_OURO = 9;
  const PTS_PRATA = 3;
  const PTS_BRONZE = 1;

  useEffect(() => {
    carregarDadosIniciais();
  }, []);

  async function carregarDadosIniciais() {
    setLoading(true);

    const { data: evts } = await supabase.from("eventos").select("id, nome").order("data_evento", { ascending: false });
    if (evts) setEventos(evts);

    // NOVO: Busca apenas os nomes na tabela de inscrições para cruzar os dados
    const { data: insc } = await supabase.from("inscricoes").select("atleta");
    if (insc) {
      const listaNomes = insc.map((i: any) => i.atleta?.trim().toUpperCase()).filter(Boolean);
      setNomesInscritos(listaNomes);
    }

    const { data: atls } = await supabase.from("atletas").select("id, user_id, nome, equipe, academia, faixa, foto_url, ouro, prata, bronze");
    if (atls) {
      setTodosAtletas(atls);
    } else {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Adicionado o 'nomesInscritos' na dependência para garantir que só calcula quando tiver a lista
    if (todosAtletas.length > 0) {
      calcularRanking();
    }
  }, [filtroEvento, todosAtletas, nomesInscritos]);

  // =======================================================
  // FILTRO ANTI-FANTASMA (Barra BYE, TBD e Professores no sofá)
  // =======================================================
  const isAtletaValido = (nome: string | null) => {
    if (!nome) return false;
    const limpo = nome.trim().toUpperCase();
    if (limpo === "BYE" || limpo === "TBD" || limpo === "") return false;

    // NOVO: O atleta OBRIGATORIAMENTE precisa estar na tabela de inscricoes
    if (!nomesInscritos.includes(limpo)) {
      return false;
    }

    return true;
  };

  async function calcularRanking() {
    setLoading(true);

    if (filtroEvento === "Geral") {
      // Aplica o filtro de atleta válido no Global também
      const dadosComMedalhas = todosAtletas.filter(a => 
        isAtletaValido(a.nome) && (a.ouro > 0 || a.prata > 0 || a.bronze > 0)
      );
      processarRankings(dadosComMedalhas);
      setLoading(false);

    } else {
      const { data: lutas } = await supabase
        .from("chaves")
        .select("*")
        .eq("evento_id", filtroEvento)
        .not("vencedor", "is", null);

      if (!lutas || lutas.length === 0) {
        processarRankings([]); 
        setLoading(false);
        return;
      }

      const mapaEvento: Record<string, any> = {};

      const getAtletaBase = (nomeLutador: string) => {
        const nomeLimpo = nomeLutador.trim().toUpperCase();
        const at = todosAtletas.find(a => a.nome && a.nome.trim().toUpperCase() === nomeLimpo);
        return at ? { ...at } : { nome: nomeLutador, equipe: "", academia: "", faixa: "", foto_url: null, user_id: null };
      };

      lutas.forEach(luta => {
        const isFinal = String(luta.id_visual) === "999";
        const isSemi = String(luta.proxima_luta) === "999";
        
        if (!isFinal && !isSemi) return;

        const vencedor = luta.vencedor;
        const perdedor = luta.vencedor === luta.atleta_1 ? luta.atleta_2 : luta.atleta_1;

        // Só dá medalha se passar no teste de validade!
        if (isFinal && isAtletaValido(vencedor)) {
          if (!mapaEvento[vencedor]) mapaEvento[vencedor] = { ...getAtletaBase(vencedor), ouro: 0, prata: 0, bronze: 0 };
          mapaEvento[vencedor].ouro += 1;
        }
        
        if (isFinal && isAtletaValido(perdedor)) {
          if (!mapaEvento[perdedor]) mapaEvento[perdedor] = { ...getAtletaBase(perdedor), ouro: 0, prata: 0, bronze: 0 };
          mapaEvento[perdedor].prata += 1;
        }
        
        if (isSemi && isAtletaValido(perdedor)) {
          if (!mapaEvento[perdedor]) mapaEvento[perdedor] = { ...getAtletaBase(perdedor), ouro: 0, prata: 0, bronze: 0 };
          mapaEvento[perdedor].bronze += 1;
        }
      });

      processarRankings(Object.values(mapaEvento));
      setLoading(false);
    }
  }

  function processarRankings(dados: any[]) {
    const atletasProcessados = dados.map(atleta => {
      const o = atleta.ouro || 0;
      const p = atleta.prata || 0;
      const b = atleta.bronze || 0;
      const pontos = (o * PTS_OURO) + (p * PTS_PRATA) + (b * PTS_BRONZE);
      return { ...atleta, pontos, ouro: o, prata: p, bronze: b };
    });

    atletasProcessados.sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.ouro !== a.ouro) return b.ouro - a.ouro;
      return b.prata - a.prata;
    });

    setRankingAtletas(atletasProcessados);

    const mapaEquipes: Record<string, any> = {};
    atletasProcessados.forEach(atleta => {
      const nomeEquipe = atleta.equipe ? atleta.equipe.trim().toUpperCase() : "";
      if (!nomeEquipe || nomeEquipe === "SEM EQUIPE") return;
      if (!mapaEquipes[nomeEquipe]) mapaEquipes[nomeEquipe] = { nome: nomeEquipe, pontos: 0, ouro: 0, prata: 0, bronze: 0 };
      mapaEquipes[nomeEquipe].pontos += atleta.pontos;
      mapaEquipes[nomeEquipe].ouro += atleta.ouro;
      mapaEquipes[nomeEquipe].prata += atleta.prata;
      mapaEquipes[nomeEquipe].bronze += atleta.bronze;
    });

    const equipesArr = Object.values(mapaEquipes).sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.ouro !== a.ouro) return b.ouro - a.ouro;
      return b.prata - a.prata;
    });
    setRankingEquipes(equipesArr);

    const mapaAcademias: Record<string, any> = {};
    atletasProcessados.forEach(atleta => {
      const nomeAcademia = atleta.academia ? atleta.academia.trim().toUpperCase() : "";
      if (!nomeAcademia) return;
      if (!mapaAcademias[nomeAcademia]) mapaAcademias[nomeAcademia] = { nome: nomeAcademia, equipeBase: atleta.equipe, pontos: 0, ouro: 0, prata: 0, bronze: 0 };
      mapaAcademias[nomeAcademia].pontos += atleta.pontos;
      mapaAcademias[nomeAcademia].ouro += atleta.ouro;
      mapaAcademias[nomeAcademia].prata += atleta.prata;
      mapaAcademias[nomeAcademia].bronze += atleta.bronze;
    });

    const academiasArr = Object.values(mapaAcademias).sort((a, b) => {
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
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-8 relative overflow-x-hidden font-sans selection:bg-red-500/30">
      
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute top-40 left-0 w-[400px] h-[400px] bg-yellow-600/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-white/5 pb-8">
          <div className="flex-1">
            <Link href="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest mb-4 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              Voltar ao Início
            </Link>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight flex items-center gap-3 leading-none mb-3">
              Ranking Oficial
            </h1>
            <p className="text-zinc-400 text-xs md:text-sm max-w-lg font-medium leading-relaxed">
              Acompanhe a elite do circuito iTatame. Pontuação baseada no padrão internacional (Ouro: 9pts | Prata: 3pts | Bronze: 1pt).
            </p>
          </div>

          <div className="flex flex-col gap-4 w-full md:w-auto shrink-0">
            <div className="w-full">
              <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5 ml-1 block">Filtrar Base de Dados</label>
              <select
                value={filtroEvento}
                onChange={(e) => setFiltroEvento(e.target.value)}
                className="w-full bg-[#0a0a0e] border border-white/10 text-white rounded-xl p-3 outline-none focus:border-red-500 transition-colors shadow-inner text-xs font-bold cursor-pointer"
              >
                <option value="Geral">🌍 Ranking Global (Acumulado de Todos)</option>
                {eventos.map(ev => (
                  <option key={ev.id} value={ev.id}>🏆 {ev.nome}</option>
                ))}
              </select>
            </div>

            <div className="flex bg-black/60 p-1.5 rounded-xl border border-white/10 w-full shadow-inner">
              <button onClick={() => setAbaAtiva("atletas")} className={`flex-1 md:flex-none px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${abaAtiva === "atletas" ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>Atletas</button>
              <button onClick={() => setAbaAtiva("equipes")} className={`flex-1 md:flex-none px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${abaAtiva === "equipes" ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>Equipes</button>
              <button onClick={() => setAbaAtiva("academias")} className={`flex-1 md:flex-none px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${abaAtiva === "academias" ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>Academias</button>
            </div>
          </div>
        </div>

        {abaAtiva === "atletas" && (
          <div className="flex overflow-x-auto gap-2 mb-10 pb-2 scrollbar-hide mask-edges">
            {["Todas", "Preta", "Marrom", "Roxa", "Azul", "Branca", "Verde", "Laranja", "Amarela", "Cinza"].map(faixa => (
              <button 
                key={faixa} 
                onClick={() => setFiltroFaixa(faixa)}
                className={`px-5 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all shrink-0 ${filtroFaixa === faixa ? 'bg-white text-black border-white shadow-sm' : 'bg-transparent border-white/10 text-zinc-400 hover:border-white/30 hover:text-white hover:bg-white/5'}`}
              >
                {faixa}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <svg className="w-8 h-8 animate-spin text-zinc-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-4">Calculando Ranking e Pontuações...</span>
          </div>
        ) : lista.length === 0 ? (
          <div className="py-20 text-center bg-[#0a0a0e]/50 border border-dashed border-white/10 rounded-2xl max-w-2xl mx-auto">
            <span className="text-3xl mb-3 block opacity-50">📉</span>
            <h3 className="text-base font-bold text-white mb-2">Sem registros neste Ranking</h3>
            <p className="text-zinc-500 text-xs max-w-sm mx-auto leading-relaxed">Não há lutas concluídas ou dados suficientes para montar o ranking selecionado no momento.</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            <div className="flex items-end justify-center gap-3 md:gap-6 mb-16 h-[320px] md:h-[350px]">
              {top3[1] && (
                <div onClick={() => abrirPerfilAtleta(top3[1])} className={`w-[30%] max-w-[160px] flex flex-col items-center relative animate-in slide-in-from-bottom-8 duration-700 delay-100 group ${abaAtiva === 'atletas' ? 'cursor-pointer' : 'cursor-default'}`}>
                  <div className="absolute -top-12 z-10 flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-2">
                    {abaAtiva === "atletas" && top3[1].foto_url ? (
                      <img src={top3[1].foto_url} className="w-16 h-16 rounded-full object-cover border-2 border-zinc-400 bg-black shadow-[0_0_20px_rgba(161,161,170,0.15)]" />
                    ) : (
                      <div className="w-16 h-16 rounded-full border-2 border-zinc-400 bg-[#0a0a0e] flex items-center justify-center text-lg font-bold text-zinc-400 shadow-[0_0_20px_rgba(161,161,170,0.15)]">{abaAtiva === "atletas" ? top3[1].nome.charAt(0) : (abaAtiva === "equipes" ? "🛡️" : "🏛️")}</div>
                    )}
                  </div>
                  <div className="w-full h-[160px] md:h-[180px] bg-gradient-to-t from-white/[0.03] to-transparent border-t-2 border-zinc-400 rounded-t-xl flex flex-col items-center justify-end pb-6 px-3 text-center relative transition-colors duration-300 group-hover:from-white/[0.06]">
                    <span className="text-zinc-500/30 font-black text-6xl absolute top-4 pointer-events-none">2</span>
                    <h4 className="text-white font-bold text-xs md:text-sm uppercase tracking-tight line-clamp-2 leading-tight mb-1 relative z-10">{top3[1].nome}</h4>
                    {abaAtiva === "atletas" && <span className="text-zinc-500 text-[9px] uppercase tracking-widest truncate w-full relative z-10">{top3[1].equipe || "S/ Equipe"}</span>}
                    <span className="text-zinc-300 font-bold text-xs md:text-sm mt-3 relative z-10">{top3[1].pontos} pts</span>
                  </div>
                </div>
              )}

              {top3[0] && (
                <div onClick={() => abrirPerfilAtleta(top3[0])} className={`w-[35%] max-w-[190px] flex flex-col items-center relative z-20 animate-in slide-in-from-bottom-12 duration-700 group ${abaAtiva === 'atletas' ? 'cursor-pointer' : 'cursor-default'}`}>
                  <div className="absolute -top-16 z-10 flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-2">
                    <span className="text-2xl mb-1 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">👑</span>
                    {abaAtiva === "atletas" && top3[0].foto_url ? (
                      <img src={top3[0].foto_url} className="w-20 h-20 rounded-full object-cover border-2 border-yellow-500 bg-black shadow-[0_0_30px_rgba(234,179,8,0.2)]" />
                    ) : (
                      <div className="w-20 h-20 rounded-full border-2 border-yellow-500 bg-[#0a0a0e] flex items-center justify-center text-2xl font-bold text-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.2)]">{abaAtiva === "atletas" ? top3[0].nome.charAt(0) : (abaAtiva === "equipes" ? "🛡️" : "🏛️")}</div>
                    )}
                  </div>
                  <div className="w-full h-[210px] md:h-[240px] bg-gradient-to-t from-yellow-500/10 to-transparent border-t-2 border-yellow-500 rounded-t-xl flex flex-col items-center justify-end pb-6 px-3 text-center relative transition-colors duration-300 group-hover:from-yellow-500/20">
                    <span className="text-yellow-500/10 font-black text-8xl absolute top-2 pointer-events-none">1</span>
                    <h4 className="text-white font-bold text-xs md:text-sm uppercase tracking-tight line-clamp-2 leading-tight mb-1 relative z-10">{top3[0].nome}</h4>
                    {abaAtiva === "atletas" && <span className="text-yellow-500/70 text-[9px] uppercase tracking-widest truncate w-full relative z-10">{top3[0].equipe || "S/ Equipe"}</span>}
                    <span className="text-yellow-500 font-bold text-sm md:text-base mt-3 relative z-10">{top3[0].pontos} pts</span>
                  </div>
                </div>
              )}

              {top3[2] && (
                <div onClick={() => abrirPerfilAtleta(top3[2])} className={`w-[30%] max-w-[160px] flex flex-col items-center relative animate-in slide-in-from-bottom-8 duration-700 delay-200 group ${abaAtiva === 'atletas' ? 'cursor-pointer' : 'cursor-default'}`}>
                  <div className="absolute -top-12 z-10 flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-2">
                    {abaAtiva === "atletas" && top3[2].foto_url ? (
                      <img src={top3[2].foto_url} className="w-16 h-16 rounded-full object-cover border-2 border-orange-600 bg-black shadow-[0_0_20px_rgba(234,88,12,0.15)]" />
                    ) : (
                      <div className="w-16 h-16 rounded-full border-2 border-orange-600 bg-[#0a0a0e] flex items-center justify-center text-lg font-bold text-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.15)]">{abaAtiva === "atletas" ? top3[2].nome.charAt(0) : (abaAtiva === "equipes" ? "🛡️" : "🏛️")}</div>
                    )}
                  </div>
                  <div className="w-full h-[140px] md:h-[150px] bg-gradient-to-t from-orange-500/5 to-transparent border-t-2 border-orange-600 rounded-t-xl flex flex-col items-center justify-end pb-6 px-3 text-center relative transition-colors duration-300 group-hover:from-orange-500/10">
                    <span className="text-orange-600/20 font-black text-6xl absolute top-4 pointer-events-none">3</span>
                    <h4 className="text-white font-bold text-xs md:text-sm uppercase tracking-tight line-clamp-2 leading-tight mb-1 relative z-10">{top3[2].nome}</h4>
                    {abaAtiva === "atletas" && <span className="text-orange-500/70 text-[9px] uppercase tracking-widest truncate w-full relative z-10">{top3[2].equipe || "S/ Equipe"}</span>}
                    <span className="text-orange-500 font-bold text-xs md:text-sm mt-3 relative z-10">{top3[2].pontos} pts</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#0a0a0e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 bg-black/40 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                <div className="col-span-1 text-center">Pos</div>
                <div className="col-span-5">{abaAtiva === "atletas" ? "Atleta" : (abaAtiva === "equipes" ? "Bandeira / Equipe" : "Academia / CT")}</div>
                <div className="col-span-4 flex items-center justify-end gap-6 text-center">
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
                    <div key={index} onClick={() => abrirPerfilAtleta(item)} className={`grid grid-cols-1 md:grid-cols-12 gap-4 px-4 md:px-6 py-3.5 border-b border-white/5 transition-colors items-center group ${abaAtiva === 'atletas' ? 'cursor-pointer hover:bg-white/[0.03]' : 'hover:bg-white/[0.01]'}`}>
                      <div className="hidden md:flex col-span-1 justify-center"><span className="text-sm font-bold text-zinc-600 group-hover:text-zinc-400 transition-colors">{pos}º</span></div>
                      <div className="col-span-1 md:col-span-5 flex items-center gap-4 overflow-hidden">
                        <div className="md:hidden w-6 text-center text-xs font-bold text-zinc-600">{pos}º</div>
                        {abaAtiva === "atletas" ? (
                          <>
                            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 overflow-hidden shrink-0 group-hover:border-white/30 transition-colors">
                              {item.foto_url ? <img src={item.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-zinc-500">{item.nome.charAt(0)}</div>}
                            </div>
                            <div className="truncate flex-1">
                              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-tight truncate group-hover:text-white transition-colors">{item.nome}</h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {item.faixa && <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{item.faixa} •</span>}
                                <span className="text-[8px] font-medium text-zinc-500 uppercase tracking-widest truncate">{item.equipe || "S/ Equipe"}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-3 truncate">
                            <div className="truncate flex-1">
                              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-tight truncate">{item.nome}</h4>
                              {abaAtiva === "academias" && item.equipeBase && <span className="text-[8px] font-medium text-zinc-500 uppercase tracking-widest truncate block mt-0.5">Bandeira: {item.equipeBase}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="col-span-1 md:col-span-4 flex items-center md:justify-end gap-6 ml-10 md:ml-0">
                        <div className="flex flex-col md:flex-row items-center gap-1 md:w-8 text-center"><span className="text-[8px] md:hidden text-yellow-600 uppercase font-bold">Ouro</span><span className="text-xs font-medium text-zinc-300 group-hover:text-yellow-500 transition-colors">{item.ouro}</span></div>
                        <div className="flex flex-col md:flex-row items-center gap-1 md:w-8 text-center"><span className="text-[8px] md:hidden text-zinc-500 uppercase font-bold">Prata</span><span className="text-xs font-medium text-zinc-400">{item.prata}</span></div>
                        <div className="flex flex-col md:flex-row items-center gap-1 md:w-8 text-center"><span className="text-[8px] md:hidden text-orange-700 uppercase font-bold">Bronze</span><span className="text-xs font-medium text-zinc-500">{item.bronze}</span></div>
                      </div>
                      <div className="col-span-1 md:col-span-2 text-right absolute right-4 md:static">
                        <span className="text-white font-black text-xs md:text-sm">{item.pontos} <span className="text-[9px] text-zinc-500 uppercase font-medium">pts</span></span>
                      </div>
                    </div>
                  );
                })}
                {restantes.length === 0 && <div className="py-8 text-center text-zinc-600 text-xs font-medium">Apenas os competidores do pódio pontuaram até o momento.</div>}
              </div>
            </div>
            
          </div>
        )}

      </div>

      {atletaSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="absolute inset-0 cursor-pointer" onClick={fecharPerfil}></div>
          <div className="bg-[#0a0a0e] border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl relative z-10 p-6 pt-8 flex flex-col items-center">
            <button onClick={fecharPerfil} className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-transparent hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer z-20"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            <div className="w-24 h-24 rounded-full border-4 border-[#161622] bg-zinc-900 overflow-hidden mb-4 shadow-[0_0_20px_rgba(0,0,0,0.8)] shrink-0">
              {atletaSelecionado.foto_url ? <img src={atletaSelecionado.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-zinc-600">{atletaSelecionado.nome.charAt(0)}</div>}
            </div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight text-center leading-tight mb-1 w-full px-2">{atletaSelecionado.nome}</h2>
            <div className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest mt-1 mb-5 ${getCorFaixa(atletaSelecionado.faixa)}`}>Faixa {atletaSelecionado.faixa || "Não Informada"}</div>
            <div className="w-full grid grid-cols-2 gap-4 text-center border-y border-white/5 py-4 mb-4">
              <div className="flex flex-col items-center justify-center"><span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Equipe Global</span><span className="block text-xs font-bold text-zinc-300 truncate w-full px-1">{atletaSelecionado.equipe || "-"}</span></div>
              <div className="flex flex-col items-center justify-center border-l border-white/5 pl-2"><span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">CT / Academia</span><span className="block text-xs font-bold text-zinc-300 truncate w-full px-1">{atletaSelecionado.academia || "-"}</span></div>
            </div>
            <div className="w-full mb-4">
              <h4 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3 flex items-center justify-center gap-2"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Quadro de Medalhas</h4>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2 text-center"><span className="block text-lg font-black text-yellow-500">{atletaSelecionado.ouro}</span><span className="block text-[8px] text-yellow-600 font-bold uppercase mt-1">Ouro</span></div>
                <div className="bg-zinc-400/10 border border-zinc-400/20 rounded-xl p-2 text-center"><span className="block text-lg font-black text-zinc-300">{atletaSelecionado.prata}</span><span className="block text-[8px] text-zinc-500 font-bold uppercase mt-1">Prata</span></div>
                <div className="bg-orange-600/10 border border-orange-600/20 rounded-xl p-2 text-center"><span className="block text-lg font-black text-orange-500">{atletaSelecionado.bronze}</span><span className="block text-[8px] text-orange-600 font-bold uppercase mt-1">Bronze</span></div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center flex flex-col justify-center items-center"><span className="block text-sm font-black text-white">{atletaSelecionado.pontos}</span><span className="block text-[8px] text-zinc-400 font-bold uppercase mt-1">Pts</span></div>
              </div>
            </div>
            <div className="w-full bg-black/40 border border-white/5 rounded-xl p-4 max-h-[160px] overflow-y-auto custom-scrollbar">
              <h4 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3 flex items-center justify-center gap-2"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>Histórico em Eventos</h4>
              {historicoLoading ? <div className="text-center py-4"><span className="text-[10px] text-zinc-600 font-bold uppercase animate-pulse">Buscando histórico...</span></div> : historicoEventos.length === 0 ? <p className="text-[10px] text-center text-zinc-600">Nenhum evento registrado na federação.</p> : (
                <div className="space-y-2">
                  {historicoEventos.map((insc, idx) => (
                    <div key={idx} className="bg-black/50 border border-white/5 rounded-lg p-2.5 flex justify-between items-center group hover:border-white/10 transition-colors text-left">
                      <div className="overflow-hidden pr-2 flex-1"><p className="text-xs font-bold text-zinc-300 truncate group-hover:text-white transition-colors">{insc.eventos?.nome || "Evento Não Identificado"}</p><p className="text-[9px] text-zinc-500 mt-0.5 truncate">{insc.categoria}</p></div>
                      {insc.eventos?.data_evento && <span className="text-[9px] font-medium text-zinc-600 whitespace-nowrap shrink-0">{formatarData(insc.eventos.data_evento)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}