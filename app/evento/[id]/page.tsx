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
      
      {/* BACKGROUND ATMOSFÉRICO (Ajustado no mobile) */}
      <div className="absolute top-0 left-0 w-full h-[300px] md:h-[400px] z-0 overflow-hidden pointer-events-none">
        <img src={evento.banner_url || "/arena.png"} alt="Background" className="w-full h-full object-cover opacity-10 blur-sm scale-110" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/80 to-[#050505]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-3 md:px-6 w-full relative z-10 pt-6 md:pt-16">
        
        {/* ========================================= */}
        {/* CABEÇALHO DO EVENTO (Poster + Info + Botões) */}
        {/* ========================================= */}
        <div className="bg-[#0a0a0e] border border-white/10 rounded-[20px] md:rounded-[24px] p-4 md:p-8 shadow-2xl flex flex-col md:flex-row gap-4 md:gap-8 mb-6 md:mb-8">
          
          {/* CARTAZ OFICIAL - AGORA REDUZIDO NO MOBILE */}
          <div className="w-full md:w-[300px] shrink-0 rounded-xl overflow-hidden shadow-2xl border border-white/5 relative bg-[#050505] flex items-center justify-center">
            <img 
              src={evento.banner_url || "/arena.png"} 
              alt={evento.nome} 
              className="w-full h-auto max-h-[250px] md:max-h-[400px] object-contain rounded-lg" 
            />
            {/* Tag em cima do cartaz */}
            <div className="absolute top-2 right-2 md:top-3 md:right-3 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-lg">
              {evento.status || "ABERTO"}
            </div>
          </div>

          {/* INFORMAÇÕES E BOTÕES */}
          <div className="flex-1 flex flex-col justify-between py-1 md:py-2">
            <div>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <span className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-white/10 px-2 md:px-3 py-1 rounded-full bg-white/5">
                  {evento.modalidade || "Jiu-Jitsu"}
                </span>
                <span className="text-red-500 font-bold text-[10px] md:text-xs flex items-center gap-1">
                  🔥 {totalInscritos} / {evento.limite_atletas || 500} inscritos
                </span>
              </div>
              
              <h1 className="text-xl md:text-4xl font-black text-white leading-tight mb-2 md:mb-4 tracking-tight">
                {evento.nome}
              </h1>
              
              <div className="space-y-1.5 md:space-y-2 mb-4 md:mb-8">
                <div className="flex items-center gap-2 text-zinc-300 text-xs md:text-sm font-medium">
                  <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>
                  <span className="truncate">{formatarData(evento.data_evento)} (Domingo)</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-300 text-xs md:text-sm font-medium">
                  <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
                  <span className="truncate">{evento.cidade} - {evento.estado} | {evento.local || "Ginásio a definir"}</span>
                </div>
              </div>
            </div>

            {/* BOTÕES ENXUTOS NO CELULAR */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <Link href={`/inscricao?evento=${evento.id}`} className="bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-[10px] md:text-xs px-3 py-2.5 md:px-6 md:py-3.5 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all text-center flex-1 md:flex-none">
                Fazer Inscrição
              </Link>
              <Link href={`/pagamento`} className="bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-3 py-2.5 md:px-6 md:py-3.5 rounded-lg transition-all text-center flex-1 md:flex-none">
                Realizar Pagamento
              </Link>
              <Link href={`/evento/${evento.id}/publico`} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold uppercase tracking-widest text-[10px] md:text-xs px-3 py-2.5 md:px-6 md:py-3.5 rounded-lg transition-all text-center flex-1 md:flex-none">
                Ver Chaves
              </Link>
              <a href="/regulamento-copa-open.pdf" target="_blank" className="text-zinc-400 hover:text-white font-bold uppercase tracking-widest text-[10px] md:text-xs px-3 py-2.5 md:px-4 md:py-3.5 transition-all flex items-center justify-center gap-1.5 w-full md:w-auto">
                <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Regulamento
              </a>
            </div>
          </div>
        </div>

        {/* ========================================= */}
        {/* CORPO DA PÁGINA (Abas + Datas Importantes) */}
        {/* ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          
          {/* COLUNA ESQUERDA (Maior) - ABAS E CONTEÚDO */}
          <div className="lg:col-span-2 space-y-4 md:space-y-8">
            
            {/* NAVEGAÇÃO DAS ABAS */}
            <div className="flex overflow-x-auto scrollbar-hide border-b border-white/10 pb-px gap-1 md:gap-2">
              <button onClick={() => setAbaAtiva("sobre")} className={`whitespace-nowrap px-3 py-2 md:px-4 md:py-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-colors ${abaAtiva === "sobre" ? "text-red-500 border-b-2 border-red-500" : "text-zinc-500 hover:text-white"}`}>Sobre o Evento</button>
              <button onClick={() => setAbaAtiva("valores")} className={`whitespace-nowrap px-3 py-2 md:px-4 md:py-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-colors ${abaAtiva === "valores" ? "text-red-500 border-b-2 border-red-500" : "text-zinc-500 hover:text-white"}`}>Valores e Lotes</button>
              <button onClick={() => setAbaAtiva("regras")} className={`whitespace-nowrap px-3 py-2 md:px-4 md:py-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-colors ${abaAtiva === "regras" ? "text-red-500 border-b-2 border-red-500" : "text-zinc-500 hover:text-white"}`}>Pesagem / Regras</button>
            </div>

            {/* CONTEÚDO DAS ABAS */}
            <div className="bg-[#0a0a0e] border border-white/5 rounded-xl md:rounded-2xl p-4 md:p-6 min-h-[200px] md:min-h-[250px]">
              {abaAtiva === "sobre" && (
                <div className="animate-in fade-in duration-500 text-zinc-400 text-xs md:text-sm leading-relaxed space-y-3 md:space-y-4 font-medium">
                  <h3 className="text-base md:text-lg font-black text-white mb-1 md:mb-2 uppercase tracking-wide">Informações Gerais</h3>
                  <p>{evento.descricao || "A organização tem a honra de anunciar a abertura oficial das inscrições. Este evento consolidou-se como um dos principais palcos do Jiu-Jitsu no estado, sendo um verdadeiro cenário para a valorização dos atletas."}</p>
                  <p>Buscamos um evento de alta qualidade, com infraestrutura de excelência, premiação atrativa e profissionalismo em todos os detalhes. O evento é aberto a todas as equipes e federações.</p>
                  <div className="mt-4 md:mt-6 p-3 md:p-4 bg-white/5 border border-white/10 rounded-xl text-[11px] md:text-xs">
                    <strong className="text-white block mb-1">Premiação do Evento:</strong>
                    {evento.premiacao || "Medalha para o 1º lugar, 2º lugar e dois 3º lugares. Premiação em dinheiro para os campeões do Absoluto (verifique o edital)."}
                  </div>
                </div>
              )}

              {abaAtiva === "valores" && (
                <div className="animate-in fade-in duration-500">
                  <h3 className="text-base md:text-lg font-black text-white mb-3 md:mb-4 uppercase tracking-wide">Lotes de Inscrição</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-5">
                      <span className="bg-green-500/20 text-green-400 text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded mb-2 md:mb-3 inline-block">Lote Atual</span>
                      <h4 className="font-bold text-white text-xs md:text-sm mb-1">1º Lote - Lançamento</h4>
                      <div className="flex items-end gap-1 mb-2">
                        <span className="text-lg md:text-xl font-black text-white">R$ 90,00</span>
                        <span className="text-zinc-500 text-[10px] md:text-xs mb-0.5">/ peso</span>
                      </div>
                      <p className="text-[10px] md:text-[11px] text-zinc-400 border-t border-white/10 pt-2">+ R$ 50,00 Absoluto</p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-5 opacity-60">
                      <span className="bg-zinc-500/20 text-zinc-400 text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded mb-2 md:mb-3 inline-block">Em Breve</span>
                      <h4 className="font-bold text-white text-xs md:text-sm mb-1">2º Lote - Final</h4>
                      <div className="flex items-end gap-1 mb-2">
                        <span className="text-lg md:text-xl font-black text-white">R$ 120,00</span>
                        <span className="text-zinc-500 text-[10px] md:text-xs mb-0.5">/ peso</span>
                      </div>
                      <p className="text-[10px] md:text-[11px] text-zinc-400 border-t border-white/10 pt-2">+ R$ 60,00 Absoluto</p>
                    </div>
                  </div>
                </div>
              )}

              {abaAtiva === "regras" && (
                <div className="animate-in fade-in duration-500 text-zinc-400 text-xs md:text-sm">
                  <h3 className="text-base md:text-lg font-black text-white mb-3 md:mb-4 uppercase tracking-wide">Diretrizes da Pesagem</h3>
                  <ul className="space-y-2 md:space-y-3 list-disc pl-4 md:pl-5 font-medium">
                    <li>A pesagem ocorrerá no dia do evento, <strong className="text-white">antes da primeira luta</strong> do atleta.</li>
                    <li>Haverá tolerância ZERO na balança. O atleta que não bater o peso estará sumariamente desclassificado, não podendo subir de categoria no dia.</li>
                    <li>É obrigatória a apresentação de um documento oficial com foto (RG, CNH, Passaporte ou Carteirinha Oficial) na balança.</li>
                    <li>Para lutas GI (Com Kimono), a pesagem deve ser feita vestindo o kimono completo.</li>
                  </ul>
                </div>
              )}
            </div>

            {/* LISTA DE ATLETAS (Abaixo das abas) */}
            <div>
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-wide">Atletas Confirmados</h2>
              </div>

              {inscricoes.length === 0 ? (
                <div className="bg-[#0a0a0e] border border-dashed border-white/10 rounded-xl md:rounded-2xl p-6 md:p-10 text-center">
                  <div className="text-xl md:text-2xl mb-2">🥋</div>
                  <p className="text-zinc-400 text-xs md:text-sm font-medium">Ainda não há inscrições confirmadas.<br/>Seja o primeiro a garantir sua vaga!</p>
                </div>
              ) : (
                <div className="bg-[#0a0a0e] border border-white/5 rounded-xl md:rounded-2xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[300px]">
                      <thead>
                        <tr className="bg-black/50 border-b border-white/5 text-zinc-500 text-[8px] md:text-[9px] font-black uppercase tracking-widest">
                          <th className="p-3 md:p-4">Atleta</th>
                          <th className="p-3 md:p-4">Equipe</th>
                          <th className="p-3 md:p-4 hidden sm:table-cell">Faixa / Cat.</th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px] md:text-xs font-medium text-zinc-300">
                        {inscricoes.map((inscricao, idx) => (
                          <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="p-3 md:p-4 text-white font-bold whitespace-nowrap">{inscricao.atleta || inscricao.nome}</td>
                            <td className="p-3 md:p-4 text-zinc-400 whitespace-nowrap">{inscricao.equipe}</td>
                            <td className="p-3 md:p-4 hidden sm:table-cell">{inscricao.faixa} • {inscricao.categoria}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* COLUNA DIREITA (Menor) - DATAS IMPORTANTES */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 md:top-24 bg-[#0a0a0e] border border-red-500/30 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-[0_0_20px_rgba(239,68,68,0.1)] relative overflow-hidden mt-2 md:mt-0">
              
              {/* Efeito visual pulsante no fundo */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400 animate-pulse"></div>
              <div className="absolute -top-10 -right-10 md:-top-20 md:-right-20 w-32 h-32 md:w-40 md:h-40 bg-red-600/10 blur-[40px] md:blur-[50px] rounded-full animate-pulse"></div>

              <h3 className="text-sm md:text-base font-black text-white mb-4 md:mb-6 uppercase tracking-wide flex items-center gap-2 relative z-10">
                <svg className="w-4 h-4 md:w-5 md:h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Datas Importantes
              </h3>

              <div className="space-y-4 md:space-y-5 relative z-10">
                <div className="border-l-2 border-red-500 pl-3 md:pl-4">
                  <span className="text-red-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-0.5">Fim das Inscrições</span>
                  <p className="text-white text-[11px] md:text-xs font-medium">10 dias antes do evento</p>
                  <p className="text-zinc-500 text-[9px] md:text-[10px] mt-0.5">Quarta-feira às 23:59h</p>
                </div>

                <div className="border-l-2 border-zinc-700 pl-3 md:pl-4">
                  <span className="text-zinc-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-0.5">Vencimento (Pix)</span>
                  <p className="text-white text-[11px] md:text-xs font-medium">Pix instantâneo no Checkout</p>
                  <p className="text-zinc-500 text-[9px] md:text-[10px] mt-0.5">Baixa automática de pedidos</p>
                </div>

                <div className="border-l-2 border-zinc-700 pl-3 md:pl-4">
                  <span className="text-zinc-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-0.5">Checagem (Correções)</span>
                  <p className="text-white text-[11px] md:text-xs font-medium">Até quinta-feira 12:00h</p>
                  <p className="text-zinc-500 text-[9px] md:text-[10px] mt-0.5">Lista oficial fechada após este prazo</p>
                </div>

                <div className="border-l-2 border-zinc-700 pl-3 md:pl-4">
                  <span className="text-zinc-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-0.5">Chaves e Cronograma</span>
                  <p className="text-white text-[11px] md:text-xs font-medium">Sexta-feira a partir das 14:00h</p>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </main>
  );
}