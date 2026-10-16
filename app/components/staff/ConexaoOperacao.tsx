'use client';

import { useEffect, useRef, useState } from 'react';
import { processarAvisosPendentes } from '@/app/lib/avisos-operacao-cliente';
import { supabase } from '@/app/lib/supabase';

export default function ConexaoOperacao() {
  const [estado, setEstado] = useState<'ok' | 'offline' | 'falha' | 'conferindo'>('ok');
  const conferirRef = useRef<() => void>(() => {});
  useEffect(() => {
    let encerrado = false;
    let emCurso = false;
    let precisaAtualizar = true;
    async function conferir() {
      if (emCurso || encerrado || document.visibilityState !== 'visible') return;
      if (!navigator.onLine) { setEstado('offline'); return; }
      emCurso = true;
      try {
        const { error } = await supabase.from('eventos').select('id').limit(1);
        if (encerrado) return;
        setEstado(error ? 'falha' : 'ok');
        if(!error)void processarAvisosPendentes().catch(()=>{});
        if (error) precisaAtualizar = true;
        else if (precisaAtualizar) {
          precisaAtualizar = false;
          window.dispatchEvent(new Event('itatame:conexao-restabelecida'));
        }
      } catch { precisaAtualizar = true; if (!encerrado) setEstado('falha'); }
      finally { emCurso = false; }
    }
    const retornar = () => {
      if (document.visibilityState !== 'visible') return;
      precisaAtualizar = true;
      void conferir();
    };
    const offline = () => { precisaAtualizar = true; setEstado('offline'); };
    conferirRef.current = () => { setEstado('conferindo'); void conferir(); };
    void conferir();
    const intervalo = window.setInterval(() => void conferir(), 15000);
    window.addEventListener('online', retornar);
    window.addEventListener('offline', offline);
    window.addEventListener('focus', retornar);
    window.addEventListener('pageshow', retornar);
    document.addEventListener('visibilitychange', retornar);
    return () => {
      encerrado = true;
      clearInterval(intervalo);
      window.removeEventListener('online', retornar);
      window.removeEventListener('offline', offline);
      window.removeEventListener('focus', retornar);
      window.removeEventListener('pageshow', retornar);
      document.removeEventListener('visibilitychange', retornar);
    };
  }, []);
  if (estado === 'ok') return null;
  return <div role="alert" className="relative z-[200] shrink-0 border-b border-amber-400/40 bg-amber-950 px-3 py-2 text-sm text-amber-100">
    <strong>{estado === 'offline' ? 'Aparelho sem internet.' : estado === 'conferindo' ? 'Conferindo conexão com o servidor…' : 'Conexão com o servidor interrompida.'}</strong>
    <p className="mt-1 text-xs">A reconexão é automática. Antes de continuar, confira se a última ação foi salva. Mantenha esta tela aberta.</p>
    <button type="button" disabled={estado === 'conferindo'} onClick={() => conferirRef.current()} className="mt-2 min-h-11 rounded-lg border border-amber-300/50 px-3 text-xs font-bold disabled:opacity-50">Tentar reconectar</button>
  </div>;
}
