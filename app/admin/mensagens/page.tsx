'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { CompeticaoShell, useEventoCompeticao } from '../_components/CompeticaoShell';
import { ChatEvento } from '@/app/components/ChatEvento';

type Conversa = { atleta_user_id: string; nome: string; texto: string; ultima: string; naoLidas: number };

export default function MensagensOrganizadorPage() {
  const contexto = useEventoCompeticao();
  return (
    <CompeticaoShell titulo="Chat com atletas" descricao="Responda dúvidas de inscrição, categoria, peso e checagem sem sair do painel." contexto={contexto}>
      <Editor eventoId={contexto.eventoId} />
    </CompeticaoShell>
  );
}

function Editor({ eventoId }: { eventoId: string }) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [ativa, setAtiva] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data: sessao } = await supabase.auth.getSession();
      const resposta = await fetch(`/api/eventos/${eventoId}/mensagens`, {
        headers: { Authorization: `Bearer ${sessao.session?.access_token || ''}` },
      });
      const dados = await resposta.json();
      if (!ativo) return;
      if (!resposta.ok) {
        setErro(dados.error || 'Chat ainda não está disponível.');
        setConversas([]);
        return;
      }
      setErro('');
      setConversas(dados.conversas || []);
    }
    void carregar();
    const timer = window.setInterval(() => { void carregar(); }, 10000);
    const ouvir = () => { void carregar(); };
    window.addEventListener('itatame-chat-atualizado', ouvir);
    return () => { ativo = false; window.clearInterval(timer); window.removeEventListener('itatame-chat-atualizado', ouvir); };
  }, [eventoId]);

  const selecionada = conversas.find(item => item.atleta_user_id === ativa);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-2xl border border-white/10 bg-black/30 p-3">
        <p className="px-2 pb-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Conversas</p>
        {conversas.length === 0 && <p className="px-2 text-xs text-zinc-500">Nenhum atleta escreveu ainda.</p>}
        <div className="space-y-1">
          {conversas.map(conversa => (
            <button
              key={conversa.atleta_user_id}
              onClick={() => {
                setAtiva(conversa.atleta_user_id);
                setConversas(atual => atual.map(item => item.atleta_user_id === conversa.atleta_user_id ? { ...item, naoLidas: 0 } : item));
              }}
              className={`w-full rounded-xl px-3 py-3 text-left ${ativa === conversa.atleta_user_id ? 'bg-red-500/10 border border-red-500/30' : 'hover:bg-white/5'}`}
            >
              <span className="flex items-center justify-between gap-2">
                <strong className="text-sm text-white truncate">{conversa.nome}</strong>
                {conversa.naoLidas > 0 && <span className="rounded-full bg-red-500 text-white text-[9px] font-black px-2 py-0.5">{conversa.naoLidas}</span>}
              </span>
              <span className="mt-1 block text-[11px] text-zinc-500 truncate">{conversa.texto}</span>
              {conversa.ultima && <span className="mt-1 block text-[9px] text-zinc-600">{new Date(conversa.ultima).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
            </button>
          ))}
        </div>
      </aside>
      <div>
        {erro && <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">{erro}</p>}
        {ativa ? (
          <ChatEvento key={ativa} eventoId={eventoId} atletaUserId={ativa} titulo={selecionada?.nome || 'Atleta'} />
        ) : (
          <p className="text-sm text-zinc-500">Escolha uma conversa para responder.</p>
        )}
      </div>
    </div>
  );
}
