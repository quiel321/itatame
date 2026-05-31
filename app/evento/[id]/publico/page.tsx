"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/app/lib/supabase"

// 1. Componente Atleta (VISÃO PÚBLICO: COM FOTO, LAYOUT AJUSTADO E SEM CLIQUES)
function Atleta({ nome, equipe, numero, foto, reverso = false, centralizado = false, ocultarLinha = false, larguraClass = "w-[96px] md:w-[180px]", campeao = false }: any) {
  const isBye = !nome || ["BYE", "TBD"].includes(nome.toString().trim().toUpperCase());
  const nomeExibicao = isBye ? "" : nome;
  const equipeExibicao = isBye ? "" : equipe;

  // LAYOUT EXCLUSIVO DO CAMPEÃO (Enquadrado e proporcional)
  if (campeao) {
    return (
      <div className="relative flex flex-col items-center justify-center gap-1.5 w-full py-1 md:py-2">
        <div className="w-[46px] h-[46px] md:w-[60px] md:h-[60px] rounded-full border-[2px] border-yellow-500 overflow-hidden flex items-center justify-center bg-black shrink-0 shadow-[0_0_15px_rgba(234,179,8,0.4)]">
          {foto && !isBye ? (
            <img src={foto} alt={nomeExibicao} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-6 h-6 md:w-8 md:h-8 text-yellow-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          )}
        </div>
        <span className="text-yellow-500 text-[11px] md:text-[13px] font-black uppercase text-center w-full drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] truncate px-1">
          {nomeExibicao || "A DEFINIR"}
        </span>
      </div>
    )
  }

  return (
    <div className={`relative h-[60px] flex-shrink-0 ${larguraClass}`}>
      {/* A BOLINHA DA FOTO (Oculta na final para não quebrar a centralização) */}
      {!centralizado && (
        <div className={`hidden md:flex absolute top-[14px] w-[32px] h-[32px] rounded-full bg-zinc-900 border border-zinc-700 overflow-hidden items-center justify-center z-10 ${reverso ? 'right-0' : 'left-0'}`}>
          {foto && !isBye ? (
            <img src={foto} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-4 h-4 text-zinc-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          )}
        </div>
      )}

      <div className={`absolute top-[6px] flex items-center ${centralizado ? 'justify-center left-0 right-0' : reverso ? 'left-0 right-0 md:left-0 md:right-[44px] flex-row-reverse' : 'left-0 right-0 md:left-[44px] md:right-0 flex-row'}`}>
        {numero && <span className={`text-zinc-500 text-[9px] md:text-[10px] font-bold ${reverso ? 'ml-1' : 'mr-1'}`}>{numero}</span>}
        <span className={`text-[#57d8ff] text-[10px] md:text-[12px] font-medium truncate flex-1 ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>{nomeExibicao}</span>
      </div>
      
      {!ocultarLinha && <div className={`absolute top-[30px] border-t border-zinc-500 ${centralizado ? 'left-0 right-0' : reverso ? 'left-0 right-0 md:left-auto md:right-[44px]' : 'left-0 right-0 md:right-auto md:left-[44px]'}`} />}
      
      <div className={`absolute top-[34px] flex items-center ${centralizado ? 'justify-center left-0 right-0' : reverso ? 'left-0 right-0 md:left-0 md:right-[44px] flex-row-reverse' : 'left-0 right-0 md:left-[44px] md:right-0 flex-row'}`}>
        <span className={`text-zinc-500 text-[8px] md:text-[9px] uppercase truncate flex-1 ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>{equipeExibicao}</span>
      </div>
    </div>
  )
}

function ConectorPequeno({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[80px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[81px] border-zinc-500 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[40px] w-[6px] md:w-[15px] border-t border-zinc-500 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }
function ConectorMedio({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[160px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[161px] border-zinc-500 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[80px] w-[6px] md:w-[15px] border-t border-zinc-500 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }
function ConectorGrande({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[320px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[321px] border-zinc-500 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[160px] w-[6px] md:w-[15px] border-t border-zinc-500 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }

export default function ChavesPublicoPage() {
  const params = useParams()
  
  const [tipoCategoria, setTipoCategoria] = useState("peso")
  const [categoriasMenu, setCategoriasMenu] = useState<string[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("")
  const [lutas, setLutas] = useState<any[]>([])
  const [abaAtual, setAbaAtual] = useState(1) 
  
  // ESTADO PARA ARMAZENAR OS ATLETAS E FAZER A BUSCA INTELIGENTE DE FOTO
  const [atletasDB, setAtletasDB] = useState<any[]>([])

  async function carregarCategorias() {
    const { data } = await supabase.from("chaves").select("categoria, faixa").eq("evento_id", params.id)
    if (data) {
      const unicas = Array.from(new Set(data.map(d => `${d.categoria}__${d.faixa}`)))
      setCategoriasMenu(unicas)
    }
  }

  // BUSCA OS ATLETAS UMA VEZ SÓ
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

  // BUSCA INTELIGENTE DE FOTO
  const buscarFoto = (nomeLimpo: string) => {
    if (!nomeLimpo || nomeLimpo === "") return null;
    const upper = nomeLimpo.toUpperCase();
    let match = atletasDB.find(a => a.nome && a.nome.toUpperCase() === upper && a.foto_url);
    if (!match) {
        match = atletasDB.find(a => a.nome && a.nome.toUpperCase().includes(upper) && a.foto_url);
    }
    return match ? match.foto_url : null;
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
      foto: buscarFoto(nomeLimpo)
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
      foto: buscarFoto(nomeLimpo)
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
      foto: buscarFoto(nomeLimpo)
    }
  }

  const getCampeao = () => {
    const lutaFinal = lutas.find(l => String(l.id_visual) === "999");
    const campeao = limparNome(lutaFinal?.vencedor || null);
    return {
      nome: campeao,
      equipe: "",
      foto: buscarFoto(campeao)
    }
  }

  // IDENTIFICADOR DE FASE (PARA O MOBILE)
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
          <h1 className="text-white text-3xl md:text-5xl font-black">Chaveamento Oficial</h1>
          <button 
            onClick={() => { carregarCategorias(); carregarChaves(); carregarFotos(); }}
            className="mt-4 md:mt-0 px-6 py-3 rounded-xl font-bold transition-all border bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white flex items-center gap-2 text-sm md:text-base"
          >
            🔄 Atualizar Resultados
          </button>
        </div>

        <div className="bg-[#050816] md:border border-white/10 md:rounded-3xl p-4 md:p-6 mb-4 mx-4 md:mx-0 flex flex-col md:flex-row gap-4 items-end shadow-lg">
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
          {totalAbas > 1 && <p className="text-zinc-500 font-bold mb-4 uppercase tracking-widest text-sm absolute top-4 left-4">Chave {abaAtual}/{totalAbas}</p>}

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

                return (
                  <div key={luta.id} className="bg-[#0c1220] border border-[#57d8ff]/20 rounded-xl flex flex-col shadow-md relative overflow-hidden">
                    
                    <div className="bg-[#57d8ff]/10 border-b border-[#57d8ff]/20 py-1.5 px-3 flex justify-between items-center">
                      <span className="text-[9px] font-black text-[#57d8ff] uppercase tracking-widest">
                        {getNomeDaFase(luta, lutas)} • #{luta.id_visual}
                      </span>
                      {luta.vencedor && <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase border border-green-500/30">Finalizada</span>}
                    </div>

                    <div className="p-3 flex flex-col gap-1.5">
                      
                      <div className={`flex justify-between items-center p-2 rounded-lg border transition-colors ${luta.vencedor && luta.vencedor === a1 ? 'bg-green-500/10 border-green-500/40' : 'bg-black/40 border-white/5'}`}>
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

                      <div className={`flex justify-between items-center p-2 rounded-lg border transition-colors ${luta.vencedor && luta.vencedor === a2 ? 'bg-green-500/10 border-green-500/40' : 'bg-black/40 border-white/5'}`}>
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