"use client"

import { useState } from "react"
import { supabase } from "@/app/lib/supabase"

export default function GerarChavesPage() {
  const [eventoId, setEventoId] = useState("")
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState("")
  
  // NOVO: Define o que estamos gerando
  const [tipoGeracao, setTipoGeracao] = useState("peso") 

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

  async function gerarChaves() {
    try {
      setLoading(true)
      setMensagem("")

      const { data: inscricoes, error } = await supabase.from("inscricoes").select("*").eq("evento_id", eventoId)

      if (error || !inscricoes || inscricoes.length === 0) {
        setMensagem(error ? error.message : "Nenhuma inscrição encontrada")
        setLoading(false)
        return
      }

      if (tipoGeracao === "absoluto") {
        await supabase.from("chaves").delete().eq("evento_id", eventoId).ilike("categoria", "%Absoluto%");
      } else {
        await supabase.from("chaves").delete().eq("evento_id", eventoId).not("categoria", "ilike", "%Absoluto%");
      }

      const grupos: any = {}
      
      inscricoes.forEach((inscricao: any) => {
        if (tipoGeracao === "peso") {
          if (inscricao.categoria.toLowerCase().includes("absoluto")) return;
          const chave = `${inscricao.categoria}__${inscricao.faixa}`
          if (!grupos[chave]) grupos[chave] = []
          grupos[chave].push(inscricao)
        } else {
          if (inscricao.absoluto === true || inscricao.categoria.toLowerCase().includes("absoluto")) {
            
            // ==========================================
            // MÁGICA ILUTAS: CONSTRUINDO A CATEGORIA
            // ==========================================
            const idadeNum = parseInt(inscricao.idade) || 18;
            let divisao = "Adulto";
            if (idadeNum < 18) divisao = "Juvenil";
            else if (idadeNum >= 30) divisao = "Master";

            const sexoAtleta = inscricao.sexo || "Masculino";

            // Resultado: "Absoluto Adulto Masculino" ou "Absoluto Master Feminino"
            const nomeCategoriaAbsoluto = `Absoluto ${divisao} ${sexoAtleta}`;
            
            const chave = `${nomeCategoriaAbsoluto}__${inscricao.faixa}`
            if (!grupos[chave]) grupos[chave] = []
            grupos[chave].push(inscricao)
          }
        }
      })

      if (Object.keys(grupos).length === 0) {
        setMensagem(tipoGeracao === "absoluto" ? "❌ Nenhum atleta marcado para lutar o Absoluto." : "❌ Nenhuma inscrição de peso encontrada.");
        setLoading(false);
        return;
      }

      for (const grupo in grupos) {
        const atletas: any[] = grupos[grupo]
        atletas.sort(() => Math.random() - 0.5)

        const categoria = grupo.split("__")[0] // Vai salvar "Absoluto Adulto Masculino"
        const faixa = grupo.split("__")[1]

        let tamanhoChave = 16 
        if (atletas.length > 16) tamanhoChave = 32
        if (atletas.length > 32) tamanhoChave = 64

        while (atletas.length < tamanhoChave) {
          atletas.push({ atleta: "BYE", nome: "BYE", equipe: "" })
        }

        const lutas: any[] = []
        const at = (idx: number) => ({
          nome: atletas[idx]?.atleta || atletas[idx]?.nome || "BYE",
          equipe: atletas[idx]?.equipe || ""
        });

        const posicoes = gerarMapaPosicoes(tamanhoChave);

        for (let i = 0; i < tamanhoChave / 2; i++) {
          const seed1 = posicoes[i * 2];
          const seed2 = posicoes[i * 2 + 1];
          const idAtual = String(i + 1);
          const prox = String(101 + Math.floor(i / 2));

          lutas.push({
            id_visual: idAtual, evento_id: eventoId, categoria, faixa,
            atleta_1: at(seed1 - 1).nome, equipe_1: at(seed1 - 1).equipe, numero_1: String(seed1).padStart(2, '0'),
            atleta_2: at(seed2 - 1).nome, equipe_2: at(seed2 - 1).equipe, numero_2: String(seed2).padStart(2, '0'),
            vencedor: null, fase: "Oitavas", ordem: i + 1,
            lado: (i + 1) <= (tamanhoChave / 4) ? "esquerda" : "direita",
            proxima_luta: prox
          });
        }

        let faseAtual = tamanhoChave / 2;
        let idFase = 1;
        while (faseAtual > 1) {
          faseAtual /= 2;
          for (let i = 0; i < faseAtual; i++) {
            const isFinal = faseAtual === 1;
            
            const idVis = isFinal ? "999" : String(idFase * 100 + i + 1);
            
            // A CORREÇÃO ESTÁ AQUI NA LINHA ABAIXO: 
            // Trocamos faseAtual === 1 por faseAtual === 2. 
            // Agora o sistema entende que a fase com 2 lutas (Semi) deve mandar os atletas para a 999.
            const prox = isFinal ? null : (faseAtual === 2 ? "999" : String((idFase + 1) * 100 + Math.floor(i / 2) + 1));
            
            lutas.push({
              id_visual: idVis, evento_id: eventoId, categoria, faixa,
              atleta_1: "TBD", equipe_1: "", numero_1: "",
              atleta_2: "TBD", equipe_2: "", numero_2: "",
              vencedor: null, fase: isFinal ? "Final" : "Fase", ordem: i + 1,
              lado: isFinal ? "centro" : (i + 1) <= (faseAtual / 2) ? "esquerda" : "direita",
              proxima_luta: prox
            });
          }
          idFase++;
        }

        await supabase.from("chaves").insert(lutas);
      }
      setMensagem(`✅ Chaves de ${tipoGeracao === 'peso' ? 'Peso' : 'Absoluto'} geradas com sucesso!`)
    } catch (err) {
      setMensagem("Erro na geração.")
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-5xl font-black mb-10">Gerar Chaveamento</h1>
        <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8">
          
          {/* SELETOR DE MODO */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setTipoGeracao("peso")}
              className={`flex-1 py-4 rounded-xl font-bold transition-all border ${
                tipoGeracao === "peso" ? "bg-[#57d8ff] border-[#57d8ff] text-black" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white"
              }`}
            >
              Categorias de Peso
            </button>
            <button
              onClick={() => setTipoGeracao("absoluto")}
              className={`flex-1 py-4 rounded-xl font-bold transition-all border ${
                tipoGeracao === "absoluto" ? "bg-yellow-500 border-yellow-500 text-black" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white"
              }`}
            >
              Absoluto Livre
            </button>
          </div>

          <label className="block mb-3 text-zinc-400">ID do Evento</label>
          <input value={eventoId} onChange={(e) => setEventoId(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl px-5 py-4" />
          
          <button onClick={gerarChaves} disabled={loading} className="w-full mt-8 bg-red-600 hover:bg-red-500 rounded-2xl py-5 font-black text-xl transition-all">
            {loading ? "Processando..." : `Gerar Chaves de ${tipoGeracao === 'peso' ? 'Peso' : 'Absoluto'}`}
          </button>
          
          {mensagem && <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5">{mensagem}</div>}
        </div>
      </div>
    </main>
  )
}