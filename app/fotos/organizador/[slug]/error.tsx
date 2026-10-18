'use client';
import FotosShell from '../../_components/FotosShell';

export default function ErroPortfolio({ reset }: { reset: () => void }) {
  return <FotosShell><main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-5 py-12 text-center text-white"><h1 className="text-xl font-bold">Não foi possível carregar esta página agora.</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Tente novamente em alguns instantes. Suas compras continuam disponíveis em Minhas fotos.</p><button type="button" onClick={reset} className="mt-6 min-h-11 rounded-xl bg-retratt px-5 text-xs font-bold text-black">Tentar novamente</button></main></FotosShell>;
}
