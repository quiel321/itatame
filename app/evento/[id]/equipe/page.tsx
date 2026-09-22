'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
  const [busca, setBusca] = useState('');
  const [equipeEscolhidaId, setEquipeEscolhidaId] = useState('');
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
      const nomeDoCadastro = perfil?.equipe || pedido?.equipe_nome || '';
      const equipeDoCadastro = encontrarEquipeSemelhante(equipesDoCampeonato, nomeDoCadastro);
      if (equipeDoCadastro) setEquipeEscolhidaId(equipeDoCadastro.id);
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

  const termoBusca = busca.trim();
  const sugestoes = useMemo(() => {
    const termo = termoBusca.toLocaleLowerCase('pt-BR');
    const filtradas = !termo ? equipes : equipes.filter(equipe => [equipe.nome, equipe.academia, equipe.professor, equipe.cidade]
      .join(' ')
      .toLocaleLowerCase('pt-BR')
      .includes(termo));
    return filtradas.slice(0, 12);
  }, [equipes, termoBusca]);
  const equipeEscolhida = equipes.find(equipe => equipe.id === equipeEscolhidaId) || null;
  const equipePeloNome = encontrarEquipeSemelhante(equipes, form.equipe_nome);
  const equipeDestino = equipeEscolhida || equipePeloNome;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !ehProfessor) return;
    setSalvando(true); setMensagem('');
    const { data: { session } } = await supabase.auth.getSession();
    const resposta = await fetch('/api/equipes/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({
        eventoId,
        equipeId: equipeDestino?.id || '',
        nome: equipeDestino?.nome || form.equipe_nome,
        academia: form.academia,
        professor: form.professor,
        cidade: form.cidade,
      }),
    });
    const resultado = await resposta.json();
    if (!resposta.ok) setMensagem(resultado.error || 'Não foi possível cadastrar a equipe.');
    else {
      const nomeEquipe = equipeDestino?.nome || form.equipe_nome;
      const { data: pedido } = await supabase.from('solicitacoes_equipe_evento').select('id,status,equipe_nome,academia,professor,cidade,equipe_id,logo_url').eq('evento_id', eventoId).eq('professor_user_id', userId).maybeSingle();
      setSolicitacao(pedido
        ? { ...pedido, status: 'aprovada' }
        : { id: resultado.equipeId, status: 'aprovada', equipe_nome: nomeEquipe, academia: form.academia, professor: form.professor, cidade: form.cidade, equipe_id: resultado.equipeId });
      const { data: equipesEvento } = await supabase.from('equipes_evento').select('id,nome,academia,professor,cidade,logo_url,academia_logo_url').eq('evento_id', eventoId).eq('ativa', true).order('nome');
      if (equipesEvento) setEquipes(equipesEvento as EquipeEvento[]);
      setMensagem(resultado.entrou
        ? `${nomeEquipe} já existia. Sua academia entrou nesta equipe. Os atletas devem selecioná-la na inscrição.`
        : 'Equipe cadastrada. Os atletas já podem selecioná-la na inscrição.');
    }
    setSalvando(false);
  }

  if (carregando) return <main className="min-h-screen bg-[#050505] p-8 text-center text-zinc-500">Carregando...</main>;
  return <main className="min-h-screen bg-[#050505] px-4 py-16 text-white"><div className="mx-auto max-w-2xl">
    <Link href={`/evento/${eventoId}`} className="text-sm text-zinc-400">← Voltar ao evento</Link>
    <p className="mt-8 text-[10px] font-black uppercase tracking-widest text-yellow-500">Professor e equipe</p>
    <h1 className="mt-2 text-3xl font-black">Participar de {eventoNome}</h1>
    <p className="mt-3 text-sm leading-relaxed text-zinc-400">O professor pesquisa a equipe do campeonato. Se ela já existe, entra com a academia dele. Se não, cadastra um nome novo. O ranking por equipes usa o nome da equipe; o ranking por academias continua separado.</p>

    {!userId ? <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6"><h2 className="font-bold">Entre com sua conta de professor</h2><p className="mt-2 text-sm text-zinc-400">O cadastro precisa ficar vinculado ao responsável técnico.</p><Link href={`/login?redirect=/evento/${eventoId}/equipe`} className="mt-5 inline-block rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black">Entrar ou criar conta</Link></section>
    : !ehProfessor ? <section className="mt-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6"><h2 className="font-bold text-yellow-200">Esta conta não é de professor</h2><p className="mt-2 text-sm text-zinc-300">Use uma conta cadastrada como professor para representar uma equipe no campeonato.</p></section>
    : solicitacao?.status === 'aprovada' ? <section className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
      <h2 className="font-bold text-emerald-300">Equipe confirmada</h2>
      <p className="mt-2 text-sm text-zinc-300">Sua academia{solicitacao.academia ? ` ${solicitacao.academia}` : ''} entrou na equipe <strong className="text-white">{solicitacao.equipe_nome}</strong>. Os atletas escolhem essa equipe na inscrição. A academia continua no ranking por academias.</p>
      {solicitacao.equipe_id && <div className="mt-5 grid gap-3">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Logo da equipe · aparece na aba Equipe</p>
          <UploadLogoEquipe eventoId={eventoId} equipeId={solicitacao.equipe_id} tipo="equipe" logoUrl={equipes.find(item => item.id === solicitacao.equipe_id)?.logo_url} nome={solicitacao.equipe_nome} onAtualizou={(url) => setEquipes(atual => atual.map(item => item.id === solicitacao.equipe_id ? { ...item, logo_url: url } : item))} />
        </div>
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Logo da academia · aparece em Equipe e professor</p>
          <UploadLogoEquipe eventoId={eventoId} equipeId={solicitacao.equipe_id} academiaId={solicitacao.id} tipo="academia" logoUrl={(() => { const equipeAtual = equipes.find(item => item.id === solicitacao.equipe_id); return solicitacao.logo_url || (equipeAtual && nomesEquipeIguais(equipeAtual.academia, solicitacao.academia) ? equipeAtual.academia_logo_url : null); })()} nome={solicitacao.academia || solicitacao.equipe_nome} onAtualizou={(url) => {
            setSolicitacao(atual => atual ? { ...atual, logo_url: url } : atual);
            const equipeAtual = equipes.find(item => item.id === solicitacao.equipe_id);
            if (equipeAtual && nomesEquipeIguais(equipeAtual.academia, solicitacao.academia)) {
              setEquipes(atual => atual.map(item => item.id === solicitacao.equipe_id ? { ...item, academia_logo_url: url } : item));
            }
          }} />
        </div>
      </div>}
    </section>
    : <form onSubmit={enviar} className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
      <p className="text-xs leading-relaxed text-zinc-500">Pesquise a equipe antes de cadastrar. Se ela já estiver no campeonato, entre nela para não duplicar o nome no ranking.</p>
      <label className="block text-xs text-zinc-400">Pesquisar equipe no campeonato
        <input maxLength={120} className={campo} placeholder="Filtre pelo nome, ou escolha na lista abaixo" value={busca} onChange={e => { setBusca(e.target.value); if (equipeEscolhidaId) setEquipeEscolhidaId(''); }} />
      </label>
      {equipes.length > 0 && <ul className="overflow-hidden rounded-xl border border-white/10">{sugestoes.length ? sugestoes.map(equipe => <li key={equipe.id} className="border-t border-white/10 first:border-t-0"><button type="button" onClick={() => { setEquipeEscolhidaId(equipe.id); setForm({ ...form, equipe_nome: equipe.nome }); setBusca(''); }} className={`flex w-full flex-col items-start gap-0.5 px-3 py-3 text-left hover:bg-white/5 ${equipe.id === equipeEscolhidaId ? 'bg-yellow-500/10' : ''}`}><span className="text-sm font-bold text-white">{equipe.nome}</span><span className="text-xs text-zinc-500">{equipe.academia ? `Cadastrada por ${equipe.academia}${equipe.cidade ? ` · ${equipe.cidade}` : ''}` : (equipe.cidade || 'Entrar nesta equipe')}</span></button></li>) : <li className="px-3 py-3 text-xs text-zinc-500">Nenhuma equipe encontrada com esse filtro. O nome do seu cadastro continua no campo abaixo.</li>}</ul>}
      {equipeDestino && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-100">
        {equipeDestino.nome.toLocaleLowerCase('pt-BR') === form.equipe_nome.trim().toLocaleLowerCase('pt-BR')
          ? 'Esta equipe já está no campeonato. Informe sua academia e entre nela, sem criar outro nome.'
          : `"${form.equipe_nome}" parece a mesma equipe que "${equipeDestino.nome}". Entre nela para não duplicar no ranking.`}
      </div>}
      <label className="block text-xs">Nome da equipe<input required maxLength={120} className={campo} placeholder="Escolha na busca ou digite um nome novo" value={form.equipe_nome} onChange={e => { setForm({ ...form, equipe_nome: e.target.value }); setEquipeEscolhidaId(''); }} /></label>
      <label className="block text-xs">Academia ou unidade<input maxLength={120} className={campo} value={form.academia} onChange={e => setForm({ ...form, academia: e.target.value })} /></label>
      <label className="block text-xs">Professor responsável<input required maxLength={120} className={campo} value={form.professor} onChange={e => setForm({ ...form, professor: e.target.value })} /></label>
      <label className="block text-xs">Cidade<input maxLength={120} className={campo} value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} /></label>
      <button disabled={salvando} className="w-full rounded-xl bg-yellow-500 p-3 font-black text-black disabled:opacity-50">{salvando ? 'Salvando...' : equipeDestino ? 'Entrar nesta equipe' : 'Cadastrar equipe gratuitamente'}</button>
    </form>}
    {mensagem && <p role="status" className="mt-4 rounded-xl border border-white/10 p-4 text-sm">{mensagem}</p>}
  </div></main>;
}
