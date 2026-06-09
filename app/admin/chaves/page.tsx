"use client"

import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

export default function GerarChavesPage() {
  const router = useRouter()
  
  const [eventos, setEventos] = useState<any[]>([])
  const [eventoId, setEventoId] = useState("")
  const [loading, setLoading] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" })
  
  const [tipoGeracao, setTipoGeracao] = useState("peso") 
  const [ignorarPagamento, setIgnorarPagamento] = useState(false)

  const eventoSelecionado = eventos.find((evento) => evento.id.toString() === eventoId)
  const fimInscricoesSelecionado = obterFimInscricoes(eventoSelecionado)
  const chaveamentoBloqueado = Boolean(fimInscricoesSelecionado && new Date() < fimInscricoesSelecionado)

  function obterFimInscricoes(evento: any) {
    const dataFim = evento?.data_fim_inscricoes || evento?.lote3_data_fim || evento?.lote2_data_fim || evento?.lote1_data_fim
    return dataFim ? new Date(dataFim) : null
  }

  function formatarDataHora(valor: Date | null) {
    if (!valor) return "Data não definida"
    return valor.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  }

  // ==========================================
  // CARREGAMENTO DOS EVENTOS DO ORGANIZADOR
  // ==========================================
  useEffect(() => {
    async function carregarMeusEventos() {
      const { data: authData } = await supabase.auth.getUser();
      
      if (!authData.user) {
        router.push("/login-organizador");
        return;
      }

      const { data, error } = await supabase
        .from("eventos")
        .select("id, nome, data_fim_inscricoes, lote1_data_fim, lote2_data_fim, lote3_data_fim")
        .eq("organizador_id", authData.user.id)
        .order("id", { ascending: false })

      if (!error && data) {
        setEventos(data)
        if (data.length > 0) {
          setEventoId(data[0].id.toString())
        } else {
          setMensagem({ tipo: "erro", texto: "Nenhum evento criado por este organizador." })
        }
      }
    }
    carregarMeusEventos()
  }, [router])

  // ==========================================
  // LÓGICA CORE: GERADOR DE MAPA E CHAVES
  // ==========================================
  function gerarMapaPosicoes(tamanho: number): number[] {
    if (tamanho === 2) return [1, 2];
    const mapaAnterior = gerarMapaPosicoes(tamanho / 2);
    const novoMapa: number[] = [];
    for (let i = 0; i < mapaAnterior.length; i++) {
      novoMapa.push(mapaAnterior[i]);
      novoMapa.push(tamanho - mapaAnterior[i] + 1);
    }
    return novoMapa;
  }

  // ==========================================
  // MOTOR GERADOR DE CHAVES (REFINADO PARA BATER COM A CHECAGEM)
  // ==========================================
  async function gerarChaves() {
    if (!eventoId) {
      setMensagem({ tipo: "erro", texto: "Selecione um evento primeiro." })
      return
    }

    const eventoAtual = eventos.find((evento) => evento.id.toString() === eventoId)
    const fimInscricoes = obterFimInscricoes(eventoAtual)

    if (!fimInscricoes) {
      setMensagem({ tipo: "erro", texto: "Defina a data de encerramento das inscrições antes de gerar as chaves." })
      return
    }

    if (new Date() < fimInscricoes) {
      setMensagem({ tipo: "erro", texto: `As inscrições encerram em ${formatarDataHora(fimInscricoes)}. O chaveamento só pode ser gerado depois disso.` })
      return
    }

    const confirmacao = window.confirm("Atenção: gerar o chaveamento apagará todo o progresso de lutas atual desta categoria. Deseja continuar?")
    if (!confirmacao) return;

    try {
      setLoading(true)
      setMensagem({ tipo: "", texto: "" })

      let query = supabase.from("inscricoes").select("*").eq("evento_id", eventoId);
      
      if (!ignorarPagamento) {
        query = query.eq("pagamento_ok", true);
      }

      const { data: inscricoes, error } = await query;

      if (error || !inscricoes || inscricoes.length === 0) {
        setMensagem({ 
          tipo: "erro", 
          texto: error ? error.message : ignorarPagamento 
            ? "Nenhuma inscrição encontrada para este evento." 
            : "Nenhum atleta com PAGAMENTO CONFIRMADO encontrado para este evento." 
        })
        setLoading(false)
        return
      }

      // Limpa as chaves antigas baseando-se no tipo de geração
      if (tipoGeracao === "absoluto") {
        await supabase.from("chaves").delete().eq("evento_id", eventoId).ilike("categoria", "%Absoluto%");
      } else {
        await supabase.from("chaves").delete().eq("evento_id", eventoId).not("categoria", "ilike", "%Absoluto%");
      }

      // 🔥 BUSCA OS DADOS DE EQUIPE E FAIXA DOS ATLETAS (IGUAL NA CHECAGEM)
      const userIds = [...new Set(inscricoes.map(i => i.user_id))];
      const { data: atletasData } = await supabase.from('atletas').select('user_id, equipe, faixa').in('user_id', userIds);

      const grupos: any = {};
      
      inscricoes.forEach((inscricao: any) => {
        const atletaInfo = atletasData?.find(a => a.user_id === inscricao.user_id);
        const equipeAtleta = atletaInfo?.equipe || "SEM EQUIPE";
        const faixaAtleta = atletaInfo?.faixa || "SEM FAIXA";
        
        inscricao.equipe_atleta = equipeAtleta; // Injeta para o sorteio depois

        if (tipoGeracao === "peso") {
          if (inscricao.categoria.toLowerCase().includes("absoluto")) return;
          
          // 🔥 AGRUPAMENTO IDÊNTICO AO DA CHECAGEM! (Categoria exata + Faixa)
          const chave = `${inscricao.categoria}__${faixaAtleta}`;
          if (!grupos[chave]) grupos[chave] = [];
          grupos[chave].push(inscricao);
          
        } else {
          if (inscricao.absoluto === true && !String(inscricao.categoria || "").toLowerCase().includes("absoluto")) {
            const sexoAtleta = inscricao.sexo || "Masculino";
            const idadeNum = parseInt(inscricao.idade) || 18;
            let divisao = "Adulto";
            if (idadeNum < 16) divisao = "Infantil-Juvenil";
            else if (idadeNum >= 30) divisao = "Master";

            const nomeCategoriaAbsoluto = `Absoluto ${divisao} ${sexoAtleta}`;
            const chave = `${nomeCategoriaAbsoluto}__${faixaAtleta}`;
            if (!grupos[chave]) grupos[chave] = [];
            grupos[chave].push(inscricao);
          }
        }
      })

      if (Object.keys(grupos).length === 0) {
        setMensagem({ 
          tipo: "erro", 
          texto: tipoGeracao === "absoluto" 
            ? "Nenhum atleta apto para lutar o Absoluto." 
            : "Nenhuma inscrição apta encontrada nas categorias de peso." 
        })
        setLoading(false);
        return;
      }

      for (const grupo in grupos) {
        let atletasDoGrupo: any[] = grupos[grupo];
        
        // ==========================================
        // 🔥 ALGORITMO ANTI-EQUIPES (ESPELHAMENTO)
        // ==========================================
        // Embaralha aleatoriamente primeiro para não ter vícios
        atletasDoGrupo.sort(() => Math.random() - 0.5);

        // Separa os atletas por equipe
        const separacaoEquipes: Record<string, any[]> = {};
        atletasDoGrupo.forEach(a => {
          if (!separacaoEquipes[a.equipe_atleta]) separacaoEquipes[a.equipe_atleta] = [];
          separacaoEquipes[a.equipe_atleta].push(a);
        });

        // Monta a lista final distribuindo as equipes (ex: A, B, A, B, A, C)
        const atletasDistribuidos = [];
        const chavesEquipes = Object.keys(separacaoEquipes);
        
        let aindaTemAtletas = true;
        while(aindaTemAtletas) {
          aindaTemAtletas = false;
          for(const eq of chavesEquipes) {
            if (separacaoEquipes[eq].length > 0) {
              atletasDistribuidos.push(separacaoEquipes[eq].shift());
              aindaTemAtletas = true;
            }
          }
        }
        atletasDoGrupo = atletasDistribuidos;
        // ==========================================

        const categoria = grupo.split("__")[0];
        const faixa = grupo.split("__")[1];

        let tamanhoChave = 2;
        while (tamanhoChave < atletasDoGrupo.length) tamanhoChave *= 2;
        if (tamanhoChave > 64) tamanhoChave = 64;

        while (atletasDoGrupo.length < tamanhoChave) {
          atletasDoGrupo.push({ atleta: "BYE", nome: "BYE", equipe_atleta: "" });
        }

        const lutas: any[] = [];
        
        const at = (idx: number) => ({
          nome: atletasDoGrupo[idx]?.atleta || atletasDoGrupo[idx]?.nome || "BYE",
          equipe: atletasDoGrupo[idx]?.equipe_atleta || "",
          atleta_id: atletasDoGrupo[idx]?.atleta_id || null 
        });

        const posicoes = gerarMapaPosicoes(tamanhoChave);

        let faseInicialNome = "Final";
        if (tamanhoChave === 4) faseInicialNome = "Semifinal";
        if (tamanhoChave === 8) faseInicialNome = "Quartas";
        if (tamanhoChave === 16) faseInicialNome = "Oitavas";
        if (tamanhoChave === 32) faseInicialNome = "16-Avos";
        if (tamanhoChave === 64) faseInicialNome = "32-Avos";

        // PRIMEIRA RODADA
        for (let i = 0; i < tamanhoChave / 2; i++) {
          const seed1 = posicoes[i * 2];
          const seed2 = posicoes[i * 2 + 1];
          const idAtual = String(i + 1);
          const proxId = tamanhoChave === 2 ? null : (tamanhoChave === 4 ? 999 : 101 + Math.floor(i / 2));

          lutas.push({
            id_visual: idAtual, 
            evento_id: eventoId, 
            categoria, 
            faixa,
            atleta_1: at(seed1 - 1).nome, 
            equipe_1: at(seed1 - 1).equipe, 
            numero_1: String(seed1).padStart(2, '0'),
            atleta_1_id: at(seed1 - 1).atleta_id,
            
            atleta_2: at(seed2 - 1).nome, 
            equipe_2: at(seed2 - 1).equipe, 
            numero_2: String(seed2).padStart(2, '0'),
            atleta_2_id: at(seed2 - 1).atleta_id,
            
            vencedor: null,
            vencedor_id: null, 
            fase: faseInicialNome, 
            ordem: i + 1,
            lado: (i + 1) <= (tamanhoChave / 4) ? "esquerda" : "direita",
            proxima_luta: proxId,
            status_luta: "agendada",
            pontuacao_atleta_1: {"pontos":0,"punicoes":0,"vantagens":0},
            pontuacao_atleta_2: {"pontos":0,"punicoes":0,"vantagens":0}
          });
        }

        // TBDs (O RESTANTE DA ÁRVORE DE LUTAS)
        let faseAtual = tamanhoChave / 2;
        let idFase = 1;
        
        while (faseAtual > 1) {
          faseAtual /= 2; 
          
          let nomeFase = "Fase";
          if (faseAtual === 16) nomeFase = "16-Avos";
          if (faseAtual === 8) nomeFase = "Oitavas";
          if (faseAtual === 4) nomeFase = "Quartas";
          if (faseAtual === 2) nomeFase = "Semifinal";
          if (faseAtual === 1) nomeFase = "Final";

          for (let i = 0; i < faseAtual; i++) {
            const isFinal = faseAtual === 1;
            const idVis = isFinal ? "999" : String(idFase * 100 + i + 1);
            const prox = isFinal ? null : (faseAtual === 2 ? 999 : ((idFase + 1) * 100 + Math.floor(i / 2) + 1));
            
            lutas.push({
              id_visual: idVis, 
              evento_id: eventoId, 
              categoria, 
              faixa,
              atleta_1: "TBD", 
              equipe_1: "", 
              numero_1: "", 
              atleta_1_id: null,
              
              atleta_2: "TBD", 
              equipe_2: "", 
              numero_2: "", 
              atleta_2_id: null,
              
              vencedor: null, 
              vencedor_id: null,
              fase: nomeFase,  
              ordem: i + 1,
              lado: isFinal ? "centro" : (i + 1) <= (faseAtual / 2) ? "esquerda" : "direita",
              proxima_luta: prox,
              status_luta: "agendada",
              pontuacao_atleta_1: {"pontos":0,"punicoes":0,"vantagens":0},
              pontuacao_atleta_2: {"pontos":0,"punicoes":0,"vantagens":0}
            });
          }
          idFase++;
        }

        await supabase.from("chaves").insert(lutas);
      }
      
      setMensagem({ tipo: "sucesso", texto: `CHAVEAMENTO GERADO COM SUCESSO!` })
    } catch (err) {
      console.error(err);
      setMensagem({ tipo: "erro", texto: "Erro na geração do banco de dados." })
    }
    setLoading(false)
  }

  // ==========================================
  // EXPORTACAO (MANTIDA)
  // ==========================================
  const buscarChavesParaExportacao = async () => {
    if (!eventoId) {
      alert("Selecione um evento primeiro.");
      return null;
    }
    
    setExportando(true);
    
    let query = supabase.from("chaves").select("*").eq("evento_id", eventoId);
    
    if (tipoGeracao === "absoluto") {
      query = query.ilike("categoria", "%Absoluto%");
    } else {
      query = query.not("categoria", "ilike", "%Absoluto%");
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      alert(`Nenhuma chave de ${tipoGeracao === 'peso' ? 'Categoria de Peso' : 'Absoluto'} encontrada! Gere o chaveamento primeiro.`);
      setExportando(false);
      return null;
    }
    
    const lutasReais = data.filter(l => !(l.atleta_1 === "BYE" && l.atleta_2 === "BYE"));
    lutasReais.sort((a, b) => Number(a.id_visual) - Number(b.id_visual));

    setExportando(false);
    return lutasReais;
  }

  const formatarNome = (nome: string) => (nome === "BYE" || nome === "TBD") ? "SEM OPONENTE" : nome;
  const formatarEquipe = (nome: string, equipe: string) => (nome === "BYE" || nome === "TBD") ? "" : (equipe || "-");

  const exportarMesarioPDF = async () => {
    const lutas = await buscarChavesParaExportacao();
    if (!lutas) return;

    const doc = new jsPDF();
    const nomeEventoAtual = eventos.find(e => e.id.toString() === eventoId)?.nome || "Evento";
    const pageWidth = doc.internal.pageSize.getWidth();
    const nomeArquivoCompl = tipoGeracao === 'peso' ? 'Categorias' : 'Absoluto';

    const grupos: any = {};
    lutas.forEach(l => {
      const titulo = `${l.categoria} - Faixa ${l.faixa}`;
      if (!grupos[titulo]) grupos[titulo] = [];
      grupos[titulo].push(l);
    });

    let yPos = 45; 

    for (const [tituloGrupo, lutasGrupo] of Object.entries(grupos)) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 45;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38); 
      doc.text(tituloGrupo.toUpperCase(), 14, yPos);

      const tableColumn = ["Luta #", "Fase", "Competidor 1 (Vermelho)", "Competidor 2 (Azul)", "Vencedor (Anotar)"];
      const tableRows: any[] = [];

      (lutasGrupo as any[]).forEach(l => {
        const nome1 = formatarNome(l.atleta_1);
        const eq1 = formatarEquipe(l.atleta_1, l.equipe_1);
        const txt1 = eq1 ? `${nome1}\n(${eq1})` : nome1;

        const nome2 = formatarNome(l.atleta_2);
        const eq2 = formatarEquipe(l.atleta_2, l.equipe_2);
        const txt2 = eq2 ? `${nome2}\n(${eq2})` : nome2;

        tableRows.push([
          `# ${l.id_visual}`,
          l.fase,
          txt1,
          txt2,
          "" 
        ]);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: yPos + 4,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 4, valign: 'middle' },
        headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 
          0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 20 },
          4: { cellWidth: 40 } 
        },
        margin: { top: 40 } 
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      doc.setFillColor(15, 15, 18); 
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(22);
      doc.setTextColor(239, 68, 68); 
      doc.text("// i", 14, 22);
      doc.setTextColor(255, 255, 255); 
      doc.text("TATAME", 26, 22);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`CRONOGRAMA DE LUTAS (${nomeArquivoCompl.toUpperCase()})`, pageWidth - 14, 16, { align: "right" });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(200, 200, 200);
      doc.text(nomeEventoAtual.toUpperCase(), pageWidth - 14, 23, { align: "right" });

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      const dataHora = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;
      doc.text(`Exportado em: ${dataHora}  |  Página ${i} de ${pageCount}`, pageWidth - 14, 29, { align: "right" });
    }

    doc.save(`chaveamento_${nomeArquivoCompl}_${nomeEventoAtual.replace(/\s+/g, '_')}.pdf`);
  }

  const exportarMesarioCSV = async () => {
    const lutas = await buscarChavesParaExportacao();
    if (!lutas) return;

    const headers = ["Categoria", "Faixa", "Fase", "Luta Num", "Atleta 1 (Vermelho)", "Equipe 1", "Atleta 2 (Azul)", "Equipe 2", "Vencedor"];
    
    const csvRows = lutas.map(l => [
      `"${l.categoria}"`,
      `"${l.faixa}"`,
      `"${l.fase}"`,
      `"${l.id_visual}"`,
      `"${formatarNome(l.atleta_1)}"`,
      `"${formatarEquipe(l.atleta_1, l.equipe_1)}"`,
      `"${formatarNome(l.atleta_2)}"`,
      `"${formatarEquipe(l.atleta_2, l.equipe_2)}"`,
      `""` 
    ].join(","));

    const csvContent = ["\uFEFF" + headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const nomeEventoAtual = eventos.find(e => e.id.toString() === eventoId)?.nome || "evento";
    const nomeArquivoCompl = tipoGeracao === 'peso' ? 'Categorias' : 'Absoluto';
    
    link.setAttribute("download", `chaveamento_${nomeArquivoCompl}_${nomeEventoAtual.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <main className="bg-[#050505] text-white p-4 pt-12 pb-12 md:pt-20 md:min-h-screen relative overflow-x-hidden">
      
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-xl mx-auto relative z-10">
        
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="cursor-pointer p-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white border border-white/5 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight leading-none">Gerador de Chaves</h1>
            <p className="text-zinc-500 text-[10px] md:text-xs mt-1 uppercase tracking-widest">Motor de sorteio de lutas</p>
          </div>
        </div>

        <div className="bg-[#0a0a0e]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl mb-6">
          
          <div className="flex gap-2 mb-5">
            <button onClick={() => setTipoGeracao("peso")} className={`cursor-pointer flex-1 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${tipoGeracao === "peso" ? "bg-[#57d8ff]/10 border-[#57d8ff]/50 text-[#57d8ff] shadow-[0_0_10px_rgba(87,216,255,0.1)]" : "bg-black/50 border-white/5 text-zinc-500 hover:text-white"}`}>
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
              Por Categorias
            </button>
            <button onClick={() => setTipoGeracao("absoluto")} className={`cursor-pointer flex-1 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${tipoGeracao === "absoluto" ? "bg-yellow-500/10 border-yellow-500/50 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.1)]" : "bg-black/50 border-white/5 text-zinc-500 hover:text-white"}`}>
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Absoluto Livre
            </button>
          </div>

          <div className="mb-5">
            <label className="block text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Selecione o Evento Alvo</label>
            <div className="relative">
              <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className="cursor-pointer w-full bg-black/50 border border-white/10 focus:border-red-500 outline-none rounded-xl px-4 py-3 text-white transition-all appearance-none font-bold text-xs md:text-sm">
                {eventos.length === 0 && <option value="">Nenhum evento encontrado...</option>}
                {eventos.map(ev => <option key={ev.id} value={ev.id.toString()}>{ev.nome}</option>)}
              </select>
              <svg className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7-7-7-7"></path></svg>
            </div>
            <div className={`mt-3 rounded-xl border p-3 text-[10px] md:text-xs font-bold ${chaveamentoBloqueado ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-200" : "bg-green-500/10 border-green-500/20 text-green-300"}`}>
              {fimInscricoesSelecionado ? (
                chaveamentoBloqueado
                  ? <>Inscrições abertas até {formatarDataHora(fimInscricoesSelecionado)}. O chaveamento fica bloqueado até o encerramento.</>
                  : <>Inscrições encerradas. Chaveamento liberado para este evento.</>
              ) : (
                <>Data de encerramento não definida. Configure o evento antes de gerar as chaves.</>
              )}
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <label className="flex items-center gap-3 cursor-pointer bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-colors group">
              <div className="relative flex items-center justify-center shrink-0">
                <input type="checkbox" checked={ignorarPagamento} onChange={(e) => setIgnorarPagamento(e.target.checked)} className="peer appearance-none w-5 h-5 border-2 border-zinc-500 rounded bg-black/50 checked:bg-yellow-500 checked:border-yellow-500 transition-colors cursor-pointer"/>
                <svg className="absolute w-3.5 h-3.5 text-black opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <div>
                <h4 className="text-white font-black text-[10px] md:text-xs uppercase tracking-widest group-hover:text-yellow-400 transition-colors">Evento Gratuito / Isento</h4>
                <p className="text-zinc-500 text-[9px] md:text-[10px] mt-0.5 leading-relaxed">Ignora o bloqueio financeiro no sorteio.</p>
              </div>
            </label>

            <div className="relative bg-[#2f0404] border border-red-500/50 rounded-xl p-4 md:p-5 shadow-[0_0_20px_rgba(239,68,68,0.15)] overflow-hidden">
              <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none"></div>
              <div className="relative z-10 flex items-start gap-4">
                <div className="bg-red-500/20 p-2.5 rounded-full shrink-0">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <div>
                  <h4 className="text-red-500 font-black text-[11px] md:text-xs uppercase tracking-widest mb-1.5 drop-shadow-md">Atenção: Ação Irreversível</h4>
                  <p className="text-red-200/90 text-[10px] md:text-xs font-medium leading-relaxed">
                    Gere o chaveamento <strong>APENAS APÓS o encerramento das inscrições</strong>. O algoritmo incluirá apenas os atletas com <strong>Pagamento Confirmado</strong>. Ao gerar, o histórico atual de lutas será apagado.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button onClick={gerarChaves} disabled={loading || !eventoId || chaveamentoBloqueado || !fimInscricoesSelecionado} className="cursor-pointer disabled:cursor-not-allowed w-full bg-red-600 hover:bg-red-500 text-white rounded-xl py-3.5 font-black text-xs md:text-sm uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            {loading ? "Processando Algoritmo..." : `Gerar Chaveamento - ${tipoGeracao === 'peso' ? 'Categoria' : 'Absoluto'}`}
          </button>
          
          {mensagem.texto && (
            <div className={`mt-4 border rounded-xl p-3 flex items-center justify-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider pointer-events-none ${mensagem.tipo === "sucesso" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
              {mensagem.tipo === "sucesso" ? "✅" : "⚠️"} {mensagem.texto}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-b from-[#111116] to-black border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            </div>
            <div>
              <h2 className="text-white font-black text-sm md:text-base uppercase tracking-widest leading-none">Área do Mesário</h2>
              <p className="text-zinc-500 text-[9px] md:text-[10px] mt-1">Exporte as chaves do evento selecionado acima.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={exportarMesarioPDF} disabled={exportando || !eventoId} className="cursor-pointer disabled:opacity-50 flex-1 flex flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl py-4 transition-colors">
              {exportando ? (
                <svg className="w-6 h-6 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <>
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Imprimir PDF</span>
                </>
              )}
            </button>
            <button onClick={exportarMesarioCSV} disabled={exportando || !eventoId} className="cursor-pointer disabled:opacity-50 flex-1 flex flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl py-4 transition-colors">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Exportar CSV</span>
            </button>
          </div>
        </div>

      </div>
    </main>
  )
}