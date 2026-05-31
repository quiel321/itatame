"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/app/lib/supabase"

// O Componente Atleta agora é 100% "Read-Only" (Somente Leitura)
function Atleta({ nome, equipe, numero, reverso = false, centralizado = false, ocultarLinha = false, larguraClass = "w-[96px] md:w-[180px]" }: any) {
  const isBye = !nome || ["BYE", "TBD"].includes(nome.toString().trim().toUpperCase());
  const nomeExibicao = isBye ? "" : nome;
  const equipeExibicao = isBye ? "" : equipe;

  return (
    <div className={`relative h-[60px] flex-shrink-0 ${larguraClass}`}>
      <div className={`hidden md:block absolute top-[14px] w-[32px] h-[32px] rounded-full bg-zinc-800 ${reverso ? 'right-0' : 'left-0'}`} />
      <div className={`absolute top-[6px] flex items-center ${centralizado ? 'justify-center left-0 right-0' : reverso ? 'left-0 right-0 md:left-0 md:right-[44px] flex-row-reverse' : 'left-0 right-0 md:left-[44px] md:right-0 flex-row'}`}>
        {numero && <span className={`text-zinc-500 text-[9px] md:text-[10px] font-bold ${reverso ? 'ml-1' : 'mr-1'}`}>{numero}</span>}
        <span className={`text-white text-[10px] md:text-[12px] font-medium truncate flex-1 ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>{nomeExibicao}</span>
      </div>
      {!ocultarLinha && <div className={`absolute top-[30px] border-t border-zinc-600 ${reverso ? 'left-0 right-0 md:left-auto md:right-[44px]' : 'left-0 right-0 md:right-auto md:left-[44px]'}`} />}
      <div className={`absolute top-[34px] flex items-center ${centralizado ? 'justify-center left-0 right-0' : reverso ? 'left-0 right-0 md:left-0 md:right-[44px] flex-row-reverse' : 'left-0 right-0 md:left-[44px] md:right-0 flex-row'}`}>
        <span className={`text-zinc-500 text-[8px] md:text-[9px] uppercase truncate flex-1 ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>{equipeExibicao}</span>
      </div>
    </div>
  )
}

// Conectores
function ConectorPequeno({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[80px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[81px] border-zinc-600 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[40px] w-[6px] md:w-[15px] border-t border-zinc-600 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }
function ConectorMedio({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[160px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[161px] border-zinc-600 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[80px] w-[6px] md:w-[15px] border-t border-zinc-600 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }
function ConectorGrande({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[320px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[321px] border-zinc-600 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[160px] w-[6px] md:w-[15px] border-t border-zinc-600 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }

export default function ChavesPublicoPage() {
  const params = useParams()
  
  const [tipoCategoria, setTipoCategoria] = useState("peso")
  const [categoriasMenu, setCategoriasMenu] = useState<string[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("")
  const [lutas, setLutas] = useState<any[]>([])
  const [abaAtual, setAbaAtual] = useState(1) 

  async function carregarCategorias() {
    const { data } = await supabase.from("chaves").select("categoria, faixa").eq("evento_id", params.id)
    if (data) {
      const unicas = Array.from(new Set(data.map(d => `${d.categoria}__${d.faixa}`)))
      setCategoriasMenu(unicas)
    }
  }

  async function carregarChaves() {
    if (!categoriaSelecionada) {
      setLutas([])
      return
    }
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
    { numero: String(luta.numero_1 || ""), nome: luta.atleta_1 || "" },
    { numero: String(luta.numero_2 || ""), nome: luta.atleta_2 || "" }
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
    }
  }

  const getCampeao = () => {
    const lutaFinal = lutas.find(l => String(l.id_visual) === "999");
    const campeao = limparNome(lutaFinal?.vencedor || null);
    return {
      nome: campeao,
      equipe: "",
    }
  }

  return (
    <main className="min-h-screen bg-black p-0 md:p-6">
      <div className="w-full max-w-[1400px] mx-auto pt-6 md:pt-0">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-10 px-4 md:px-0">
          <h1 className="text-white text-3xl md:text-5xl font-black">Chaves Oficiais</h1>
          
          <button 
            onClick={() => { carregarCategorias(); carregarChaves(); }}
            className="mt-4 md:mt-0 px-6 py-3 rounded-xl font-bold transition-all border bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white flex items-center gap-2"
          >
            🔄 Atualizar Resultados
          </button>
        </div>

        {/* PAINEL DE FILTROS */}
        <div className="bg-[#050816] md:border border-white/10 md:rounded-3xl p-4 md:p-6 mb-4 mx-4 md:mx-0 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full flex flex-col gap-2">
            <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider pl-1">Modalidade</label>
            <select value={tipoCategoria} onChange={(e) => setTipoCategoria(e.target.value)} className="w-full bg-black/50 border border-zinc-800 text-white rounded-lg p-3 outline-none focus:border-zinc-500">
              <option value="peso">Categorias de Peso</option>
              <option value="absoluto">Absoluto Livre</option>
            </select>
          </div>
          <div className="flex-[2] w-full flex flex-col gap-2">
            <label className="text-zinc-500 text-xs font-bold uppercase tracking-wider pl-1">Categoria / Divisão</label>
            <select value={categoriaSelecionada} onChange={(e) => setCategoriaSelecionada(e.target.value)} className="w-full bg-black/50 border border-zinc-800 text-white rounded-lg p-3 outline-none focus:border-zinc-500">
              {categoriasFiltradas.length === 0 && <option value="">Nenhuma chave liberada ainda...</option>}
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
                Chave {i + 1}/{totalAbas}
              </button>
            ))}
          </div>
        )}

        <div className="bg-[#050816] md:border md:border-white/10 md:rounded-3xl py-6 md:p-10 w-full overflow-x-auto min-w-0 flex flex-col items-center scrollbar-hide">
          {totalAbas > 1 && <p className="text-zinc-500 font-bold mb-4 uppercase tracking-widest text-sm">Visualizando Chave {abaAtual}/{totalAbas}</p>}

          <div className="flex w-max md:w-full justify-center px-2 md:px-0 opacity-90">
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

            {/* CENTRO (FINAL) */}
            <div className="flex flex-col w-[120px] md:w-[260px] relative items-center">
              <div className="absolute top-[310px] left-[-10px] right-[-10px] border-t border-zinc-700 z-0" />
              
              <div className="absolute top-[260px] flex flex-col gap-[10px] bg-[#050816] px-2 py-4 border border-zinc-800 rounded-xl z-10 shadow-lg">
                <span className="text-zinc-500 font-bold text-[10px] uppercase text-center mb-1 tracking-widest">Disputa do Ouro</span>
                <Atleta larguraClass="w-[100px] md:w-[160px]" centralizado {...getAtletaDaFinal(1)} />
                <Atleta larguraClass="w-[100px] md:w-[160px]" centralizado {...getAtletaDaFinal(2)} />
              </div>

              <div className="absolute top-[100px] flex flex-col items-center z-10">
                <span className="text-yellow-500 font-black text-sm md:text-2xl mb-3 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]">🏆 CAMPEÃO</span>
                <div className="bg-gradient-to-t from-yellow-500/10 to-transparent border border-yellow-500/30 rounded-2xl p-3">
                  <Atleta larguraClass="w-[100px] md:w-[160px]" centralizado ocultarLinha {...getCampeao()} />
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
      </div>
    </main>
  )
}