'use client';
import {useId,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import {dataGaleriaValida,exibirDataGaleria,lerDataGaleria} from '@/app/lib/fotos-data';

export default function DataGaleriaInput({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const id=useId(),[tocou,setTocou]=useState(false);const invalida=!dataGaleriaValida(value);
 return <div>
  <div className="relative flex h-12 w-full rounded-xl border border-white/15 bg-black focus-within:border-retratt focus-within:ring-1 focus-within:ring-retratt/40">
   <input type="text" inputMode="numeric" autoComplete="off" placeholder="DD/MM/AAAA" maxLength={10} value={exibirDataGaleria(value)} onChange={e=>onChange(lerDataGaleria(e.target.value))} onBlur={()=>setTocou(true)} aria-label="Data do evento" aria-invalid={tocou&&invalida} aria-describedby={tocou&&invalida?id:undefined} className="h-full min-w-0 flex-1 rounded-l-xl bg-transparent px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-500"/>
   <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-r-xl border-l border-white/10 text-retratt focus-within:ring-2 focus-within:ring-retratt" title="Escolher data no calendário">
    <CalendarDays size={21} aria-hidden="true"/>
    <input type="date" value={dataGaleriaValida(value)?value:''} onChange={e=>{onChange(e.target.value);setTocou(false);}} aria-label="Escolher data no calendário" className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"/>
   </span>
  </div>
  {tocou&&invalida&&<p id={id} role="alert" className="mt-1 text-xs text-red-300">Informe uma data válida no formato DD/MM/AAAA.</p>}
 </div>;
}
