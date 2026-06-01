"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

export default function VouchersAdminPage() {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  // ESTADOS DOS DADOS
  const [eventos, setEventos] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);

  // ESTADOS DO FORMULÁRIO
  const [eventoSelecionado, setEventoSelecionado] = useState("");
  const [equipeSelecionada, setEquipeSelecionada] = useState("");
  const [quantidade, setQuantidade] = useState<number | "">("");

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      window.location.href = "/login-organizador";
      return;
    }

    try {
      // 2. BUSCA EVENTOS (Com trava de segurança)
      const { data: evtData, error: evtError } = await supabase
        .from("eventos")
        .select("id, nome")
        .eq("organizador_id", authData.user.id); 

      if (evtError) throw evtError; // Joga pro Catch ao invés do console
      
      let meusEventosIds: string[] = [];

      if (evtData) {
        setEventos(evtData);
        meusEventosIds = evtData.map(e => e.id);
      }

      // 3. Busca Professores e Equipes
      const { data: profData, error: profError } = await supabase
        .from("atletas")
        .select("nome, equipe")
        .eq("role", "professor")
        .neq("equipe", "")
        .not("equipe", "is", null);

      if (profError) throw profError;

      if (profData) {
        const equipesUnicas = Array.from(new Set(profData.map(p => `${p.equipe}|${p.nome}`))).map(str => {
          const [eq, prof] = str.split("|");
          return { equipe: eq, professor: prof };
        });
        setEquipes(equipesUnicas);
      }

      // 4. BUSCA VOUCHERS
      if (meusEventosIds.length > 0) {
        const { data: vData, error: vError } = await supabase
          .from("vouchers")
          .select("*, eventos (nome)")
          .in("evento_id", meusEventosIds) 
          .order("criado_em", { ascending: false });
        
        if (vError) throw vError;
        if (vData) setVouchers(vData);
      } else {
        setVouchers([]); 
      }

    } catch (error: any) {
      // O erro agora aparece no nosso layout e não quebra o Next.js
      setErro("Houve um problema de conexão: " + error.message);
    }

    setLoading(false);
  }

  async function gerarVoucher(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    setMensagem("");

    if (!eventoSelecionado || !equipeSelecionada || !quantidade || quantidade <= 0) {
      setErro("Preencha todos os campos corretamente.");
      setSalvando(false);
      return;
    }

    const [eqNome, profNome] = equipeSelecionada.split("|");

    try {
      const novoVoucher = {
        evento_id: eventoSelecionado,
        equipe_nome: eqNome,
        professor_nome: profNome,
        quantidade_total: quantidade,
      };

      const { error } = await supabase.from("vouchers").insert([novoVoucher]);

      if (error) throw error;

      setMensagem(`Voucher de ${quantidade} inscrições gerado com sucesso para a equipe ${eqNome}!`);
      setEventoSelecionado("");
      setEquipeSelecionada("");
      setQuantidade("");
      
      await carregarDados();

      setTimeout(() => setMensagem(""), 3000);
    } catch (err: any) {
      setErro("Erro ao gerar voucher: " + err.message);
    } finally {
      setSalvando(false);
    }
  }

  // ==========================================
  // FUNÇÃO DE EXCLUSÃO MELHORADA
  // ==========================================
  async function excluirVoucher(id: string) {
    const confirmacao = window.confirm("Deseja realmente cancelar este voucher? Os alunos que já usaram continuarão inscritos, mas a equipe não poderá usar o saldo restante.");
    if (!confirmacao) return;

    try {
      // O .select() no final força o Supabase a devolver os dados da linha que foi apagada
      const { data, error } = await supabase.from("vouchers").delete().eq("id", id).select();
      
      if (error) throw error;
      
      // Se 'data' vier vazio, significa que o comando rodou, mas o banco se recusou a apagar a linha (Falta de permissão RLS)
      if (data && data.length === 0) {
        alert("⚠️ AVISO: O Supabase bloqueou a exclusão. Vá no seu painel do Supabase, na tabela 'vouchers', e verifique se as políticas (RLS) permitem a ação de DELETE.");
      }
      
      await carregarDados();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  }

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-sm">Carregando Painel...</div>;

  return (
    <main className="min-h-screen bg-[#050505] p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/admin" className="text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1 mb-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
              Voltar ao Painel
            </Link>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
              Gestão de Cortesias
            </h1>
            <p className="text-zinc-400 text-sm mt-1">Libere vagas gratuitas para as equipes parceiras do seu evento.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-[350px_1fr] gap-6">
          
          {/* ========================================== */}
          {/* FORMULÁRIO DE GERAÇÃO                      */}
          {/* ========================================== */}
          <div className="bg-[#0a0a0e] border border-white/5 rounded-3xl p-6 shadow-xl h-fit">
            <h3 className="text-white font-black text-lg mb-6 border-b border-white/5 pb-4">Gerar Novo Voucher</h3>
            
            {erro && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-bold text-xs">{erro}</div>}
            {mensagem && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl font-bold text-xs">{mensagem}</div>}

            <form onSubmit={gerarVoucher} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">1. Selecione o Evento</label>
                <select 
                  value={eventoSelecionado} 
                  onChange={(e) => setEventoSelecionado(e.target.value)} 
                  required
                  className="w-full cursor-pointer bg-black/50 border border-white/10 focus:border-yellow-500 outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors appearance-none"
                >
                  <option value="" className="bg-[#0a0a0e]">Selecione um evento...</option>
                  {eventos.map(ev => (
                    <option key={ev.id} value={ev.id} className="bg-[#0a0a0e]">{ev.nome}</option>
                  ))}
                </select>
                {eventos.length === 0 && (
                  <p className="text-[9px] text-yellow-500 mt-1 pl-1">Você não possui eventos criados.</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">2. Equipe Parceira (Mestre)</label>
                <select 
                  value={equipeSelecionada} 
                  onChange={(e) => setEquipeSelecionada(e.target.value)} 
                  required
                  className="w-full cursor-pointer bg-black/50 border border-white/10 focus:border-yellow-500 outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors appearance-none"
                >
                  <option value="" className="bg-[#0a0a0e]">Selecione a equipe beneficiada...</option>
                  {equipes.map((eq, i) => (
                    <option key={i} value={`${eq.equipe}|${eq.professor}`} className="bg-[#0a0a0e]">
                      {eq.equipe} (Resp: {eq.professor})
                    </option>
                  ))}
                </select>
                {equipes.length === 0 && (
                  <p className="text-[9px] text-yellow-500 mt-1 pl-1">Nenhum professor cadastrou uma equipe ainda.</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">3. Quantidade de Vagas</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  value={quantidade} 
                  onChange={(e) => setQuantidade(parseInt(e.target.value))} 
                  placeholder="Ex: 10"
                  className="w-full bg-black/50 border border-white/10 focus:border-yellow-500 outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors"
                />
              </div>

              <button 
                type="submit" 
                disabled={salvando || eventos.length === 0 || equipes.length === 0}
                className="w-full mt-2 cursor-pointer bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(234,179,8,0.2)] disabled:opacity-50 flex justify-center"
              >
                {salvando ? "Gerando..." : "Gerar Cortesias"}
              </button>
            </form>
          </div>

          {/* ========================================== */}
          {/* LISTA DE VOUCHERS ATIVOS                   */}
          {/* ========================================== */}
          <div className="bg-[#0a0a0e] border border-white/5 rounded-3xl p-6 shadow-xl">
            <h3 className="text-white font-black text-lg mb-6 border-b border-white/5 pb-4">Vouchers Ativos</h3>
            
            {vouchers.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl">
                <p className="text-zinc-500 font-medium text-sm">Nenhuma cortesia liberada até o momento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vouchers.map(v => {
                  const saldo = v.quantidade_total - v.quantidade_usada;
                  const isEsgotado = saldo <= 0;

                  return (
                    <div key={v.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/10 transition-colors relative overflow-hidden">
                      
                      {/* BARRA DE PROGRESSO DE FUNDO */}
                      <div 
                        className={`absolute top-0 left-0 h-1 bg-gradient-to-r ${isEsgotado ? 'from-red-500/50 to-red-500/10' : 'from-yellow-500/50 to-yellow-500/10'}`} 
                        style={{ width: `${(v.quantidade_usada / v.quantidade_total) * 100}%` }}
                      ></div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${isEsgotado ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                            {isEsgotado ? 'Esgotado' : 'Ativo'}
                          </span>
                          <span className="text-zinc-500 text-[10px] font-bold truncate">
                            {v.eventos?.nome || "Evento Deletado"}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-white leading-tight truncate">
                          Equipe {v.equipe_nome}
                        </h4>
                        <p className="text-zinc-400 text-[10px] uppercase tracking-widest mt-1">
                          Prof. Resp: {v.professor_nome}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <span className="text-2xl font-black text-white block leading-none">{v.quantidade_usada} <span className="text-sm text-zinc-600">/ {v.quantidade_total}</span></span>
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Usados</span>
                        </div>
                        
                        {/* AJUSTE AQUI: Adicionado type="button" e relative z-10 */}
                        <button 
                          type="button"
                          onClick={() => excluirVoucher(v.id)}
                          className="relative z-10 cursor-pointer p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors border border-red-500/20 group"
                          title="Cancelar Voucher"
                        >
                          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}