'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/app/lib/supabase';

type Mensagem = {
  id: string;
  remetente: 'atleta' | 'organizador';
  texto: string;
  criado_em: string;
};

export function ChatEvento({
  eventoId,
  atletaUserId,
  titulo = 'Falar com a organização',
  compacto = false,
  inicialAberto,
  onFechar,
}: {
  eventoId: string;
  atletaUserId?: string;
  titulo?: string;
  compacto?: boolean;
  inicialAberto?: boolean;
  onFechar?: () => void;
}) {
  const [aberto, setAberto] = useState(inicialAberto ?? !compacto);

  function fechar() {
    setAberto(false);
    onFechar?.();
  }
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [disponivel, setDisponivel] = useState(true);
  const fimRef = useRef<HTMLDivElement | null>(null);

  const carregar = useCallback(async () => {
    const { data: sessao } = await supabase.auth.getSession();
    const token = sessao.session?.access_token;
    if (!token) {
      setDisponivel(false);
      setErro('Entre na sua conta para falar com a organização.');
      return;
    }
    const url = atletaUserId
      ? `/api/eventos/${eventoId}/mensagens?atleta=${encodeURIComponent(atletaUserId)}`
      : `/api/eventos/${eventoId}/mensagens`;
    const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const dados = await resposta.json();
    if (!resposta.ok) {
      setDisponivel(false);
      setErro(dados.error || 'Chat indisponível.');
      return;
    }
    if (Array.isArray(dados.conversas) && !Array.isArray(dados.mensagens)) {
      setDisponivel(false);
      setErro('Para responder os atletas, abra Chat com atletas no painel do organizador.');
      return;
    }
    setDisponivel(true);
    setErro('');
    setMensagens(dados.mensagens || []);
  }, [atletaUserId, eventoId]);

  useEffect(() => {
    if (!aberto) return;
    void carregar();
    const timer = window.setInterval(() => { void carregar(); }, 8000);
    return () => window.clearInterval(timer);
  }, [aberto, carregar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length]);

  async function enviar() {
    const mensagem = texto.trim();
    if (!mensagem || enviando) return;
    setEnviando(true);
    setErro('');
    const { data: sessao } = await supabase.auth.getSession();
    const resposta = await fetch(`/api/eventos/${eventoId}/mensagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao.session?.access_token || ''}` },
      body: JSON.stringify({ texto: mensagem, atletaUserId }),
    });
    const dados = await resposta.json();
    setEnviando(false);
    if (!resposta.ok) {
      setErro(dados.error || 'Não foi possível enviar.');
      return;
    }
    setTexto('');
    setMensagens(atual => [...atual, dados.mensagem]);
  }

  if (compacto && !aberto) {
    return (
      <button onClick={() => setAberto(true)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] md:text-xs px-3 py-2.5 md:px-6 md:py-3.5 rounded-lg transition-all text-center flex-1 md:flex-none">
        Dúvidas com a organização
      </button>
    );
  }

  const painel = (
    <section className={compacto ? 'fixed inset-0 z-[80] bg-black/80 p-4 flex items-end sm:items-center justify-center' : 'rounded-2xl border border-white/10 bg-[#0a0a0e] overflow-hidden'}>
      {compacto && <button className="absolute inset-0 z-0" aria-label="Fechar chat" onClick={fechar} />}
      <div className={`relative z-10 w-full ${compacto ? 'max-w-md rounded-2xl border border-white/10 bg-[#0a0a0e] shadow-2xl' : ''}`}>
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-cyan-400">Chat do evento</p>
            <h2 className="text-sm font-black text-white">{titulo}</h2>
          </div>
          {compacto && <button onClick={fechar} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>}
        </header>
        <div className="h-72 overflow-y-auto p-4 space-y-2">
          {mensagens.length === 0 && disponivel && <p className="text-xs text-zinc-500">Nenhuma mensagem ainda. Envie sua dúvida sobre inscrição, categoria, peso ou checagem.</p>}
          {mensagens.map(msg => (
            <div key={msg.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.remetente === 'atleta' ? 'ml-auto bg-cyan-500/15 text-cyan-50' : 'bg-white/5 text-zinc-200'}`}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-zinc-500">{msg.remetente === 'atleta' ? 'Atleta' : 'Organização'}</p>
              <p className="whitespace-pre-wrap">{msg.texto}</p>
            </div>
          ))}
          <div ref={fimRef} />
        </div>
        {erro && <p className="px-4 pb-2 text-[11px] text-red-300">{erro}</p>}
        <form className="p-3 border-t border-white/10 flex gap-2" onSubmit={event => { event.preventDefault(); void enviar(); }}>
          <input
            value={texto}
            onChange={event => setTexto(event.target.value)}
            maxLength={2000}
            disabled={!disponivel}
            placeholder={disponivel ? 'Escreva sua mensagem...' : 'Chat ainda não ativado'}
            className="flex-1 bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400 disabled:opacity-50"
          />
          <button disabled={enviando || !texto.trim() || !disponivel} className="rounded-xl bg-cyan-500 text-black px-4 text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
            Enviar
          </button>
        </form>
      </div>
    </section>
  );

  if (compacto && typeof document !== 'undefined') {
    return createPortal(painel, document.body);
  }
  return painel;
}
