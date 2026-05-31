"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function AdminInscricoesPage() {

  const [inscricoes, setInscricoes] = useState<any[]>([])
  const [filtroFaixa, setFiltroFaixa] = useState("")
const [filtroCategoria, setFiltroCategoria] = useState("")
const [filtroNome, setFiltroNome] = useState("")
const [filtroEquipe, setFiltroEquipe] = useState("")

  useEffect(() => {

    async function carregarInscricoes() {

      const { data, error } = await supabase
        .from("inscricoes")
        .select("*")
        .order("id", { ascending: false })

      if (error) {
        console.log(error)

       
        
        return
      }

      setInscricoes(data || [])

    }

    carregarInscricoes()

  }, [])

   const inscricoesFiltradas = inscricoes.filter((item) => {

 const faixaOk =
  filtroFaixa === "" ||
  item.faixa === filtroFaixa

const categoriaOk =
  filtroCategoria === "" ||
  item.categoria === filtroCategoria

const nomeOk =
  item.atleta
    ?.toLowerCase()
    .includes(filtroNome.toLowerCase())

    const equipeOk =
  filtroEquipe === "" ||
  item.equipe === filtroEquipe

return faixaOk && categoriaOk && nomeOk && equipeOk

})

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">

      <div className="max-w-7xl mx-auto">

        <h1 className="text-5xl font-black mb-10">
          Painel de Inscrições
        </h1>
   <div className="flex gap-4 mb-8">

  <input
  type="text"
  placeholder="Buscar atleta..."
  value={filtroNome}
  onChange={(e) => setFiltroNome(e.target.value)}
  className="bg-zinc-950 border border-white/10 rounded-2xl px-4 py-3 w-72"
/>

  <select

    value={filtroFaixa}
    onChange={(e) => setFiltroFaixa(e.target.value)}
    className="bg-zinc-950 border border-white/10 rounded-2xl px-4 py-3"
  >
    <option value="">Todas as Faixas</option>
    <option>Branca</option>
    <option>Azul</option>
    <option>Roxa</option>
    <option>Marrom</option>
    <option>Preta</option>
  </select>

  <select
    value={filtroCategoria}
    onChange={(e) => setFiltroCategoria(e.target.value)}
    className="bg-zinc-950 border border-white/10 rounded-2xl px-4 py-3"
  >
    <option value="">Todas Categorias</option>

    <option>Pluma (Até 64.500 kg)</option>

    <option>Leve (Até 72.500 kg)</option>

    <option>Meio Pesado (Até 80.000 kg)</option>

    <option>Super Pesado (Até 85.500 kg)</option>

    <option>Pesadíssimo (Acima de 85.5 kg)</option>

  </select>

  <select
  value={filtroEquipe}
  onChange={(e) => setFiltroEquipe(e.target.value)}
  className="bg-zinc-950 border border-white/10 rounded-2xl px-4 py-3"
>
  <option value="">Todas Equipes</option>

  <option>Legado</option>
  <option>Alliance</option>
  <option>Gracie Barra</option>
  <option>Atos</option>

</select>

</div>
        <div className="overflow-x-auto border border-white/10 rounded-3xl">

          <table className="w-full">

            <thead className="bg-zinc-950">

              <tr className="text-left">

                <th className="p-5">Atleta</th>
                <th className="p-5">Equipe</th>
                <th className="p-5">Faixa</th>
                <th className="p-5">Categoria</th>
                <th className="p-5">Peso</th>
                <th className="p-5">Idade</th>

              </tr>

            </thead>

            <tbody>

              {inscricoesFiltradas.map((item, index) => (

                <tr
                  key={index}
                  className="border-t border-white/10 hover:bg-white/5 transition-all"
                >

                  <td className="p-5 font-bold">
                    {item.atleta}
                  </td>

                  <td className="p-5">
                    {item.equipe}
                  </td>

                  <td className="p-5">
                    {item.faixa}
                  </td>

                  <td className="p-5">
                    {item.categoria}
                  </td>

                  <td className="p-5">
                    {item.peso}kg
                  </td>

                  <td className="p-5">
                    {item.idade}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

    </main>
  )
}