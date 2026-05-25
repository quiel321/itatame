export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* HERO */}
      <section className="flex flex-col items-center justify-center text-center py-32 px-6">
        <h1 className="text-6xl font-extrabold mb-6">
          iTatame
        </h1>

        <p className="text-gray-400 text-xl max-w-2xl mb-8">
          Plataforma moderna para inscrições, gerenciamento e
          chaveamento de campeonatos de luta.
        </p>

        <button className="bg-red-600 hover:bg-red-700 transition px-8 py-4 rounded-xl text-lg font-semibold">
          Criar Campeonato
        </button>
      </section>

      {/* CARDS */}
      <section className="grid md:grid-cols-3 gap-6 px-8 pb-20">
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <h2 className="text-2xl font-bold mb-4">
            Inscrições Online
          </h2>

          <p className="text-gray-400">
            Gerencie atletas, categorias e inscrições de forma simples.
          </p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <h2 className="text-2xl font-bold mb-4">
            Chaveamento Automático
          </h2>

          <p className="text-gray-400">
            Gere brackets automaticamente para seus campeonatos.
          </p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <h2 className="text-2xl font-bold mb-4">
            Resultados em Tempo Real
          </h2>

          <p className="text-gray-400">
            Atualize lutas e acompanhe resultados ao vivo.
          </p>
        </div>
      </section>
    </main>
  );
}
