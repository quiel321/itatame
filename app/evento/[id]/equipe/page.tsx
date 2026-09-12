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
    const payload = { ...form, evento_id: eventoId, professor_user_id: userId, status: 'pendente', equipe_id: null, atualizado_em: new Date().toISOString() };
    const resposta = solicitacao
      ? await supabase.from('solicitacoes_equipe_evento').update(payload).eq('id', solicitacao.id).select('id,status,equipe_nome,academia,professor,cidade').single()
      : await supabase.from('solicitacoes_equipe_evento').insert(payload).select('id,status,equipe_nome,academia,professor,cidade').single();
    if (resposta.error) setMensagem(resposta.error.message);
    else { setSolicitacao(resposta.data as Solicitacao); setMensagem('Solicitação enviada. O organizador verá o pedido no painel do campeonato.'); }
    setSalvando(false);
  }

  if (carregando) return <main className="min-h-screen bg-[#050505] p-8 text-center text-zinc-500">Carregando...</main>;
  return <main className="min-h-screen bg-[#050505] px-4 py-16 text-white"><div className="mx-auto max-w-2xl">
    <Link href={`/evento/${eventoId}`} className="text-sm text-zinc-400">← Voltar ao evento</Link>
    <p className="mt-8 text-[10px] font-black uppercase tracking-widest text-yellow-500">Professor e equipe</p>
    <h1 className="mt-2 text-3xl font-black">Participar de {eventoNome}</h1>
    <p className="mt-3 text-sm leading-relaxed text-zinc-400">O professor envia os dados da equipe. O organizador confere e aprova; somente depois a equipe aparece na inscrição dos atletas e no painel do campeonato.</p>

    {!userId ? <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6"><h2 className="font-bold">Entre com sua conta de professor</h2><p className="mt-2 text-sm text-zinc-400">O pedido precisa ficar vinculado ao responsável técnico.</p><Link href="/login" className="mt-5 inline-block rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black">Entrar ou criar conta</Link></section>
    : !ehProfessor ? <section className="mt-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6"><h2 className="font-bold text-yellow-200">Esta conta não é de professor</h2><p className="mt-2 text-sm text-zinc-300">Use uma conta cadastrada como professor para representar uma equipe no campeonato.</p></section>
    : solicitacao?.status === 'aprovada' ? <section className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6"><h2 className="font-bold text-emerald-300">Equipe aprovada</h2><p className="mt-2 text-sm text-zinc-300">{solicitacao.equipe_nome} já está disponível para os atletas deste campeonato.</p></section>
    : <form onSubmit={enviar} className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
      <div className={`rounded-xl border p-4 text-sm ${solicitacao?.status === 'recusada' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-100'}`}>{solicitacao?.status === 'recusada' ? 'O pedido anterior foi recusado. Corrija os dados e envie novamente.' : solicitacao ? 'Pedido aguardando análise do organizador. Você pode atualizar os dados enquanto estiver pendente.' : 'Preencha os dados usados na inscrição e no ranking por equipes.'}</div>
      <label className="block text-xs">Nome da equipe<input required maxLength={120} className={campo} value={form.equipe_nome} onChange={e => setForm({ ...form, equipe_nome: e.target.value })} /></label>
      <label className="block text-xs">Academia ou unidade<input maxLength={120} className={campo} value={form.academia} onChange={e => setForm({ ...form, academia: e.target.value })} /></label>
      <label className="block text-xs">Professor responsável<input required maxLength={120} className={campo} value={form.professor} onChange={e => setForm({ ...form, professor: e.target.value })} /></label>
      <label className="block text-xs">Cidade<input maxLength={120} className={campo} value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} /></label>
      <button disabled={salvando} className="w-full rounded-xl bg-yellow-500 p-3 font-black text-black disabled:opacity-50">{salvando ? 'Enviando...' : solicitacao ? 'Atualizar solicitação' : 'Solicitar participação'}</button>
    </form>}
    {mensagem && <p role="status" className="mt-4 rounded-xl border border-white/10 p-4 text-sm">{mensagem}</p>}
  </div></main>;
}
