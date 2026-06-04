"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";
import QRCode from "react-qr-code";

export default function PagamentoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inscricoes, setInscricoes] = useState<any[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<"pendentes" | "pagas">("pendentes");

  // Estados do Simulador de PIX
  const [modalPixAberto, setModalPixAberto] = useState(false);
  const [inscricaoSelecionada, setInscricaoSelecionada] = useState<any>(null);
  const [processandoPagamento, setProcessandoPagamento] = useState(false);

  useEffect(() => {
    carregarInscricoes();
  }, [router]);

  async function carregarInscricoes() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      router.push("/login");
      return;
    }

    try {
      // 1. Busca os dependentes para puxar as inscrições de toda a família
      const { data: depsData, error: depsError } = await supabase
        .from("atletas")
        .select("user_id")
        .eq("responsavel_id", authData.user.id);
      
      const idsFamilia = [authData.user.id];
      if (depsData && !depsError) {
        depsData.forEach(d => idsFamilia.push(d.user_id));
      }

      // 2. Busca as inscrições com os dados do evento anexados
      const { data, error } = await supabase
        .from("inscricoes")
        .select(`
          *,
          eventos (
            nome,
            data_evento,
            banner_url,
            cidade,
            estado
          )
        `)
        .in("user_id", idsFamilia)
        .order("created_at", { ascending: false }); // 🟢 CORRIGIDO AQUI: created_at

      if (error) throw error;
      
      setInscricoes(data || []);
    } catch (error: any) {
      // 🟢 MELHORIA: Exibe a mensagem de erro real no console se algo falhar
      console.error("Erro ao carregar pagamentos:", error.message || error);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // SIMULADOR DE PAGAMENTO PIX (PARA TESTES)
  // ==========================================
  function abrirModalPix(inscricao: any) {
    setInscricaoSelecionada(inscricao);
    setModalPixAberto(true);
  }

  async function simularAprovacaoPix() {
    if (!inscricaoSelecionada) return;
    setProcessandoPagamento(true);

    try {
      // Atualiza no banco de dados como "Pago"
      const { error } = await supabase
        .from("inscricoes")
        .update({ pagamento_ok: true })
        .eq("id", inscricaoSelecionada.id);

      if (error) throw error;

      // Atualiza o estado local para refletir na UI imediatamente
      setInscricoes(inscricoes.map(insc => 
        insc.id === inscricaoSelecionada.id ? { ...insc, pagamento_ok: true } : insc
      ));

      alert("✅ PAGAMENTO APROVADO! O atleta já está na chave oficial.");
      setModalPixAberto(false);
      setAbaAtiva("pagas"); // Muda para a aba de pagamentos aprovados

    } catch (error) {
      alert("Erro ao processar pagamento simulado.");
    } finally {
      setProcessandoPagamento(false);
    }
  }

  const formatarData = (dataStr: string) => {
    if (!dataStr) return "Data a definir";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const pendentes = inscricoes.filter(i => !i.pagamento_ok);
  const pagas = inscricoes.filter(i => i.pagamento_ok);

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-xs">Carregando Faturas...</div>;

  return (
    <main className="min-h-screen bg-[#050505] p-4 md:p-8 font-sans relative overflow-hidden">
      {/* Background Atmosférico */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10 pt-6">
        
        {/* CABEÇALHO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/perfil" className="text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1 mb-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
              Voltar ao Perfil
            </Link>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 tracking-tight">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
              Central de Pagamentos
            </h1>
            <p className="text-zinc-400 text-sm mt-1">Gira as suas inscrições pendentes e emita os seus passaportes.</p>
          </div>
        </div>

        {/* ABAS DE NAVEGAÇÃO */}
        <div className="flex bg-[#0e0e12] p-1.5 rounded-xl border border-white/5 w-full md:w-max mb-6">
          <button 
            onClick={() => setAbaAtiva("pendentes")}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === "pendentes" ? "bg-red-600 text-white shadow-md" : "text-zinc-500 hover:text-white"}`}
          >
            Faturas Pendentes {pendentes.length > 0 && `(${pendentes.length})`}
          </button>
          <button 
            onClick={() => setAbaAtiva("pagas")}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === "pagas" ? "bg-green-600 text-white shadow-md" : "text-zinc-500 hover:text-white"}`}
          >
            Inscrições Pagas {pagas.length > 0 && `(${pagas.length})`}
          </button>
        </div>

        {/* LISTAGEM */}
        <div className="space-y-4">
          {(abaAtiva === "pendentes" ? pendentes : pagas).length === 0 ? (
            <div className="bg-[#0e0e12] border border-dashed border-white/10 rounded-3xl p-12 text-center">
              <span className="text-4xl block mb-4 opacity-50">📭</span>
              <h3 className="text-white font-bold text-lg mb-2">Nenhuma inscrição encontrada aqui.</h3>
              <p className="text-zinc-500 text-sm">Pode explorar os próximos campeonatos e garantir a sua vaga.</p>
              <Link href="/" className="inline-block mt-6 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl border border-white/10 transition-colors">
                Ver Calendário de Eventos
              </Link>
            </div>
          ) : (
            (abaAtiva === "pendentes" ? pendentes : pagas).map(insc => (
              <div key={insc.id} className={`bg-[#0e0e12] border rounded-2xl overflow-hidden transition-colors ${abaAtiva === "pendentes" ? "border-red-500/20 hover:border-red-500/40" : "border-green-500/20 hover:border-green-500/40"}`}>
                <div className="flex flex-col md:flex-row">
                  
                  {/* FOTO DO EVENTO */}
                  <div className="md:w-48 h-32 md:h-auto bg-zinc-900 relative shrink-0">
                    {insc.eventos?.banner_url ? (
                      <img src={insc.eventos.banner_url} alt="Banner" className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">Sem Imagem</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0e0e12] to-transparent"></div>
                  </div>

                  {/* DADOS DA INSCRIÇÃO */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-white font-black text-lg md:text-xl leading-tight truncate">
                          {insc.eventos?.nome || "Campeonato Desconhecido"}
                        </h3>
                        <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest shrink-0 border ${abaAtiva === "pendentes" ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"}`}>
                          {abaAtiva === "pendentes" ? "Aguarda Pagamento" : "Confirmado"}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
                        <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          {formatarData(insc.eventos?.data_evento)}
                        </span>
                        <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          Atleta: <strong className="text-zinc-200">{insc.atleta}</strong>
                        </span>
                      </div>

                      <div className="bg-black/50 p-3 rounded-xl border border-white/5 mb-4 md:mb-0">
                        <span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Categoria Inscrita</span>
                        <span className="text-white text-xs font-bold">{insc.categoria}</span>
                      </div>
                    </div>
                  </div>

                  {/* AÇÕES / BOTÕES */}
                  <div className="p-5 bg-black/20 border-t md:border-t-0 md:border-l border-white/5 flex flex-col justify-center gap-3 shrink-0 md:w-56">
                    {abaAtiva === "pendentes" ? (
                      <>
                        <button onClick={() => abrirModalPix(insc)} className="cursor-pointer w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-[0_0_20px_rgba(5,150,105,0.2)] transition-colors flex items-center justify-center gap-2">
                          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path></svg>
                          Pagar com PIX
                        </button>
                        <button className="cursor-pointer w-full bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] uppercase tracking-widest py-3 rounded-xl border border-white/5 transition-colors">
                          Cartão / Boleto
                        </button>
                      </>
                    ) : (
                      <>
                        <Link href={`/ingresso/${insc.evento_id}/${insc.user_id}`} className="cursor-pointer w-full bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-colors flex items-center justify-center gap-2 text-center">
                       <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
                        Ver Passaporte
                       </Link>
                        <Link href={`/evento/${insc.evento_id}/publico`} className="cursor-pointer w-full bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] uppercase tracking-widest py-3 rounded-xl border border-white/5 transition-colors text-center">
                          Checar Chave
                        </Link>
                      </>
                    )}
                  </div>

                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL SIMULADOR DE PIX                     */}
      {/* ========================================== */}
      {modalPixAberto && inscricaoSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0e0e12] border border-red-500/30 rounded-3xl w-full max-w-sm overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.15)] animate-in zoom-in-95">
            
            <div className="bg-red-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-black uppercase tracking-widest text-sm">Pagamento PIX</h3>
              <button onClick={() => setModalPixAberto(false)} className="text-white/70 hover:text-white transition-colors cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-6 flex flex-col items-center">
              <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest text-center mb-4">Abra o app do seu banco e escaneie o código abaixo</p>
              
              <div className="bg-white p-4 rounded-2xl mb-6 shadow-lg">
                {/* QR Code Falso apontando para o iTatame apenas para ilustrar */}
                <QRCode value={`https://itatame.com/pay/${inscricaoSelecionada.id}`} size={180} level="H" />
              </div>

              <div className="w-full bg-black/50 border border-white/5 rounded-xl p-3 flex items-center justify-between mb-6">
                <span className="text-zinc-500 text-xs font-mono truncate w-48">00020126580014br.gov.bcb.pix...</span>
                <button className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest hover:text-emerald-400 cursor-pointer">Copiar</button>
              </div>

              <div className="w-full border-t border-dashed border-white/10 pt-6">
                <p className="text-center text-zinc-500 text-[9px] uppercase tracking-widest mb-3">🛠️ Ambiente de Testes (Homologação)</p>
                <button 
                  onClick={simularAprovacaoPix} 
                  disabled={processandoPagamento}
                  className="cursor-pointer w-full bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-500 hover:text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processandoPagamento ? "A processar..." : "Simular Pagamento Aprovado"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}