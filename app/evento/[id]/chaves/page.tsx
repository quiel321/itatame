"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/app/lib/supabase"
import { processarAvancosAutomaticosChaves, propagarResultadoChave } from "@/app/lib/chaves-auto-avanco"

// 1. Componente Atleta (COM FOTO E INTELIGÊNCIA DE LAYOUT)
function Atleta({ nome, equipe, numero, luta_id, id_banco, foto, onAvancar, reverso = false, centralizado = false, ocultarLinha = false, larguraClass = "w-[96px] md:w-[180px]", campeao = false }: any) {
  const podeClicar = onAvancar && nome && nome !== "" && !["BYE", "TBD"].includes(nome.toString().trim().toUpperCase());

  // LAYOUT EXCLUSIVO DO CAMPEÃO (Enquadrado, fontes ajustadas e mais alto)
  if (campeao) {
    return (
      <div 
        onClick={() => podeClicar && onAvancar(id_banco, luta_id, nome, equipe)}
        className={`relative flex flex-col items-center justify-center gap-1.5 w-full py-1 md:py-2 ${podeClicar ? 'cursor-pointer hover:scale-105 transition-transform z-20' : ''}`}
      >
        <div className="w-[46px] h-[46px] md:w-[60px] md:h-[60px] rounded-full border-[2px] border-yellow-500 overflow-hidden flex items-center justify-center bg-black shrink-0 shadow-[0_0_15px_rgba(234,179,8,0.4)]">
          {foto ? (
            <img src={foto} alt={nome} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-6 h-6 md:w-8 md:h-8 text-yellow-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          )}
        </div>
        <span className="text-yellow-500 text-[11px] md:text-[13px] font-black uppercase text-center w-full drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] truncate px-1">
          {nome || "A DEFINIR"}
        </span>
      </div>
    )
  }

  return (
    <div 
      onClick={() => podeClicar && onAvancar(id_banco, luta_id, nome, equipe)}
      className={`relative h-[60px] flex-shrink-0 ${larguraClass} ${podeClicar ? 'cursor-pointer hover:scale-105 transition-transform z-20' : ''}`}
    >
      {/* A BOLINHA DA FOTO (Oculta na final para não quebrar a centralização) */}
      {!centralizado && (
        <div className={`hidden md:flex absolute top-[14px] w-[32px] h-[32px] rounded-full bg-zinc-900 border border-zinc-700 overflow-hidden items-center justify-center z-10 ${reverso ? 'right-0' : 'left-0'}`}>
          {foto ? (
            <img src={foto} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-4 h-4 text-zinc-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          )}
        </div>
      )}

      <div className={`absolute top-[6px] flex items-center ${centralizado ? 'justify-center left-0 right-0' : reverso ? 'left-0 right-0 md:left-0 md:right-[44px] flex-row-reverse' : 'left-0 right-0 md:left-[44px] md:right-0 flex-row'}`}>
        {numero && <span className={`text-zinc-500 text-[9px] md:text-[10px] font-bold ${reverso ? 'ml-1' : 'mr-1'}`}>{numero}</span>}
        <span className={`text-[#57d8ff] text-[10px] md:text-[12px] font-medium truncate flex-1 ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>{nome}</span>
      </div>
      
      {!ocultarLinha && <div className={`absolute top-[30px] border-t border-zinc-500 ${centralizado ? 'left-0 right-0' : reverso ? 'left-0 right-0 md:left-auto md:right-[44px]' : 'left-0 right-0 md:right-auto md:left-[44px]'}`} />}
      
      <div className={`absolute top-[34px] flex items-center ${centralizado ? 'justify-center left-0 right-0' : reverso ? 'left-0 right-0 md:left-0 md:right-[44px] flex-row-reverse' : 'left-0 right-0 md:left-[44px] md:right-0 flex-row'}`}>
        <span className={`text-zinc-500 text-[8px] md:text-[9px] uppercase truncate flex-1 ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>{equipe}</span>
      </div>
    </div>
  )
}

function ConectorPequeno({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[80px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[81px] border-zinc-500 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[40px] w-[6px] md:w-[15px] border-t border-zinc-500 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }
function ConectorMedio({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[160px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[161px] border-zinc-500 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[80px] w-[6px] md:w-[15px] border-t border-zinc-500 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }
function ConectorGrande({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[320px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[321px] border-zinc-500 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[160px] w-[6px] md:w-[15px] border-t border-zinc-500 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }

export default function ChavesPage() {
  const params = useParams()
  
  const [tipoCategoria, setTipoCategoria] = useState("peso")
  const [categoriasMenu, setCategoriasMenu] = useState<string[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("")
  const [lutas, setLutas] = useState<any[]>([])
  const [abaAtual, setAbaAtual] = useState(1) 
  const [modoAdmin, setModoAdmin] = useState(false)
  
  const [atletasDB, setAtletasDB] = useState<any[]>([])

  async function carregarCategorias() {
    const { data } = await supabase.from("chaves").select("categoria, faixa").eq("evento_id", params.id)
    if (data) {
      const unicas = Array.from(new Set(data.map(d => `${d.categoria}__${d.faixa}`)))
      setCategoriasMenu(unicas)
    }
  }

  async function carregarFotos() {
    const { data } = await supabase.from('atletas').select('nome, foto_url');
    if (data) setAtletasDB(data);
  }

  async function carregarChaves() {
    if (!categoriaSelecionada) return
    const [cat, fx] = categoriaSelecionada.split("__")
    const { data } = await supabase.from("chaves").select("*").eq("evento_id", params.id).eq("categoria", cat).eq("faixa", fx)
    setLutas(data || [])
  }

  useEffect(() => { 
    carregarCategorias();
    carregarFotos();
  }, [])

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

  const limparNome = (nome: string | null) => {
    if (!nome) return "";
    const strLimpa = String(nome).trim().toUpperCase();
    if (strLimpa === "BYE" || strLimpa === "TBD") return "";
    return String(nome);
  }

  const buscarFoto = (nomeLimpo: string) => {
    if (!nomeLimpo || nomeLimpo === "") return null;
    const upper = nomeLimpo.toUpperCase();
    let match = atletasDB.find(a => a.nome && a.nome.toUpperCase() === upper && a.foto_url);
    if (!match) {
        match = atletasDB.find(a => a.nome && a.nome.toUpperCase().includes(upper) && a.foto_url);
    }
    return match ? match.foto_url : null;
  }

  const handleAvancar = async (idBanco: string, idVisual: string, nomeVenc: string, equipeVenc: string) => {
    if (!modoAdmin || !nomeVenc) return;

    const lutaAtual = lutas.find(l => l.id === idBanco);
    if (!lutaAtual) return;

    const normalizar = (valor: string | null | undefined) => limparNome(valor || "").trim().toUpperCase();
    const nome1 = limparNome(lutaAtual.atleta_1);
    const nome2 = limparNome(lutaAtual.atleta_2);
    const id1 = lutaAtual.atleta_1_id || null;
    const id2 = lutaAtual.atleta_2_id || null;

    const idPorNomeNaLuta = (luta: any, nome: string | null | undefined) => {
      const alvo = normalizar(nome);
      if (!alvo) return null;
      if (normalizar(luta.atleta_1) === alvo) return luta.atleta_1_id || null;
      if (normalizar(luta.atleta_2) === alvo) return luta.atleta_2_id || null;
      return null;
    };

    const nomeVencNormalizado = normalizar(nomeVenc);
    const idVencedor = normalizar(lutaAtual.atleta_1) === nomeVencNormalizado ? id1 : normalizar(lutaAtual.atleta_2) === nomeVencNormalizado ? id2 : null;
    if (!idVencedor) return;

    const idPerdedor = String(idVencedor) === String(id1) ? id2 : id1;
    const nomePerdedor = String(idVencedor) === String(id1) ? lutaAtual.atleta_2 : lutaAtual.atleta_1;
    const equipePerdedor = String(idVencedor) === String(id1) ? lutaAtual.equipe_2 : lutaAtual.equipe_1;
    const vencedorAntigo = limparNome(lutaAtual.vencedor);
    const idVencedorAntigo = lutaAtual.vencedor_id || idPorNomeNaLuta(lutaAtual, vencedorAntigo);

    if (idVencedorAntigo && String(idVencedorAntigo) === String(idVencedor)) {
      console.log("Clique ignorado: atleta ja e o vencedor desta luta.");
      return;
    }

    const ganhouPorWO = !nome1 || !nome2 || !id1 || !id2;
    const isFinal = !lutaAtual.proxima_luta || String(lutaAtual.id_visual) === "999";
    const primeiraDaChaveDeTres = String(lutaAtual.id_visual) === '1' && String(lutaAtual.fase || '').toUpperCase().includes('CHAVE DE 3');
    const isSemifinal = String(lutaAtual.proxima_luta) === "999" && !primeiraDaChaveDeTres;

    const updateEstatistica = async (idAtletaNum: number | string | null, coluna: string, incremento: number) => {
      if (!idAtletaNum) return;
      const { data } = await supabase.from("atletas").select(`id, ${coluna}`).eq("id", idAtletaNum).single();
      if (data) {
        const valorAtual = (data as any)[coluna] || 0;
        await supabase.from("atletas").update({ [coluna]: Math.max(0, valorAtual + incremento) }).eq("id", (data as any).id);
      }
    };

    await supabase.from("chaves").update({
      vencedor: nomeVenc,
      vencedor_id: idVencedor,
      status_luta: "concluida",
      metodo_vitoria: ganhouPorWO ? "wo" : (lutaAtual.metodo_vitoria || "manual"),
      finalizada_em: lutaAtual.finalizada_em || new Date().toISOString(),
    }).eq("id", idBanco);

    if (!idVencedorAntigo) {
      if (ganhouPorWO) await updateEstatistica(idVencedor, "vitorias_wo", 1);

      if (isFinal) {
        await updateEstatistica(idVencedor, "ouro", 1);
        await updateEstatistica(idPerdedor, "prata", 1);
      }

      if (isSemifinal) {
        await updateEstatistica(idPerdedor, "bronze", 1);
      }
    } else if (String(idVencedorAntigo) !== String(idVencedor)) {
      if (ganhouPorWO) {
        await updateEstatistica(idVencedorAntigo, "vitorias_wo", -1);
        await updateEstatistica(idVencedor, "vitorias_wo", 1);
      }

      if (isFinal) {
        await updateEstatistica(idVencedorAntigo, "ouro", -1);
        await updateEstatistica(idVencedorAntigo, "prata", 1);
        await updateEstatistica(idVencedor, "prata", -1);
        await updateEstatistica(idVencedor, "ouro", 1);
      }

      if (isSemifinal) {
        await updateEstatistica(idVencedorAntigo, "bronze", 1);
        await updateEstatistica(idVencedor, "bronze", -1);
      }
    }

    if (lutaAtual.proxima_luta) {
      const proximaLuta = lutas.find(l => String(l.id_visual) === String(lutaAtual.proxima_luta));
      if (proximaLuta) {
        const isImpar = Number(idVisual) % 2 !== 0;
        let updateData: any = isImpar
          ? { atleta_1: nomeVenc, equipe_1: equipeVenc, atleta_1_id: idVencedor }
          : { atleta_2: nomeVenc, equipe_2: equipeVenc, atleta_2_id: idVencedor };

        if (proximaLuta.vencedor || proximaLuta.vencedor_id) {
          const proxVencedor = limparNome(proximaLuta.vencedor);
          const proxVencedorId = proximaLuta.vencedor_id || idPorNomeNaLuta(proximaLuta, proxVencedor);
          const proxId1 = proximaLuta.atleta_1_id || null;
          const proxId2 = proximaLuta.atleta_2_id || null;
          const proxPerdedorId = proxVencedorId && String(proxVencedorId) === String(proxId1) ? proxId2 : proxId1;
          const proxGanhouPorWO = !limparNome(proximaLuta.atleta_1) || !limparNome(proximaLuta.atleta_2) || !proxId1 || !proxId2;
          const isProxFinal = !proximaLuta.proxima_luta || String(proximaLuta.id_visual) === "999";
          const isProxSemi = String(proximaLuta.proxima_luta) === "999";

          if (proxGanhouPorWO) await updateEstatistica(proxVencedorId, "vitorias_wo", -1);

          if (isProxFinal) {
            await updateEstatistica(proxVencedorId, "ouro", -1);
            await updateEstatistica(proxPerdedorId, "prata", -1);
          } else if (isProxSemi) {
            await updateEstatistica(proxPerdedorId, "bronze", -1);
          }

          updateData = {
            ...updateData,
            vencedor: null,
            vencedor_id: null,
            status_luta: null,
            metodo_vitoria: null,
            finalizada_em: null,
          };
        }

        await supabase.from("chaves").update(updateData).eq("id", proximaLuta.id);
      }
    }
    await propagarResultadoChave(supabase, lutas, lutaAtual, {
      vencedorNome: nomeVenc,
      vencedorEquipe: equipeVenc,
      vencedorId: idVencedor,
      perdedorNome: nomePerdedor,
      perdedorEquipe: equipePerdedor,
      perdedorId: idPerdedor,
      propagarPerdedor: !ganhouPorWO,
    });
    await processarAvancosAutomaticosChaves(supabase, lutaAtual.evento_id);
    await carregarChaves();
  }
  const getAtletaDaPrimeiraFase = (posicaoColuna: number, slot: number, lado: "esquerda" | "direita") => {
    const idLutaVisual = getFase1VisualId(posicaoColuna, lado);
    const luta = lutas.find(l => String(l.id_visual) === String(idLutaVisual));
    if (!luta) return { nome: "", equipe: "", numero: "", foto: null };

    const nomeBruto = slot === 1 ? luta.atleta_1 : luta.atleta_2;
    const nomeLimpo = limparNome(nomeBruto);

    return {
      numero: slot === 1 ? luta.numero_1 : luta.numero_2,
      nome: nomeLimpo,
      equipe: nomeLimpo === "" ? "" : (slot === 1 ? luta.equipe_1 : luta.equipe_2),
      foto: buscarFoto(nomeLimpo),
      luta_id: luta.id_visual,
      id_banco: luta.id,
      onAvancar: modoAdmin ? handleAvancar : undefined
    }
  }

  const getAtletaDoMeio = (idBase: number, multiplicador: number, slotDelta: number, slot: number) => {
    const idLutaVisual = idBase + (abaAtual - 1) * multiplicador + slotDelta;
    const luta = lutas.find(l => String(l.id_visual) === String(idLutaVisual));
    if (!luta) return { nome: "", equipe: "", foto: null };

    const nomeBruto = slot === 1 ? luta.atleta_1 : luta.atleta_2;
    const nomeLimpo = limparNome(nomeBruto);
    
    return {
      nome: nomeLimpo,
      equipe: nomeLimpo === "" ? "" : (slot === 1 ? luta.equipe_1 : luta.equipe_2),
      foto: buscarFoto(nomeLimpo),
      luta_id: luta.id_visual,
      id_banco: luta.id,
      onAvancar: modoAdmin ? handleAvancar : undefined
    }
  }

  const getAtletaDaFinal = (slot: number) => {
    const luta = lutas.find(l => String(l.id_visual) === "999");
    if (!luta) return { nome: "", equipe: "", foto: null };

    const nomeBruto = slot === 1 ? luta.atleta_1 : luta.atleta_2;
    const nomeLimpo = limparNome(nomeBruto);
    
    return {
      nome: nomeLimpo,
      equipe: nomeLimpo === "" ? "" : (slot === 1 ? luta.equipe_1 : luta.equipe_2),
      foto: buscarFoto(nomeLimpo),
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
      equipe: "",
      foto: buscarFoto(campeao),
      luta_id: lutaFinal?.id_visual,
      id_banco: lutaFinal?.id,
      onAvancar: modoAdmin ? handleAvancar : undefined
    }
  }

  const getNomeDaFase = (luta: any, todasLutas: any[]) => {
    if (String(luta.id_visual) === "999") return "FINAL - DISPUTA DO OURO";
    if (String(luta.proxima_luta) === "999") return "SEMIFINAL";
    const semis = todasLutas.filter(l => String(l.proxima_luta) === "999").map(l => String(l.id_visual));
    if (semis.includes(String(luta.proxima_luta))) return "QUARTAS DE FINAL";
    const quartas = todasLutas.filter(l => semis.includes(String(l.proxima_luta))).map(l => String(l.id_visual));
    if (quartas.includes(String(luta.proxima_luta))) return "OITAVAS DE FINAL";
    const oitavas = todasLutas.filter(l => quartas.includes(String(l.proxima_luta))).map(l => String(l.id_visual));
    if (oitavas.includes(String(luta.proxima_luta))) return "16 AVOS DE FINAL";
    return "FASE ELIMINATÓRIA";
  }

  const lutasMobile = [...lutas]
    .filter(luta => {
      const a1 = limparNome(luta.atleta_1);
      const a2 = limparNome(luta.atleta_2);
      if ((!a1 || a1 === "BYE") && (!a2 || a2 === "BYE")) return false;
      return true;
    })
    .sort((a, b) => (parseInt(a.id_visual) || 0) - (parseInt(b.id_visual) || 0));

  const campeaoData = getCampeao();
  const temCampeao = campeaoData.nome && campeaoData.nome !== "";

  return (
    <main className="min-h-screen bg-black p-0 md:p-6">
      <div className="w-full max-w-[1400px] mx-auto pt-6 md:pt-0">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-10 px-4 md:px-0">
          <h1 className="text-white text-3xl md:text-5xl font-black">Chaveamento</h1>
          <button 
            onClick={() => setModoAdmin(!modoAdmin)}
            className={`mt-4 md:mt-0 px-6 py-3 rounded-xl font-bold transition-all border ${
              modoAdmin ? 'bg-red-600 border-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.5)]' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
            }`}
          >
            {modoAdmin ? "🔴 MODO JUIZ ATIVADO" : "Ativar Modo Juiz"}
          </button>
        </div>

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

        {/* ======================================================= */}
        {/* MODO DESKTOP: ÁRVORE CLÁSSICA                           */}
        {/* ======================================================= */}
        <div className="hidden md:flex bg-[#050816] md:border md:border-white/10 md:rounded-3xl py-6 md:p-10 w-full overflow-x-auto min-w-0 flex-col items-center scrollbar-hide relative shadow-2xl">
          {totalAbas > 1 && <p className="text-red-500 font-bold mb-4 uppercase tracking-widest text-sm absolute top-4 left-4">Chave {abaAtual}/{totalAbas}</p>}

          <div className="flex w-max md:w-full justify-center px-2 md:px-0 opacity-90 transition-all pt-6 md:pt-0 pb-8">
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

              <div className="flex flex-col gap-[80px] pt-[30px]"><ConectorPequeno /><ConectorPequeno /><ConectorPequeno /><ConectorPequeno /></div>
              <div className="flex flex-col gap-[100px] pt-[40px]">
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 1, 1)} />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 1, 2)} />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 2, 1)} />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 2, 2)} />
              </div>
              <div className="flex flex-col gap-[160px] pt-[70px]"><ConectorMedio /><ConectorMedio /></div>
              <div className="flex flex-col gap-[260px] pt-[120px]">
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(200, 1, 1, 1)} />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(200, 1, 1, 2)} />
              </div>
              <div className="flex flex-col pt-[150px]"><ConectorGrande /></div>
            </div>

            {/* CENTRO (FINAL E CAMPEÃO ALINHADOS) */}
            <div className="flex flex-col w-[140px] md:w-[220px] relative items-center mx-4">
              <div className="absolute top-[310px] left-[-10px] right-[-10px] border-t border-zinc-500 z-0" />
              
              {/* CAIXA DA LUTA FINAL */}
              <div className="absolute top-[260px] flex flex-col gap-[10px] bg-[#050816] px-2 py-4 border border-zinc-800 rounded-xl z-10 shadow-2xl w-full">
                <span className="text-red-600 font-black text-[10px] md:text-[11px] uppercase text-center mb-1 tracking-widest">Luta Final</span>
                <Atleta {...getAtletaDaFinal(1)} larguraClass="w-full" centralizado />
                <Atleta {...getAtletaDaFinal(2)} larguraClass="w-full" centralizado />
              </div>

              {/* CAIXA DO CAMPEÃO */}
              <div className="absolute top-[75px] md:top-[80px] flex flex-col items-center z-10 w-full">
                <span className="text-yellow-500 font-black text-[12px] md:text-lg mb-2 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)] tracking-widest">🏆 CAMPEÃO</span>
                <div className="bg-gradient-to-t from-yellow-500/10 to-black/80 border border-yellow-500/50 rounded-xl py-2 px-2 shadow-[0_0_20px_rgba(234,179,8,0.2)] w-full flex flex-col items-center">
                  <Atleta {...campeaoData} larguraClass="w-full" centralizado ocultarLinha campeao={true} />
                </div>
              </div>
            </div>

            {/* LADO DIREITO */}
            <div className="flex">
              <div className="flex flex-col pt-[150px]"><ConectorGrande reverso /></div>
              <div className="flex flex-col gap-[260px] pt-[120px]">
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(200, 1, 2, 1)} reverso />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(200, 1, 2, 2)} reverso />
              </div>
              <div className="flex flex-col gap-[160px] pt-[70px]"><ConectorMedio reverso /><ConectorMedio reverso /></div>
              <div className="flex flex-col gap-[100px] pt-[40px]">
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 3, 1)} reverso />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 3, 2)} reverso />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 4, 1)} reverso />
                <Atleta larguraClass="w-[16px] md:w-[80px]" {...getAtletaDoMeio(100, 2, 4, 2)} reverso />
              </div>
              <div className="flex flex-col gap-[80px] pt-[30px]"><ConectorPequeno reverso /><ConectorPequeno reverso /><ConectorPequeno reverso /><ConectorPequeno reverso /></div>
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

        {/* ======================================================= */}
        {/* MODO MOBILE: CARDS VERTICAIS E CLEAN                    */}
        {/* ======================================================= */}
        <div className="flex md:hidden flex-col w-full px-4 mb-20 mt-4">
          
          {temCampeao && (
            <div className="bg-gradient-to-t from-yellow-600/20 to-[#0c1220] border border-yellow-500/30 rounded-2xl p-6 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.15)] mb-6 animate-in fade-in zoom-in duration-500">
              <span className="text-yellow-500 font-black text-sm mb-3 tracking-widest drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">🏆 CAMPEÃO OFICIAL</span>
              <div className="w-16 h-16 rounded-full border-[3px] border-yellow-500 overflow-hidden bg-black flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)] mb-3 shrink-0">
                {campeaoData.foto ? (
                  <img src={campeaoData.foto} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-yellow-500 font-black">{campeaoData.nome.charAt(0)}</span>
                )}
              </div>
              <h2 className="text-white text-lg font-black uppercase tracking-tight text-center">{campeaoData.nome}</h2>
            </div>
          )}

          {lutasMobile.length === 0 ? (
            <div className="text-center text-zinc-500 py-10 text-sm">Nenhum confronto ativo no momento.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {lutasMobile.map(luta => {
                const a1 = limparNome(luta.atleta_1);
                const a2 = limparNome(luta.atleta_2);
                const foto1 = buscarFoto(a1);
                const foto2 = buscarFoto(a2);

                const handleClickA1 = () => modoAdmin && a1 && a1 !== "BYE" ? handleAvancar(luta.id, luta.id_visual, a1, luta.equipe_1) : undefined;
                const handleClickA2 = () => modoAdmin && a2 && a2 !== "BYE" ? handleAvancar(luta.id, luta.id_visual, a2, luta.equipe_2) : undefined;

                return (
                  <div key={luta.id} className="bg-[#0c1220] border border-[#57d8ff]/20 rounded-xl flex flex-col shadow-md relative overflow-hidden">
                    
                    <div className="bg-[#57d8ff]/10 border-b border-[#57d8ff]/20 py-1.5 px-3 flex justify-between items-center">
                      <span className="text-[9px] font-black text-[#57d8ff] uppercase tracking-widest">
                        {getNomeDaFase(luta, lutas)} • #{luta.id_visual}
                      </span>
                      {luta.vencedor && <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase border border-green-500/30">Finalizada</span>}
                    </div>

                    <div className="p-3 flex flex-col gap-1.5">
                      
                      <div onClick={handleClickA1} className={`flex justify-between items-center p-2 rounded-lg border transition-colors ${modoAdmin && a1 && a1 !== "BYE" ? 'cursor-pointer hover:border-[#57d8ff]/50' : ''} ${luta.vencedor && luta.vencedor === a1 ? 'bg-green-500/10 border-green-500/40' : 'bg-black/40 border-white/5'}`}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-400 border border-zinc-600 overflow-hidden shrink-0">
                            {foto1 ? <img src={foto1} className="w-full h-full object-cover"/> : a1 ? a1.charAt(0) : "?"}
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className={`text-xs font-black uppercase tracking-tight truncate ${luta.vencedor === a1 ? 'text-green-400' : 'text-white'}`}>{a1 || "A DEFINIR"}</span>
                            <span className="text-[9px] text-zinc-500 uppercase truncate">{luta.equipe_1 || "Sem Equipe"}</span>
                          </div>
                        </div>
                        {luta.vencedor === a1 && <svg className="w-5 h-5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                      </div>

                      <div className="relative h-1 w-full flex justify-center items-center my-1">
                        <div className="absolute w-6 h-6 bg-[#0c1220] border border-[#57d8ff]/30 rounded-full flex items-center justify-center text-[8px] font-black text-[#57d8ff] z-10">VS</div>
                        <div className="w-full border-t border-white/5"></div>
                      </div>

                      <div onClick={handleClickA2} className={`flex justify-between items-center p-2 rounded-lg border transition-colors ${modoAdmin && a2 && a2 !== "BYE" ? 'cursor-pointer hover:border-[#57d8ff]/50' : ''} ${luta.vencedor && luta.vencedor === a2 ? 'bg-green-500/10 border-green-500/40' : 'bg-black/40 border-white/5'}`}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-400 border border-zinc-600 overflow-hidden shrink-0">
                            {foto2 ? <img src={foto2} className="w-full h-full object-cover"/> : a2 ? a2.charAt(0) : "?"}
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className={`text-xs font-black uppercase tracking-tight truncate ${luta.vencedor === a2 ? 'text-green-400' : 'text-white'}`}>{a2 || "A DEFINIR"}</span>
                            <span className="text-[9px] text-zinc-500 uppercase truncate">{luta.equipe_2 || "Sem Equipe"}</span>
                          </div>
                        </div>
                        {luta.vencedor === a2 && <svg className="w-5 h-5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                      </div>

                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
