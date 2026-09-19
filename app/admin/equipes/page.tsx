'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { CompeticaoShell, campoCompeticao as campo, useEventoCompeticao } from '../_components/CompeticaoShell';
import { encontrarEquipeSemelhante } from '@/app/lib/equipes-nome';
import { UploadLogoEquipe } from '@/app/components/UploadLogoEquipe';

type Equipe = { id: string; nome: string; academia: string; professor: string; cidade: string; logo_url?: string | null; academia_logo_url?: string | null };
type Solicitacao = { id: string; equipe_nome: string; academia: string; professor: string; cidade: string; status: 'pendente' | 'aprovada' | 'recusada'; equipe_id: string | null; logo_url?: string | null };
type AcademiaEquipe = { id: string; equipeId: string; academia: string; professor: string; cidade: string; logo_url?: string | null };
type Confirmacao = { tipo: 'equipe' | 'academia'; id: string; equipeId: string; titulo: string; detalhe: string };

function textoIgual(a: string, b: string) {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

function academiasDaEquipe(equipe: Equipe, solicitacoes: Solicitacao[]): AcademiaEquipe[] {
  const vinculadas = solicitacoes
    .filter(item => item.status === 'aprovada' && item.equipe_id === equipe.id)
    .map(item => ({ id: item.id, equipeId: equipe.id, academia: item.academia, professor: item.professor, cidade: item.cidade, logo_url: item.logo_url }));
  if (!vinculadas.length) {
    return [{ id: `equipe-${equipe.id}`, equipeId: equipe.id, academia: equipe.academia, professor: equipe.professor, cidade: equipe.cidade, logo_url: equipe.academia_logo_url }];
  }
  const jaTemUnidadeInicial = vinculadas.some(item => textoIgual(item.academia, equipe.academia) && textoIgual(item.professor, equipe.professor));
  if (equipe.academia && !jaTemUnidadeInicial) {
    return [{ id: `equipe-${equipe.id}`, equipeId: equipe.id, academia: equipe.academia, professor: equipe.professor, cidade: equipe.cidade, logo_url: equipe.academia_logo_url }, ...vinculadas];
  }
  return vinculadas;
}

export default function EquipesPage() {
  const contexto = useEventoCompeticao();
  return <CompeticaoShell titulo="Equipes e professores" descricao="A equipe é o nome do ranking. Cada academia entra como unidade dessa equipe, com o professor responsável." contexto={contexto}><Editor key={contexto.eventoId} eventoId={contexto.eventoId} /></CompeticaoShell>;
}

function Editor({ eventoId }: { eventoId: string }) {
  const [equipes,setEquipes] = useState<Equipe[]>([]);
  const [solicitacoes,setSolicitacoes] = useState<Solicitacao[]>([]);
  const [form,setForm] = useState({ nome:'',academia:'',professor:'',cidade:'' });
  const [editandoEquipeId,setEditandoEquipeId] = useState('');
  const [editandoAcademia,setEditandoAcademia] = useState<AcademiaEquipe | null>(null);
  const [confirmacao,setConfirmacao] = useState<Confirmacao | null>(null);
  const [mensagem,setMensagem] = useState('');
  const [salvando,setSalvando] = useState(false);
  const [origens,setOrigens] = useState<{ equipe: string; equipe_id?: string | null }[]>([]);
  const [selecionadas,setSelecionadas] = useState<string[]>([]);
  const [destino,setDestino] = useState('');
  const [origemUniao,setOrigemUniao] = useState('');
  const [destinoUniao,setDestinoUniao] = useState('');
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
    setEditandoAcademia(null);
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
      } else if (editandoAcademia) {
        await chamarAdmin('PATCH', { tipo: 'academia', id: editandoAcademia.id, equipeId: editandoAcademia.equipeId, academia: payload.academia, professor: payload.professor, cidade: payload.cidade });
        await recarregar();
        cancelarEdicao();
        setMensagem('Academia atualizada.');
      } else {
        const semelhante = encontrarEquipeSemelhante(equipes, payload.nome);
        if (semelhante) throw new Error(`Já existe a equipe "${semelhante.nome}". Entre nela ou unifique, em vez de cadastrar outro nome.`);
        const {data,error}=await supabase.from('equipes_evento').insert({...payload,evento_id:eventoId}).select().single();
        if(error) throw new Error(error.code==='23505'?'Já existe uma equipe com este nome no campeonato.':error.message);
        setEquipes([...equipes,data]); setForm({nome:'',academia:'',professor:'',cidade:''});
        setMensagem('Equipe cadastrada. Ela já pode ser escolhida pelos atletas na inscrição.');
      }
    } catch (error) { setMensagem((error as Error).message); }
    setSalvando(false);
  }

  function editarEquipe(equipe: Equipe) {
    setEditandoAcademia(null);
    setEditandoEquipeId(equipe.id);
    setForm({ nome: equipe.nome, academia: equipe.academia, professor: equipe.professor, cidade: equipe.cidade });
    setMensagem('Editando o nome da equipe no ranking.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function editarAcademia(academia: AcademiaEquipe) {
    setEditandoEquipeId('');
    setEditandoAcademia(academia);
    setForm({ nome: equipes.find(item => item.id === academia.equipeId)?.nome || '', academia: academia.academia, professor: academia.professor, cidade: academia.cidade });
    setMensagem('Editando academia da equipe.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function confirmarExclusao() {
    if (!confirmacao) return;
    setSalvando(true); setMensagem('');
    try {
      await chamarAdmin('DELETE', { tipo: confirmacao.tipo, id: confirmacao.id, equipeId: confirmacao.equipeId });
      await recarregar();
      if ((editandoEquipeId && confirmacao.tipo === 'equipe' && confirmacao.id === editandoEquipeId) || (editandoAcademia && confirmacao.tipo === 'academia' && confirmacao.id === editandoAcademia.id)) cancelarEdicao();
      setMensagem(confirmacao.tipo === 'equipe' ? 'Equipe removida. As inscrições dos atletas foram preservadas.' : 'Academia removida desta equipe. O professor pode cadastrar de novo se precisar.');
      setConfirmacao(null);
    } catch (error) { setMensagem((error as Error).message); setConfirmacao(null); }
    setSalvando(false);
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

  async function unirOficiais() {
    setSalvando(true); setMensagem('');
    try {
      await chamarAdmin('PATCH', { tipo: 'unir', origemId: origemUniao, destinoId: destinoUniao });
      await recarregar();
      setOrigemUniao(''); setDestinoUniao('');
      setMensagem('Equipes unificadas. Inscrições, chaves e ranking passam a usar o nome oficial.');
    } catch (error) { setMensagem((error as Error).message); }
    setSalvando(false);
  }

  async function unificar() {
    setSalvando(true); setMensagem('');
    try {
      const {data,error}=await supabase.rpc('unificar_equipes_evento',{p_evento:eventoId,p_destino:destino,p_nomes:selecionadas});
      if(error)throw new Error(error.message);
      setMensagem(`${data} inscrições vinculadas à equipe escolhida. Os perfis pessoais foram preservados.`);
      const nome=equipes.find(e=>e.id===destino)?.nome||'';
      setOrigens(origens.map(o=>selecionadas.includes(o.equipe)?{equipe:nome,equipe_id:destino}:o));setSelecionadas([]);
    }catch(error){setMensagem((error as Error).message);}finally{setSalvando(false);}
  }

  const pendentes = solicitacoes.filter(item => item.status === 'pendente');
  const nomesNaoVinculados = Array.from(new Set(origens.filter(item => !item.equipe_id && item.equipe).map(item => item.equipe))).sort();
  const totalAcademias = equipes.reduce((total, equipe) => total + academiasDaEquipe(equipe, solicitacoes).length, 0);
  const equipesFiltradas = equipes.filter(equipe => {
    const academias = academiasDaEquipe(equipe, solicitacoes);
    return [equipe.nome, ...academias.flatMap(item => [item.academia, item.professor, item.cidade])].join(' ').toLowerCase().includes(busca.toLowerCase());
  });
  const tituloForm = editandoEquipeId ? 'Editar equipe' : editandoAcademia ? 'Editar academia' : 'Cadastrar equipe diretamente';
  const descricaoForm = editandoEquipeId
    ? 'Altera o nome usado nas inscrições, chaves e ranking por equipes.'
    : editandoAcademia
      ? 'Altera só esta academia. A equipe do ranking permanece a mesma.'
      : 'O nome da equipe é o do ranking. Academia, professor e cidade ficam como a primeira unidade.';
  return <>
    <section className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
      <h2 className="font-bold">Como uma equipe entra no campeonato</h2>
      <div className="mt-3 grid gap-3 text-sm text-zinc-400 md:grid-cols-3">
        <p><strong className="block text-white mb-1">Opção 1 · Organizador</strong>Cadastre a equipe diretamente usando o formulário desta página.</p>
        <p><strong className="block text-white mb-1">Opção 2 · Professor</strong>Na página pública do evento, o professor pesquisa a equipe. Se ela já existe, entra com a academia dele; se não, cadastra um nome novo.</p>
        <p><strong className="block text-white mb-1">Resultado</strong>O ranking por equipes usa o nome único. Academias da mesma bandeira pontuam juntas na equipe e separadas no ranking por academias. A logo da equipe e da academia sobe no card abaixo — o sistema converte para WebP leve.</p>
      </div>
    </section>

    <section className="mb-6 rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Solicitações antigas</h2><p className="mt-1 text-xs text-zinc-400">Pedidos anteriores à liberação do cadastro direto ainda podem ser analisados aqui.</p></div><span className="rounded-full bg-yellow-500 px-3 py-1 text-xs font-black text-black">{pendentes.length} pendentes</span></div>
      {!pendentes.length ? <p className="mt-4 text-sm text-zinc-500">Nenhuma solicitação aguardando análise.</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{pendentes.map(item => <article key={item.id} className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4"><h3 className="font-bold">{item.equipe_nome}</h3><p className="mt-1 text-sm text-zinc-400">{item.academia || 'Academia não informada'} · {item.cidade || 'Cidade não informada'}</p><p className="mt-2 text-sm">Professor: {item.professor}</p><div className="mt-4 flex gap-2"><button disabled={salvando} onClick={() => analisar(item,true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold disabled:opacity-40">Aprovar</button><button disabled={salvando} onClick={() => analisar(item,false)} className="rounded-lg border border-red-500/30 px-4 py-2 text-xs font-bold text-red-300 disabled:opacity-40">Recusar</button></div></article>)}</div>}
    </section>

    <div className="grid lg:grid-cols-[340px_1fr] gap-6">
      <form onSubmit={salvar} className="p-5 rounded-2xl border border-white/10 bg-zinc-900/50 space-y-4 self-start">
        <h2 className="font-bold">{tituloForm}</h2>
        <p className="text-xs text-zinc-400">{descricaoForm}</p>
        {!editandoAcademia && <label className="block text-xs">Nome da equipe<input maxLength={120} required className={campo+' mt-1'} value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></label>}
        {!editandoEquipeId && <>
          <label className="block text-xs">Academia / unidade<input maxLength={120} className={campo+' mt-1'} value={form.academia} onChange={e=>setForm({...form,academia:e.target.value})}/></label>
          <label className="block text-xs">Professor<input maxLength={120} required={Boolean(editandoAcademia)} className={campo+' mt-1'} value={form.professor} onChange={e=>setForm({...form,professor:e.target.value})}/></label>
          <label className="block text-xs">Cidade<input maxLength={120} className={campo+' mt-1'} value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})}/></label>
        </>}
        <button disabled={salvando} className="w-full rounded-xl bg-red-600 p-3 font-bold disabled:opacity-40">{salvando?'Salvando...':editandoEquipeId || editandoAcademia ? 'Salvar alterações' : 'Cadastrar equipe'}</button>
        {(editandoEquipeId || editandoAcademia) && <button type="button" onClick={cancelarEdicao} className="w-full rounded-xl border border-white/10 p-3 text-sm text-zinc-300">Cancelar edição</button>}
      </form>
      <section>
        <input aria-label="Buscar equipe ou professor" className={campo} placeholder="Buscar equipe, academia ou professor" value={busca} onChange={e=>setBusca(e.target.value)}/>
        <p className="my-4 text-xs text-zinc-400">{equipes.length} {equipes.length === 1 ? 'equipe' : 'equipes'} · {totalAcademias} {totalAcademias === 1 ? 'academia' : 'academias'}</p>
        <div className="space-y-3">{equipesFiltradas.map(equipe => {
          const academias = academiasDaEquipe(equipe, solicitacoes);
          return <article key={equipe.id} className="rounded-2xl border border-white/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500">Equipe no ranking</p>
                <h2 className="mt-1 text-xl font-black">{equipe.nome}</h2>
                <div className="mt-3 max-w-sm">
                  <UploadLogoEquipe eventoId={eventoId} equipeId={equipe.id} tipo="equipe" logoUrl={equipe.logo_url} nome={equipe.nome} onAtualizou={(url) => setEquipes(atual => atual.map(item => item.id === equipe.id ? { ...item, logo_url: url } : item))} />
                </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-300">{academias.length} {academias.length === 1 ? 'academia' : 'academias'}</span>
                <button type="button" onClick={() => editarEquipe(equipe)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold">Editar</button>
                <button type="button" onClick={() => setConfirmacao({ tipo: 'equipe', id: equipe.id, equipeId: equipe.id, titulo: `Excluir equipe ${equipe.nome}?`, detalhe: 'A equipe some da inscrição. As academias vinculadas são desfeitas e as inscrições dos atletas permanecem.' })} className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold text-red-300">Excluir</button>
              </div>
            </div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Academias inscritas</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">{academias.map(academia => <li key={academia.id} className="rounded-xl border border-white/10 bg-black/40 p-3">
              <p className="font-bold text-white">{academia.academia || 'Academia não informada'}</p>
              <p className="mt-1 text-sm text-zinc-400">{academia.professor || 'Professor não informado'}</p>
              {academia.cidade ? <p className="mt-1 text-xs text-zinc-500">{academia.cidade}</p> : null}
              <div className="mt-3">
                <UploadLogoEquipe eventoId={eventoId} equipeId={equipe.id} academiaId={academia.id} tipo="academia" logoUrl={academia.logo_url} nome={academia.academia || equipe.nome} onAtualizou={(url) => {
                  if (academia.id.startsWith('equipe-')) setEquipes(atual => atual.map(item => item.id === equipe.id ? { ...item, academia_logo_url: url } : item));
                  else setSolicitacoes(atual => atual.map(item => item.id === academia.id ? { ...item, logo_url: url } : item));
                }} />
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => editarAcademia(academia)} className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold">Editar</button>
                <button type="button" onClick={() => setConfirmacao({ tipo: 'academia', id: academia.id, equipeId: academia.equipeId, titulo: `Excluir ${academia.academia || 'esta academia'}?`, detalhe: `Ela sai da equipe ${equipe.nome}. Os atletas que já se inscreveram nessa equipe continuam nela.` })} className="rounded-lg border border-red-500/20 px-3 py-1.5 text-[10px] font-bold text-red-300">Excluir</button>
              </div>
            </li>)}</ul>
          </article>;
        })}</div>
      </section>
    </div>

    {equipes.length > 1 && (
      <section className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
        <h2 className="font-bold">Unificar equipes duplicadas</h2>
        <p className="mt-2 text-sm text-zinc-400">Se alguém cadastrou LEGADO e outra pessoa cadastrou LEGADO JIU, junte as duas no nome oficial. Inscrições e chaves passam a contar juntas no ranking.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block text-xs">Equipe digitada errado
            <select className={campo+' mt-1'} value={origemUniao} onChange={e=>setOrigemUniao(e.target.value)}>
              <option value="">Selecione</option>
              {equipes.filter(equipe => equipe.id !== destinoUniao).map(equipe => <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>)}
            </select>
          </label>
          <label className="block text-xs">Nome oficial que permanece
            <select className={campo+' mt-1'} value={destinoUniao} onChange={e=>setDestinoUniao(e.target.value)}>
              <option value="">Selecione</option>
              {equipes.filter(equipe => equipe.id !== origemUniao).map(equipe => <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>)}
            </select>
          </label>
        </div>
        <button disabled={salvando||!origemUniao||!destinoUniao} onClick={unirOficiais} className="mt-4 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold disabled:opacity-40">Unificar no ranking</button>
      </section>
    )}

    <details className="mt-6 rounded-2xl border border-white/10 p-5">
      <summary className="cursor-pointer font-bold">Vincular inscrições antigas a uma equipe oficial <span className="ml-2 text-xs text-zinc-500">{nomesNaoVinculados.length} nomes pendentes</span></summary>
      <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-zinc-300"><strong className="block text-cyan-300">Quando usar?</strong>Somente em inscrições antigas que ainda não possuem vínculo. Exemplo: se “LEGADO” representa a equipe “Academia Central”, marque LEGADO, escolha Academia Central e confirme. Se LEGADO for o nome correto, cadastre primeiro uma equipe oficial com esse mesmo nome.</div>
      {!nomesNaoVinculados.length ? <p className="mt-4 text-sm text-emerald-400">Todas as inscrições já estão vinculadas a equipes oficiais.</p> : <><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{nomesNaoVinculados.map(nome=><label key={nome} className="flex gap-2 text-sm"><input type="checkbox" checked={selecionadas.includes(nome)} onChange={e=>setSelecionadas(e.target.checked?[...selecionadas,nome]:selecionadas.filter(n=>n!==nome))}/>{nome} ({origens.filter(o=>o.equipe===nome && !o.equipe_id).length} inscrições)</label>)}</div><label className="block text-xs mt-4">Equipe oficial que receberá as inscrições<select className={campo+' mt-1 max-w-lg'} value={destino} onChange={e=>setDestino(e.target.value)}><option value="">Selecione a equipe correta</option>{equipes.map(q=><option key={q.id} value={q.id}>{q.nome}</option>)}</select></label><p className="text-sm my-3">Prévia: {origens.filter(o=>selecionadas.includes(o.equipe) && !o.equipe_id).length} inscrições serão vinculadas a {equipes.find(q=>q.id===destino)?.nome||'uma equipe a selecionar'}.</p><button disabled={salvando||!destino||!selecionadas.length} onClick={unificar} className="rounded-xl bg-red-600 p-3 text-sm disabled:opacity-40">Confirmar vínculo</button></>}
    </details>
    {mensagem&&<p role="status" className="mt-5 p-4 border border-white/10 rounded-xl text-sm">{mensagem}</p>}
    {confirmacao && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4"><div role="dialog" aria-modal="true" aria-labelledby="titulo-excluir-equipe" className="w-full max-w-md rounded-2xl border border-red-500/30 bg-zinc-950 p-6 shadow-2xl"><h2 id="titulo-excluir-equipe" className="text-lg font-black">{confirmacao.titulo}</h2><p className="mt-2 text-sm text-zinc-400">{confirmacao.detalhe}</p><div className="mt-5 flex gap-3"><button type="button" onClick={() => setConfirmacao(null)} className="flex-1 rounded-xl border border-white/10 p-3 text-sm font-bold">Cancelar</button><button type="button" disabled={salvando} onClick={confirmarExclusao} className="flex-1 rounded-xl bg-red-600 p-3 text-sm font-bold disabled:opacity-40">Confirmar exclusão</button></div></div></div>}
  </>;
}
