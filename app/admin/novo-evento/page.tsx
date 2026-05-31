"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function NovoEventoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  // ESTADOS DO FORMULÁRIO
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("RO"); // Já deixei seu estado como padrão!
  const [local, setLocal] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [status, setStatus] = useState("ABERTO");

  async function salvarEvento(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");
    setSucesso(false);

    // Validação básica
    if (!nome || !cidade || !dataEvento) {
      setErro("Preencha pelo menos o Nome, Cidade e Data do evento.");
      setLoading(false);
      return;
    }

    const novoEvento = {
      nome,
      descricao,
      cidade,
      estado,
      local,
      data_evento: dataEvento,
      banner_url: bannerUrl,
      status
    };

    const { error } = await supabase.from("eventos").insert([novoEvento]);

    if (error) {
      setErro("Erro ao criar evento: " + error.message);
    } else {
      setSucesso(true);
      // Limpa o formulário após o sucesso
      setNome(""); setDescricao(""); setCidade(""); setLocal(""); setDataEvento(""); setBannerUrl("");
      
      // Redireciona para a Home após 2 segundos para ver o evento no ar
      setTimeout(() => {
        router.push("/");
      }, 2000);
    }
    
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        
        {/* NAVEGAÇÃO SUPERIOR */}
        <div className="flex items-center gap-4 mb-10">
          <Link href="/admin" className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-zinc-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </Link>
          <div>
            <h1 className="text-3xl font-black text-white">Lançar Novo Evento</h1>
            <p className="text-zinc-500 text-sm mt-1">Preencha os dados oficiais para publicar o campeonato.</p>
          </div>
        </div>

        {/* FORMULÁRIO */}
        <form onSubmit={salvarEvento} className="bg-[#0a0a0e] border border-white/5 rounded-[32px] p-8 md:p-10 shadow-2xl">
          
          <div className="space-y-6">
            
            {/* LINHA 1: Nome e Status */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Nome do Campeonato *</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Copa iTatame Open" className="w-full bg-black/50 border border-white/5 focus:border-red-500/50 outline-none rounded-xl px-5 py-4 text-white transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Status Inicial</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-red-500/50 outline-none rounded-xl px-5 py-4 text-white transition-colors appearance-none">
                  <option value="EM BREVE">Em Breve</option>
                  <option value="ABERTO">Aberto</option>
                  <option value="OFICIAL">Oficial (Destaque)</option>
                </select>
              </div>
            </div>

            {/* LINHA 2: Descrição */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Modalidade / Detalhes</label>
              <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Jiu-Jitsu Gi e No-Gi • Premiação em Dinheiro" className="w-full bg-black/50 border border-white/5 focus:border-red-500/50 outline-none rounded-xl px-5 py-4 text-white transition-colors" />
            </div>

            {/* LINHA 3: Localização */}
            <div className="grid md:grid-cols-4 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Cidade *</label>
                <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: Vilhena" className="w-full bg-black/50 border border-white/5 focus:border-red-500/50 outline-none rounded-xl px-5 py-4 text-white transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Estado</label>
                <input type="text" value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2} placeholder="UF" className="w-full bg-black/50 border border-white/5 focus:border-red-500/50 outline-none rounded-xl px-5 py-4 text-white transition-colors uppercase" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Data *</label>
                <input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-red-500/50 outline-none rounded-xl px-5 py-4 text-white transition-colors [color-scheme:dark]" />
              </div>
            </div>

            {/* LINHA 4: Ginásio */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Ginásio / Local</label>
              <input type="text" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex: Ginásio Poliesportivo Jorge Teixeira" className="w-full bg-black/50 border border-white/5 focus:border-red-500/50 outline-none rounded-xl px-5 py-4 text-white transition-colors" />
            </div>

            {/* LINHA 5: Banner */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">URL do Banner (Imagem de Fundo)</label>
              <input type="text" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="Deixe em branco para usar a imagem padrão do iTatame" className="w-full bg-black/50 border border-white/5 focus:border-red-500/50 outline-none rounded-xl px-5 py-4 text-zinc-400 transition-colors" />
              <p className="text-zinc-600 text-xs mt-2">Dica: Cole um link direto de imagem (.jpg ou .png).</p>
            </div>

          </div>

          {/* MENSAGENS E BOTÃO */}
          <div className="mt-10 pt-8 border-t border-white/5">
            {erro && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-medium">{erro}</div>}
            {sucesso && <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl font-medium text-center">✅ Evento lançado com sucesso! Redirecionando...</div>}
            
            <button type="submit" disabled={loading || sucesso} className="w-full bg-red-600 hover:bg-red-500 text-white font-black text-lg py-5 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Publicando no servidor..." : "Lançar Campeonato"}
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}