"use client";

import type { OpcoesPublicacaoGaleria as Opcoes } from "@/app/lib/fotos-criacao-galeria";

export default function OpcoesPublicacaoGaleria({ value, onChange }: { value: Opcoes; onChange: (value: Opcoes) => void }) {
  return <fieldset className="space-y-3 rounded-2xl border border-white/10 p-4 sm:col-span-2">
    <legend className="px-2 text-xs font-bold text-white">Como a galeria será publicada</legend>
    <label className="block text-xs font-bold text-zinc-300">Visibilidade
      <select aria-label="Visibilidade" value={value.acessoPorLink ? "link" : "publica"} onChange={(e) => onChange({ ...value, acessoPorLink: e.target.value === "link" })} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs text-white">
        <option value="publica">Pública — aparece nas buscas e no perfil</option>
        <option value="link">Por link — acesso pelo link exclusivo</option>
      </select>
    </label>
    <label className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3 text-xs text-zinc-300">
      <input type="checkbox" className="mt-0.5 accent-orange-500" checked={value.emBreve} onChange={(e) => onChange({ ...value, emBreve: e.target.checked })} />
      <span><strong className="block text-white">Em breve</strong><span className="mt-1 block text-zinc-400">Divulgue a página enquanto prepara as mídias. Desative o aviso para exibi-las e iniciar as vendas.</span></span>
    </label>
    <label className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3 text-xs text-zinc-300">
      <input type="checkbox" className="mt-0.5 accent-orange-500" checked={value.downloadGratuito} onChange={(e) => onChange({ ...value, downloadGratuito: e.target.checked })} />
      <span><strong className="block text-white">Download gratuito</strong><span className="mt-1 block text-zinc-400">Libera fotos e vídeos originais sem pagamento para quem puder acessar a galeria.</span></span>
    </label>
    <p role="status" className="rounded-xl border border-retratt/20 bg-retratt/5 p-3 text-xs leading-relaxed text-orange-100">
      {value.acessoPorLink ? "Acesso pelo link exclusivo." : "Galeria pública."} {value.emBreve ? "As mídias ficarão ocultas pelo aviso “em breve”." : value.downloadGratuito ? "As mídias publicadas poderão ser baixadas gratuitamente." : "As mídias publicadas estarão disponíveis para compra."}
    </p>
  </fieldset>;
}
