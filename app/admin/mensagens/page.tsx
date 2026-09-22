'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { CompeticaoShell, useEventoCompeticao } from '../_components/CompeticaoShell';
import { ChatEvento } from '@/app/components/ChatEvento';
import { MENSAGEM_PEDIR_VINCULO } from '@/app/lib/vinculo-inscricao';

type Conversa = { atleta_user_id: string; nome: string; texto: string; ultima: string; naoLidas: number };
type Inscrito = { user_id: string; nome: string };

export default function MensagensOrganizadorPage() {
  const contexto = useEventoCompeticao();
  return (
    <CompeticaoShell titulo="Chat com atletas" descricao="Responda dúvidas de inscrição, categoria, peso e checagem sem sair do painel." contexto={contexto}>
      <Editor eventoId={contexto.eventoId} />
    </CompeticaoShell>
  );
}

function Editor({ eventoId }: { eventoId: string }) {
  const params = useSearchParams();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [ativa, setAtiva] = useState(params.get('atleta') || '');
  const [textoInicial, setTextoInicial] = useState(params.get('aviso') === 'vinculo' ? MENSAGEM_PEDIR_VINCULO : '');
  const [erro, setErro] = useState('');
  const [inscritos, setInscritos] = useState<Inscrito[]>([]);
  const [escolhendo, setEscolhendo] = useState(false);
  const [buscaAtleta, setBuscaAtleta] = useState('');

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

  useEffect(() => {
    let ativo = true;
    supabase.from('inscricoes').select('user_id,atleta').eq('evento_id', eventoId).order('atleta').then(({ data }) => {
      if (!ativo) return;
      const unicos = new Map<string, Inscrito>();
      for (const item of data || []) {
        if (item.user_id && !unicos.has(item.user_id)) unicos.set(item.user_id, { user_id: item.user_id, nome: item.atleta || 'Atleta' });
      }
      setInscritos([...unicos.values()]);
    });
    return () => { ativo = false; };
  }, [eventoId]);

  function abrirConversa(atleta: Inscrito, rascunho = '') {
    setAtiva(atleta.user_id);
    setTextoInicial(rascunho);
    setEscolhendo(false);
    setConversas((atual) => atual.some((item) => item.atleta_user_id === atleta.user_id)
      ? atual
      : [{ atleta_user_id: atleta.user_id, nome: atleta.nome, texto: rascunho ? 'Rascunho pronto para enviar' : 'Conversa nova', ultima: '', naoLidas: 0 }, ...atual]);
  }

  const selecionada = conversas.find(item => item.atleta_user_id === ativa) || inscritos.find(item => item.user_id === ativa);
  const busca = buscaAtleta.trim().toLocaleLowerCase('pt-BR');
  const listaInscritos = inscritos.filter((item) => !busca || item.nome.toLocaleLowerCase('pt-BR').includes(busca));

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="mb-3 flex items-center justify-between gap-2 px-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Conversas</p>
          <button type="button" onClick={() => setEscolhendo(true)} className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-white">Iniciar chat</button>
        </div>
        {conversas.length === 0 && <p className="px-2 text-xs text-zinc-500">Nenhuma conversa ainda. Inicie um chat com um atleta inscrito.</p>}
        <div className="space-y-1">
          {conversas.map(conversa => (
            <button
              key={conversa.atleta_user_id}
              onClick={() => {
                setAtiva(conversa.atleta_user_id);
                setTextoInicial('');
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
          <ChatEvento key={`${ativa}-${textoInicial}`} eventoId={eventoId} atletaUserId={ativa} titulo={selecionada?.nome || 'Atleta'} textoInicial={textoInicial} />
        ) : (
          <p className="text-sm text-zinc-500">Escolha uma conversa ou inicie um chat com um atleta inscrito.</p>
        )}
      </div>
      {escolhendo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e0e12] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black">Iniciar chat</h2>
              <button type="button" onClick={() => setEscolhendo(false)} className="text-zinc-500">Fechar</button>
            </div>
            <input value={buscaAtleta} onChange={(event) => setBuscaAtleta(event.target.value)} placeholder="Buscar atleta inscrito" className="mb-3 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-red-500" />
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {listaInscritos.length === 0 && <p className="text-sm text-zinc-500">Nenhum atleta inscrito neste campeonato.</p>}
              {listaInscritos.map((atleta) => (
                <button key={atleta.user_id} type="button" onClick={() => abrirConversa(atleta)} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-white hover:bg-white/5">{atleta.nome}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
