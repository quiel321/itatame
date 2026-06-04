"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function VouchersAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  // ESTADOS DOS DADOS
  const [eventos, setEventos] = useState<any[]>([]);
  const [cupons, setCupons] = useState<any[]>([]);

  // ESTADOS DO FORMULÁRIO
  const [eventoId, setEventoId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [tipoDesconto, setTipoDesconto] = useState("porcentagem");
  const [valorDesconto, setValorDesconto] = useState<number | "">(100);
  const [limiteUsos, setLimiteUsos] = useState<number | "">(5);

  useEffect(() => {
    carregarEventos();
  }, []);

  useEffect(() => {
    if (eventoId) {
      carregarCupons(eventoId);
    } else {
      setCupons([]);
    }
  }, [eventoId]);

  async function carregarEventos() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      router.push("/login-organizador");
      return;
    }

    try {
      const { data: evtData, error: evtError } = await supabase
        .from("eventos")
        .select("id, nome")
        .eq("organizador_id", authData.user.id)
        .order("id", { ascending: false });

      if (evtError) throw evtError;

      if (evtData && evtData.length > 0) {
        setEventos(evtData);
        setEventoId(evtData[0].id.toString());
      }
    } catch (error: any) {
      setErro("Erro ao buscar eventos: " + error.message);
    }
    setLoading(false);
  }

  async function carregarCupons(idEvento: string) {
    try {
      const { data: cupomData, error } = await supabase
        .from("cupons")
        .select("*")
        .eq("evento_id", idEvento)
        .order("criado_em", { ascending: false });

      if (error) throw error;
      setCupons(cupomData || []);
    } catch (error: any) {
      console.error(error);
    }
  }

  async function gerarCupom(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    setMensagem("");

    if (!eventoId || !codigo || valorDesconto === "" || limiteUsos === "") {
      setErro("Preencha todos os campos corretamente.");
      setSalvando(false);
      return;
    }

    const codigoLimpo = codigo.trim().toUpperCase();
    const valDesconto = Number(valorDesconto);

    if (tipoDesconto === "porcentagem" && (valDesconto <= 0 || valDesconto > 100)) {
      setErro("A porcentagem deve ser entre 1 e 100.");
      setSalvando(false); return;
    }

    try {
      const novoCupom = {
        codigo: codigoLimpo,
        evento_id: eventoId,
        limite_usos: Number(limiteUsos),
        usos_atualmente: 0,
        desconto_porcentagem: tipoDesconto === "porcentagem" ? valDesconto : 0,
        desconto_valor: tipoDesconto === "valor" ? valDesconto : 0,
      };

      const { data, error } = await supabase.from("cupons").insert([novoCupom]).select().single();

      if (error) {
        if (error.code === '23505') {
          throw new Error("Este código de cupom já existe para este evento.");
        }
        throw error;
      }

      setMensagem(`Cupom ${codigoLimpo} ativado com sucesso!`);
      setCodigo("");
      setValorDesconto(100);
      setTipoDesconto("porcentagem");
      setLimiteUsos(5);
      
      if (data) {
        setCupons([data, ...cupons]);
      }

      setTimeout(() => setMensagem(""), 3000);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluirCupom(id: string) {
    const confirmacao = window.confirm("Deseja apagar este cupom? Atletas que já usaram não serão afetados, mas o código não funcionará mais.");
    if (!confirmacao) return;

    try {
      const { error } = await supabase.from("cupons").delete().eq("id", id);
      if (error) throw error;
      setCupons(cupons.filter(c => c.id !== id));
    } catch (err: any) {
      alert("Erro ao excluir cupom: " + err.message);
    }
  }

  const inputClass = "w-full bg-[#050505] border border-white/10 focus:border-red-500 outline-none rounded-xl px-4 py-3 text-sm text-white transition-colors placeholder:text-zinc-700";

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-sm">Carregando Painel...</div>;

  return (
    <main className="min-h-screen bg-[#050505] p-4 md:p-8 font-sans relative overflow-x-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/admin" className="text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1 mb-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
              Voltar ao Painel
            </Link>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
              Gerenciador de Cupons
            </h1>
            <p className="text-zinc-400 text-sm mt-1">Crie códigos de desconto e isenções para seus parceiros.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-[400px_1fr] gap-6">
          
          {/* ========================================== */}
          {/* FORMULÁRIO DE GERAÇÃO                      */}
          {/* ========================================== */}
          <div className="bg-[#0a0a0e] border border-white/5 rounded-3xl p-6 shadow-xl h-fit">
            <h3 className="text-white font-black text-lg mb-6 border-b border-white/5 pb-4">Gerar Novo Cupom</h3>
            
            {erro && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-bold text-xs">{erro}</div>}
            {mensagem && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl font-bold text-xs">{mensagem}</div>}

            <form onSubmit={gerarCupom} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">1. Evento Alvo</label>
                <div className="relative">
                  <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} required className={`${inputClass} appearance-none cursor-pointer`}>
                    {eventos.length === 0 && <option value="" className="bg-[#0a0a0e]">Nenhum evento...</option>}
                    {eventos.map(ev => <option key={ev.id} value={ev.id} className="bg-[#0a0a0e]">{ev.nome}</option>)}
                  </select>
                  <svg className="w-4 h-4 text-zinc-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">2. Código do Cupom</label>
                <input type="text" required placeholder="EX: VIPSPARTAN" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">Tipo</label>
                  <select value={tipoDesconto} onChange={(e) => setTipoDesconto(e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
                    <option value="porcentagem" className="bg-[#0a0a0e]">Porcentagem (%)</option>
                    <option value="valor" className="bg-[#0a0a0e]">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">Desconto</label>
                  <input type="number" step="0.01" required value={valorDesconto} onChange={(e) => setValorDesconto(Number(e.target.value))} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">3. Limite de Usos (Pessoas)</label>
                <input type="number" required min="1" value={limiteUsos} onChange={(e) => setLimiteUsos(Number(e.target.value))} placeholder="Ex: 5" className={inputClass} />
                <p className="text-[9px] text-zinc-500 mt-1.5 ml-1">Após este limite, o cupom expira automaticamente.</p>
              </div>

              <button type="submit" disabled={salvando || eventos.length === 0} className="w-full mt-2 cursor-pointer bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(234,179,8,0.2)] disabled:opacity-50 flex items-center justify-center gap-2">
                <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path></svg>
                {salvando ? "Salvando..." : "Ativar Cupom"}
              </button>
            </form>
          </div>

          {/* ========================================== */}
          {/* LISTA DE CUPONS ATIVOS                     */}
          {/* ========================================== */}
          <div className="bg-[#0a0a0e] border border-white/5 rounded-3xl p-6 shadow-xl h-fit">
            <h3 className="text-white font-black text-lg mb-6 border-b border-white/5 pb-4">Cupons Operacionais</h3>
            
            {!eventoId ? (
              <div className="text-center py-10"><p className="text-zinc-500 font-medium text-sm">Selecione um evento ao lado.</p></div>
            ) : cupons.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl">
                <p className="text-zinc-500 font-medium text-sm">Nenhum cupom ativo para este evento.</p>
                <p className="text-zinc-600 text-[10px] mt-2 uppercase tracking-widest">Crie códigos de desconto ao lado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cupons.map(c => {
                  const saldo = c.limite_usos - c.usos_atualmente;
                  const isEsgotado = saldo <= 0;

                  return (
                    <div key={c.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/10 transition-colors relative overflow-hidden">
                      
                      {/* BARRA DE PROGRESSO DE FUNDO */}
                      <div 
                        className={`absolute top-0 left-0 h-1 bg-gradient-to-r ${isEsgotado ? 'from-red-500/50 to-red-500/10' : 'from-yellow-500/50 to-yellow-500/10'}`} 
                        style={{ width: `${(c.usos_atualmente / c.limite_usos) * 100}%` }}
                      ></div>

                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-yellow-500 shrink-0">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${isEsgotado ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                              {isEsgotado ? 'Esgotado' : 'Ativo'}
                            </span>
                          </div>
                          <h4 className="text-base font-black text-white leading-tight font-mono tracking-wide">
                            {c.codigo}
                          </h4>
                          <p className="text-zinc-400 text-xs mt-1 font-medium">
                            Desconto: <strong className="text-white">{c.desconto_porcentagem > 0 ? `${c.desconto_porcentagem}%` : `R$ ${c.desconto_valor.toFixed(2).replace('.', ',')}`}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <span className="text-2xl font-black text-white block leading-none">{c.usos_atualmente} <span className="text-sm text-zinc-600">/ {c.limite_usos}</span></span>
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Usos</span>
                        </div>
                        
                        <button 
                          type="button"
                          onClick={() => excluirCupom(c.id)}
                          className="relative z-10 cursor-pointer p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors border border-red-500/20 group"
                          title="Excluir Cupom"
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