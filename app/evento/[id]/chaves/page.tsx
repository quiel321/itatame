"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/app/lib/supabase"
import { rotuloLuta } from "@/app/lib/lutas-rotulos"
import { lutasFormamChaveDeTres } from "@/app/lib/chave-de-tres"
import { ChaveTriangularPainel } from "@/app/components/ChaveDeTresPainel"
import ArvoreChaveDesktop from "@/app/components/ArvoreChaveDesktop"

export default function ChavesPage() {
  const params = useParams()
  
  const [tipoCategoria, setTipoCategoria] = useState("peso")
  const [categoriasMenu, setCategoriasMenu] = useState<string[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("")
  const [lutas, setLutas] = useState<any[]>([])
  const [abaAtual, setAbaAtual] = useState(1) 
  const [modoAdmin, setModoAdmin] = useState(false)
  
  const [atletasDB, setAtletasDB] = useState<{ id?: number; nome: string; foto_url: string | null }[]>([])

  async function carregarCategorias() {
    const { data } = await supabase.from("chaves").select("categoria, faixa").eq("evento_id", params.id)
    if (data) {
      const unicas = Array.from(new Set(data.map(d => `${d.categoria}__${d.faixa}`)))
      setCategoriasMenu(unicas)
    }
  }

  async function carregarFotos() {
    const { data } = await supabase.from('atletas_publico').select('id, nome, foto_url');
    if (data) setAtletasDB(data);
  }

  async function carregarChaves() {
    if (!categoriaSelecionada) return
    const [cat, fx] = categoriaSelecionada.split("__")
    const { data } = await supabase.from("chaves").select("*").eq("evento_id", params.id).eq("categoria", cat).eq("faixa", fx)
    setLutas(data || [])
  }

  useEffect(() => { 
    if (!params.id) return;
    void fetch(`/api/eventos/${params.id}/gerar-chaves-auto`).then(() => { carregarCategorias(); carregarChaves(); });
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

  const limparNome = (nome: string | null) => {
    if (!nome) return "";
    const strLimpa = String(nome).trim().toUpperCase();
    if (strLimpa === "BYE" || strLimpa === "TBD") return "";
    return String(nome);
  }

  const buscarFoto = (idNumerico?: number | null, nomeLimpo?: string): string | null => {
    if (idNumerico) {
      const porId = atletasDB.find(a => Number(a.id) === Number(idNumerico) && a.foto_url);
      if (typeof porId?.foto_url === 'string' && porId.foto_url) return porId.foto_url;
    }
    if (!nomeLimpo) return null;
    const upper = nomeLimpo.toUpperCase();
    let match = atletasDB.find(a => a.nome && a.nome.toUpperCase() === upper && a.foto_url);
    if (!match) {
        match = atletasDB.find(a => a.nome && a.nome.toUpperCase().includes(upper) && a.foto_url);
    }
    return typeof match?.foto_url === 'string' && match.foto_url ? match.foto_url : null;
  }

  const handleAvancar = async (..._args: unknown[]) => {
    if (!modoAdmin) return;
    window.location.href = `/admin/resultados?evento=${params.id}`;
  };

  const getCampeao = () => {
    const lutaFinal = lutas.find(l => String(l.id_visual) === "999") || lutas.find(l => !l.proxima_luta);
    const campeao = limparNome(lutaFinal?.vencedor || null);
    return {
      nome: campeao,
      equipe: "",
      foto: buscarFoto(lutaFinal?.vencedor_id, campeao),
      luta_id: lutaFinal?.id_visual,
      id_banco: lutaFinal?.id,
      onAvancar: modoAdmin ? handleAvancar : undefined
    }
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
  const ehChaveDeTres = lutasFormamChaveDeTres(lutas);

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

        <ArvoreChaveDesktop
          lutas={lutas}
          abaAtual={abaAtual}
          totalAbas={totalAbas}
          buscarFoto={(id) => buscarFoto(id, "")}
          onAvancar={modoAdmin ? handleAvancar : undefined}
        />

        {ehChaveDeTres && (
          <div className="mt-5 bg-[#050816] py-6 md:hidden">
            <div className="px-4">
              <ChaveTriangularPainel lutas={lutas} buscarFoto={(id) => buscarFoto(id, "")} />
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* MODO MOBILE: CARDS VERTICAIS E CLEAN                    */}
        {/* ======================================================= */}
        {!ehChaveDeTres && (
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
                const foto1 = buscarFoto(luta.atleta_1_id, a1);
                const foto2 = buscarFoto(luta.atleta_2_id, a2);

                const handleClickA1 = () => modoAdmin && a1 && a1 !== "BYE" ? handleAvancar(luta.id, luta.id_visual, a1, luta.equipe_1) : undefined;
                const handleClickA2 = () => modoAdmin && a2 && a2 !== "BYE" ? handleAvancar(luta.id, luta.id_visual, a2, luta.equipe_2) : undefined;

                return (
                  <div key={luta.id} className="bg-[#0c1220] border border-[#57d8ff]/20 rounded-xl flex flex-col shadow-md relative overflow-hidden">
                    
                    <div className="bg-[#57d8ff]/10 border-b border-[#57d8ff]/20 py-1.5 px-3 flex justify-between items-center">
                      <span className="text-[9px] font-black text-[#57d8ff] uppercase tracking-widest">
                        {rotuloLuta(luta)}
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
        )}

      </div>
    </main>
  )
}
