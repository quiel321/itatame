"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/app/lib/supabase"

function Atleta({ nome, equipe, numero, luta_id, id_banco, onAvancar, reverso = false, centralizado = false, ocultarLinha = false, larguraClass = "w-[96px] md:w-[180px]" }: any) {
  // Como o nome já vem "limpo" da função, só verificamos se existe para habilitar o clique
  const podeClicar = onAvancar && nome && nome !== "";

  return (
    <div 
      onClick={() => podeClicar && onAvancar(id_banco, luta_id, nome, equipe)}
      className={`relative h-[60px] flex-shrink-0 ${larguraClass} ${podeClicar ? 'cursor-pointer hover:scale-105 transition-transform z-20' : ''}`}
    >
      <div className={`hidden md:block absolute top-[14px] w-[32px] h-[32px] rounded-full bg-zinc-700 ${reverso ? 'right-0' : 'left-0'}`} />
      <div className={`absolute top-[6px] flex items-center ${centralizado ? 'justify-center left-0 right-0' : reverso ? 'left-0 right-0 md:left-0 md:right-[44px] flex-row-reverse' : 'left-0 right-0 md:left-[44px] md:right-0 flex-row'}`}>
        {numero && <span className={`text-zinc-500 text-[9px] md:text-[10px] font-bold ${reverso ? 'ml-1' : 'mr-1'}`}>{numero}</span>}
        <span className={`text-[#57d8ff] text-[10px] md:text-[12px] font-medium truncate flex-1 ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>{nome}</span>
      </div>
      {!ocultarLinha && <div className={`absolute top-[30px] border-t border-zinc-400 ${reverso ? 'left-0 right-0 md:left-auto md:right-[44px]' : 'left-0 right-0 md:right-auto md:left-[44px]'}`} />}
      <div className={`absolute top-[34px] flex items-center ${centralizado ? 'justify-center left-0 right-0' : reverso ? 'left-0 right-0 md:left-0 md:right-[44px] flex-row-reverse' : 'left-0 right-0 md:left-[44px] md:right-0 flex-row'}`}>
        <span className={`text-zinc-500 text-[8px] md:text-[9px] uppercase truncate flex-1 ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>{equipe}</span>
      </div>
    </div>
  )
}

function ConectorPequeno({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[80px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[81px] border-zinc-400 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[40px] w-[6px] md:w-[15px] border-t border-zinc-400 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }
function ConectorMedio({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[160px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[161px] border-zinc-400 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[80px] w-[6px] md:w-[15px] border-t border-zinc-400 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }
function ConectorGrande({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[320px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[321px] border-zinc-400 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[160px] w-[6px] md:w-[15px] border-t border-zinc-400 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }

export default function ChavesPage() {
  const params = useParams()
  
  const [tipoCategoria, setTipoCategoria] = useState("peso")
  const [categoriasMenu, setCategoriasMenu] = useState<string[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("")
  const [lutas, setLutas] = useState<any[]>([])
  const [abaAtual, setAbaAtual] = useState(1) 
  const [modoAdmin, setModoAdmin] = useState(false)

  async function carregarCategorias() {
    const { data } = await supabase.from("chaves").select("categoria, faixa").eq("evento_id", params.id)
    if (data) {
      const unicas = Array.from(new Set(data.map(d => `${d.categoria}__${d.faixa}`)))
      setCategoriasMenu(unicas)
    }
  }

  async function carregarChaves() {
    if (!categoriaSelecionada) return
    const [cat, fx] = categoriaSelecionada.split("__")
    const { data } = await supabase.from("chaves").select("*").eq("evento_id", params.id).eq("categoria", cat).eq("faixa", fx)
    setLutas(data || [])
  }

  useEffect(() => { carregarCategorias() }, [])
  useEffect(() => { carregarChaves() }, [categoriaSelecionada])

  const categoriasFiltradas = categoriasMenu.filter((cat) => {
    const isAbsoluto = cat.toLowerCase().includes("absoluto")
    return tipoCategoria === "peso" ? !isAbsoluto : isAbsoluto
  })

  useEffect(() => {
    setCategoriaSelecionada(categoriasFiltradas[0] || "")
    setAbaAtual(1) 
  }, [tipoCategoria, categoriasMenu])

  const atletas = lutas.flatMap((luta: any) => [
    { numero: String(luta.numero_1 || ""), nome: luta.atleta_1 || "", equipe: luta.equipe_1 || "" },
    { numero: String(luta.numero_2 || ""), nome: luta.atleta_2 || "", equipe: luta.equipe_2 || "" }
  ])

  const maxNumero = atletas.length > 0 ? Math.max(...atletas.map(a => parseInt(a.numero) || 0)) : 0;
  const totalAbas = Math.max(1, Math.ceil(maxNumero / 16));

  const getFase1VisualId = (posicaoColuna: number, lado: "esquerda" | "direita") => {
    const lutasPorLado = totalAbas * 4;
    if (lado === "esquerda") return (abaAtual - 1) * 4 + posicaoColuna; 
    return lutasPorLado + (abaAtual - 1) * 4 + posicaoColuna;
  }

  // O GRANDE EXTERMINADOR DE TBD E BYE
  const limparNome = (nome: string | null) => {
    if (!nome) return "";
    const strLimpa = String(nome).trim().toUpperCase();
    if (strLimpa === "BYE" || strLimpa === "TBD") return "";
    return String(nome);
  }

  // NOVA LÓGICA DE AVANÇAR: BLINDADA CONTRA CLIQUES DUPLOS E COM SISTEMA DE CORREÇÃO (OPS!) E EFEITO CASCATA
  const handleAvancar = async (idBanco: string, idVisual: string, nomeVenc: string, equipeVenc: string) => {
    if (!modoAdmin || !nomeVenc) return;

    const lutaAtual = lutas.find(l => l.id === idBanco);
    if (!lutaAtual) return;

    // 🛡️ TRAVA 1: PREVENÇÃO DE SPAM (CLIQUE DUPLO)
    if (lutaAtual.vencedor === nomeVenc) {
      console.log("Clique ignorado: Atleta já é o vencedor desta luta.");
      return; 
    }

    // 1. ATUALIZA A CHAVE COM O NOVO VENCEDOR
    await supabase.from("chaves").update({ vencedor: nomeVenc }).eq("id", idBanco);

    // ==========================================
    // SISTEMA DE MEDALHAS, W.O. E CORREÇÃO DE ERROS
    // ==========================================
    const nome1 = limparNome(lutaAtual.atleta_1);
    const nome2 = limparNome(lutaAtual.atleta_2);
    
    const ganhouPorWO = (nome1 === "" || nome2 === "");
    const isFinal = !lutaAtual.proxima_luta || String(lutaAtual.id_visual) === "999";
    const isSemifinal = String(lutaAtual.proxima_luta) === "999"; 
    const vencedorAntigo = limparNome(lutaAtual.vencedor);

    // Mini-função auxiliar para somar ou subtrair pontos com segurança (Busca Aproximada)
    const updateEstatistica = async (nomeAtleta: string, coluna: string, incremento: number) => {
      if (!nomeAtleta) return;
      const { data } = await supabase.from("atletas").select(`id, ${coluna}`).ilike("nome", `%${nomeAtleta}%`).limit(1).single();
      if (data) {
        const valorAtual = (data as any)[coluna] || 0;
        const novoValor = Math.max(0, valorAtual + incremento);
        await supabase.from("atletas").update({ [coluna]: novoValor }).eq("id", (data as any).id);
      }
    };
    
    if (!vencedorAntigo) {
      // 🟢 CENA 1: PRIMEIRA VEZ QUE DEFINE O VENCEDOR
      if (ganhouPorWO) await updateEstatistica(nomeVenc, "vitorias_wo", 1);
      
      if (isFinal) {
        await updateEstatistica(nomeVenc, "ouro", 1); 
        const nomePerdedor = nomeVenc.toUpperCase() === nome1.toUpperCase() ? nome2 : nome1;
        await updateEstatistica(nomePerdedor, "prata", 1); 
      }

      if (isSemifinal) {
        const nomePerdedor = nomeVenc.toUpperCase() === nome1.toUpperCase() ? nome2 : nome1;
        if (nomePerdedor && nomePerdedor !== "") await updateEstatistica(nomePerdedor, "bronze", 1); 
      }
    } 
    else if (vencedorAntigo !== nomeVenc) {
      // 🟠 CENA 2: O FAMOSO "OPS!" (Juiz corrigindo a mesma luta)
      if (ganhouPorWO) {
        await updateEstatistica(vencedorAntigo, "vitorias_wo", -1);
        await updateEstatistica(nomeVenc, "vitorias_wo", 1);
      }

      if (isFinal) {
        await updateEstatistica(vencedorAntigo, "ouro", -1); 
        await updateEstatistica(vencedorAntigo, "prata", 1); 
        
        await updateEstatistica(nomeVenc, "prata", -1); 
        await updateEstatistica(nomeVenc, "ouro", 1);  
      }

      if (isSemifinal) {
        if (vencedorAntigo !== "") await updateEstatistica(vencedorAntigo, "bronze", 1);
        if (nomeVenc !== "") await updateEstatistica(nomeVenc, "bronze", -1);
      }
    }
    // ==========================================

    // 2. AVANÇA O VENCEDOR PARA A PRÓXIMA LUTA (Visual da Chave)
    if (lutaAtual.proxima_luta) {
      const proximaLuta = lutas.find(l => String(l.id_visual) === String(lutaAtual.proxima_luta));
      if (proximaLuta) {
        
        const isImpar = Number(idVisual) % 2 !== 0;
        let updateData: any = isImpar ? { atleta_1: nomeVenc, equipe_1: equipeVenc } : { atleta_2: nomeVenc, equipe_2: equipeVenc };

        // 🛑 EFEITO CASCATA: Se a próxima luta JÁ TINHA vencedor, a mudança de agora invalida ela!
        if (proximaLuta.vencedor) {
            const proxVencedor = limparNome(proximaLuta.vencedor);
            const proxNome1 = limparNome(proximaLuta.atleta_1);
            const proxNome2 = limparNome(proximaLuta.atleta_2);
            const proxPerdedor = proxVencedor === proxNome1 ? proxNome2 : proxNome1;
            const proxGanhouPorWO = (proxNome1 === "" || proxNome2 === "");
            
            const isProxFinal = String(proximaLuta.id_visual) === "999";
            const isProxSemi = String(proximaLuta.proxima_luta) === "999";

            // Se a próxima luta invalidada foi vencida por WO, remove esse WO
            if (proxGanhouPorWO && proxVencedor !== "") {
                await updateEstatistica(proxVencedor, "vitorias_wo", -1);
            }

            // Remove as medalhas geradas por essa próxima luta que foi invalidada
            if (isProxFinal) {
               if (proxVencedor !== "") await updateEstatistica(proxVencedor, "ouro", -1);
               if (proxPerdedor !== "") await updateEstatistica(proxPerdedor, "prata", -1);
            } else if (isProxSemi) {
               if (proxPerdedor !== "") await updateEstatistica(proxPerdedor, "bronze", -1);
            }

            // Invalida o vencedor da próxima luta (reseta a luta para o juiz clicar de novo)
            updateData.vencedor = null; 
        }

        await supabase.from("chaves").update(updateData).eq("id", proximaLuta.id);
      }
    }

    // Recarrega a chave para atualizar a tela
    await carregarChaves(); 
  }

  const getAtletaDaPrimeiraFase = (posicaoColuna: number, slot: number, lado: "esquerda" | "direita") => {
    const idLutaVisual = getFase1VisualId(posicaoColuna, lado);
    const luta = lutas.find(l => String(l.id_visual) === String(idLutaVisual));
    if (!luta) return { nome: "", equipe: "", numero: "" };

    const nomeBruto = slot === 1 ? luta.atleta_1 : luta.atleta_2;
    const nomeLimpo = limparNome(nomeBruto);

    return {
      numero: slot === 1 ? luta.numero_1 : luta.numero_2,
      nome: nomeLimpo,
      equipe: nomeLimpo === "" ? "" : (slot === 1 ? luta.equipe_1 : luta.equipe_2),
      luta_id: luta.id_visual,
      id_banco: luta.id,
      onAvancar: modoAdmin ? handleAvancar : undefined
    }
  }

  const getAtletaDoMeio = (idBase: number, multiplicador: number, slotDelta: number, slot: number) => {
    const idLutaVisual = idBase + (abaAtual - 1) * multiplicador + slotDelta;
    const luta = lutas.find(l => String(l.id_visual) === String(idLutaVisual));
    if (!luta) return { nome: "", equipe: "" };

    const nomeBruto = slot === 1 ? luta.atleta_1 : luta.atleta_2;
    const nomeLimpo = limparNome(nomeBruto);
    
    return {
      nome: nomeLimpo,
      equipe: nomeLimpo === "" ? "" : (slot === 1 ? luta.equipe_1 : luta.equipe_2),
      luta_id: luta.id_visual,
      id_banco: luta.id,
      onAvancar: modoAdmin ? handleAvancar : undefined
    }
  }

  const getAtletaDaFinal = (slot: number) => {
    const luta = lutas.find(l => String(l.id_visual) === "999");
    if (!luta) return { nome: "", equipe: "" };

    const nomeBruto = slot === 1 ? luta.atleta_1 : luta.atleta_2;
    const nomeLimpo = limparNome(nomeBruto);
    
    return {
      nome: nomeLimpo,
      equipe: nomeLimpo === "" ? "" : (slot === 1 ? luta.equipe_1 : luta.equipe_2),
      luta_id: luta.id_visual,
      id_banco: luta.id,
      onAvancar: modoAdmin ? handleAvancar : undefined
    }
  }

  const getCampeao = () => {
    const lutaFinal = lutas.find(l => String(l.id_visual) === "999");
    const campeao = limparNome(lutaFinal?.vencedor || null);
    return {
      nome: campeao,
      equipe: ""
    }
  }

  return (
    <main className="min-h-screen bg-black p-0 md:p-6">
      <div className="w-full max-w-[1400px] mx-auto pt-6 md:pt-0">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-10 px-4 md:px-0">
          <h1 className="text-white text-3xl md:text-5xl font-black">Chaveamento</h1>
          <button 
            onClick={() => setModoAdmin(!modoAdmin)}
            className={`mt-4 md:mt-0 px-6 py-3 rounded-xl font-bold transition-all border ${
              modoAdmin ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
            }`}
          >
            {modoAdmin ? "🔴 MODO JUIZ ATIVADO" : "Ativar Modo Juiz"}
          </button>
        </div>

        {/* PAINEL DE FILTROS */}
        <div className="bg-[#050816] md:border border-white/10 md:rounded-3xl p-4 md:p-6 mb-4 mx-4 md:mx-0 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full flex flex-col gap-2">
            <label className="text-[#57d8ff] text-xs font-bold uppercase tracking-wider pl-1">Tipo Categoria</label>
            <select value={tipoCategoria} onChange={(e) => setTipoCategoria(e.target.value)} className="w-full bg-black/50 border border-zinc-700 text-white rounded-lg p-3 outline-none focus:border-[#57d8ff]">
              <option value="peso">Categoria de Peso Jiu-Jitsu</option>
              <option value="absoluto">Categoria Absoluto Jiu-Jitsu</option>
            </select>
          </div>
          <div className="flex-[2] w-full flex flex-col gap-2">
            <label className="text-[#57d8ff] text-xs font-bold uppercase tracking-wider pl-1">Categoria</label>
            <select value={categoriaSelecionada} onChange={(e) => setCategoriaSelecionada(e.target.value)} className="w-full bg-black/50 border border-zinc-700 text-white rounded-lg p-3 outline-none focus:border-[#57d8ff]">
              {categoriasFiltradas.length === 0 && <option value="">Nenhuma chave nesta modalidade...</option>}
              {categoriasFiltradas.map((cat) => {
                const [nomeCategoria, faixa] = cat.split("__")
                return <option key={cat} value={cat}>{nomeCategoria} - Faixa {faixa}</option>
              })}
            </select>
          </div>
        </div>

        {totalAbas > 1 && (
          <div className="flex justify-center gap-2 mb-6 flex-wrap px-4">
            {Array.from({ length: totalAbas }).map((_, i) => (
              <button key={i} onClick={() => setAbaAtual(i + 1)} className={`px-6 py-2 rounded-lg font-bold transition-all ${abaAtual === i + 1 ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>
                {i + 1}/{totalAbas}
              </button>
            ))}
          </div>
        )}

        <div className="bg-[#050816] md:border md:border-white/10 md:rounded-3xl py-6 md:p-10 w-full overflow-x-auto min-w-0 flex flex-col items-center scrollbar-hide">
          {totalAbas > 1 && <p className="text-red-500 font-bold mb-4 uppercase tracking-widest text-sm">Chave {abaAtual}/{totalAbas}</p>}

          <div className="flex w-max md:w-full justify-center px-2 md:px-0">
            {/* LADO ESQUERDO */}
            <div className="flex">
              <div className="flex flex-col gap-[20px]">
                <Atleta {...getAtletaDaPrimeiraFase(1, 1, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(1, 2, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(2, 1, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(2, 2, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(3, 1, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(3, 2, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(4, 1, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(4, 2, "esquerda")} />
              </div>

              <div className="flex flex-col gap-[80px] pt-[30px]">
                <ConectorPequeno /><ConectorPequeno /><ConectorPequeno /><ConectorPequeno />
              </div>

              <div className="flex flex-col gap-[100px] pt-[40px]">
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 1, 1)} />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 1, 2)} />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 2, 1)} />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 2, 2)} />
              </div>

              <div className="flex flex-col gap-[160px] pt-[70px]">
                <ConectorMedio /><ConectorMedio />
              </div>

              <div className="flex flex-col gap-[260px] pt-[120px]">
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(200, 1, 1, 1)} />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(200, 1, 1, 2)} />
              </div>

              <div className="flex flex-col pt-[150px]">
                <ConectorGrande />
              </div>
            </div>

            {/* CENTRO (FINAL) */}
            <div className="flex flex-col w-[120px] md:w-[260px] relative items-center">
              <div className="absolute top-[310px] left-[-10px] right-[-10px] border-t border-zinc-500 z-0" />
              
              <div className="absolute top-[260px] flex flex-col gap-[10px] bg-[#050816] px-2 py-4 border border-zinc-800 rounded-xl z-10 shadow-2xl">
                <span className="text-red-600 font-black text-[11px] uppercase text-center mb-1 tracking-widest">Luta Final</span>
                <Atleta {...getAtletaDaFinal(1)} larguraClass="w-[100px] md:w-[160px]" centralizado />
                <Atleta {...getAtletaDaFinal(2)} larguraClass="w-[100px] md:w-[160px]" centralizado />
              </div>

              <div className="absolute top-[100px] flex flex-col items-center z-10">
                <span className="text-yellow-500 font-black text-sm md:text-2xl mb-3 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">🏆 CAMPEÃO</span>
                <div className="bg-gradient-to-t from-yellow-500/20 to-transparent border border-yellow-500/50 rounded-2xl p-3 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                  <Atleta {...getCampeao()} larguraClass="w-[100px] md:w-[160px]" centralizado ocultarLinha />
                </div>
              </div>
            </div>

            {/* LADO DIREITO */}
            <div className="flex">
              <div className="flex flex-col pt-[150px]">
                <ConectorGrande reverso />
              </div>

              <div className="flex flex-col gap-[260px] pt-[120px]">
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(200, 1, 2, 1)} reverso />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(200, 1, 2, 2)} reverso />
              </div>

              <div className="flex flex-col gap-[160px] pt-[70px]">
                <ConectorMedio reverso /><ConectorMedio reverso />
              </div>

              <div className="flex flex-col gap-[100px] pt-[40px]">
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 3, 1)} reverso />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 3, 2)} reverso />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 4, 1)} reverso />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 4, 2)} reverso />
              </div>

              <div className="flex flex-col gap-[80px] pt-[30px]">
                <ConectorPequeno reverso /><ConectorPequeno reverso /><ConectorPequeno reverso /><ConectorPequeno reverso />
              </div>

              <div className="flex flex-col gap-[20px]">
                <Atleta {...getAtletaDaPrimeiraFase(1, 1, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(1, 2, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(2, 1, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(2, 2, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(3, 1, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(3, 2, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(4, 1, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(4, 2, "direita")} reverso />
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  )
}