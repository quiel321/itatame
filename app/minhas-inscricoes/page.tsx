"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function MinhasInscricoesPage() {

  const [inscricoes, setInscricoes] = useState<any[]>([])

  useEffect(() => {

    async function carregarInscricoes() {

      const { data: authData } = await supabase.auth.getUser()

      const user = authData.user

      if (!user) return

      const { data, error } = await supabase
        .from("inscricoes")
        .select("*")
        .eq("user_id", user.id)
        .order("id", { ascending: false })

      if (error) {
        console.log(error)
        return
      }

      setInscricoes(data || [])

    }

    carregarInscricoes()

  }, [])

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">

      <div className="max-w-5xl mx-auto">

        <h1 className="text-5xl font-black mb-10">
          Minhas Inscrições
        </h1>

        <div className="space-y-6">

          {inscricoes.map((item, index) => (

            <div
              key={index}
              className="bg-zinc-950 border border-white/10 rounded-3xl p-6"
            >

              <h2 className="text-2xl font-black mb-4">
                Evento #{item.evento_id}
              </h2>

              <div className="grid md:grid-cols-2 gap-4 text-zinc-300">

                <div>
                  <span className="text-zinc-500">
                    Categoria
                  </span>

                  <p className="text-white font-bold">
                    {item.categoria}
                  </p>
                </div>

                <div>
                  <span className="text-zinc-500">
                    Faixa
                  </span>

                  <p className="text-white font-bold">
                    {item.faixa}
                  </p>
                </div>

                <div>
                  <span className="text-zinc-500">
                    Peso
                  </span>

                  <p className="text-white font-bold">
                    {item.peso}kg
                  </p>
                </div>

                <div>
                  <span className="text-zinc-500">
                    Idade
                  </span>

                  <p className="text-white font-bold">
                    {item.idade}
                  </p>
                </div>

              </div>

            </div>

          ))}

        </div>

      </div>

    </main>
  )
}