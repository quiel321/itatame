import Image from "next/image";
import { ArrowUpRight, Play } from "lucide-react";
import type { Tutorial } from "../lib/tutoriais";

export default function TutorialVideoCard({ tutorial }: { tutorial: Tutorial }) {
  return (
    <a
      href={tutorial.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Assistir ao tutorial ${tutorial.numero}: ${tutorial.titulo} no YouTube (abre em nova aba)`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101013] transition duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_18px_50px_rgba(0,0,0,0.4)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500"
    >
      <div className="relative aspect-video overflow-hidden bg-zinc-900">
        <Image
          src={tutorial.capa}
          alt={`Capa do tutorial ${tutorial.numero}: ${tutorial.titulo}`}
          width={960}
          height={540}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 600px"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] group-hover:brightness-75"
        />
        <span className="absolute bottom-3 left-3 rounded-md border border-white/20 bg-black/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-sm">
          Tutorial {tutorial.numero}
        </span>
        <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_8px_30px_rgba(220,38,38,0.45)] transition duration-300 group-hover:scale-110 group-hover:bg-red-500" aria-hidden="true">
          <Play size={23} fill="currentColor" className="ml-1" />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-black uppercase leading-snug tracking-tight text-white transition group-hover:text-red-400 sm:text-lg">
          {tutorial.titulo}
        </h3>
        <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-400">{tutorial.resumo}</p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-red-400">
          Assistir no YouTube <ArrowUpRight size={14} />
        </span>
      </div>
    </a>
  );
}
