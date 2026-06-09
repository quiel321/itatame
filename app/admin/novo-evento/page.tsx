"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import imageCompression from "browser-image-compression";

export default function NovoEventoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");
  
  // DADOS GERAIS
  const [nome, setNome] = useState("");
  const [modalidade, setModalidade] = useState("Jiu-Jitsu"); 
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("MT"); 
  const [local, setLocal] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [status, setStatus] = useState("ABERTO");
  const [linkInscricao, setLinkInscricao] = useState(""); 

  // TEXTOS DO EVENTO
  const [sobreEvento, setSobreEvento] = useState("");
  const [valoresLotes, setValoresLotes] = useState("");
  const [regrasPesagem, setRegrasPesagem] = useState("");

  // PONTUACAO POR EQUIPE
  const [pontosEquipeOuro, setPontosEquipeOuro] = useState<number>(10);
  const [pontosEquipePrata, setPontosEquipePrata] = useState<number>(7);
  const [pontosEquipeBronze, setPontosEquipeBronze] = useState<number>(4);
  const [pontosEquipeVitoria, setPontosEquipeVitoria] = useState<number>(1);
  const [absolutoPontuaEquipe, setAbsolutoPontuaEquipe] = useState(false);
  const [woPontuaEquipe, setWoPontuaEquipe] = useState(false);

  // CRONOGRAMA E VAGAS
  const [limiteVagas, setLimiteVagas] = useState<number>(500);
  const [dataInicioInscricoes, setDataInicioInscricoes] = useState("");
  const [dataFimInscricoes, setDataFimInscricoes] = useState("");
  const [dataFimPagamento, setDataFimPagamento] = useState("");
  const [dataInicioChecagem, setDataInicioChecagem] = useState("");
  const [dataFimChecagem, setDataFimChecagem] = useState("");
  const [dataDivulgacaoChaves, setDataDivulgacaoChaves] = useState("");
  const [dataDivulgacaoCronograma, setDataDivulgacaoCronograma] = useState("");

  // VALORES POR LOTES DINÂMICOS
  const [lote1Valor, setLote1Valor] = useState<number>(0);
  const [lote1DataFim, setLote1DataFim] = useState("");
  const [lote2Valor, setLote2Valor] = useState<number>(0);
  const [lote2DataFim, setLote2DataFim] = useState("");
  const [lote3Valor, setLote3Valor] = useState<number>(0);
  const [lote3DataFim, setLote3DataFim] = useState("");

  // FICHEIROS E PREVIEW
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [comprimindo, setComprimindo] = useState(false);
  const [regulamentoFile, setRegulamentoFile] = useState<File | null>(null);

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const options = { maxSizeMB: 0.4, maxWidthOrHeight: 1280, useWebWorker: true, fileType: "image/webp" };
      try {
        setComprimindo(true);
        const compressedFile = await imageCompression(file, options);
        setBannerFile(compressedFile);
        setBannerPreview(URL.createObjectURL(compressedFile));
      } catch (error) {
        alert("Erro ao otimizar a imagem.");
      } finally {
        setComprimindo(false);
      }
    }
  };

  const handleRegulamentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setRegulamentoFile(e.target.files[0]);
  };

  async function salvarEvento(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErro(""); setSucesso(false);

    if (!nome || !cidade || !dataEvento) {
      setErro("Nome, Cidade e Data do evento são obrigatórios.");
      setLoading(false); return;
    }

    try {
      let finalBannerUrl = ""; let finalRegulamentoUrl = "";
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Utilizador não autenticado.");

      if (bannerFile) {
        const fileExt = bannerFile.type.split('/')[1] || "webp";
        const filePath = `banners/banner-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('eventos').upload(filePath, bannerFile);
        if (uploadError) throw new Error("Erro no upload: " + uploadError.message);
        finalBannerUrl = supabase.storage.from('eventos').getPublicUrl(filePath).data.publicUrl;
      }

      if (regulamentoFile) {
        const fileExt = regulamentoFile.name.split('.').pop();
        const filePath = `regulamentos/reg-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('eventos').upload(filePath, regulamentoFile);
        if (uploadError) throw new Error("Erro no edital: " + uploadError.message);
        finalRegulamentoUrl = supabase.storage.from('eventos').getPublicUrl(filePath).data.publicUrl;
      }


      const regrasPontuacaoEquipes = {
        ouro: pontosEquipeOuro,
        prata: pontosEquipePrata,
        bronze: pontosEquipeBronze,
        vitoria: pontosEquipeVitoria,
        absoluto_pontua: absolutoPontuaEquipe,
        wo_pontua: woPontuaEquipe
      };

      const novoEvento = {
        organizador_id: authData.user.id,
        nome, descricao: modalidade, cidade, estado, local, data_evento: dataEvento, status, 
        link_inscricao: linkInscricao, sobre_evento: sobreEvento, valores_lotes: valoresLotes, regras_pesagem: regrasPesagem,
        banner_url: finalBannerUrl, regulamento_url: finalRegulamentoUrl,
        limite_vagas: limiteVagas,
        
        // CONFIGURAÇÃO DOS LOTES NO BANCO
        lote1_valor: lote1Valor,
        lote1_data_fim: lote1DataFim || null,
        lote2_valor: lote2Valor,
        lote2_data_fim: lote2DataFim || null,
        lote3_valor: lote3Valor,
        lote3_data_fim: lote3DataFim || null,

        // OUTRAS DATAS DO CRONOGRAMA
        data_inicio_inscricoes: dataInicioInscricoes || null,
        data_fim_inscricoes: dataFimInscricoes || null,
        data_fim_pagamento: dataFimPagamento || null,
        data_inicio_checagem: dataInicioChecagem || null, // CORRIGIDO AQUI
        data_fim_checagem: dataFimChecagem || null,
        data_divulgacao_chaves: dataDivulgacaoChaves || null,
        data_divulgacao_cronograma: dataDivulgacaoCronograma || null,
        regras_pontuacao_equipes: regrasPontuacaoEquipes,
      };

      let { error } = await supabase.from("eventos").insert([novoEvento]);
      if (error && error.message.toLowerCase().includes("regras_pontuacao_equipes")) {
        const eventoSemPontuacao = { ...novoEvento };
        delete (eventoSemPontuacao as { regras_pontuacao_equipes?: unknown }).regras_pontuacao_equipes;
        const retry = await supabase.from("eventos").insert([eventoSemPontuacao]);
        error = retry.error;
      }
      if (error) throw new Error("Erro DB: " + error.message);

      setSucesso(true);
      setTimeout(() => { router.push("/admin"); }, 1500); 
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-[#050505] border border-white/10 focus:border-red-500 outline-none rounded-md px-3 py-1.5 text-xs text-white transition-all shadow-inner placeholder:text-zinc-700";
  const labelClass = "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5 pl-0.5";
  const sectionClass = "bg-[#0e0e12] p-4 rounded-xl border border-white/5 space-y-3";
  const sectionTitleClass = "text-xs font-black text-white border-l-2 border-red-500 pl-2 uppercase tracking-widest";

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 relative pb-20 font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
          <button onClick={() => router.back()} className="cursor-pointer p-2 bg-white/5 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white border border-white/5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">Lançar Novo Evento</h1>
          </div>
        </div>

        <form onSubmit={salvarEvento} className="space-y-5">
          
          {/* DADOS GERAIS */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>1. Dados Gerais</h2>
            <div className="grid md:grid-cols-4 gap-3">
              <div className="md:col-span-3">
                <label className={`${labelClass} text-red-500`}>Nome Oficial *</label>
                <input required type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Spartan Open Jiu-Jitsu CJ" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} cursor-pointer appearance-none font-bold text-red-400`}>
                  <option value="EM BREVE">Em Breve</option>
                  <option value="ABERTO">Inscrições Abertas</option>
                  <option value="OFICIAL">Oficial</option>
                  <option value="ENCERRADO">Encerrado</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className={labelClass}>Cidade Sede *</label>
                <input required type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: Campos de Júlio" className={inputClass} />
              </div>
              <div className="md:col-span-1">
                <label className={labelClass}>UF</label>
                <input required type="text" value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2} placeholder="MT" className={`${inputClass} text-center`} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Ginásio / Local</label>
                <input type="text" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex: Ginásio 28 de Novembro" className={inputClass} />
              </div>
            </div>
            
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>Data Principal do Evento *</label>
                <input required type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} className={`${inputClass} cursor-pointer [color-scheme:dark]`} />
              </div>
              <div className="md:col-span-3">
                <label className={labelClass}>Link Sistema Externo (Opcional)</label>
                <input type="text" value={linkInscricao} onChange={(e) => setLinkInscricao(e.target.value)} placeholder="Deixe em branco para usar o iTatame" className={inputClass} />
              </div>
            </div>
          </div>

          {/* CRONOGRAMA DE LOTES INTELIGENTES */}
          <div className={sectionClass}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-2">
              <h2 className={sectionTitleClass}>2. Configuração de Valores e Lotes</h2>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Vagas Limite:</label>
                <input type="number" value={limiteVagas} onChange={(e) => setLimiteVagas(Number(e.target.value))} className="w-16 bg-[#050505] border border-white/10 rounded px-2 py-1 text-xs text-white text-center outline-none focus:border-red-500" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Lote 1 */}
              <div className="bg-[#050505] p-3 rounded-lg border border-white/5 space-y-2">
                <h3 className="text-[10px] font-black text-green-500 uppercase tracking-widest border-b border-white/5 pb-1">1º Lote (Promocional)</h3>
                <div>
                  <label className="text-[9px] text-zinc-500 font-bold uppercase">Valor (R$)</label>
                  <input type="number" step="0.01" value={lote1Valor} onChange={(e) => setLote1Valor(Number(e.target.value))} className={inputClass} />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 font-bold uppercase">Término do Lote:</label>
                  <input type="datetime-local" value={lote1DataFim} onChange={(e) => setLote1DataFim(e.target.value)} className={`${inputClass} !py-1 text-[11px]`} />
                </div>
              </div>

              {/* Lote 2 */}
              <div className="bg-[#050505] p-3 rounded-lg border border-white/5 space-y-2">
                <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest border-b border-white/5 pb-1">2º Lote</h3>
                <div>
                  <label className="text-[9px] text-zinc-500 font-bold uppercase">Valor (R$)</label>
                  <input type="number" step="0.01" value={lote2Valor} onChange={(e) => setLote2Valor(Number(e.target.value))} className={inputClass} />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 font-bold uppercase">Término do Lote:</label>
                  <input type="datetime-local" value={lote2DataFim} onChange={(e) => setLote2DataFim(e.target.value)} className={`${inputClass} !py-1 text-[11px]`} />
                </div>
              </div>

              {/* Lote 3 */}
              <div className="bg-[#050505] p-3 rounded-lg border border-white/5 space-y-2">
                <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest border-b border-white/5 pb-1">3º Lote (Final)</h3>
                <div>
                  <label className="text-[9px] text-zinc-500 font-bold uppercase">Valor (R$)</label>
                  <input type="number" step="0.01" value={lote3Valor} onChange={(e) => setLote3Valor(Number(e.target.value))} className={inputClass} />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 font-bold uppercase">Encerramento Inscrições:</label>
                  <input type="datetime-local" value={lote3DataFim} onChange={(e) => setLote3DataFim(e.target.value)} className={`${inputClass} !py-1 text-[11px]`} />
                </div>
              </div>
            </div>
          </div>

          {/* CRONOGRAMA ADICIONAL OPERACIONAL */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>3. Cronograma Operacional</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#050505] p-3 rounded-lg border border-white/5">
              <div>
                <label className="block text-[9px] font-bold text-yellow-500 uppercase mb-0.5">Vencimento Boleto/Pix</label>
                <input type="datetime-local" value={dataFimPagamento} onChange={(e) => setDataFimPagamento(e.target.value)} className={`${inputClass} !py-1 text-[11px]`} />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-blue-500 uppercase mb-0.5">Início da Checagem</label>
                <input type="datetime-local" value={dataInicioChecagem} onChange={(e) => setDataInicioChecagem(e.target.value)} className={`${inputClass} !py-1 text-[11px]`} />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-blue-500 uppercase mb-0.5">Fim da Checagem</label>
                <input type="datetime-local" value={dataFimChecagem} onChange={(e) => setDataFimChecagem(e.target.value)} className={`${inputClass} !py-1 text-[11px]`} />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-purple-500 uppercase mb-0.5">Divulgação das Chaves</label>
                <input type="datetime-local" value={dataDivulgacaoChaves} onChange={(e) => setDataDivulgacaoChaves(e.target.value)} className={`${inputClass} !py-1 text-[11px]`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[9px] font-bold text-purple-500 uppercase mb-0.5">Divulgação do Cronograma</label>
                <input type="datetime-local" value={dataDivulgacaoCronograma} onChange={(e) => setDataDivulgacaoCronograma(e.target.value)} className={`${inputClass} !py-1 text-[11px]`} />
              </div>
            </div>
          </div>



          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>4. Pontuação por Equipe</h2>
            <p className="text-zinc-500 text-[10px] leading-relaxed">Defina como o ranking por equipe vai pontuar neste evento. Esses valores podem mudar conforme o regulamento do organizador.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>Ouro</label>
                <input type="number" value={pontosEquipeOuro} onChange={(e) => setPontosEquipeOuro(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Prata</label>
                <input type="number" value={pontosEquipePrata} onChange={(e) => setPontosEquipePrata(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Bronze</label>
                <input type="number" value={pontosEquipeBronze} onChange={(e) => setPontosEquipeBronze(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Vitória</label>
                <input type="number" value={pontosEquipeVitoria} onChange={(e) => setPontosEquipeVitoria(Number(e.target.value))} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 bg-[#050505] border border-white/10 rounded-lg p-3 text-xs font-bold text-zinc-300">
                <input type="checkbox" checked={absolutoPontuaEquipe} onChange={(e) => setAbsolutoPontuaEquipe(e.target.checked)} className="w-4 h-4 accent-red-600" />
                Absoluto pontua para equipe
              </label>
              <label className="flex items-center gap-3 bg-[#050505] border border-white/10 rounded-lg p-3 text-xs font-bold text-zinc-300">
                <input type="checkbox" checked={woPontuaEquipe} onChange={(e) => setWoPontuaEquipe(e.target.checked)} className="w-4 h-4 accent-red-600" />
                Vitória por W.O. pontua
              </label>
            </div>
          </div>

          {/* TEXTOS E IDENTIDADE VISUAL */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>4. Regras & Textos Informativos</h2>
              <div>
                <label className={labelClass}>Lotes e Valores (Descrição UI)</label>
                <textarea rows={2} value={valoresLotes} onChange={(e) => setValoresLotes(e.target.value)} placeholder="Ex: Lote promocional R$ 90,00..." className={`${inputClass} resize-none`}></textarea>
              </div>
              <div>
                <label className={labelClass}>Apresentação do Evento</label>
                <textarea rows={2} value={sobreEvento} onChange={(e) => setSobreEvento(e.target.value)} placeholder="Breve texto de apresentação..." className={`${inputClass} resize-none`}></textarea>
              </div>
              <div>
                <label className={labelClass}>Avisos de Pesagem</label>
                <input type="text" value={regrasPesagem} onChange={(e) => setRegrasPesagem(e.target.value)} placeholder="Ex: Pesagem com kimono, tolerância zero." className={inputClass} />
              </div>
            </div>

            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>5. Identidade & Edital</h2>
              <label className={labelClass}>Banner Oficial (Proporção 16:9)</label>
              <div className="relative border border-dashed border-white/20 rounded-md overflow-hidden flex flex-col items-center justify-center hover:border-red-500/50 bg-[#050505] group aspect-video w-full cursor-pointer shadow-inner mb-3">
                <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleBannerChange} disabled={comprimindo} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed" />
                {comprimindo ? (
                  <div className="flex flex-col items-center text-red-500 z-10"><span className="text-[10px] font-bold uppercase">Otimizando...</span></div>
                ) : bannerPreview ? (
                  <>
                    <img src={bannerPreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-70 pointer-events-none" />
                    <div className="relative z-10 bg-black/80 px-2 py-1 rounded border border-white/20 text-white font-bold text-[9px] uppercase tracking-widest">Trocar Imagem</div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-zinc-600 pointer-events-none">
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span className="text-[10px] font-bold text-center px-4 uppercase tracking-widest">Upload do Banner</span>
                  </div>
                )}
              </div>

              <label className={labelClass}>Regulamento Oficial (PDF)</label>
              <div className="relative border border-dashed border-white/20 rounded-md p-2 flex flex-col items-center justify-center hover:border-red-500/50 bg-[#050505] cursor-pointer">
                <input type="file" accept="application/pdf" onChange={handleRegulamentoChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <span className={`text-[10px] font-bold truncate w-full text-center ${regulamentoFile ? "text-white" : "text-zinc-500 uppercase tracking-widest"}`}>
                  {regulamentoFile ? `📄 ${regulamentoFile.name}` : "Anexar PDF do Edital"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            {erro && <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md font-bold text-[10px] uppercase text-center">{erro}</div>}
            {sucesso && <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-md font-bold text-[10px] uppercase text-center">Lançado com sucesso!</div>}
            <button type="submit" disabled={loading || sucesso || comprimindo} className="cursor-pointer disabled:opacity-50 w-full bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-widest py-3 rounded-md transition-all active:scale-95 flex items-center justify-center gap-2">
              {loading || comprimindo ? "Processando..." : "Publicar Evento Oficial"}
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}