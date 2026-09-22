"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/app/lib/supabase"
import { rotuloLuta } from "@/app/lib/lutas-rotulos"
import ArvoreChaveDesktop from "@/app/components/ArvoreChaveDesktop"
import { totalAbasArvore } from "@/app/lib/chave-visual"

export default function ChavesPage() {
  const params = useParams()
  
  const [tipoCategoria, setTipoCategoria] = useState("peso")
  const [categoriasMenu, setCategoriasMenu] = useState<string[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("")
  const [lutas, setLutas] = useState<any[]>([])
  const [abaAtual, setAbaAtual] = useState(1)
  
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

  useEffect(() => { carregarChaves(); setAbaAtual(1) }, [categoriaSelecionada])

  const categoriasFiltradas = categoriasMenu.filter((cat) => {
    const isAbsoluto = cat.toLowerCase().includes("absoluto")
    return tipoCategoria === "peso" ? !isAbsoluto : isAbsoluto
  })

  useEffect(() => {
    setCategoriaSelecionada(categoriasFiltradas[0] || "")
    setAbaAtual(1) 
  }, [tipoCategoria, categoriasMenu])

  const totalAbas = totalAbasArvore(lutas);

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

  const getCampeao = () => {
    const lutaFinal = lutas.find(l => String(l.id_visual) === "999") || lutas.find(l => !l.proxima_luta);
    const campeao = limparNome(lutaFinal?.vencedor || null);
    return {
      nome: campeao,
      equipe: "",
      foto: buscarFoto(lutaFinal?.vencedor_id, campeao),
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

  return (
    <main className="min-h-screen bg-black p-0 md:p-6">
      <div className="w-full max-w-[1400px] mx-auto pt-6 md:pt-0">
        
        <div className="mb-4 flex items-center justify-between gap-3 px-4 md:mb-8 md:items-end md:px-0">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Árvore do campeonato</p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight text-white md:text-5xl">Chaveamento</h1>
            <p className="mt-1 hidden max-w-xl text-sm text-zinc-400 md:block">Troque a categoria acima da árvore. Os nomes e as fotos ficam no caminho até a final.</p>
          </div>
        </div>

        <div className="sticky top-16 z-30 mx-4 mb-3 flex flex-col items-end gap-3 rounded-2xl border border-white/10 bg-[#050816]/95 p-3 backdrop-blur md:top-20 md:mx-0 md:mb-4 md:rounded-3xl md:p-5 md:flex-row">
          <div className="flex w-full flex-1 flex-col gap-2">
            <label className="pl-1 text-xs font-bold uppercase tracking-wider text-[#57d8ff]">Tipo de categoria</label>
            <select value={tipoCategoria} onChange={(e) => setTipoCategoria(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-black/50 p-3 text-white outline-none focus:border-[#57d8ff]">
              <option value="peso">Categoria de peso</option>
              <option value="absoluto">Absoluto</option>
            </select>
          </div>
          <div className="flex w-full flex-[2] flex-col gap-2">
            <label className="pl-1 text-xs font-bold uppercase tracking-wider text-[#57d8ff]">Categoria e faixa</label>
            <select value={categoriaSelecionada} onChange={(e) => setCategoriaSelecionada(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-black/50 p-3 text-white outline-none focus:border-[#57d8ff]">
              {categoriasFiltradas.length === 0 && <option value="">Nenhuma chave nesta modalidade...</option>}
              {categoriasFiltradas.map((cat) => {
                const [nomeCategoria, faixa] = cat.split("__")
                return <option key={cat} value={cat}>{nomeCategoria} - Faixa {faixa}</option>
              })}
            </select>
          </div>
        </div>

        {totalAbas > 1 && (
          <div className="mb-6 hidden flex-wrap justify-center gap-2 px-4 md:flex">
            {Array.from({ length: totalAbas }).map((_, i) => (
              <button key={i} onClick={() => setAbaAtual(i + 1)} className={`px-6 py-2 rounded-lg font-bold transition-all ${abaAtual === i + 1 ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>
                {i + 1}/{totalAbas}
              </button>
            ))}
          </div>
        )}

        <div className="hidden px-4 md:block md:px-0">
          <ArvoreChaveDesktop
            lutas={lutas}
            abaAtual={abaAtual}
            totalAbas={totalAbas}
            buscarFoto={(id) => buscarFoto(id, "")}
          />
        </div>

        <div className="mb-16 mt-3 flex w-full flex-col px-4 md:hidden">
          
          {temCampeao && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-600/20 to-[#0c1220] px-3 py-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-yellow-500 bg-black">
                {campeaoData.foto ? (
                  <img src={campeaoData.foto} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-black text-yellow-500">{campeaoData.nome.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-yellow-500">Campeão</p>
                <h2 className="truncate text-sm font-black uppercase text-white">{campeaoData.nome}</h2>
              </div>
            </div>
          )}

          {lutasMobile.length === 0 ? (
            <div className="text-center text-zinc-500 py-10 text-sm">Nenhum confronto ativo no momento.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {lutasMobile.map(luta => {
                const a1 = limparNome(luta.atleta_1);
                const a2 = limparNome(luta.atleta_2);
                const foto1 = buscarFoto(luta.atleta_1_id, a1);
                const foto2 = buscarFoto(luta.atleta_2_id, a2);

                return (
                  <div key={luta.id} className="bg-[#0c1220] border border-[#57d8ff]/20 rounded-xl flex flex-col shadow-md relative overflow-hidden">
                    
                    <div className="bg-[#57d8ff]/10 border-b border-[#57d8ff]/20 py-1.5 px-3 flex justify-between items-center">
                      <span className="text-[9px] font-black text-[#57d8ff] uppercase tracking-widest">
                        {rotuloLuta(luta)}
                      </span>
                      {luta.vencedor && <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase border border-green-500/30">Finalizada</span>}
                    </div>

                    <div className="p-3 flex flex-col gap-1.5">
                      
                      <div className={`flex justify-between items-center p-2 rounded-lg border ${luta.vencedor && luta.vencedor === a1 ? 'bg-green-500/10 border-green-500/40' : 'bg-black/40 border-white/5'}`}>
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

                      <div className={`flex justify-between items-center p-2 rounded-lg border ${luta.vencedor && luta.vencedor === a2 ? 'bg-green-500/10 border-green-500/40' : 'bg-black/40 border-white/5'}`}>
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
