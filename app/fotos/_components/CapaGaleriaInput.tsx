"use client";

import { useEffect, useRef, useState } from "react";

export default function CapaGaleriaInput({ file, onChange, fallbackUrl }: { file: File | null; onChange: (file: File | null) => void; fallbackUrl?: string | null }) {
  const previewRef = useRef<HTMLImageElement>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : fallbackUrl;
    if (previewRef.current && url) previewRef.current.src = url;
    return () => { if (file && url) URL.revokeObjectURL(url); };
  }, [file, fallbackUrl]);
  return <div className="space-y-2 sm:col-span-2">
    <label className="block text-xs font-bold text-zinc-300">Capa da galeria (opcional)
      <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full rounded-xl border border-dashed border-white/15 p-3 text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:p-2 file:text-white" onChange={(e) => {
        const nova = e.target.files?.[0];
        if (!nova) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(nova.type) || nova.size > 10 * 1024 * 1024) { setErro("Use JPG, PNG ou WebP de até 10 MB."); e.target.value = ""; return; }
        setErro(""); onChange(nova); e.target.value = "";
      }} />
    </label>
    <p className="text-[11px] text-zinc-500">JPG, PNG ou WebP até 10 MB. Prefira uma imagem horizontal.</p>
    {(file || fallbackUrl) && <img ref={previewRef} alt="Prévia da capa da galeria" className="aspect-[16/7] w-full rounded-xl object-cover" />}
    {file && <button type="button" onClick={() => { onChange(null); setErro(""); }} className="text-xs text-zinc-300 underline">Remover capa selecionada</button>}
    {erro && <p role="alert" className="text-xs text-red-400">{erro}</p>}
  </div>;
}
