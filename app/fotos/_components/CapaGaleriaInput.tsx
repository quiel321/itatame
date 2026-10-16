"use client";

import { useEffect, useRef, useState } from "react";
import { ACCEPT_FOTOS_RETRATT } from '@/app/lib/fotos-formatos';
import { comprimirCapaRetratt } from '@/app/lib/fotos-preparar';

export default function CapaGaleriaInput({ file, onChange, fallbackUrl, onPreparandoChange }: { file: File | null; onChange: (file: File | null) => void; fallbackUrl?: string | null; onPreparandoChange?: (valor:boolean)=>void }) {
  const previewRef = useRef<HTMLImageElement>(null);
  const [erro, setErro] = useState("");
  const [preparando,setPreparando]=useState(false);
  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : fallbackUrl;
    if (previewRef.current && url) previewRef.current.src = url;
    return () => { if (file && url) URL.revokeObjectURL(url); };
  }, [file, fallbackUrl]);
  return <div className="space-y-2 sm:col-span-2">
    <label className="block text-xs font-bold text-zinc-300">Capa da galeria (opcional)
      <input type="file" accept={ACCEPT_FOTOS_RETRATT} disabled={preparando} className="mt-2 block w-full rounded-xl border border-dashed border-white/15 p-3 text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:p-2 file:text-white" onChange={async(e) => {
        const nova = e.target.files?.[0];
        if (!nova) return;
        e.target.value = "";setErro("");setPreparando(true);onPreparandoChange?.(true);
        try{onChange(await comprimirCapaRetratt(nova));}
        catch(error){setErro(error instanceof Error?error.message:'Não foi possível preparar a capa.');}
        finally{setPreparando(false);onPreparandoChange?.(false);}
      }} />
    </label>
    <p className="text-[11px] text-zinc-500">Fotos e RAW, incluindo CR2, HEIC e TIFF, até 100 MB. Conversão automática para capa. Prefira uma imagem horizontal.</p>
    {preparando&&<p role="status" className="text-xs text-zinc-300">Preparando capa…</p>}
    {(file || fallbackUrl) && <img ref={previewRef} alt="Prévia da capa da galeria" className="aspect-[16/7] w-full rounded-xl object-cover" />}
    {file && <button type="button" onClick={() => { onChange(null); setErro(""); }} className="text-xs text-zinc-300 underline">Remover capa selecionada</button>}
    {erro && <p role="alert" className="text-xs text-red-400">{erro}</p>}
  </div>;
}
