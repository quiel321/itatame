import { faixaAplicavel, type FaixaDesconto } from "@/app/lib/fotos-descontos";

export default function ProgressoDesconto({ faixas, quantidade }: { faixas: FaixaDesconto[]; quantidade: number }) {
  if (!faixas.length) return null;

  const atual = faixaAplicavel(faixas, quantidade);
  const proxima = faixas.find((faixa) => faixa.quantidade > quantidade);
  const meta = faixas.at(-1)!.quantidade;
  const progresso = Math.min(100, Math.round(quantidade / meta * 100));

  return <div className="rounded-xl border border-sky-300/20 bg-sky-50 p-3 text-slate-900">
    <p className="text-xs font-bold">
      {proxima ? <><strong>Mais {proxima.quantidade - quantidade} {proxima.quantidade - quantidade === 1 ? "foto" : "fotos"}</strong> para {proxima.percentual}% de desconto</> : <>Você alcançou {atual?.percentual}% de desconto!</>}
    </p>
    <p className="mt-0.5 text-[10px] text-slate-600">{quantidade} {quantidade === 1 ? "foto selecionada" : "fotos selecionadas"} da mesma galeria e fotógrafo</p>
    <div className="relative mt-3 h-2 rounded-full bg-sky-200" role="progressbar" aria-label="Progresso do desconto" aria-valuenow={Math.min(quantidade, meta)} aria-valuemin={0} aria-valuemax={meta}>
      <div className="h-full rounded-full bg-sky-500 transition-all duration-300" style={{ width: `${progresso}%` }} />
      {faixas.map((faixa) => <span key={faixa.quantidade} className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${quantidade >= faixa.quantidade ? "border-sky-600 bg-sky-600" : "border-sky-500 bg-white"}`} style={{ left: `${faixa.quantidade / meta * 100}%` }} />)}
    </div>
    <div className="mt-2 flex justify-between gap-1 text-[9px] font-bold text-sky-700">
      {faixas.map((faixa) => <span key={faixa.quantidade}>{faixa.percentual}% · {faixa.quantidade} fotos</span>)}
    </div>
  </div>;
}
