"use client";

import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { supabase } from '@/app/lib/supabase';
import { ADIAMENTO_AVISOS_MS, assinaturaCorresponde, deveConvidarAvisos } from '@/app/lib/avisos-celular';
import { assinaturaNesteAparelho, prepararRegistroAvisos } from '@/app/lib/avisos-navegador';

export default function AvisosCelular({ userId, role, ref }: { userId: string; role: string; ref?: Ref<{ abrir: () => void }> }) {
  const [visivel, setVisivel] = useState(false);
  const [ativando, setAtivando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [situacao, setSituacao] = useState<'conferindo' | 'ativo' | 'inativo' | 'bloqueado' | 'incompativel' | 'falha'>('conferindo');
  const [renovar, setRenovar] = useState(false);
  const [aguardarTeste, setAguardarTeste] = useState(false);
  useImperativeHandle(ref, () => ({ abrir: () => { setMensagem(''); setErro(''); setVisivel(true); } }), []);
  const chave = `itatame:avisos-adiados:${userId}`;

  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!userId || !['atleta', 'professor'].includes(role)) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) { setSituacao('incompativel'); return; }
    async function verificar(aposEspera = false) {
      try {
        let adiadoAte = 0;
        try { adiadoAte = Number(localStorage.getItem(chave)) || 0; } catch { /* Navegador sem armazenamento persistente. */ }
        const registro = await navigator.serviceWorker.getRegistration('/');
        const assinatura = await registro?.pushManager.getSubscription();
        let assinaturaNaConta = false;
        if (assinatura && Notification.permission === 'granted') {
          const [antigas,novas] = await Promise.all([supabase.from('assinaturas_push').select('subscription').eq('user_id', userId),supabase.from('push_dispositivos').select('subscription').eq('user_id',userId)]);
          if (antigas.error||novas.error) { if(ativo)setSituacao('falha'); return; }
          assinaturaNaConta = [...(antigas.data||[]),...(novas.data||[])].some(item => assinaturaCorresponde(item.subscription, assinatura.endpoint));
        }
        if (ativo) setSituacao(Notification.permission === 'denied' ? 'bloqueado' : assinaturaNaConta && !renovar ? 'ativo' : 'inativo');
        if (ativo && deveConvidarAvisos({ role, suportado: true, permissao: Notification.permission, assinaturaNoNavegador: Boolean(assinatura), assinaturaNaConta, adiadoAte })) {
          if (aposEspera) setVisivel(true);
          else timer = setTimeout(() => { if (ativo) void verificar(true); }, 7000);
        }
      } catch { if(ativo)setSituacao('falha'); }
    }
    void verificar();
    return () => { ativo = false; if (timer) clearTimeout(timer); };
  }, [userId, role, chave, visivel, renovar]);

  function adiar() {
    try { localStorage.setItem(chave, String(Date.now() + ADIAMENTO_AVISOS_MS)); } catch { /* Fecha mesmo sem armazenamento. */ }
    setVisivel(false);
  }

  async function ativar() {
    if (ativando || testando) return;
    setAtivando(true); setErro(''); setMensagem('');
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Este navegador não oferece avisos no celular. Use um navegador compatível ou o Itatame instalado na tela inicial.');
      if (Notification.permission === 'denied') { setSituacao('bloqueado'); throw new Error('Libere as notificações do iTatame nas configurações deste site no navegador. Confira também se o Android permite notificações do Chrome.'); }
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') throw new Error('Permita as notificações do Itatame para receber os avisos.');
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
      if (!vapid) throw new Error('Os avisos estão indisponíveis no momento. Tente mais tarde.');
      const registro = await prepararRegistroAvisos();
      const assinatura = await assinaturaNesteAparelho(registro, vapid, renovar);
      const { error } = await supabase.from('push_dispositivos').upsert({user_id:userId,endpoint:assinatura.endpoint,subscription:assinatura.toJSON(),atualizada_em:new Date().toISOString()},{onConflict:'user_id,endpoint'});
      if (error) throw error;
      setSituacao('ativo'); setRenovar(false);
      setMensagem('Ativação salva neste navegador. Toque em “Testar aviso neste aparelho” para conferir o recebimento.');
    } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível ativar os avisos. Tente novamente.'); }
    finally { setAtivando(false); }
  }

  async function testar() {
    if (testando || ativando || aguardarTeste || situacao !== 'ativo') return;
    setTestando(true); setErro(''); setMensagem('');
    try {
      if (Notification.permission !== 'granted') { setSituacao('bloqueado'); throw new Error('As notificações estão bloqueadas neste navegador. Libere os avisos antes de testar.'); }
      const registro = await prepararRegistroAvisos();
      const assinatura = await registro.pushManager.getSubscription();
      if (!assinatura) { setSituacao('inativo'); throw new Error('Ative os avisos neste navegador antes de testar.'); }
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error('Entre novamente na sua conta para testar.');
      const response = await fetch('/api/push/testar', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ confirmado: true, endpoint: assinatura.endpoint }), signal: AbortSignal.timeout(12000),
      });
      const r = await response.json();
      if (r.codigo === 'ASSINATURA_EXPIRADA') { setRenovar(true); setSituacao('inativo'); }
      if (response.status === 429) setAguardarTeste(true);
      if (!response.ok || !r.success) throw new Error(r.error || 'O teste não foi confirmado.');
      setAguardarTeste(true);
      setMensagem('Teste aceito pelo serviço de push para este aparelho. Confira a barra de notificações. Se não aparecer, verifique as permissões abaixo; a aceitação não confirma a exibição.');
    } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível testar agora.'); }
    finally { setTestando(false); }
  }

  useEffect(() => {
    if (!aguardarTeste) return;
    const timer = setTimeout(() => setAguardarTeste(false), 30000);
    return () => clearTimeout(timer);
  }, [aguardarTeste]);

  if (!visivel) return null;
  return (
    <aside role="region" aria-label="Avisos no celular" className="fixed bottom-4 left-4 right-4 z-[200] max-h-[80dvh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0a0a0e] p-4 shadow-2xl sm:left-auto sm:w-80">
      <button type="button" aria-label="Fechar avisos" onClick={adiar} disabled={ativando || testando} className="absolute right-3 top-2 p-2 text-zinc-400">×</button>
      <h2 className="pr-6 text-sm font-bold text-white">{situacao === 'ativo' ? 'Avisos neste aparelho' : 'Receber avisos no celular?'}</h2>
      <p className="mt-2 text-xs text-zinc-400">Ative os avisos de lutas e mensagens do campeonato neste navegador.</p>
      {situacao === 'ativo' && <p className="mt-2 text-xs text-green-300">Ativação cadastrada neste navegador.</p>}
      {situacao === 'conferindo' && <p className="mt-2 text-xs text-zinc-400">Conferindo a ativação deste navegador…</p>}
      {situacao === 'incompativel' && <p className="mt-2 text-xs text-amber-200">Este navegador não oferece avisos. No iPhone, abra o iTatame pelo ícone adicionado à Tela de Início.</p>}
      {situacao === 'falha' && <p className="mt-2 text-xs text-amber-200">Não foi possível conferir a ativação agora. Confira a conexão ou tente ativar novamente.</p>}
      {(situacao === 'ativo' || situacao === 'bloqueado') && <details className="mt-3 text-xs text-zinc-300"><summary className="cursor-pointer">O aviso não apareceu no Android?</summary><p className="mt-2">No Chrome, abra as configurações deste site e permita Notificações. No Android, abra Configurações → Apps → Chrome → Notificações e confira se os avisos estão permitidos. Os nomes podem variar por aparelho. Confira também a barra de notificações e o modo Não perturbe.</p></details>}
      {erro && <p role="alert" className="mt-2 text-xs text-red-300">{erro}</p>}
      {mensagem && <p role="status" className="mt-2 text-xs text-green-300">{mensagem}</p>}
      {situacao === 'ativo' && <button type="button" disabled={testando || ativando || aguardarTeste} onClick={() => void testar()} className="mt-3 min-h-11 w-full rounded-lg border border-cyan-400/40 px-3 py-2 text-xs font-bold text-cyan-200 disabled:opacity-50">{testando ? 'Solicitando teste…' : aguardarTeste ? 'Aguarde 30 segundos para outro teste' : 'Testar aviso neste aparelho'}</button>}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={ativando || testando} onClick={adiar} className="min-h-11 flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">{situacao === 'ativo' ? 'Fechar' : 'Agora não'}</button>
        {situacao !== 'ativo' && situacao !== 'incompativel' && <button type="button" disabled={ativando || testando} onClick={() => void ativar()} className="min-h-11 flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{ativando ? 'Ativando...' : renovar ? 'Reativar avisos' : 'Ativar avisos'}</button>}
      </div>
    </aside>
  );
}
