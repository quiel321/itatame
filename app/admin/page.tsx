"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminPage() {
  const [inscricoes, setInscricoes] = useState<any[]>([]);
  
  // ESTADOS DOS FILTROS
  const [busca, setBusca] = useState("");
  const [filtroPagamento, setFiltroPagamento] = useState("todos");
  
  // CONTROLES DE AÇÃO
  const [loadingId, setLoadingId] = useState<string | null>(null);
  
  // ESTADO DO POP-UP DE EDIÇÃO
  const [editando, setEditando] = useState<any>(null);

  async function carregarInscricoes() {
    const { data, error } = await supabase
      .from("inscricoes")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }
    setInscricoes(data || []);
  }

  useEffect(() => {
    carregarInscricoes();
  }, []);

  // FUNÇÃO DE STATUS RÁPIDO (Pagamento e Pesagem)
  async function toggleStatus(id: string, campo: string, valorAtual: boolean) {
    setLoadingId(id);
    const { error } = await supabase.from("inscricoes").update({ [campo]: !valorAtual }).eq("id", id);
      
    if (!error) {
      setInscricoes(prev => prev.map(inst => inst.id === id ? { ...inst, [campo]: !valorAtual } : inst));
    } else {
      alert("Erro ao atualizar status.");
    }
    setLoadingId(null);
  }

  // FUNÇÃO PARA SALVAR A EDIÇÃO DO POP-UP
  async function salvarEdicao() {
    if (!editando) return;
    setLoadingId(editando.id);
    
    const { error } = await supabase
      .from("inscricoes")
      .update({
        equipe: editando.equipe,
        categoria: editando.categoria,
        peso: editando.peso,
        faixa: editando.faixa
      })
      .eq("id", editando.id);

    if (!error) {
      setInscricoes(prev => prev.map(inst => inst.id === editando.id ? editando : inst));
      setEditando(null); // Fecha o Pop-up
    } else {
      alert("Erro ao salvar as alterações.");
    }
    setLoadingId(null);
  }

  const inscricoesFiltradas = inscricoes.filter((inst) => {
    const termo = busca.toLowerCase();
    const matchBusca = (inst.atleta && inst.atleta.toLowerCase().includes(termo)) || (inst.equipe && inst.equipe.toLowerCase().includes(termo));
    const matchPagamento = filtroPagamento === "todos" ? true : filtroPagamento === "pagos" ? inst.pagamento_ok === true : inst.pagamento_ok !== true;
    return matchBusca && matchPagamento;
  });

  const totalInscritos = inscricoes.length;
  const totalPagos = inscricoes.filter(i => i.pagamento_ok).length;
  const totalPendentes = totalInscritos - totalPagos;

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-10 relative">
      <div className="max-w-7xl mx-auto">
        
        <h1 className="text-4xl md:text-5xl font-black mb-8">Centro de Comando</h1>

        {/* DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#050816] border border-white/10 rounded-3xl p-6 shadow-lg">
            <h3 className="text-zinc-400 font-bold uppercase text-xs tracking-wider mb-2">Total de Inscritos</h3>
            <p className="text-4xl font-black text-white">{totalInscritos}</p>
          </div>
          <div className="bg-green-950/20 border border-green-900/30 rounded-3xl p-6 shadow-lg">
            <h3 className="text-green-500 font-bold uppercase text-xs tracking-wider mb-2">Pagamentos Confirmados</h3>
            <p className="text-4xl font-black text-green-400">{totalPagos}</p>
          </div>
          <div className="bg-red-950/20 border border-red-900/30 rounded-3xl p-6 shadow-lg">
            <h3 className="text-red-500 font-bold uppercase text-xs tracking-wider mb-2">Pagamentos Pendentes</h3>
            <p className="text-4xl font-black text-red-400">{totalPendentes}</p>
          </div>
        </div>

        {/* FILTROS */}
        <div className="bg-[#070b1a] border border-white/10 rounded-3xl p-6 mb-10 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input type="text" placeholder="Buscar por nome do atleta ou equipe..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-5 py-4 outline-none focus:border-[#57d8ff] text-white transition-colors" />
          </div>
          <div className="md:w-64">
            <select value={filtroPagamento} onChange={(e) => setFiltroPagamento(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-5 py-4 outline-none focus:border-[#57d8ff] text-white transition-colors appearance-none">
              <option value="todos">Todos os Status</option>
              <option value="pagos">Somente Pagos</option>
              <option value="pendentes">Somente Pendentes</option>
            </select>
          </div>
        </div>

        {/* LISTA DE ATLETAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {inscricoesFiltradas.map((inscricao) => (
            <div key={inscricao.id} className="bg-[#050816] border border-white/10 rounded-3xl p-6 flex flex-col hover:border-white/20 transition-all shadow-xl">
              <div className="flex justify-between items-start mb-4 border-b border-zinc-800 pb-4">
                <h2 className="text-xl font-black text-white truncate pr-2">{inscricao.atleta}</h2>
                {inscricao.absoluto && <span className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider whitespace-nowrap">Absoluto</span>}
              </div>

              <div className="space-y-3 text-zinc-400 text-sm flex-1 mb-6">
                <p className="flex justify-between"><strong className="text-zinc-500">Equipe:</strong> <span className="text-white text-right">{inscricao.equipe}</span></p>
                <p className="flex justify-between"><strong className="text-zinc-500">Categoria:</strong> <span className="text-white text-right truncate pl-4">{inscricao.categoria}</span></p>
                <p className="flex justify-between"><strong className="text-zinc-500">Peso:</strong> <span className="text-white">{inscricao.peso} kg</span></p>
                <p className="flex justify-between"><strong className="text-zinc-500">Faixa:</strong> <span className="text-white">{inscricao.faixa}</span></p>
              </div>

              <div className="flex flex-col gap-2 mt-auto">
                <button onClick={() => toggleStatus(inscricao.id, "pagamento_ok", inscricao.pagamento_ok)} disabled={loadingId === inscricao.id} className={`w-full py-3 rounded-xl font-bold transition-all border flex justify-center items-center gap-2 ${inscricao.pagamento_ok ? 'bg-green-600/10 border-green-600 text-green-500' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'}`}>
                  {inscricao.pagamento_ok ? "✅ Pagamento Confirmado" : "💰 Aprovar Pagamento"}
                </button>
                <div className="flex gap-2">
                  <button onClick={() => toggleStatus(inscricao.id, "pesagem_ok", inscricao.pesagem_ok)} disabled={loadingId === inscricao.id} className={`flex-[2] py-3 rounded-xl font-bold transition-all border flex justify-center items-center ${inscricao.pesagem_ok ? 'bg-[#57d8ff]/10 border-[#57d8ff] text-[#57d8ff]' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'}`}>
                    {inscricao.pesagem_ok ? "⚖️ Bateu o Peso" : "⚖️ Pendente de Pesagem"}
                  </button>
                  
                  {/* BOTÃO EDITAR AGORA ABRE O POP-UP */}
                  <button onClick={() => setEditando({ ...inscricao })} className="flex-1 py-3 rounded-xl font-bold bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all flex justify-center items-center">
                    ✏️ Editar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {inscricoesFiltradas.length === 0 && <div className="col-span-full py-20 text-center text-zinc-500 font-bold">Nenhum atleta encontrado.</div>}
        </div>
      </div>

      {/* ========================================== */}
      {/* POP-UP DE EDIÇÃO (MODAL)                   */}
      {/* ========================================== */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#070b1a] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
            
            <h2 className="text-2xl font-black text-white mb-6 border-b border-zinc-800 pb-4">Editar Inscrição</h2>
            <p className="text-[#57d8ff] font-bold mb-6">Atleta: <span className="text-white">{editando.atleta}</span></p>

            <div className="space-y-4">
              <div>
                <label className="text-zinc-500 text-xs font-bold uppercase block mb-1">Equipe</label>
                <input value={editando.equipe} onChange={(e) => setEditando({...editando, equipe: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-500 text-xs font-bold uppercase block mb-1">Peso Real (kg)</label>
                  <input type="number" value={editando.peso} onChange={(e) => setEditando({...editando, peso: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white" />
                </div>
                <div>
                  <label className="text-zinc-500 text-xs font-bold uppercase block mb-1">Faixa</label>
                  <select value={editando.faixa} onChange={(e) => setEditando({...editando, faixa: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white">
                    <option value="Branca">Branca</option>
                    <option value="Azul">Azul</option>
                    <option value="Roxa">Roxa</option>
                    <option value="Marrom">Marrom</option>
                    <option value="Preta">Preta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-zinc-500 text-xs font-bold uppercase block mb-1">Categoria</label>
                <input value={editando.categoria} onChange={(e) => setEditando({...editando, categoria: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white" />
                <span className="text-zinc-600 text-[10px]">Atenção: Mudar a categoria aqui afeta o gerador de chaves.</span>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button onClick={() => setEditando(null)} className="flex-1 py-4 rounded-xl font-bold bg-zinc-900 text-zinc-400 hover:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={salvarEdicao} disabled={loadingId === editando.id} className="flex-1 py-4 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                {loadingId === editando.id ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}