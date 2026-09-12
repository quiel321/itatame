'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { CompeticaoShell, campoCompeticao as campo, useEventoCompeticao } from '../_components/CompeticaoShell';

type Equipe = { id: string; nome: string; academia: string; professor: string; cidade: string };
type Solicitacao = { id: string; equipe_nome: string; academia: string; professor: string; cidade: string; status: 'pendente' | 'aprovada' | 'recusada' };

export default function EquipesPage() {
  const contexto = useEventoCompeticao();
  return <CompeticaoShell titulo="Equipes e professores" descricao="O organizador pode cadastrar diretamente ou aprovar o pedido enviado por um professor. Equipe é o nome usado nas inscrições, chaves e ranking." contexto={contexto}><Editor key={contexto.eventoId} eventoId={contexto.eventoId} /></CompeticaoShell>;
}

function Editor({ eventoId }: { eventoId: string }) {
  const [equipes,setEquipes] = useState<Equipe[]>([]);
  const [solicitacoes,setSolicitacoes] = useState<Solicitacao[]>([]);
  const [form,setForm] = useState({ nome:'',academia:'',professor:'',cidade:'' });
  const [mensagem,setMensagem] = useState('');
  const [salvando,setSalvando] = useState(false);
  const [origens,setOrigens] = useState<{ equipe: string }[]>([]);
  const [selecionadas,setSelecionadas] = useState<string[]>([]);
  const [destino,setDestino] = useState('');
  const [busca,setBusca] = useState('');

  useEffect(() => {
    let ativo=true;
    async function carregar() {
      const [inscricoesResposta,equipesResposta,solicitacoesResposta] = await Promise.all([
        supabase.from('inscricoes').select('equipe').eq('evento_id',eventoId),
        supabase.from('equipes_evento').select('id,nome,academia,professor,cidade').eq('evento_id',eventoId).order('nome'),
        supabase.from('solicitacoes_equipe_evento').select('id,equipe_nome,academia,professor,cidade,status').eq('evento_id',eventoId).order('criado_em'),
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

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setMensagem('');
    const payload=Object.fromEntries(Object.entries(form).map(([k,v])=>[k,v.trim()]));
    const {data,error}=await supabase.from('equipes_evento').insert({...payload,evento_id:eventoId}).select().single();
    if(error) setMensagem(error.code==='23505'?'Já existe uma equipe com este nome no campeonato.':error.message);
    else { setEquipes([...equipes,data]); setForm({nome:'',academia:'',professor:'',cidade:''}); setMensagem('Equipe cadastrada. Ela já pode ser escolhida pelos atletas na inscrição.'); }
    setSalvando(false);
  }

  async function analisar(solicitacao: Solicitacao, aprovar: boolean) {
    setSalvando(true); setMensagem('');
    if (aprovar) {
      const { error } = await supabase.rpc('aprovar_solicitacao_equipe_evento', { p_solicitacao: solicitacao.id });
      if (error) setMensagem(error.message);
      else {
        setSolicitacoes(atual => atual.map(item => item.id === solicitacao.id ? { ...item, status: 'aprovada' } : item));
        const { data } = await supabase.from('equipes_evento').select('id,nome,academia,professor,cidade').eq('evento_id',eventoId).order('nome');
        setEquipes(data || []); setMensagem(`${solicitacao.equipe_nome} aprovada e liberada para as inscrições.`);
      }
    } else {
      const { error } = await supabase.from('solicitacoes_equipe_evento').update({ status: 'recusada', atualizado_em: new Date().toISOString() }).eq('id', solicitacao.id);
      if (error) setMensagem(error.message);
      else { setSolicitacoes(atual => atual.map(item => item.id === solicitacao.id ? { ...item, status: 'recusada' } : item)); setMensagem('Solicitação recusada. O professor poderá corrigir e reenviar.'); }
    }
    setSalvando(false);
  }

  async function unificar() {
    setSalvando(true); setMensagem('');
    try {
      const {data,error}=await supabase.rpc('unificar_equipes_evento',{p_evento:eventoId,p_destino:destino,p_nomes:selecionadas});
      if(error)throw new Error(error.message);
      setMensagem(`${data} inscrições vinculadas à equipe escolhida. Os perfis pessoais foram preservados.`);
      const nome=equipes.find(e=>e.id===destino)?.nome||'';
      setOrigens(origens.map(o=>selecionadas.includes(o.equipe)?{equipe:nome}:o));setSelecionadas([]);
    }catch(error){setMensagem((error as Error).message);}finally{setSalvando(false);}
  }

  const pendentes = solicitacoes.filter(item => item.status === 'pendente');
  return <>
    <section className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
      <h2 className="font-bold">Como uma equipe entra no campeonato</h2>
      <div className="mt-3 grid gap-3 text-sm text-zinc-400 md:grid-cols-3">
        <p><strong className="block text-white mb-1">Opção 1 · Organizador</strong>Cadastre a equipe diretamente usando o formulário desta página.</p>
        <p><strong className="block text-white mb-1">Opção 2 · Professor</strong>Na página pública do evento, o professor envia uma solicitação com a conta dele.</p>
        <p><strong className="block text-white mb-1">Conferência</strong>Ao aprovar, a equipe aparece na inscrição, nas chaves e no ranking do evento.</p>
      </div>
    </section>

    <section className="mb-6 rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Solicitações dos professores</h2><p className="mt-1 text-xs text-zinc-400">Confira nome, academia e responsável antes de aprovar.</p></div><span className="rounded-full bg-yellow-500 px-3 py-1 text-xs font-black text-black">{pendentes.length} pendentes</span></div>
      {!pendentes.length ? <p className="mt-4 text-sm text-zinc-500">Nenhuma solicitação aguardando análise.</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{pendentes.map(item => <article key={item.id} className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4"><h3 className="font-bold">{item.equipe_nome}</h3><p className="mt-1 text-sm text-zinc-400">{item.academia || 'Academia não informada'} · {item.cidade || 'Cidade não informada'}</p><p className="mt-2 text-sm">Professor: {item.professor}</p><div className="mt-4 flex gap-2"><button disabled={salvando} onClick={() => analisar(item,true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold disabled:opacity-40">Aprovar</button><button disabled={salvando} onClick={() => analisar(item,false)} className="rounded-lg border border-red-500/30 px-4 py-2 text-xs font-bold text-red-300 disabled:opacity-40">Recusar</button></div></article>)}</div>}
    </section>

    <div className="grid lg:grid-cols-[340px_1fr] gap-6"><form onSubmit={salvar} className="p-5 rounded-2xl border border-white/10 bg-zinc-900/50 space-y-4 self-start"><h2 className="font-bold">Cadastrar equipe diretamente</h2><p className="text-xs text-zinc-400">Use quando você já recebeu os dados do responsável.</p>{(['nome','academia','professor','cidade'] as const).map(k=><label key={k} className="block text-xs capitalize">{k==='nome'?'Nome da equipe':k}<input maxLength={120} required={k==='nome'} className={campo+' mt-1'} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<button disabled={salvando} className="w-full rounded-xl bg-red-600 p-3 font-bold disabled:opacity-40">{salvando?'Salvando...':'Cadastrar equipe'}</button></form>
    <section><input aria-label="Buscar equipe ou professor" className={campo} placeholder="Buscar equipe, academia ou professor" value={busca} onChange={e=>setBusca(e.target.value)}/><p className="my-4 text-xs text-zinc-400">{equipes.length} equipes aprovadas</p><div className="grid sm:grid-cols-2 gap-3">{equipes.filter(q=>[q.nome,q.academia,q.professor].join(' ').toLowerCase().includes(busca.toLowerCase())).map(q=><article key={q.id} className="p-5 border border-white/10 rounded-xl"><h2 className="font-bold">{q.nome}</h2><p className="text-zinc-400 text-sm mt-2">{q.academia || 'Academia não informada'}</p><p className="text-sm mt-2">Professor: {q.professor || 'Não informado'}</p><p className="text-xs text-zinc-500 mt-2">{q.cidade}</p></article>)}</div></section></div>

    <section className="mt-6 p-5 rounded-2xl border border-white/10"><h2 className="font-bold">Corrigir nomes duplicados nas inscrições</h2><p className="text-sm text-zinc-400 mt-2 mb-4">Use somente quando a mesma equipe foi escrita de formas diferentes. A unificação vale para este campeonato e fica bloqueada depois de gerar as chaves.</p><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{Array.from(new Set(origens.map(o=>o.equipe).filter(Boolean))).sort().map(nome=><label key={nome} className="text-sm flex gap-2"><input type="checkbox" checked={selecionadas.includes(nome)} onChange={e=>setSelecionadas(e.target.checked?[...selecionadas,nome]:selecionadas.filter(n=>n!==nome))}/>{nome} ({origens.filter(o=>o.equipe===nome).length})</label>)}</div><label className="block text-xs mt-4">Equipe correta<select className={campo+' mt-1 max-w-lg'} value={destino} onChange={e=>setDestino(e.target.value)}><option value="">Selecione a equipe que permanecerá</option>{equipes.map(q=><option key={q.id} value={q.id}>{q.nome}</option>)}</select></label><p className="text-sm my-3">Prévia: {origens.filter(o=>selecionadas.includes(o.equipe)).length} inscrições serão vinculadas a {equipes.find(q=>q.id===destino)?.nome||'uma equipe a selecionar'}.</p><button disabled={salvando||!destino||!selecionadas.length} onClick={unificar} className="rounded-xl bg-red-600 p-3 text-sm disabled:opacity-40">Confirmar unificação</button></section>
    {mensagem&&<p role="status" className="mt-5 p-4 border border-white/10 rounded-xl text-sm">{mensagem}</p>}
  </>;
}
