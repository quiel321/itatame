"use client";

import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { supabase } from '@/app/lib/supabase';
import { ADIAMENTO_AVISOS_MS, assinaturaCorresponde, deveConvidarAvisos } from '@/app/lib/avisos-celular';

export default function AvisosCelular({ userId, role, ref }: { userId: string; role: string; ref?: Ref<{ abrir: () => void }> }) {
  const [visivel, setVisivel] = useState(false);
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState('');
  const [ativado, setAtivado] = useState(false);
  useImperativeHandle(ref, () => ({ abrir: () => setVisivel(true) }), []);
  const chave = `itatame:avisos-adiados:${userId}`;

  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!userId || !['atleta', 'professor'].includes(role) || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    async function verificar(aposEspera = false) {
      try {
        let adiadoAte = 0;
        try { adiadoAte = Number(localStorage.getItem(chave)) || 0; } catch { /* Navegador sem armazenamento persistente. */ }
        const registro = await navigator.serviceWorker.getRegistration('/');
        const assinatura = await registro?.pushManager.getSubscription();
        let assinaturaNaConta = false;
        if (assinatura && Notification.permission === 'granted') {
          const { data, error } = await supabase.from('assinaturas_push').select('subscription').eq('user_id', userId);
          if (error) return;
          assinaturaNaConta = (data || []).some(item => assinaturaCorresponde(item.subscription, assinatura.endpoint));
        }
        if (ativo && deveConvidarAvisos({ role, suportado: true, permissao: Notification.permission, assinaturaNoNavegador: Boolean(assinatura), assinaturaNaConta, adiadoAte })) {
          if (aposEspera) setVisivel(true);
          else timer = setTimeout(() => { if (ativo) void verificar(true); }, 7000);
        }
      } catch { /* Não interrompe o perfil quando o navegador não permite consultar push. */ }
    }
    void verificar();
    return () => { ativo = false; if (timer) clearTimeout(timer); };
  }, [userId, role, chave]);

  function adiar() {
    try { localStorage.setItem(chave, String(Date.now() + ADIAMENTO_AVISOS_MS)); } catch { /* Fecha mesmo sem armazenamento. */ }
    setVisivel(false);
  }

  async function ativar() {
    if (ativando) return;
    setAtivando(true); setErro('');
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Este navegador não oferece avisos no celular. Use um navegador compatível ou o Itatame instalado na tela inicial.');
      if (Notification.permission === 'denied') throw new Error('Libere as notificações nas configurações deste site no navegador e tente novamente.');
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') throw new Error('Permita as notificações do Itatame para receber os avisos.');
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
      if (!vapid) throw new Error('Os avisos estão indisponíveis no momento. Tente mais tarde.');
      await navigator.serviceWorker.register('/sw.js');
      const registro = await navigator.serviceWorker.ready;
      let assinatura = await registro.pushManager.getSubscription();
      if (!assinatura) {
        const base64 = (vapid + '='.repeat((4 - vapid.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
        assinatura = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(base64), char => char.charCodeAt(0)) });
      }
      const { data: existentes, error: erroBusca } = await supabase.from('assinaturas_push').select('id').eq('user_id', userId);
      if (erroBusca) throw erroBusca;
      const { error } = existentes?.length
        ? await supabase.from('assinaturas_push').update({ subscription: assinatura.toJSON() }).eq('user_id', userId)
        : await supabase.from('assinaturas_push').insert({ user_id: userId, subscription: assinatura.toJSON() });
      if (error) throw error;
      setAtivado(true); setVisivel(false);
    } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível ativar os avisos. Tente novamente.'); }
    finally { setAtivando(false); }
  }

  useEffect(() => {
    if (!ativado) return;
    const timer = setTimeout(() => setAtivado(false), 5000);
    return () => clearTimeout(timer);
  }, [ativado]);

  if (ativado) return <p role="status" className="fixed bottom-4 right-4 z-[200] max-w-sm rounded-xl border border-green-500/30 bg-[#0a0a0e] p-4 text-xs text-green-300">Avisos ativados neste navegador.</p>;
  if (!visivel) return null;
  return (
    <aside role="region" aria-label="Avisos no celular" className="fixed bottom-4 left-4 right-4 z-[200] rounded-2xl border border-white/15 bg-[#0a0a0e] p-4 shadow-2xl sm:left-auto sm:w-80">
      <button type="button" aria-label="Lembrar depois" onClick={adiar} disabled={ativando} className="absolute right-3 top-2 p-2 text-zinc-400">×</button>
      <h2 className="pr-6 text-sm font-bold text-white">Receber avisos no celular?</h2>
      <p className="mt-2 text-xs text-zinc-400">Ative os avisos de lutas e mensagens do campeonato neste navegador.</p>
      {erro && <p role="alert" className="mt-2 text-xs text-red-300">{erro}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={ativando} onClick={adiar} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">Agora não</button>
        <button type="button" disabled={ativando} onClick={() => void ativar()} className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{ativando ? 'Ativando...' : 'Ativar avisos'}</button>
      </div>
    </aside>
  );
}
