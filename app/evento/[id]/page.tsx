"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";

export default function EventoDetalhesPage() {
  const params = useParams();
  const [evento, setEvento] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inscricoes, setInscricoes] = useState<any[]>([]);
  const [abaAtiva, setAbaAtiva] = useState("sobre");

  useEffect(() => {
    async function carregarDados() {
      if (!params.id) return;

      const { data: eventoData } = await supabase
        .from("eventos")
        .select("*")
        .eq("id", params.id)
        .single();
      
      setEvento(eventoData);

      const { data: inscritosData, error } = await supabase
        .from("inscricoes")
        .select("*")
        .eq("evento_id", params.id);
        
      if (!error) {
        setInscricoes(inscritosData || []);
      }

      setLoading(false);
    }
    carregarDados();
  }, [params.id]);

  if (loading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-xs">Carregando evento...</div>;
  }

  if (!evento) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white font-bold text-sm">Evento não encontrado.</div>;
  }

  const formatarData = (dataStr: string) => {
    if (!dataStr) return "A definir";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const totalInscritos = inscricoes.length;

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col pb-20">
      
      {/* BACKGROUND ATMOSFÉRICO */}
      <div className="absolute top-0 left-0 w-full h-[300px] md:h-[400px] z-0 overflow-hidden pointer-events-none">
        <img src={evento.banner_url || "/arena.png"} alt="Background" className="w-full h-full object-cover opacity-10 blur-sm scale-110" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/80 to-[#050505]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-3 md:px-6 w-full relative z-10 pt-6 md:pt-16">
        
        {/* ========================================= */}
        {/* CABEÇALHO DO EVENTO */}
        {/* ========================================= */}
        <div className="bg-[#0a0a0e] border border-white/10 rounded-[20px] md:rounded-[24px] p-4 md:p-8 shadow-2xl flex flex-col md:flex-row gap-4 md:gap-8 mb-6 md:mb-8">
          
          <div className="w-full md:w-[300px] shrink-0 rounded-xl overflow-hidden shadow-2xl border border-white/5 relative bg-[#050505] flex items-center justify-center">
            <img 
              src={evento.banner_url || "/arena.png"} 
              alt={evento.nome} 
              className="w-full h-auto max-h-[250px] md:max-h-[400px] object-contain rounded-lg" 
            />
            <div className={`absolute top-2 right-2 md:top-3 md:right-3 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-lg ${evento.status === 'ENCERRADO' ? 'bg-zinc-600' : evento.status === 'EM BREVE' ? 'bg-cyan-600' : 'bg-red-600'}`}>
              {evento.status || "ABERTO"}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between py-1 md:py-2">
            <div>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <span className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-white/10 px-2 md:px-3 py-1 rounded-full bg-white/5">
                  {evento.descricao || "Evento Esportivo"}
                </span>
                <span className="text-red-500 font-bold text-[10px] md:text-xs flex items-center gap-1">
                  🔥 {totalInscritos} / {evento.limite_atletas || 500} vagas
                </span>
              </div>
              
              <h1 className="text-xl md:text-4xl font-black text-white leading-tight mb-2 md:mb-4 tracking-tight">
                {evento.nome}
              </h1>
              
              <div className="space-y-1.5 md:space-y-2 mb-4 md:mb-8">
                <div className="flex items-center gap-2 text-zinc-300 text-xs md:text-sm font-medium">
                  <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>
                  <span className="truncate">{formatarData(evento.data_evento)}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-300 text-xs md:text-sm font-medium">
                  <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
                  <span className="truncate">{evento.cidade} - {evento.estado} | {evento.local || "Local a definir"}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {evento.status === "ENCERRADO" ? (
                <button disabled className="bg-zinc-800 text-zinc-500 font-black uppercase tracking-widest text-[10px] md:text-xs px-3 py-2.5 md:px-6 md:py-3.5 rounded-lg text-center flex-1 md:flex-none cursor-not-allowed border border-white/5">
                  Inscrições Fechadas
                </button>
              ) : evento.status === "EM BREVE" ? (
                <button disabled className="bg-cyan-900/30 text-cyan-500 font-black uppercase tracking-widest text-[10px] md:text-xs px-3 py-2.5 md:px-6 md:py-3.5 rounded-lg text-center flex-1 md:flex-none cursor-not-allowed border border-cyan-500/20">
                  Abre em Breve
                </button>
              ) : (
                evento.link_inscricao ? (
                  <a href={evento.link_inscricao} target="_blank" rel="noopener noreferrer" className="bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-[10px] md:text-xs px-3 py-2.5 md:px-6 md:py-3.5 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all text-center flex-1 md:flex-none">
                    Fazer Inscrição
                  </a>
                ) : (
                  <Link href={`/inscricao?evento=${evento.id}`} className="bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-[10px] md:text-xs px-3 py-2.5 md:px-6 md:py-3.5 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all text-center flex-1 md:flex-none">
                    Fazer Inscrição
                  </Link>
                )
              )}

              <Link href={`/pagamento`} className="bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-3 py-2.5 md:px-6 md:py-3.5 rounded-lg transition-all text-center flex-1 md:flex-none">
                Pagar / Checar
              </Link>
              <Link href={`/evento/${evento.id}/publico`} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold uppercase tracking-widest text-[10px] md:text-xs px-3 py-2.5 md:px-6 md:py-3.5 rounded-lg transition-all text-center flex-1 md:flex-none">
                Chaves e Resultados
              </Link>
              
              {/* O BOTÃO DE REGULAMENTO AGORA SÓ APARECE SE TIVER LINK CADASTRADO */}
              {evento.regulamento_url && (
                <a href={evento.regulamento_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white font-bold uppercase tracking-widest text-[10px] md:text-xs px-3 py-2.5 md:px-4 md:py-3.5 transition-all flex items-center justify-center gap-1.5 w-full md:w-auto">
                  <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  Regulamento
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ========================================= */}
        {/* CORPO DA PÁGINA (Abas + Datas Importantes) */}
        {/* ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          
          <div className="lg:col-span-2 space-y-4 md:space-y-8">
            <div className="flex overflow-x-auto scrollbar-hide border-b border-white/10 pb-px gap-1 md:gap-2">
              <button onClick={() => setAbaAtiva("sobre")} className={`whitespace-nowrap px-3 py-2 md:px-4 md:py-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-colors ${abaAtiva === "sobre" ? "text-red-500 border-b-2 border-red-500" : "text-zinc-500 hover:text-white"}`}>Sobre o Evento</button>
              <button onClick={() => setAbaAtiva("valores")} className={`whitespace-nowrap px-3 py-2 md:px-4 md:py-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-colors ${abaAtiva === "valores" ? "text-red-500 border-b-2 border-red-500" : "text-zinc-500 hover:text-white"}`}>Valores e Lotes</button>
              <button onClick={() => setAbaAtiva("regras")} className={`whitespace-nowrap px-3 py-2 md:px-4 md:py-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-colors ${abaAtiva === "regras" ? "text-red-500 border-b-2 border-red-500" : "text-zinc-500 hover:text-white"}`}>Regras e Avisos</button>
            </div>

            <div className="bg-[#0a0a0e] border border-white/5 rounded-xl md:rounded-2xl p-4 md:p-6 min-h-[200px] md:min-h-[250px]">
              
              {abaAtiva === "sobre" && (
                <div className="animate-in fade-in duration-500 text-zinc-400 text-xs md:text-sm leading-relaxed space-y-3 md:space-y-4 font-medium">
                  <h3 className="text-base md:text-lg font-black text-white mb-1 md:mb-2 uppercase tracking-wide">Apresentação</h3>
                  {/* Puxa o texto customizado do BD. whitespace-pre-wrap faz o CSS respeitar os Enters/Quebras de linha */}
                  <div className="whitespace-pre-wrap">
                    {evento.sobre_evento || `Este evento consolidou-se como um dos principais palcos do ${evento.descricao || "esporte"} no estado. Buscamos um evento de alta qualidade, com infraestrutura de excelência e profissionalismo em todos os detalhes.`}
                  </div>
                  
                  {evento.premiacao && (
                    <div className="mt-4 md:mt-6 p-3 md:p-4 bg-white/5 border border-white/10 rounded-xl text-[11px] md:text-xs">
                      <strong className="text-white block mb-1">Resumo da Premiação:</strong>
                      {evento.premiacao}
                    </div>
                  )}
                </div>
              )}

              {abaAtiva === "valores" && (
                <div className="animate-in fade-in duration-500 text-zinc-400 text-xs md:text-sm leading-relaxed font-medium">
                  <h3 className="text-base md:text-lg font-black text-white mb-3 md:mb-4 uppercase tracking-wide">Informações de Lotes</h3>
                  <div className="whitespace-pre-wrap">
                    {evento.valores_lotes || "Valores e prazos de lote serão divulgados em breve pela organização."}
                  </div>
                </div>
              )}

              {abaAtiva === "regras" && (
                <div className="animate-in fade-in duration-500 text-zinc-400 text-xs md:text-sm leading-relaxed font-medium">
                  <h3 className="text-base md:text-lg font-black text-white mb-3 md:mb-4 uppercase tracking-wide">Regras / Pesagem / Informações</h3>
                  <div className="whitespace-pre-wrap">
                    {evento.regras_pesagem || "Regras de pesagem e diretrizes de competição seguirão o livro de regras da modalidade oficial. Em caso de dúvidas, consulte o regulamento (caso disponibilizado) ou entre em contato com a organização."}
                  </div>
                </div>
              )}

            </div>

            {/* LISTA DE ATLETAS */}
            <div>
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-wide">Inscritos Recentes</h2>
              </div>

              {inscricoes.length === 0 ? (
                <div className="bg-[#0a0a0e] border border-dashed border-white/10 rounded-xl md:rounded-2xl p-6 md:p-10 text-center">
                  <div className="text-xl md:text-2xl mb-2">🥋</div>
                  <p className="text-zinc-400 text-xs md:text-sm font-medium">Ainda não há inscrições no sistema.<br/>Seja o primeiro a garantir sua vaga!</p>
                </div>
              ) : (
                <div className="bg-[#0a0a0e] border border-white/5 rounded-xl md:rounded-2xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[300px]">
                      <thead>
                        <tr className="bg-black/50 border-b border-white/5 text-zinc-500 text-[8px] md:text-[9px] font-black uppercase tracking-widest">
                          <th className="p-3 md:p-4">Atleta</th>
                          <th className="p-3 md:p-4">Equipe</th>
                          <th className="p-3 md:p-4 hidden sm:table-cell">Categoria</th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px] md:text-xs font-medium text-zinc-300">
                        {inscricoes.map((inscricao, idx) => (
                          <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="p-3 md:p-4 text-white font-bold whitespace-nowrap">{inscricao.atleta || inscricao.nome}</td>
                            <td className="p-3 md:p-4 text-zinc-400 whitespace-nowrap">{inscricao.equipe || "-"}</td>
                            <td className="p-3 md:p-4 hidden sm:table-cell">{inscricao.faixa} • {inscricao.categoria || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* COLUNA DIREITA */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 md:top-24 bg-[#0a0a0e] border border-red-500/30 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-[0_0_20px_rgba(239,68,68,0.1)] relative overflow-hidden mt-2 md:mt-0">
              
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400 animate-pulse"></div>
              <div className="absolute -top-10 -right-10 md:-top-20 md:-right-20 w-32 h-32 md:w-40 md:h-40 bg-red-600/10 blur-[40px] md:blur-[50px] rounded-full animate-pulse"></div>

              <h3 className="text-sm md:text-base font-black text-white mb-4 md:mb-6 uppercase tracking-wide flex items-center gap-2 relative z-10">
                <svg className="w-4 h-4 md:w-5 md:h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Checklist do Atleta
              </h3>

              <div className="space-y-4 md:space-y-5 relative z-10">
                <div className="border-l-2 border-red-500 pl-3 md:pl-4">
                  <span className="text-red-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-0.5">Prazo de Inscrições</span>
                  <p className="text-white text-[11px] md:text-xs font-medium">Não deixe para a última hora.</p>
                  <p className="text-zinc-500 text-[9px] md:text-[10px] mt-0.5">Vagas podem esgotar antes da data.</p>
                </div>

                <div className="border-l-2 border-zinc-700 pl-3 md:pl-4">
                  <span className="text-zinc-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-0.5">Pagamento (Pix)</span>
                  <p className="text-white text-[11px] md:text-xs font-medium">Conferência Automática</p>
                  <p className="text-zinc-500 text-[9px] md:text-[10px] mt-0.5">Seu nome entra na lista assim que pago.</p>
                </div>

                <div className="border-l-2 border-zinc-700 pl-3 md:pl-4">
                  <span className="text-zinc-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-0.5">Checagem de Chaves</span>
                  <p className="text-white text-[11px] md:text-xs font-medium">Dias antes do Evento</p>
                  <p className="text-zinc-500 text-[9px] md:text-[10px] mt-0.5">Fique atento às redes da organização.</p>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </main>
  );
}