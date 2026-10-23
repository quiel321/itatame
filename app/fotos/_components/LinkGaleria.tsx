'use client';
import Link from '@/app/fotos/_components/LinkFotos';
import {useState,useSyncExternalStore,type ComponentProps} from 'react';
import {destinoGaleriaRetratt} from '@/app/lib/fotos-navegacao';
const escutar=()=>()=>{};
const hostAtual=()=>window.location.hostname;
const hostServidor=()=>'';

export default function LinkGaleria({href,prefetch,onPointerEnter,onPointerLeave,onPointerDown,onFocus,onBlur,...props}:Omit<ComponentProps<typeof Link>,'href'>&{href:string}){
 const host=useSyncExternalStore(escutar,hostAtual,hostServidor),[anteciparCompleto,setAnteciparCompleto]=useState(false);
 const destino=destinoGaleriaRetratt(href,host);
 function antecipar(){
  if(prefetch!==false)setAnteciparCompleto(true);
 }
 return <Link {...props} href={destino} prefetch={prefetch===false?false:anteciparCompleto?true:prefetch??null} onPointerEnter={e=>{onPointerEnter?.(e);antecipar();}} onPointerLeave={e=>{onPointerLeave?.(e);setAnteciparCompleto(false);}} onPointerDown={e=>{onPointerDown?.(e);antecipar();}} onFocus={e=>{onFocus?.(e);antecipar();}} onBlur={e=>{onBlur?.(e);setAnteciparCompleto(false);}}/>;
}
