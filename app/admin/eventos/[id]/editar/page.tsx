"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase"; 
import imageCompression from "browser-image-compression";

export default function EditarEventoPage() {
  const router = useRouter();
  const params = useParams();
  const eventoId = params.id as string;

  const [loadingInitial, setLoadingInitial] = useState(true);
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

  // LOTES DINÂMICOS
  const [lote1Valor, setLote1Valor] = useState<number>(0);
  const [lote1DataFim, setLote1DataFim] = useState("");
  const [lote2Valor, setLote2Valor] = useState<number>(0);
  const [lote2DataFim, setLote2DataFim] = useState("");
  const [lote3Valor, setLote3Valor] = useState<number>(0);
  const [lote3DataFim, setLote3DataFim] = useState("");

  // ARQUIVOS DO BANCO E NOVOS
  const [bannerAtualUrl, setBannerAtualUrl] = useState("");
  const [regulamentoAtualUrl, setRegulamentoAtualUrl] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [comprimindo, setComprimindo] = useState(false);
  const [regulamentoFile, setRegulamentoFile] = useState<File | null>(null);

  const formatarParaInput = (dataISO: string | null) => {
    if (!dataISO) return "";
    return dataISO.slice(0, 16); 
  };

  useEffect(() => {
    async function carregarEvento() {
      if (!eventoId) return;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) throw new Error("Acesso negado.");

        const { data: evento, error } = await supabase
          .from("eventos")
          .select("*")
          .eq("id", eventoId)
          .single();

        if (error || !evento) throw new Error("Evento não encontrado.");

        setNome(evento.nome || "");
        setModalidade(evento.descricao || "Jiu-Jitsu"); 
        setCidade(evento.cidade || "");
        setEstado(evento.estado || "MT");
        setLocal(evento.local || "");
        setDataEvento(evento.data_evento || "");
        setStatus(evento.status || "ABERTO");
        setLinkInscricao(evento.link_inscricao || "");
        setSobreEvento(evento.sobre_evento || "");
        setValoresLotes(evento.valores_lotes || "");
        setRegrasPesagem(evento.regras_pesagem || "");
        setLimiteVagas(evento.limite_vagas || 500);

        // PUXA OS VALORES E DATAS DOS 3 LOTES DO BANCO
        setLote1Valor(Number(evento.lote1_valor) || 0);
        setLote1DataFim(formatarParaInput(evento.lote1_data_fim));
        setLote2Valor(Number(evento.lote2_valor) || 0);
        setLote2DataFim(formatarParaInput(evento.lote2_data_fim));
        setLote3Valor(Number(evento.lote3_valor) || 0);
        setLote3DataFim(formatarParaInput(evento.lote3_data_fim));
        
        // CRONOGRAMA ADICIONAL
        setDataInicioInscricoes(formatarParaInput(evento.data_inicio_inscricoes));
        setDataFimInscricoes(formatarParaInput(evento.data_fim_inscricoes));
        setDataFimPagamento(formatarParaInput(evento.data_fim_pagamento));
        setDataInicioChecagem(formatarParaInput(evento.data_inicio_checagem));
        setDataFimChecagem(formatarParaInput(evento.data_fim_checagem));
        setDataDivulgacaoChaves(formatarParaInput(evento.data_divulgacao_chaves));
        setDataDivulgacaoCronograma(formatarParaInput(evento.data_divulgacao_cronograma));

        setBannerAtualUrl(evento.banner_url || "");
        setRegulamentoAtualUrl(evento.regulamento_url || "");

      } catch (err: any) {
        alert(err.message);
        router.push("/admin");
      } finally {
        setLoadingInitial(false);
      }
    }
    carregarEvento();
  }, [eventoId, router]);

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
        alert("Erro na compressão.");
      } finally {
        setComprimindo(false);
      }
    }
  };

  async function atualizarEvento(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErro(""); setSucesso(false);

    try {
      let finalBannerUrl = bannerAtualUrl;
      let finalRegulamentoUrl = regulamentoAtualUrl;

      if (bannerFile) {
        const filePath = `banners/banner-${eventoId}-${Date.now()}.webp`;
        await supabase.storage.from('eventos').upload(filePath, bannerFile);
        finalBannerUrl = supabase.storage.from('eventos').getPublicUrl(filePath).data.publicUrl;
      }

      if (regulamentoFile) {
        const filePath = `regulamentos/reg-${eventoId}-${Date.now()}.pdf`;
        await supabase.storage.from('eventos').upload(filePath, regulamentoFile);
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

      const payloadEvento = {
          nome, descricao: modalidade, cidade, estado, local, data_evento: dataEvento, status, 
          link_inscricao: linkInscricao, sobre_evento: sobreEvento, valores_lotes: valoresLotes, regras_pesagem: regrasPesagem,
          banner_url: finalBannerUrl, regulamento_url: finalRegulamentoUrl,
          limite_vagas: limiteVagas,
          
          // SALVA OS LOTES ATUALIZADOS
          lote1_valor: lote1Valor,
          lote1_data_fim: lote1DataFim || null,
          lote2_valor: lote2Valor,
          lote2_data_fim: lote2DataFim || null,
          lote3_valor: lote3Valor,
          lote3_data_fim: lote3DataFim || null,

          // DEMAIS DATAS
          data_inicio_inscricoes: dataInicioInscricoes || null,
          data_fim_inscricoes: dataFimInscricoes || null,
          data_fim_pagamento: dataFimPagamento || null,
          data_inicio_checagem: dataInicioChecagem || null,
          data_fim_checagem: dataFimChecagem || null,
          data_divulgacao_chaves: dataDivulgacaoChaves || null,
          data_divulgacao_cronograma: dataDivulgacaoCronograma || null,
          regras_pontuacao_equipes: regrasPontuacaoEquipes,
        };

      let { error } = await supabase
        .from("eventos")
        .update(payloadEvento)
        .eq("id", eventoId);

      if (error && error.message.toLowerCase().includes("regras_pontuacao_equipes")) {
        const payloadSemPontuacao = { ...payloadEvento };
        delete (payloadSemPontuacao as { regras_pontuacao_equipes?: unknown }).regras_pontuacao_equipes;
        const retry = await supabase
          .from("eventos")
          .update(payloadSemPontuacao)
          .eq("id", eventoId);
        error = retry.error;
      }

      if (error) throw error;
      setSucesso(true);
      setTimeout(() => router.push("/admin"), 1500);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-[#050505] border border-white/10 focus:border-red-500 outline-none rounded-md px-3 py-1.5 text-xs text-white transition-all shadow-inner";
  const labelClass = "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5 pl-0.5";
  const sectionClass = "bg-[#0e0e12] p-4 rounded-xl border border-white/5 space-y-3";
  const sectionTitleClass = "text-xs font-black text-white border-l-2 border-red-500 pl-2 uppercase tracking-widest";

  if (loadingInitial) return <div className="h-screen bg-black flex items-center justify-center text-zinc-500 text-xs font-bold uppercase animate-pulse">Carregando dados...</div>;

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 relative pb-20 font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
          <button onClick={() => router.back()} className="cursor-pointer p-2 bg-white/5 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white border border-white/5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">Editar Regras do Evento</h1>
          </div>
        </div>

        <form onSubmit={atualizarEvento} className="space-y-5">
          
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>1. Dados Gerais</h2>
            <div className="grid md:grid-cols-4 gap-3">
              <div className="md:col-span-3">
                <label className={`${labelClass} text-red-500`}>Nome Oficial *</label>
                <input required type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} cursor-pointer text-red-400 font-bold`}>
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
                <input required type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} className={inputClass} />
              </div>
              <div className="md:col-span-1">
                <label className={labelClass}>UF</label>
                <input required type="text" value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2} className={`${inputClass} text-center`} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Ginásio / Local</label>
                <input type="text" value={local} onChange={(e) => setLocal(e.target.value)} className={inputClass} />
              </div>
            </div>
            
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>Data Principal</label>
                <input required type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} className={`${inputClass} [color-scheme:dark]`} />
              </div>
              <div className="md:col-span-3">
                <label className={labelClass}>Link Inscrição Externa</label>
                <input type="text" value={linkInscricao} onChange={(e) => setLinkInscricao(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          {/* CRONOGRAMA DE LOTES COORDENADO */}
          <div className={sectionClass}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-2">
              <h2 className={sectionTitleClass}>2. Cronograma de Valores e Lotes</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Vagas:</label>
                  <input type="number" value={limiteVagas} onChange={(e) => setLimiteVagas(Number(e.target.value))} className="w-16 bg-black border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-red-500" />
                </div>
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
                <label className="block text-[9px] font-bold text-yellow-500 uppercase mb-0.5">Vencimento Pgto</label>
                <input type="datetime-local" value={dataFimPagamento} onChange={(e) => setDataFimPagamento(e.target.value)} className={`${inputClass} !py-1 text-[11px]`} />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-blue-500 uppercase mb-0.5">Início Checagem</label>
                <input type="datetime-local" value={dataInicioChecagem} onChange={(e) => setDataInicioChecagem(e.target.value)} className={`${inputClass} !py-1 text-[11px]`} />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-blue-500 uppercase mb-0.5">Fim Checagem</label>
                <input type="datetime-local" value={dataFimChecagem} onChange={(e) => setDataFimChecagem(e.target.value)} className={`${inputClass} !py-1 text-[11px]`} />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-purple-500 uppercase mb-0.5">Divulgação Chaves</label>
                <input type="datetime-local" value={dataDivulgacaoChaves} onChange={(e) => setDataDivulgacaoChaves(e.target.value)} className={`${inputClass} !py-1 text-[11px]`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[9px] font-bold text-purple-500 uppercase mb-0.5">Divulgação Crono</label>
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

          <div className="grid md:grid-cols-2 gap-4">
            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>4. Regras & Textos</h2>
              <textarea rows={2} value={valoresLotes} onChange={(e) => setValoresLotes(e.target.value)} placeholder="Valores..." className={inputClass}></textarea>
              <textarea rows={2} value={sobreEvento} onChange={(e) => setSobreEvento(e.target.value)} placeholder="Descrição..." className={inputClass}></textarea>
              <input type="text" value={regrasPesagem} onChange={(e) => setRegrasPesagem(e.target.value)} placeholder="Pesagem..." className={inputClass} />
            </div>

            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>5. Identidade & Edital</h2>
              <div className="relative border border-dashed border-white/20 rounded-md bg-black group aspect-video w-full cursor-pointer overflow-hidden">
                <input type="file" accept="image/*" onChange={handleBannerChange} disabled={comprimindo} className="absolute inset-0 opacity-0 z-20 cursor-pointer" />
                {comprimindo ? <div className="h-full flex items-center justify-center text-red-500 text-[10px] font-bold uppercase">Otimizando...</div> : (
                  <>
                    <img src={bannerPreview || bannerAtualUrl} className="w-full h-full object-cover opacity-60" alt="Banner" />
                    <div className="absolute inset-0 flex items-center justify-center text-white text-[9px] font-bold uppercase bg-black/40">Trocar Banner</div>
                  </>
                )}
              </div>
              <div className="relative border border-dashed border-white/20 rounded-md p-2 bg-black text-center cursor-pointer">
                <input type="file" accept="application/pdf" onChange={(e) => setRegulamentoFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 z-20 cursor-pointer" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase truncate block">
                  {regulamentoFile ? `📄 ${regulamentoFile.name}` : regulamentoAtualUrl ? "📄 Edital Salvo (Clique p/ Trocar)" : "Anexar PDF"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            {erro && <div className="mb-3 p-2 bg-red-500/10 text-red-400 rounded-md text-[10px] uppercase text-center font-bold">{erro}</div>}
            {sucesso && <div className="mb-3 p-2 bg-green-500/10 text-green-400 rounded-md text-[10px] uppercase text-center font-bold">Alterações salvas!</div>}
            <button type="submit" disabled={loading || sucesso || comprimindo} className="cursor-pointer w-full bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase py-3 rounded-md transition-all active:scale-95">
              {loading ? "Salvando..." : "Salvar Alterações do Evento"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}