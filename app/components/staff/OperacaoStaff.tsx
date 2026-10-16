'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, LogOut, Megaphone, LockKeyhole } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import { lerSessaoStaff, type SessaoStaff } from '@/app/lib/staff-sessao';
import RecepcaoOperacao from './RecepcaoOperacao';
import ChamadorOperacao from './ChamadorOperacao';
import ConexaoOperacao from './ConexaoOperacao';

type Aba = 'recepcao' | 'chamada';
export default function OperacaoStaff({ inicial = 'recepcao' }: { inicial?: Aba }) {
  const router = useRouter();
  const [sessao, setSessao] = useState<SessaoStaff | null>(null);
  const [aba, setAba] = useState<Aba>(inicial);
  const [erro, setErro] = useState('');
  const conteudo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelado = false;
    let validando = false;
    document.body.classList.add('hide-global-nav');
    async function validar() {
      if (validando || cancelado) return;
      validando = true;
      try {
      const salva = lerSessaoStaff();
      if (!salva?.pin) { router.replace('/staff/login'); return; }
      const { data, error } = await supabase.rpc('vincular_sessao_staff', { p_pin: salva.pin });
      if (cancelado) return;
      if (error || !data || !['checkin', 'chamador', 'operacao'].includes(data.funcao)) {
        setErro('Não foi possível validar o posto. Confira a conexão. Se o PIN foi revogado, entre novamente.'); return;
      }
      const validada = { ...salva, id: data.staff_id, evento_id: data.evento_id, funcao: data.funcao, identificacao: data.identificacao, evento_nome: data.evento_nome };
      localStorage.setItem('itatame_staff_session', JSON.stringify(validada));
      setAba(atual => data.funcao === 'checkin' ? 'recepcao' : data.funcao === 'chamador' ? 'chamada' : atual);
      setSessao(validada);
      setErro('');
      } finally { validando = false; }
    }
    const tentarValidar = () => { void validar().catch(() => { if (!cancelado) setErro('Não foi possível validar o posto. Aguardando reconexão.'); }); };
    tentarValidar();
    window.addEventListener('itatame:conexao-restabelecida', tentarValidar);
    return () => { cancelado = true; window.removeEventListener('itatame:conexao-restabelecida', tentarValidar); document.body.classList.remove('hide-global-nav'); };
  }, [router, inicial]);
  const recepcao = sessao?.funcao === 'checkin' || sessao?.funcao === 'operacao';
  const chamada = sessao?.funcao === 'chamador' || sessao?.funcao === 'operacao';
  async function sair() {
    localStorage.removeItem('itatame_staff_session');
    document.cookie = 'itatame_staff_access=; Path=/; Max-Age=0; SameSite=Lax';
    await supabase.auth.signOut(); router.replace('/staff/login');
  }
  return <div className="fixed inset-x-0 bottom-0 top-0 z-[100] flex flex-col overflow-hidden bg-[#050505] text-white">
    <ConexaoOperacao />
    <style>{`.hide-global-nav .nav-global-mobile, .hide-global-nav > header, .hide-global-nav > nav, .hide-global-nav footer { display:none!important; }`}</style>
    <header className="shrink-0 border-b border-white/10 bg-black px-3 py-2 sm:px-5">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-black">Operação do campeonato</p><p className="truncate text-[11px] text-zinc-400">{sessao ? `${sessao.evento_nome || 'Evento'} · ${sessao.identificacao}` : 'Validando seu posto…'}</p></div>
        <button onClick={() => void sair()} aria-label="Sair do posto" className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs"><LogOut size={15} /> Sair</button>
      </div>
      {sessao && <div role="tablist" aria-label="Etapas da operação" className="mx-auto mt-2 grid max-w-7xl grid-cols-2 gap-2">
        {([{ id: 'recepcao', titulo: 'Recepção / Pesagem', permitido: recepcao, Icone: ClipboardCheck }, { id: 'chamada', titulo: 'Chamada / Tatames', permitido: chamada, Icone: Megaphone }] as const).map(({ id, titulo, permitido, Icone }) => <button key={id} id={`aba-${id}`} role="tab" aria-selected={aba === id} aria-controls={`painel-${id}`} disabled={!permitido} onClick={() => { setAba(id); conteudo.current?.scrollTo({ top: 0 }); }} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold sm:text-sm ${aba === id ? 'bg-red-600 text-white' : 'bg-white/5 text-zinc-300'} disabled:opacity-40`}><Icone size={16} />{titulo}{!permitido && <LockKeyhole size={12} />}</button>)}
      </div>}
    </header>
    <div ref={conteudo} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      {erro && <div role="alert" className="m-4 rounded-xl border border-red-500/40 p-4 text-sm text-red-200">{erro}<button onClick={() => router.replace('/staff/login')} className="mt-3 block min-h-11 rounded-lg bg-red-600 px-4 text-white">Entrar com PIN</button></div>}
      {sessao && <>
        {sessao.funcao !== 'operacao' && <p className="mx-auto max-w-7xl px-3 pt-3 text-xs text-zinc-400">Seu PIN permite {recepcao ? 'recepção e pesagem' : 'chamada e tatames'}. Para trabalhar nas duas etapas, peça um PIN de Operação completa ao organizador.</p>}
        {recepcao && <div id="painel-recepcao" role="tabpanel" aria-labelledby="aba-recepcao" hidden={aba !== 'recepcao'}><RecepcaoOperacao ativa={aba === 'recepcao'} /></div>}
        {chamada && <div id="painel-chamada" role="tabpanel" aria-labelledby="aba-chamada" hidden={aba !== 'chamada'}><ChamadorOperacao /></div>}
      </>}
    </div>
  </div>;
}
