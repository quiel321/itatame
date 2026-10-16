import Link from 'next/link';
export default function CarregandoGaleria(){
 return <div data-fotos-shell className="min-h-screen bg-black text-white"><header className="flex h-20 items-center border-b border-white/10 px-5 md:px-8"><Link href="/fotos" aria-label="Página inicial da Retratt"><img src="/retratt/logo-white.svg" alt="Retratt" className="h-8 w-auto"/></Link></header><main aria-busy="true" aria-label="Abrindo galeria" className="mx-auto min-h-[80vh] max-w-7xl space-y-6 px-4 py-8 md:px-8">
  <p role="status" className="text-sm font-bold text-zinc-300">Abrindo galeria…</p>
  <div aria-hidden="true" className="h-44 animate-pulse rounded-3xl bg-white/5"/>
  <div aria-hidden="true" className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({length:8},(_,i)=><div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white/5"/>)}</div>
 </main></div>;
}
