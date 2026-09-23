import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CirclePlay } from "lucide-react";
import TutorialVideoCard from "../components/TutorialVideoCard";
import { canalItatame, tutoriais } from "../lib/tutoriais";

export const metadata: Metadata = {
  title: "Tutoriais | iTatame",
  description: "Aprenda a cadastrar professor, atleta, menor, equipe e academia, e a fazer inscrições em campeonatos pelo iTatame.",
  openGraph: {
    title: "Tutoriais do iTatame",
    description: "Passo a passo em vídeo para começar a usar o iTatame e participar de campeonatos.",
    images: ["/tutoriais/01-professor.jpg"],
  },
};

export default function TutoriaisPage() {
  return (
    <main className="min-h-screen bg-[#020202] px-4 pb-20 pt-12 text-white sm:px-6 md:pt-16">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 transition hover:text-white">
          <ArrowLeft size={15} /> Voltar ao início
        </Link>

        <div className="mt-10 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
            <CirclePlay size={15} /> Aprenda com o iTatame
          </span>
          <h1 className="mt-5 text-3xl font-black uppercase tracking-tight sm:text-4xl md:text-5xl">
            Tutoriais <span className="text-red-500">em vídeo</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Siga os vídeos na ordem ou escolha o assunto que você precisa. Cada capa abre o tutorial correspondente no nosso canal do YouTube.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:gap-6">
          {tutoriais.map((tutorial) => <TutorialVideoCard key={tutorial.numero} tutorial={tutorial} />)}
        </div>

        <a href={canalItatame} target="_blank" rel="noopener noreferrer" className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#101013] p-5 transition hover:border-red-500/35 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <span className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white"><CirclePlay size={24} /></span>
            <span>
              <strong className="block text-sm font-black text-white">iTatame Sistemas no YouTube</strong>
              <span className="mt-1 block text-xs text-zinc-400">Acompanhe novos tutoriais e novidades da plataforma.</span>
            </span>
          </span>
          <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-400">Acessar canal <ArrowUpRight size={16} /></span>
        </a>
      </div>
    </main>
  );
}
