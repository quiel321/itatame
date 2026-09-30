'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

type Solicitacao = { id: string; status: 'pendente' | 'aprovada' | 'recusada'; equipe_nome: string; academia: string; professor: string; cidade: string; equipe_id?: string | null; logo_url?: string | null };
type EquipeEvento = { id: string; nome: string; academia: string; professor: string; cidade: string; logo_url?: string | null; academia_logo_url?: string | null };
const campo = 'mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none focus:border-yellow-500';

import { encontrarEquipeSemelhante, nomesEquipeIguais } from '@/app/lib/equipes-nome';
import { UploadLogoEquipe } from '@/app/components/UploadLogoEquipe';

export default function SolicitarEquipeEventoPage() {
  const params = useParams<{ id: string }>();
  const eventoId = params.id;
  const [eventoNome, setEventoNome] = useState('Campeonato');
  const [userId, setUserId] = useState('');
  const [ehProfessor, setEhProfessor] = useState(false);
  const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null);
  const [equipes, setEquipes] = useState<EquipeEvento[]>([]);
  const [form, setForm] = useState({ equipe_nome: '', academia: '', professor: '', cidade: '' });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data: evento }, { data: equipesEvento }] = await Promise.all([
        supabase.from('eventos').select('nome').eq('id', eventoId).maybeSingle(),
        supabase.from('equipes_evento').select('id,nome,academia,professor,cidade,logo_url,academia_logo_url').eq('evento_id', eventoId).eq('ativa', true).order('nome'),
      ]);
      if (!ativo) return;
      setEventoNome(evento?.nome || 'Campeonato');
      setEquipes((equipesEvento || []) as EquipeEvento[]);
      if (!user || user.is_anonymous) { setCarregando(false); return; }
      setUserId(user.id);
      const [{ data: perfil }, { data: pedido }] = await Promise.all([
        supabase.from('atletas').select('nome,equipe,academia,cidade,role').eq('user_id', user.id).maybeSingle(),
        supabase.from('solicitacoes_equipe_evento').select('id,status,equipe_nome,academia,professor,cidade,equipe_id,logo_url').eq('evento_id', eventoId).eq('professor_user_id', user.id).maybeSingle(),
      ]);
      if (!ativo) return;
      setEhProfessor(perfil?.role === 'professor');
      if (pedido) setSolicitacao(pedido as Solicitacao);
      const equipesDoCampeonato = (equipesEvento || []) as EquipeEvento[];
      const nomeDoCadastro = perfil?.equipe || '';
      const equipeDoCadastro = encontrarEquipeSemelhante(equipesDoCampeonato, nomeDoCadastro);
      setForm({
        equipe_nome: equipeDoCadastro?.nome || nomeDoCadastro,
        academia: perfil?.academia || pedido?.academia || '',
        professor: perfil?.nome || pedido?.professor || '',
        cidade: perfil?.cidade || pedido?.cidade || '',
      });
      setCarregando(false);
    }
    void carregar();
    return () => { ativo = false; };
  }, [eventoId]);

  const equipePeloNome = encontrarEquipeSemelhante(equipes, form.equipe_nome);
  const equipeDestino = equipePeloNome;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !ehProfessor) return;
    setSalvando(true); setMensagem('');
    const { data: { session } } = await supabase.auth.getSession();
    const resposta = await fetch('/api/equipes/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ eventoId }),
    });
    const resultado = await resposta.json();
    if (!resposta.ok) setMensagem(resultado.error || 'Não foi possível cadastrar a equipe.');
    else {
      const nomeEquipe = equipeDestino?.nome || form.equipe_nome;
      const { data: pedido } = await supabase.from('solicitacoes_equipe_evento').select('id,status,equipe_nome,academia,professor,cidade,equipe_id,logo_url').eq('evento_id', eventoId).eq('professor_user_id', userId).maybeSingle();
      setSolicitacao(pedido
        ? { ...pedido, status: 'aprovada' }
        : { id: resultado.equipeId, status: 'aprovada', equipe_nome: nomeEquipe, academia: '', professor: form.professor, cidade: '', equipe_id: resultado.equipeId });
      const { data: equipesEvento } = await supabase.from('equipes_evento').select('id,nome,academia,professor,cidade,logo_url,academia_logo_url').eq('evento_id', eventoId).eq('ativa', true).order('nome');
      if (equipesEvento) setEquipes(equipesEvento as EquipeEvento[]);
      setMensagem(resultado.entrou
        ? `${nomeEquipe} já existia. Seu cadastro de professor foi vinculado à equipe.`
        : 'Equipe cadastrada. Os atletas já podem selecioná-la na inscrição.');
    }
    setSalvando(false);
  }

  if (carregando) return <main className="min-h-screen bg-[#050505] p-8 text-center text-zinc-500">Carregando...</main>;
  return <main className="min-h-screen bg-[#050505] px-4 py-16 text-white"><div className="mx-auto max-w-2xl">
    <Link href={`/evento/${eventoId}`} className="text-sm text-zinc-400">← Voltar ao evento</Link>
    <p className="mt-8 text-[10px] font-black uppercase tracking-widest text-yellow-500">Professor e equipe</p>
    <h1 className="mt-2 text-3xl font-black">Participar de {eventoNome}</h1>
    <p className="mt-3 text-sm leading-relaxed text-zinc-400">Pesquise sua equipe no campeonato. Se ela já existir, vincule seu cadastro a ela. Se não, cadastre o nome da equipe. As academias já registradas continuam preservadas.</p>

    {!userId ? <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6"><h2 className="font-bold">Entre com sua conta de professor</h2><p className="mt-2 text-sm text-zinc-400">O cadastro precisa ficar vinculado ao responsável técnico.</p><Link href={`/login?redirect=/evento/${eventoId}/equipe`} className="mt-5 inline-block rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black">Entrar ou criar conta</Link></section>
    : !ehProfessor ? <section className="mt-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6"><h2 className="font-bold text-yellow-200">Esta conta não é de professor</h2><p className="mt-2 text-sm text-zinc-300">Use uma conta cadastrada como professor para representar uma equipe no campeonato.</p></section>
    : solicitacao?.status === 'aprovada' ? <section className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
      <h2 className="font-bold text-emerald-300">Equipe confirmada</h2>
      <p className="mt-2 text-sm text-zinc-300">Seu cadastro está vinculado à equipe <strong className="text-white">{solicitacao.equipe_nome}</strong>. Os atletas escolhem essa equipe na inscrição.{solicitacao.academia ? ` Sua academia ${solicitacao.academia} continua registrada.` : ''}</p>
      {solicitacao.equipe_id && <div className="mt-5 grid gap-3">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Logo da equipe · aparece na aba Equipe</p>
          <UploadLogoEquipe eventoId={eventoId} equipeId={solicitacao.equipe_id} tipo="equipe" logoUrl={equipes.find(item => item.id === solicitacao.equipe_id)?.logo_url} nome={solicitacao.equipe_nome} onAtualizou={(url) => setEquipes(atual => atual.map(item => item.id === solicitacao.equipe_id ? { ...item, logo_url: url } : item))} />
        </div>
        {solicitacao.academia && <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Logo da academia · aparece em Equipe e professor</p>
          <UploadLogoEquipe eventoId={eventoId} equipeId={solicitacao.equipe_id} academiaId={solicitacao.id} tipo="academia" logoUrl={(() => { const equipeAtual = equipes.find(item => item.id === solicitacao.equipe_id); return solicitacao.logo_url || (equipeAtual && nomesEquipeIguais(equipeAtual.academia, solicitacao.academia) ? equipeAtual.academia_logo_url : null); })()} nome={solicitacao.academia || solicitacao.equipe_nome} onAtualizou={(url) => {
            setSolicitacao(atual => atual ? { ...atual, logo_url: url } : atual);
            const equipeAtual = equipes.find(item => item.id === solicitacao.equipe_id);
            if (equipeAtual && nomesEquipeIguais(equipeAtual.academia, solicitacao.academia)) {
              setEquipes(atual => atual.map(item => item.id === solicitacao.equipe_id ? { ...item, academia_logo_url: url } : item));
            }
          }} />
        </div>}
      </div>}
    </section>
    : <form onSubmit={enviar} className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
      <p className="text-xs leading-relaxed text-zinc-500">A equipe vem do seu perfil de professor. Para corrigir o nome, <Link href="/perfil" className="text-yellow-400 underline">altere o perfil</Link> antes de continuar.</p>
      {equipeDestino && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-100">
        {equipeDestino.nome.toLocaleLowerCase('pt-BR') === form.equipe_nome.trim().toLocaleLowerCase('pt-BR')
          ? 'Esta equipe já está no campeonato. Seu cadastro será vinculado a ela.'
          : `"${form.equipe_nome}" será vinculado à equipe já cadastrada como "${equipeDestino.nome}".`}
      </div>}
      <div><p className="text-xs text-zinc-400">Equipe do perfil</p><div className={campo + ' mt-1 font-bold'}>{form.equipe_nome || 'Equipe não informada'}</div></div>
      <p className="text-xs text-zinc-500">Professor responsável: {form.professor || 'seu nome no perfil'}</p>
      <button disabled={salvando || !form.equipe_nome.trim()} className="w-full rounded-xl bg-yellow-500 p-3 font-black text-black disabled:opacity-50">{salvando ? 'Salvando...' : equipeDestino ? 'Vincular minha equipe' : 'Cadastrar equipe gratuitamente'}</button>
    </form>}
    {mensagem && <p role="status" className="mt-4 rounded-xl border border-white/10 p-4 text-sm">{mensagem}</p>}
  </div></main>;
}
