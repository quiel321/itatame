"use client";

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import MercadoPagoConnectButton from '@/app/admin/_components/MercadoPagoConnectButton';

export type EstadoConexaoMP = 'verificando' | 'conectado' | 'pendente' | 'erro';

export default function ConexaoMercadoPagoObrigatoria({ estado, onVerificar, onSair }: {
  estado: EstadoConexaoMP; onVerificar: () => void; onSair: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento || estado === 'conectado') return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    elemento.showModal();
    return () => { elemento.close(); document.body.style.overflow = overflowAnterior; };
  }, [estado]);

  function manterFoco(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const botoes = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const primeiro = botoes[0], ultimo = botoes.at(-1);
    if (event.shiftKey && document.activeElement === primeiro && ultimo) { event.preventDefault(); ultimo.focus(); }
    else if (!event.shiftKey && document.activeElement === ultimo && primeiro) { event.preventDefault(); primeiro.focus(); }
  }

  if (estado === 'conectado') return null;
  const pendente = estado === 'pendente';
  return <dialog ref={dialogo} aria-modal="true" aria-labelledby="conexao-mp-titulo" aria-describedby="conexao-mp-descricao" onCancel={event => event.preventDefault()} onKeyDown={manterFoco} className="fixed inset-0 m-auto max-h-[90dvh] w-full overflow-y-auto rounded-3xl border border-retratt/40 bg-[#0a0a0e] p-6 text-white shadow-2xl backdrop:bg-black/85 backdrop:backdrop-blur-sm sm:p-8" style={{ maxWidth: 'min(32rem, calc(100vw - 2rem))' }}>
    <span aria-hidden="true" className="mb-5 inline-flex rounded-2xl bg-retratt/15 p-3 text-retratt"><Wallet size={28} /></span>
    <h2 id="conexao-mp-titulo" className="text-xl font-black leading-tight">{pendente ? 'Conecte o Mercado Pago para continuar' : estado === 'erro' ? 'Precisamos conferir sua conexão' : 'Verificando Mercado Pago'}</h2>
    <p id="conexao-mp-descricao" className="mt-3 text-sm leading-relaxed text-zinc-300">{pendente ? 'Vincule sua conta Mercado Pago à Retratt para receber as vendas das galerias no modelo Diária. A conexão é obrigatória para continuar neste painel.' : estado === 'erro' ? 'Não foi possível confirmar se sua conta está conectada. Confira sua internet e tente verificar novamente.' : 'Aguarde enquanto conferimos a conta de recebimento deste organizador.'}</p>
    {pendente && <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm leading-relaxed text-amber-100"><strong>Diária só fica salva após a conexão.</strong><p className="mt-2">Depois de autorizar no Mercado Pago, você volta ao painel. Selecione Diária e salve para cada fotógrafo que vai usar esse modelo.</p></div>}
    <div className="mt-6 flex flex-col gap-3">
      {pendente && <MercadoPagoConnectButton conectado={false} perfil="organizador_fotos" returnTo="/fotos/admin" className="min-h-12 w-full rounded-xl bg-retratt px-5 py-3 text-sm font-black text-white" />}
      {estado === 'verificando' ? <p role="status" className="flex items-center gap-2 text-sm text-zinc-300"><Loader2 size={18} className="animate-spin" /> Conferindo conexão…</p> : <button type="button" onClick={onVerificar} className="min-h-11 rounded-xl border border-white/20 px-4 py-3 text-sm font-bold hover:bg-white/5">{pendente ? 'Já conectei: verificar novamente' : 'Tentar verificar novamente'}</button>}
      <button type="button" onClick={onSair} className="min-h-11 px-4 py-2 text-sm text-zinc-400 underline underline-offset-4 hover:text-white">Sair da conta</button>
    </div>
  </dialog>;
}
