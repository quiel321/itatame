import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import FotosShell from "./FotosShell";

type SecaoLegal = {
  titulo: string;
  paragrafos?: string[];
  itens?: string[];
};

export default function FotosLegalPage({
  etiqueta,
  titulo,
  introducao,
  secoes,
}: {
  etiqueta: string;
  titulo: string;
  introducao: string;
  secoes: SecaoLegal[];
}) {
  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] px-4 py-16 text-white md:px-6 md:py-24">
        <div className="mx-auto max-w-4xl">
          <Link href="/fotos" className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500 transition-colors hover:text-white">
            <ArrowLeft size={14} /> Voltar ao Itatame Fotos
          </Link>

          <header className="mt-8 border-b border-white/10 pb-10">
            <span className="text-[9px] font-black uppercase tracking-[0.24em] text-red-500">{etiqueta}</span>
            <h1 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-4xl md:text-6xl">{titulo}</h1>
            <p className="mt-5 max-w-3xl text-xs font-medium leading-7 text-zinc-400 md:text-sm">{introducao}</p>
            <p className="mt-5 text-[9px] font-black uppercase tracking-widest text-zinc-600">Última atualização: 14 de julho de 2026</p>
          </header>

          <div className="mt-10 space-y-5">
            {secoes.map((secao, index) => (
              <section key={secao.titulo} className="rounded-2xl border border-white/5 bg-[#0a0a0e] p-5 md:p-8">
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 text-[10px] font-black text-red-500">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-black uppercase tracking-wide md:text-lg">{secao.titulo}</h2>
                    {secao.paragrafos?.map((paragrafo) => (
                      <p key={paragrafo} className="mt-4 text-[11px] font-medium leading-6 text-zinc-400 md:text-xs">{paragrafo}</p>
                    ))}
                    {secao.itens && (
                      <ul className="mt-4 space-y-3">
                        {secao.itens.map((item) => (
                          <li key={item} className="flex gap-3 text-[11px] font-medium leading-6 text-zinc-400 md:text-xs">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>

          <aside className="mt-8 flex flex-col items-center justify-between gap-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 text-center sm:flex-row sm:text-left md:p-7">
            <div>
              <p className="text-sm font-black uppercase">Ainda ficou com alguma dúvida?</p>
              <p className="mt-1 text-[10px] font-medium text-zinc-500 md:text-xs">Nossa equipe atende pelo WhatsApp no número (65) 99305-9729.</p>
            </div>
            <a
              href="https://wa.me/5565993059729?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20no%20Itatame%20Fotos."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 text-[9px] font-black uppercase tracking-widest text-black transition-colors hover:bg-emerald-400 sm:w-auto"
            >
              <MessageCircle size={15} /> Falar com o suporte
            </a>
          </aside>
        </div>
      </main>
    </FotosShell>
  );
}
