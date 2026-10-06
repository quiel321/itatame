'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { CompeticaoShell, campoCompeticao as campo, useEventoCompeticao } from '../_components/CompeticaoShell';
import { encontrarEquipeSemelhante } from '@/app/lib/equipes-nome';
import { UploadLogoEquipe } from '@/app/components/UploadLogoEquipe';

type Equipe = { id: string; nome: string; academia: string; professor: string; cidade: string; logo_url?: string | null; academia_logo_url?: string | null };
type Solicitacao = { id: string; equipe_nome: string; academia: string; professor: string; cidade: string; status: 'pendente' | 'aprovada' | 'recusada'; equipe_id: string | null; logo_url?: string | null };
type AcademiaEquipe = { id: string; equipeId: string; academia: string; professor: string; cidade: string; logo_url?: string | null };

function textoIgual(a: string, b: string) {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

function academiasDaEquipe(equipe: Equipe, solicitacoes: Solicitacao[]): AcademiaEquipe[] {
  const vinculadas = solicitacoes
    .filter(item => item.status === 'aprovada' && item.equipe_id === equipe.id && Boolean(item.academia?.trim()))
    .map(item => ({ id: item.id, equipeId: equipe.id, academia: item.academia, professor: item.professor, cidade: item.cidade, logo_url: item.logo_url }));
  if (!vinculadas.length) {
    return equipe.academia?.trim() ? [{ id: `equipe-${equipe.id}`, equipeId: equipe.id, academia: equipe.academia, professor: equipe.professor, cidade: equipe.cidade, logo_url: equipe.academia_logo_url }] : [];
  }
  const jaTemUnidadeInicial = vinculadas.some(item => textoIgual(item.academia, equipe.academia) && textoIgual(item.professor, equipe.professor));
  if (equipe.academia && !jaTemUnidadeInicial) {
    return [{ id: `equipe-${equipe.id}`, equipeId: equipe.id, academia: equipe.academia, professor: equipe.professor, cidade: equipe.cidade, logo_url: equipe.academia_logo_url }, ...vinculadas];
  }
  return vinculadas;
}

export default function EquipesPage() {
  const contexto = useEventoCompeticao();
  return <CompeticaoShell titulo="Equipes e professores" descricao="A equipe é o nome do ranking. Academias já cadastradas permanecem como unidades da equipe." contexto={contexto}><Editor key={contexto.eventoId} eventoId={contexto.eventoId} /></CompeticaoShell>;
}

function Editor({ eventoId }: { eventoId: string }) {
  const [equipes,setEquipes] = useState<Equipe[]>([]);
  const [solicitacoes,setSolicitacoes] = useState<Solicitacao[]>([]);
  const [form,setForm] = useState({ nome:'',academia:'',professor:'',cidade:'' });
  const [editandoEquipeId,setEditandoEquipeId] = useState('');
  const [mensagem,setMensagem] = useState('');
  const [salvando,setSalvando] = useState(false);
  const [origens,setOrigens] = useState<{ equipe: string; equipe_id?: string | null }[]>([]);
  const [busca,setBusca] = useState('');

  useEffect(() => {
    let ativo=true;
    async function carregar() {
      const [inscricoesResposta,equipesResposta,solicitacoesResposta] = await Promise.all([
        supabase.from('inscricoes').select('equipe,equipe_id').eq('evento_id',eventoId),
        supabase.from('equipes_evento').select('id,nome,academia,professor,cidade,logo_url,academia_logo_url').eq('evento_id',eventoId).order('nome'),
        supabase.from('solicitacoes_equipe_evento').select('id,equipe_nome,academia,professor,cidade,status,equipe_id,logo_url').eq('evento_id',eventoId).order('criado_em'),
      ]);
      if (!ativo) return;
      setOrigens(inscricoesResposta.data || []);
      setEquipes(equipesResposta.data || []);
      setSolicitacoes((solicitacoesResposta.data || []) as Solicitacao[]);
      if (equipesResposta.error) setMensagem('Não foi possível carregar as equipes do campeonato.');
    }
    void carregar();
    return () => { ativo=false; };
  },[eventoId]);

  function cancelarEdicao() {
    setEditandoEquipeId('');
    setForm({ nome:'',academia:'',professor:'',cidade:'' });
  }

  async function chamarAdmin(metodo: 'PATCH' | 'DELETE', corpo: Record<string, string>) {
    const { data: { session } } = await supabase.auth.getSession();
    const resposta = await fetch('/api/equipes/admin', {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ eventoId, ...corpo }),
    });
    const resultado = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(resultado.error || 'Não foi possível salvar a alteração.');
  }

  async function recarregar() {
    const [equipesResposta,solicitacoesResposta,inscricoesResposta] = await Promise.all([
      supabase.from('equipes_evento').select('id,nome,academia,professor,cidade,logo_url,academia_logo_url').eq('evento_id',eventoId).order('nome'),
      supabase.from('solicitacoes_equipe_evento').select('id,equipe_nome,academia,professor,cidade,status,equipe_id,logo_url').eq('evento_id',eventoId).order('criado_em'),
      supabase.from('inscricoes').select('equipe,equipe_id').eq('evento_id',eventoId),
    ]);
    setEquipes(equipesResposta.data || []);
    setSolicitacoes((solicitacoesResposta.data || []) as Solicitacao[]);
    setOrigens(inscricoesResposta.data || []);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setMensagem('');
    const payload=Object.fromEntries(Object.entries(form).map(([k,v])=>[k,v.trim()]));
    try {
      if (editandoEquipeId) {
        await chamarAdmin('PATCH', { tipo: 'equipe', id: editandoEquipeId, nome: payload.nome });
        await recarregar();
        cancelarEdicao();
        setMensagem('Nome da equipe atualizado nas inscrições e no ranking.');
      } else {
        const semelhante = encontrarEquipeSemelhante(equipes, payload.nome);
        if (semelhante) throw new Error(`A equipe "${semelhante.nome}" já está cadastrada neste campeonato.`);
        const {data,error}=await supabase.from('equipes_evento').insert({nome:payload.nome,evento_id:eventoId}).select().single();
        if(error) throw new Error(error.code==='23505'?'Já existe uma equipe com este nome no campeonato.':error.message);
        setEquipes([...equipes,data]); setForm({nome:'',academia:'',professor:'',cidade:''});
        setMensagem('Equipe cadastrada. Ela já pode ser escolhida pelos atletas na inscrição.');
      }
    } catch (error) { setMensagem((error as Error).message); }
    setSalvando(false);
  }

  function editarEquipe(equipe: Equipe) {
    setEditandoEquipeId(equipe.id);
    setForm({ nome: equipe.nome, academia: equipe.academia, professor: equipe.professor, cidade: equipe.cidade });
    setMensagem('Editando o nome da equipe no ranking.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function excluirEquipe(equipe: Equipe) {
    if (!window.confirm(`Excluir a equipe "${equipe.nome}" deste campeonato?`)) return;
    setSalvando(true); setMensagem('');
    try {
      await chamarAdmin('DELETE', { tipo: 'equipe', id: equipe.id });
      await recarregar();
      if (editandoEquipeId === equipe.id) cancelarEdicao();
      setMensagem(`Equipe "${equipe.nome}" excluída do campeonato.`);
    } catch (error) { setMensagem((error as Error).message); }
    finally { setSalvando(false); }
  }

  async function analisar(solicitacao: Solicitacao, aprovar: boolean) {
    setSalvando(true); setMensagem('');
    if (aprovar) {
      const { error } = await supabase.rpc('aprovar_solicitacao_equipe_evento', { p_solicitacao: solicitacao.id });
      if (error) setMensagem(error.message);
      else {
        setSolicitacoes(atual => atual.map(item => item.id === solicitacao.id ? { ...item, status: 'aprovada' } : item));
        const { data } = await supabase.from('equipes_evento').select('id,nome,academia,professor,cidade,logo_url,academia_logo_url').eq('evento_id',eventoId).order('nome');
        setEquipes(data || []); setMensagem(`${solicitacao.equipe_nome} aprovada e liberada para as inscrições.`);
      }
    } else {
      const { error } = await supabase.from('solicitacoes_equipe_evento').update({ status: 'recusada', atualizado_em: new Date().toISOString() }).eq('id', solicitacao.id);
      if (error) setMensagem(error.message);
      else { setSolicitacoes(atual => atual.map(item => item.id === solicitacao.id ? { ...item, status: 'recusada' } : item)); setMensagem('Solicitação recusada. O professor poderá corrigir e reenviar.'); }
    }
    setSalvando(false);
  }

  const pendentes = solicitacoes.filter(item => item.status === 'pendente');
  const equipesFiltradas = equipes.filter(equipe => {
    const professores = solicitacoes.filter(item => item.status === 'aprovada' && item.equipe_id === equipe.id).map(item => item.professor);
    return [equipe.nome, ...professores, equipe.professor].join(' ').toLowerCase().includes(busca.toLowerCase());
  });
  const tituloForm = editandoEquipeId ? 'Editar nome da equipe' : 'Cadastrar equipe';
  const descricaoForm = editandoEquipeId
    ? 'O nome só pode mudar antes de haver atletas ou chaves vinculados.'
    : 'Cadastre apenas o nome oficial usado no campeonato e no ranking.';
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-zinc-400">
      <span><strong className="text-white">{equipes.length} equipes</strong> neste campeonato · {origens.length} inscrições</span>
      <span>O atleta entra na equipe do próprio perfil. Correções individuais ficam na inscrição.</span>
    </div>

    {pendentes.length > 0 && <details className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <summary className="cursor-pointer text-sm font-bold text-amber-200">{pendentes.length} solicitações antigas pendentes</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{pendentes.map(item => <article key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-3"><h3 className="font-bold">{item.equipe_nome}</h3><p className="mt-1 text-xs text-zinc-400">Professor: {item.professor}</p><div className="mt-3 flex gap-2"><button disabled={salvando} onClick={() => analisar(item,true)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold disabled:opacity-40">Aprovar</button><button disabled={salvando} onClick={() => analisar(item,false)} className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 disabled:opacity-40">Recusar</button></div></article>)}</div>
    </details>}

    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <form onSubmit={salvar} className="self-start space-y-3 rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
        <h2 className="font-bold">{tituloForm}</h2>
        <p className="text-xs text-zinc-400">{descricaoForm}</p>
        <label className="block text-xs">Nome da equipe<input maxLength={120} required className={campo+' mt-1'} value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></label>
        <button disabled={salvando} className="w-full rounded-xl bg-red-600 p-3 text-sm font-bold disabled:opacity-40">{salvando?'Salvando...':editandoEquipeId ? 'Salvar nome' : 'Cadastrar equipe'}</button>
        {editandoEquipeId && <button type="button" onClick={cancelarEdicao} className="w-full rounded-xl border border-white/10 p-2.5 text-xs text-zinc-300">Cancelar edição</button>}
      </form>
      <section className="min-w-0">
        <input aria-label="Buscar equipe" className={campo} placeholder="Buscar equipe ou professor" value={busca} onChange={e=>setBusca(e.target.value)}/>
        <p className="my-3 text-xs text-zinc-500">{equipesFiltradas.length} {equipesFiltradas.length === 1 ? 'equipe encontrada' : 'equipes encontradas'}</p>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{equipesFiltradas.map(equipe => {
          const academias = academiasDaEquipe(equipe, solicitacoes);
          const inscritos = origens.filter(item => item.equipe_id === equipe.id || (!item.equipe_id && item.equipe === equipe.nome)).length;
          const professoresVinculados = solicitacoes.filter(item => item.status === 'aprovada' && item.equipe_id === equipe.id).map(item => item.professor.trim()).filter(Boolean);
          const professores = [...new Set(professoresVinculados.length ? professoresVinculados : [equipe.professor.trim()].filter(Boolean))];
          return <article key={equipe.id} className="min-w-0 rounded-2xl border border-white/10 bg-[#0b0b10] p-4 hover:border-white/20">
            <div className="flex items-start gap-3">
              {equipe.logo_url ? <img src={equipe.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-white/10 object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-black text-zinc-400">{equipe.nome.slice(0,2).toUpperCase()}</span>}
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white" title={equipe.nome}>{equipe.nome}</p><p className="mt-1 text-[11px] text-zinc-400">{inscritos} {inscritos === 1 ? 'atleta' : 'atletas'} inscrito{inscritos === 1 ? '' : 's'}</p></div>
              <button type="button" onClick={() => editarEquipe(equipe)} disabled={inscritos > 0} title={inscritos > 0 ? 'Equipe com atletas: corrija vínculos pela inscrição individual' : 'Editar nome da equipe'} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40">Editar</button>
              <button type="button" onClick={() => void excluirEquipe(equipe)} disabled={salvando || inscritos > 0 || professoresVinculados.length > 0} title={inscritos > 0 || professoresVinculados.length > 0 ? 'Equipe com vínculos ativos não pode ser excluída' : 'Excluir equipe sem uso'} className="rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[11px] font-bold text-red-300 disabled:cursor-not-allowed disabled:opacity-40">Excluir</button>
            </div>
            <p className="mt-3 truncate text-[11px] text-zinc-500" title={professores.join(', ')}>{professores.length ? `Professor${professores.length > 1 ? 'es' : ''}: ${professores.join(', ')}` : 'Professor ainda não vinculado'}</p>
            <details className="mt-3 border-t border-white/10 pt-2 text-xs text-zinc-400">
              <summary className="cursor-pointer">Logo e dados antigos{academias.length ? ` · ${academias.length} ${academias.length === 1 ? 'academia' : 'academias'}` : ''}</summary>
              <div className="mt-3"><UploadLogoEquipe eventoId={eventoId} equipeId={equipe.id} tipo="equipe" logoUrl={equipe.logo_url} nome={equipe.nome} onAtualizou={(url) => setEquipes(atual => atual.map(item => item.id === equipe.id ? { ...item, logo_url: url } : item))} /></div>
              {academias.length > 0 && <ul className="mt-3 space-y-1 text-[11px] text-zinc-500">{academias.map(academia => <li key={academia.id}>{academia.academia} · {academia.professor || 'Sem professor'}</li>)}</ul>}
            </details>
          </article>;
        })}</div>
      </section>
    </div>

    {mensagem&&<p role="status" className="mt-5 p-4 border border-white/10 rounded-xl text-sm">{mensagem}</p>}
  </>;
}
