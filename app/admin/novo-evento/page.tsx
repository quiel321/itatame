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

  const [nome, setNome] = useState("");
  const [modalidade, setModalidade] = useState("Jiu-Jitsu"); 
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("MT"); 
  const [local, setLocal] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [status, setStatus] = useState("ABERTO");
  const [linkInscricao, setLinkInscricao] = useState(""); 
  const [premiacao, setPremiacao] = useState("");

  const [sobreEvento, setSobreEvento] = useState("");
  const [valoresLotes, setValoresLotes] = useState("");
  const [regrasPesagem, setRegrasPesagem] = useState("");

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [regulamentoFile, setRegulamentoFile] = useState<File | null>(null);

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const handleRegulamentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setRegulamentoFile(e.target.files[0]);
    }
  };

  async function salvarEvento(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");
    setSucesso(false);

    if (!nome || !cidade || !dataEvento) {
      setErro("Preencha pelo menos o Nome, Cidade e Data do evento.");
      setLoading(false);
      return;
    }

    try {
      let finalBannerUrl = "";
      let finalRegulamentoUrl = "";

      if (bannerFile) {
        const fileExt = bannerFile.name.split('.').pop();
        const fileName = `banner-${Date.now()}.${fileExt}`;
        const filePath = `banners/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('eventos').upload(filePath, bannerFile);
        if (uploadError) throw new Error("Erro ao fazer upload da imagem: " + uploadError.message);

        const { data: publicUrlData } = supabase.storage.from('eventos').getPublicUrl(filePath);
        finalBannerUrl = publicUrlData.publicUrl;
      }

      if (regulamentoFile) {
        const fileExt = regulamentoFile.name.split('.').pop();
        const fileName = `regulamento-${Date.now()}.${fileExt}`;
        const filePath = `regulamentos/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('eventos').upload(filePath, regulamentoFile);
        if (uploadError) throw new Error("Erro ao fazer upload do regulamento: " + uploadError.message);

        const { data: publicUrlData } = supabase.storage.from('eventos').getPublicUrl(filePath);
        finalRegulamentoUrl = publicUrlData.publicUrl;
      }

      const novoEvento = {
        nome, descricao: modalidade, cidade, estado, local, data_evento: dataEvento, status, link_inscricao: linkInscricao,
        premiacao, sobre_evento: sobreEvento, valores_lotes: valoresLotes, regras_pesagem: regrasPesagem,
        banner_url: finalBannerUrl, regulamento_url: finalRegulamentoUrl 
      };

      const { error } = await supabase.from("eventos").insert([novoEvento]);
      if (error) throw new Error("Erro ao salvar dados do evento: " + error.message);

      setSucesso(true);
      setTimeout(() => { router.push("/"); }, 2000);

    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-8 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        <div className="flex items-center gap-4 mb-8 pt-4">
          <button onClick={() => router.back()} className="cursor-pointer p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-zinc-400 hover:text-white border border-white/5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Lançar Novo Evento</h1>
            <p className="text-zinc-500 text-xs md:text-sm mt-1">Cadastre campeonatos, seminários ou cursos no iTatame.</p>
          </div>
        </div>

        <form onSubmit={salvarEvento} className="bg-[#0a0a0e]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl space-y-10">
          
          <div className="space-y-6">
            <h2 className="text-lg font-black text-white border-b border-white/10 pb-2">1. Dados Principais</h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 ml-1">Nome do Evento *</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Copa iTatame Open 2026 / Seminário de Jiu-Jitsu" className="w-full bg-black/50 border border-white/10 focus:border-red-500 outline-none rounded-2xl px-5 py-4 text-white transition-all placeholder:text-zinc-600 shadow-inner" />
              </div>
              <div className="relative">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="cursor-pointer w-full bg-black/50 border border-white/10 focus:border-red-500 outline-none rounded-2xl px-5 py-4 text-white transition-all appearance-none font-bold shadow-inner">
                  <option value="EM BREVE">🗓️ Em Breve</option>
                  <option value="ABERTO">🟢 Inscrições Abertas</option>
                  <option value="OFICIAL">🔥 Oficial (Destaque)</option>
                  <option value="ENCERRADO">🔴 Encerrado</option>
                </select>
                <svg className="w-4 h-4 text-zinc-400 absolute right-5 top-1/2 mt-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Modalidade / Tipo</label>
              <div className="flex flex-wrap gap-3">
                {["Jiu-Jitsu", "No-Gi", "Judô", "MMA", "Seminário / Curso"].map((mod) => (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => setModalidade(mod)}
                    className={`cursor-pointer px-6 py-3 rounded-xl text-sm font-bold transition-all border ${
                      modalidade === mod 
                      ? "bg-red-600 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]" 
                      : "bg-black/50 border-white/10 text-zinc-400 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    {mod}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-6 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Cidade Sede *</label>
                <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: Cuiabá" className="w-full bg-black/50 border border-white/10 focus:border-red-500 outline-none rounded-xl px-4 py-3 text-white transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">UF</label>
                <input type="text" value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2} placeholder="MT" className="w-full bg-black/50 border border-white/10 focus:border-red-500 outline-none rounded-xl px-4 py-3 text-white transition-all uppercase text-center font-bold" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Data *</label>
                <input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} className="cursor-pointer w-full bg-black/50 border border-white/10 focus:border-red-500 outline-none rounded-xl px-4 py-3 text-white transition-all [color-scheme:dark]" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Local / Ginásio</label>
                <input type="text" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Nome do Ginásio..." className="w-full bg-black/50 border border-white/10 focus:border-red-500 outline-none rounded-2xl px-5 py-4 text-white transition-all placeholder:text-zinc-600" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 ml-1">Link de Inscrição Externa (Opcional)</label>
                <input type="text" value={linkInscricao} onChange={(e) => setLinkInscricao(e.target.value)} placeholder="URL de outro sistema, se houver..." className="w-full bg-black/50 border border-white/10 focus:border-blue-500 outline-none rounded-2xl px-5 py-4 text-white transition-all placeholder:text-zinc-600" />
              </div>
            </div>
          </div>

          <div className="space-y-6 pt-6">
            <h2 className="text-lg font-black text-white border-b border-white/10 pb-2">2. Detalhes e Arquivos</h2>
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Aba: Sobre o Evento</label>
              <textarea rows={4} value={sobreEvento} onChange={(e) => setSobreEvento(e.target.value)} placeholder="Digite um texto de apresentação do evento, cronograma geral..." className="w-full bg-black/50 border border-white/10 focus:border-red-500 outline-none rounded-2xl px-5 py-4 text-white transition-all placeholder:text-zinc-600 resize-none"></textarea>
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Aba: Valores e Lotes</label>
              <textarea rows={4} value={valoresLotes} onChange={(e) => setValoresLotes(e.target.value)} placeholder="Ex: 1º Lote (Até 10/10): R$ 90,00 | 2º Lote: R$ 120,00 | Absoluto: R$ 50,00..." className="w-full bg-black/50 border border-white/10 focus:border-red-500 outline-none rounded-2xl px-5 py-4 text-white transition-all placeholder:text-zinc-600 resize-none"></textarea>
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Aba: Pesagem e Regras</label>
              <textarea rows={4} value={regrasPesagem} onChange={(e) => setRegrasPesagem(e.target.value)} placeholder="Ex: A pesagem ocorrerá de Kimono. Tolerância zero na balança..." className="w-full bg-black/50 border border-white/10 focus:border-red-500 outline-none rounded-2xl px-5 py-4 text-white transition-all placeholder:text-zinc-600 resize-none"></textarea>
            </div>

            <div className="grid md:grid-cols-2 gap-6 items-end">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Resumo da Premiação</label>
                <input type="text" value={premiacao} onChange={(e) => setPremiacao(e.target.value)} placeholder="Ex: Medalhas e Dinheiro no Absoluto" className="w-full bg-black/50 border border-white/10 focus:border-red-500 outline-none rounded-2xl px-5 py-4 text-white transition-all placeholder:text-zinc-600" />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Upload do Regulamento (PDF)</label>
                <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center hover:border-red-500/50 transition-colors bg-black/50 group cursor-pointer">
                  <input type="file" accept="application/pdf" onChange={handleRegulamentoChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <svg className={`w-6 h-6 mb-2 transition-colors pointer-events-none ${regulamentoFile ? "text-red-500" : "text-zinc-500 group-hover:text-red-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  <span className={`text-xs font-bold text-center px-4 truncate w-full pointer-events-none ${regulamentoFile ? "text-white" : "text-zinc-500"}`}>
                    {regulamentoFile ? regulamentoFile.name : "Clique ou arraste o PDF aqui"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 pt-6">
            <h2 className="text-lg font-black text-white border-b border-white/10 pb-2">3. Mídia</h2>
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Upload da Imagem / Banner do Evento</label>
              
              <div className="relative border-2 border-dashed border-white/10 rounded-2xl overflow-hidden flex flex-col items-center justify-center hover:border-red-500/50 transition-colors bg-black/50 group min-h-[150px] md:min-h-[200px] cursor-pointer">
                <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleBannerChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                
                {bannerPreview ? (
                  <>
                    <img src={bannerPreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none" />
                    <div className="relative z-10 bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20 text-white font-bold text-sm flex items-center gap-2 cursor-pointer">
                      <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                      Trocar Imagem
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-zinc-500 group-hover:text-red-400 transition-colors pointer-events-none">
                    <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span className="text-sm font-bold text-center px-4">Clique ou arraste o banner (.png, .jpg)</span>
                    <span className="text-[10px] mt-1 opacity-70">Recomendado: 1200x800px</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-white/10">
            {erro && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-medium flex items-center gap-3"><svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{erro}</div>}
            {sucesso && <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl font-medium text-center flex items-center justify-center gap-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Evento lançado no iTatame com sucesso!</div>}
            
            <button type="submit" disabled={loading || sucesso} className="cursor-pointer disabled:cursor-not-allowed relative w-full bg-red-600 hover:bg-red-500 text-white font-black text-lg py-5 rounded-2xl transition-all shadow-[0_0_30px_rgba(239,68,68,0.4)] group overflow-hidden">
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? "Sincronizando arquivos e dados..." : "PUBLICAR EVENTO"}
                {!loading && <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-400 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}