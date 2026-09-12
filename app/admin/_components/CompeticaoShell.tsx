'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/lib/supabase';
import { guardarEventoOrganizador, obterEventoOrganizador } from '@/app/lib/evento-organizador';

export const campoCompeticao = 'w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-red-500';
export function useEventoCompeticao() {
  const [eventos, setEventos] = useState<{ id: string; nome: string }[]>([]);
  const [eventoId, setEventoId] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from('eventos').select('id,nome').eq('organizador_id', user.id).order('data_evento', { ascending: false });
      if (!ativo) return;
      if (error) { setErro('Não foi possível carregar os campeonatos.'); return; }
      setEventos(data || []); setEventoId(obterEventoOrganizador(data || []));
    })();
    return () => { ativo = false; };
  }, []);
  useEffect(() => { if (eventoId) guardarEventoOrganizador(eventoId); }, [eventoId]);
  return { eventos, eventoId, setEventoId, erro };
}
export function CompeticaoShell({ titulo, descricao, contexto, children }: {
  titulo: string; descricao: string; contexto: ReturnType<typeof useEventoCompeticao>; children: ReactNode;
}) {
  return <main className="min-h-screen bg-[#050505] px-4 py-16 text-white"><div className="max-w-6xl mx-auto">
    <Link href={`/admin?evento=${contexto.eventoId}`} className="text-zinc-400 text-sm">← Painel do organizador</Link>
    <h1 className="mt-5 text-3xl font-black">{titulo}</h1><p className="mt-2 mb-6 text-zinc-400 text-sm">{descricao}</p>
    <label className="block max-w-lg mb-6 text-xs text-zinc-400">Campeonato<select className={campoCompeticao + ' mt-2'} value={contexto.eventoId} onChange={e => contexto.setEventoId(e.target.value)}><option value="">Selecione um campeonato</option>{contexto.eventos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
    {contexto.erro && <p role="alert">{contexto.erro}</p>}{contexto.eventoId ? children : <p className="text-zinc-500">Escolha o campeonato para continuar.</p>}
  </div></main>;
}
