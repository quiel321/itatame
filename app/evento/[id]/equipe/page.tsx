'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

type Solicitacao = { id: string; status: 'pendente' | 'aprovada' | 'recusada'; equipe_nome: string; academia: string; professor: string; cidade: string };
const campo = 'mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none focus:border-yellow-500';

export default function SolicitarEquipeEventoPage() {
  const params = useParams<{ id: string }>();
  const eventoId = params.id;
  const [eventoNome, setEventoNome] = useState('Campeonato');
  const [userId, setUserId] = useState('');
  const [ehProfessor, setEhProfessor] = useState(false);
  const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null);
  const [form, setForm] = useState({ equipe_nome: '', academia: '', professor: '', cidade: '' });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: evento } = await supabase.from('eventos').select('nome').eq('id', eventoId).maybeSingle();
      if (!ativo) return;
      setEventoNome(evento?.nome || 'Campeonato');
      if (!user) { setCarregando(false); return; }
      setUserId(user.id);
      const [{ data: perfil }, { data: pedido }] = await Promise.all([
        supabase.from('atletas').select('nome,equipe,academia,cidade,role').eq('user_id', user.id).maybeSingle(),
        supabase.from('solicitacoes_equipe_evento').select('id,status,equipe_nome,academia,professor,cidade').eq('evento_id', eventoId).eq('professor_user_id', user.id).maybeSingle(),
      ]);
      if (!ativo) return;
      setEhProfessor(perfil?.role === 'professor');
      if (pedido) {
        const atual = pedido as Solicitacao;
        setSolicitacao(atual);
        setForm({ equipe_nome: atual.equipe_nome, academia: atual.academia, professor: atual.professor, cidade: atual.cidade });
      } else {
        setForm({ equipe_nome: perfil?.equipe || '', academia: perfil?.academia || '', professor: perfil?.nome || '', cidade: perfil?.cidade || '' });
      }
      setCarregando(false);
    }
    void carregar();
    return () => { ativo = false; };
  }, [eventoId]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !ehProfessor) return;
    setSalvando(true); setMensagem('');
    const { data: { session } } = await supabase.auth.getSession();
    const resposta = await fetch('/api/equipes/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ eventoId, nome: form.equipe_nome, academia: form.academia, professor: form.professor, cidade: form.cidade }),
    });
    const resultado = await resposta.json();
    if (!resposta.ok) setMensagem(resultado.error || 'Não foi possível cadastrar a equipe.');
    else {
      setSolicitacao({ id: resultado.equipeId, status: 'aprovada', ...form });
      setMensagem('Equipe cadastrada. Os atletas já podem selecioná-la na inscrição.');
    }
    setSalvando(false);
  }

  if (carregando) return <main className="min-h-screen bg-[#050505] p-8 text-center text-zinc-500">Carregando...</main>;
  return <main className="min-h-screen bg-[#050505] px-4 py-16 text-white"><div className="mx-auto max-w-2xl">
    <Link href={`/evento/${eventoId}`} className="text-sm text-zinc-400">← Voltar ao evento</Link>
    <p className="mt-8 text-[10px] font-black uppercase tracking-widest text-yellow-500">Professor e equipe</p>
    <h1 className="mt-2 text-3xl font-black">Participar de {eventoNome}</h1>
    <p className="mt-3 text-sm leading-relaxed text-zinc-400">O professor cadastra a equipe gratuitamente. Ela aparece imediatamente para os atletas na inscrição e no painel do organizador.</p>

    {!userId ? <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6"><h2 className="font-bold">Entre com sua conta de professor</h2><p className="mt-2 text-sm text-zinc-400">O cadastro precisa ficar vinculado ao responsável técnico.</p><Link href="/login" className="mt-5 inline-block rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black">Entrar ou criar conta</Link></section>
    : !ehProfessor ? <section className="mt-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6"><h2 className="font-bold text-yellow-200">Esta conta não é de professor</h2><p className="mt-2 text-sm text-zinc-300">Use uma conta cadastrada como professor para representar uma equipe no campeonato.</p></section>
    : solicitacao?.status === 'aprovada' ? <section className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6"><h2 className="font-bold text-emerald-300">Equipe cadastrada</h2><p className="mt-2 text-sm text-zinc-300">{solicitacao.equipe_nome} já está disponível para os atletas deste campeonato.</p></section>
    : <form onSubmit={enviar} className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">Preencha os dados usados na inscrição e no ranking por equipes. O nome não pode repetir outra equipe do campeonato.</div>
      <label className="block text-xs">Nome da equipe<input required maxLength={120} className={campo} value={form.equipe_nome} onChange={e => setForm({ ...form, equipe_nome: e.target.value })} /></label>
      <label className="block text-xs">Academia ou unidade<input maxLength={120} className={campo} value={form.academia} onChange={e => setForm({ ...form, academia: e.target.value })} /></label>
      <label className="block text-xs">Professor responsável<input required maxLength={120} className={campo} value={form.professor} onChange={e => setForm({ ...form, professor: e.target.value })} /></label>
      <label className="block text-xs">Cidade<input maxLength={120} className={campo} value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} /></label>
      <button disabled={salvando} className="w-full rounded-xl bg-yellow-500 p-3 font-black text-black disabled:opacity-50">{salvando ? 'Cadastrando...' : 'Cadastrar equipe gratuitamente'}</button>
    </form>}
    {mensagem && <p role="status" className="mt-4 rounded-xl border border-white/10 p-4 text-sm">{mensagem}</p>}
  </div></main>;
}
