'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { FAIXA_TODAS_AS_FAIXAS, faixaEhLivre, faixasDaCategoria, rotuloCategoria, serializarFaixasCategoria, validarCategoria, type CategoriaCompeticao } from '@/app/lib/categorias-competicao';
import { faixasCadastradas, fonteCategoriasIBJJF, modelosPesoIBJJF, opcoesFaixaCategoria } from '@/app/lib/categorias-ibjjf';
import { CompeticaoShell, campoCompeticao as campo, useEventoCompeticao } from '../_components/CompeticaoShell';

type ModoCadastro = 'modelo' | 'copiar' | 'manual';
type EventoOpcao = { id: string | number; nome: string | null };
type CategoriaNova = Omit<CategoriaCompeticao, 'id' | 'evento_id'>;

const inicial = { nome: '', modalidade: 'Jiu-Jitsu', sexo: 'Masculino', faixa: 'Branca', idade_min: 18, idade_max: 29, peso_min: 0, peso_max: null as number | null, tempo_minutos: 5, tipo: 'peso' as const, ativa: true };
export default function CategoriasPage() {
  const contexto = useEventoCompeticao();
  return <CompeticaoShell titulo="Categorias do campeonato" descricao="Escolha como montar a tabela. Depois, o sistema mostra a cada atleta somente as categorias compatíveis com sexo, idade, faixa e peso." contexto={contexto}><Editor key={contexto.eventoId} eventoId={contexto.eventoId} /></CompeticaoShell>;
}

function Editor({ eventoId }: { eventoId: string }) {
  const [categorias, setCategorias] = useState<CategoriaCompeticao[]>([]);
  const [eventos, setEventos] = useState<EventoOpcao[]>([]);
  const [eventoOrigem, setEventoOrigem] = useState('');
  const [modo, setModo] = useState<ModoCadastro>('modelo');
  const [form, setForm] = useState<CategoriaNova>(inicial);
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [modeloId, setModeloId] = useState(modelosPesoIBJJF[0].id);
  const [categoriasEmUso, setCategoriasEmUso] = useState<Set<string>>(new Set());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [categoriaExcluir, setCategoriaExcluir] = useState<CategoriaCompeticao | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!eventoId) return;
    async function carregar() {
      const { data: authData } = await supabase.auth.getUser();
      const [categoriasResposta, eventosResposta, inscricoesResposta, chavesResposta] = await Promise.all([
        supabase.from('categorias_evento').select('*').eq('evento_id', eventoId).order('idade_min'),
        authData.user ? supabase.from('eventos').select('id,nome').eq('organizador_id', authData.user.id).neq('id', eventoId).order('id', { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.from('inscricoes').select('categoria_id').eq('evento_id', eventoId).not('categoria_id', 'is', null),
        supabase.from('chaves').select('categoria_id').eq('evento_id', eventoId).not('categoria_id', 'is', null),
      ]);
      if (!ativo) return;
      setCategorias(categoriasResposta.data || []);
      setEventos((eventosResposta.data || []) as EventoOpcao[]);
      setCategoriasEmUso(new Set([
        ...(inscricoesResposta.data || []).map(item => String(item.categoria_id)),
        ...(chavesResposta.data || []).map(item => String(item.categoria_id)),
      ]));
      if (categoriasResposta.error) setMensagem('Não foi possível carregar as categorias deste campeonato.');
      setCarregando(false);
    }
    void carregar();
    return () => { ativo = false; };
  }, [eventoId]);

  async function inserir(lista: CategoriaNova[], sucesso: string) {
    setSalvando(true); setMensagem('');
    try {
      lista.forEach(validarCategoria);
      const payload = lista.map(item => ({ ...item, evento_id: eventoId }));
      const { data, error } = await supabase.from('categorias_evento').insert(payload).select();
      if (error) throw new Error(error.code === '23505' ? 'Uma ou mais categorias já existem neste campeonato.' : error.message);
      setCategorias(atual => [...atual, ...(data || [])]);
      setMensagem(sucesso);
      return true;
    } catch (error) { setMensagem((error as Error).message); return false; }
    finally { setSalvando(false); }
  }

  async function importarModelo() {
    const modelo = modelosPesoIBJJF.find(item => item.id === modeloId) || modelosPesoIBJJF[0];
    const lista = modelo.pesos.map(peso => ({
      ...form,
      ...peso,
      sexo: modelo.sexo || form.sexo,
      idade_min: modelo.idade_min ?? form.idade_min,
      idade_max: modelo.idade_max ?? form.idade_max,
      tempo_minutos: modelo.tempo_minutos ?? form.tempo_minutos,
      nome: peso.nome,
      tipo: 'peso' as const,
      ativa: true,
    }));
    await inserir(lista, `${modelo.pesos.length} categorias de referência IBJJF importadas. Revise faixa, idade, tempo e regulamento antes de abrir as inscrições.`);
  }

  function selecionarModelo(id: string) {
    const modelo = modelosPesoIBJJF.find(item => item.id === id) || modelosPesoIBJJF[0];
    setModeloId(id);
    setForm(atual => ({
      ...atual,
      sexo: modelo.sexo || atual.sexo,
      idade_min: modelo.idade_min ?? atual.idade_min,
      idade_max: modelo.idade_max ?? atual.idade_max,
      tempo_minutos: modelo.tempo_minutos ?? atual.tempo_minutos,
      faixa: modelo.faixasPermitidas?.includes(atual.faixa) ? atual.faixa : (modelo.faixasPermitidas?.[0] || atual.faixa),
    }));
  }

  async function copiarCampeonato() {
    if (!eventoOrigem) return;
    setSalvando(true); setMensagem('');
    const { data, error } = await supabase.from('categorias_evento').select('nome,modalidade,sexo,faixa,idade_min,idade_max,peso_min,peso_max,tempo_minutos,tipo,ativa').eq('evento_id', eventoOrigem);
    setSalvando(false);
    if (error) { setMensagem(error.message); return; }
    if (!data?.length) { setMensagem('O campeonato escolhido não possui categorias para copiar.'); return; }
    await inserir(data as CategoriaNova[], `${data.length} categorias copiadas. Revise a tabela antes de abrir as inscrições.`);
  }

  async function salvarManual(e: React.FormEvent) {
    e.preventDefault();
    const categoria = { ...form, nome: form.nome.trim(), faixa: form.faixa.trim(), modalidade: form.modalidade.trim() };
    if (editandoId) {
      setSalvando(true); setMensagem('');
      try {
        validarCategoria(categoria);
        const { data, error } = await supabase.from('categorias_evento').update(categoria).eq('id', editandoId).eq('evento_id', eventoId).select().single();
        if (error) throw new Error(error.code === '23505' ? 'Já existe uma categoria com esses dados.' : error.message);
        setCategorias(atual => atual.map(item => item.id === editandoId ? data : item));
        setMensagem('Categoria atualizada. As opções de inscrição já usam os novos dados.');
        cancelarEdicao();
      } catch (error) { setMensagem((error as Error).message); }
      finally { setSalvando(false); }
      return;
    }
    const salvou = await inserir([categoria], 'Categoria cadastrada e disponível para os atletas elegíveis.');
    if (salvou) setForm(atual => ({ ...atual, nome: '' }));
  }

  function editarCategoria(categoria: CategoriaCompeticao) {
    setModo('manual');
    setEditandoId(categoria.id);
    setForm({
      nome: categoria.nome, modalidade: categoria.modalidade, sexo: categoria.sexo,
      faixa: categoria.faixa, idade_min: categoria.idade_min, idade_max: categoria.idade_max,
      peso_min: categoria.peso_min, peso_max: categoria.peso_max,
      tempo_minutos: categoria.tempo_minutos, tipo: categoria.tipo, ativa: categoria.ativa,
    });
    setMensagem('Editando a categoria selecionada.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(inicial);
  }

  async function alternarCategoria(categoria: CategoriaCompeticao) {
    setSalvando(true); setMensagem('');
    const { data, error } = await supabase.from('categorias_evento').update({ ativa: !categoria.ativa }).eq('id', categoria.id).eq('evento_id', eventoId).select().single();
    setSalvando(false);
    if (error) { setMensagem(error.message); return; }
    setCategorias(atual => atual.map(item => item.id === categoria.id ? data : item));
    setMensagem(data.ativa ? 'Categoria reativada e disponível para novas inscrições.' : 'Categoria pausada e ocultada das novas inscrições.');
  }

  async function excluirCategoria() {
    if (!categoriaExcluir) return;
    setSalvando(true); setMensagem('');
    const { data, error } = await supabase.from('categorias_evento').delete().eq('id', categoriaExcluir.id).eq('evento_id', eventoId).select('id').maybeSingle();
    setSalvando(false);
    if (error) { setMensagem(error.code === '23503' ? 'Categoria em uso. Ela foi preservada para proteger inscrições e chaves.' : error.message); setCategoriaExcluir(null); return; }
    if (!data) { setMensagem('A categoria não foi excluída. Atualize a página e confirme seu acesso ao campeonato.'); setCategoriaExcluir(null); return; }
    setCategorias(atual => atual.filter(item => item.id !== categoriaExcluir.id));
    if (editandoId === categoriaExcluir.id) cancelarEdicao();
    setMensagem('Categoria excluída.');
    setCategoriaExcluir(null);
  }

  const seletorBase = <>
    <label className="block text-xs">Tipo
      <select className={campo + ' mt-1'} value={form.tipo} onChange={e => {
        const tipo = e.target.value === 'absoluto' ? 'absoluto' : 'peso';
        setForm({
          ...form,
          tipo,
          nome: tipo === 'absoluto' && !form.nome.trim() ? 'Absoluto' : form.nome,
          peso_min: tipo === 'absoluto' ? 0 : form.peso_min,
          peso_max: tipo === 'absoluto' ? null : form.peso_max,
          faixa: tipo === 'peso' ? (faixasDaCategoria(form.faixa)[0] || 'Branca') : form.faixa,
        });
      }}>
        <option value="peso">Categoria de peso</option>
        <option value="absoluto">Absoluto</option>
      </select>
    </label>
    <label className="block text-xs">Modalidade<input required maxLength={80} className={campo + ' mt-1'} value={form.modalidade} onChange={e => setForm({ ...form, modalidade: e.target.value })} /></label>
    {form.tipo === 'absoluto' ? (
      <fieldset>
        <legend className="text-xs">Faixas deste absoluto</legend>
        <label className="mt-2 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={faixaEhLivre(form.faixa)} onChange={e => setForm({ ...form, faixa: e.target.checked ? FAIXA_TODAS_AS_FAIXAS : 'Branca' })} />
          Todas as faixas
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {faixasCadastradas.map(faixa => {
            const marcada = !faixaEhLivre(form.faixa) && faixasDaCategoria(form.faixa).some(item => item.toLowerCase() === faixa.toLowerCase());
            return <label key={faixa} className={`flex items-center gap-2 text-xs ${faixaEhLivre(form.faixa) ? 'opacity-40' : ''}`}>
              <input type="checkbox" disabled={faixaEhLivre(form.faixa)} checked={marcada} onChange={e => {
                const atuais = faixasDaCategoria(form.faixa);
                const proxima = e.target.checked ? [...atuais, faixa] : atuais.filter(item => item.toLowerCase() !== faixa.toLowerCase());
                if (!proxima.length) return;
                setForm({ ...form, faixa: serializarFaixasCategoria(proxima) });
              }} />
              {faixa}
            </label>;
          })}
        </div>
        <span className="mt-2 block text-zinc-400">Marque só as faixas que lutam juntas. Ex.: Branca e Azul no feminino. Somente quem tiver uma dessas faixas, o mesmo sexo e a idade do intervalo vê e compra este extra. Juvenil a Master: idade 16 a 100.</span>
      </fieldset>
    ) : (
      <label className="block text-xs">Faixa
        <select required className={campo + ' mt-1'} value={form.faixa} onChange={e => setForm({ ...form, faixa: e.target.value })}>
          {opcoesFaixaCategoria(form.faixa)
            .filter((faixa, indice, lista) => lista.findIndex(item => item.toLowerCase() === faixa.toLowerCase()) === indice)
            .map(faixa => <option key={faixa} value={faixa}>{faixa}</option>)}
        </select>
        <span className="mt-1 block text-zinc-400">A faixa aparecerá automaticamente na descrição da categoria.</span>
      </label>
    )}
    <label className="block text-xs">Sexo competitivo<select className={campo + ' mt-1'} value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })}><option>Masculino</option><option>Feminino</option></select></label>
    <div className="grid grid-cols-2 gap-3">{(['idade_min','idade_max','tempo_minutos'] as const).map(k => <label key={k} className="text-xs">{{ idade_min:'Idade mínima', idade_max:'Idade máxima', tempo_minutos:'Tempo de luta' }[k]}<input required type="number" min={k.startsWith('idade') ? 4 : 1} max={k.startsWith('idade') ? 100 : 30} step="1" className={campo + ' mt-1'} value={form[k]} onChange={e => setForm({ ...form, [k]: Number(e.target.value) })} /></label>)}</div>
  </>;

  const modeloSelecionado = modelosPesoIBJJF.find(item => item.id === modeloId) || modelosPesoIBJJF[0];
  const seletorModelo = <>
    <label className="block text-xs">Tabela de referência<select className={campo + ' mt-1'} value={modeloId} onChange={e => selecionarModelo(e.target.value)}><optgroup label="Adulto">{modelosPesoIBJJF.filter(modelo => modelo.id.startsWith('adulto_')).map(modelo => <option key={modelo.id} value={modelo.id}>{modelo.titulo}</option>)}</optgroup><optgroup label="Kids / Infantil">{modelosPesoIBJJF.filter(modelo => modelo.id.startsWith('kids_')).map(modelo => <option key={modelo.id} value={modelo.id}>{modelo.titulo}</option>)}</optgroup></select></label>
    <p className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-zinc-400">{modeloSelecionado.descricao}</p>
    <label className="block text-xs">Modalidade<input required maxLength={80} className={campo + ' mt-1'} value={form.modalidade} onChange={e => setForm({ ...form, modalidade: e.target.value })} /></label>
    <label className="block text-xs">Faixa<select className={campo + ' mt-1'} value={form.faixa} onChange={e => setForm({ ...form, faixa: e.target.value })}>{(modeloSelecionado.faixasPermitidas || [form.faixa]).map(faixa => <option key={faixa}>{faixa}</option>)}</select></label>
    <label className="block text-xs">Sexo competitivo<select disabled={Boolean(modeloSelecionado.sexo)} className={campo + ' mt-1 disabled:opacity-60'} value={modeloSelecionado.sexo || form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })}><option>Masculino</option><option>Feminino</option></select></label>
    <div className="grid grid-cols-2 gap-3">{(['idade_min','idade_max','tempo_minutos'] as const).map(k => <label key={k} className="text-xs">{{ idade_min:'Idade mínima', idade_max:'Idade máxima', tempo_minutos:'Tempo de luta' }[k]}<input required type="number" min={k.startsWith('idade') ? 4 : 1} max={k.startsWith('idade') ? 100 : 30} step="1" className={campo + ' mt-1'} value={form[k]} onChange={e => setForm({ ...form, [k]: Number(e.target.value) })} /></label>)}</div>
  </>;

  return <>
    <section className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
      <h2 className="font-bold">Como funciona</h2>
      <div className="mt-3 grid gap-3 text-sm text-zinc-400 md:grid-cols-3">
        <p><strong className="block text-white mb-1">1. Monte a tabela</strong>Importe um modelo, copie outro campeonato ou cadastre manualmente.</p>
        <p><strong className="block text-white mb-1">2. O atleta se inscreve</strong>O sistema filtra automaticamente pelas informações do perfil.</p>
        <p><strong className="block text-white mb-1">3. Gere as chaves</strong>Cada absoluto vira uma chave e um pódio. Branca e azul juntas ficam no mesmo grupo; roxa não entra se você não marcou essa faixa.</p>
      </div>
    </section>

    <div className="mb-5 grid gap-2 sm:grid-cols-3">
      {([
        ['modelo','Usar modelo pronto','Cria uma tabela inicial editável.'],
        ['copiar','Copiar campeonato','Reaproveita uma tabela já usada.'],
        ['manual','Criar manualmente','Cadastra uma categoria específica.'],
      ] as const).map(([id,titulo,descricao]) => <button key={id} type="button" onClick={() => setModo(id)} className={`rounded-xl border p-4 text-left ${modo === id ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-black/30'}`}><strong className="block text-sm">{titulo}</strong><span className="mt-1 block text-xs text-zinc-400">{descricao}</span></button>)}
    </div>

    <div className="grid lg:grid-cols-[380px_1fr] gap-6">
      <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 self-start">
        {modo === 'modelo' && <div className="space-y-4"><h2 className="font-bold">Categorias de referência IBJJF</h2><p className="text-xs leading-relaxed text-zinc-400">Escolha Adulto ou Kids/Infantil. Nos modelos infantis, selecione a idade, a faixa e o sexo; o sistema preenche os nove pesos oficiais em quilogramas e o tempo de luta. A pesagem inclui o kimono.</p>{seletorModelo}<a href={modeloSelecionado.fonte || fonteCategoriasIBJJF} target="_blank" rel="noopener noreferrer" className="block text-xs font-bold text-cyan-400 underline underline-offset-4">Consultar fonte oficial da IBJJF</a><button type="button" disabled={salvando} onClick={importarModelo} className="w-full rounded-xl bg-red-600 p-3 font-bold disabled:opacity-40">Importar tabela selecionada</button></div>}
        {modo === 'copiar' && <div className="space-y-4"><h2 className="font-bold">Copiar de outro campeonato</h2><p className="text-xs text-zinc-400">Copia todas as categorias de outro evento seu. As categorias do evento original permanecem intactas.</p><label className="block text-xs">Campeonato de origem<select className={campo + ' mt-1'} value={eventoOrigem} onChange={e => setEventoOrigem(e.target.value)}><option value="">Selecione</option>{eventos.map(evento => <option key={evento.id} value={String(evento.id)}>{evento.nome || `Evento ${evento.id}`}</option>)}</select></label><button type="button" disabled={salvando || !eventoOrigem} onClick={copiarCampeonato} className="w-full rounded-xl bg-red-600 p-3 font-bold disabled:opacity-40">Copiar tabela</button></div>}
        {modo === 'manual' && <form onSubmit={salvarManual} className="space-y-4"><h2 className="font-bold">{editandoId ? 'Editar categoria' : 'Nova categoria'}</h2><p className="text-xs text-zinc-400">{editandoId ? 'Revise os dados e salve. Categorias já utilizadas ficam protegidas.' : 'Use para peso, absoluto de uma faixa, absoluto de duas faixas (ex.: branca e azul) ou todas as faixas.'}</p><label className="block text-xs">Nome da categoria<input required maxLength={80} className={campo + ' mt-1'} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>{seletorBase}{form.tipo === 'peso' && <div className="grid grid-cols-2 gap-3"><label className="text-xs">Peso acima de (kg)<input required type="number" min="0" max="500" step="0.1" className={campo + ' mt-1'} value={form.peso_min} onChange={e => setForm({ ...form, peso_min: Number(e.target.value) })} /></label><label className="text-xs">Peso máximo (kg)<input type="number" min="0.1" max="500" step="0.1" placeholder="Sem limite" className={campo + ' mt-1'} value={form.peso_max ?? ''} onChange={e => setForm({ ...form, peso_max: e.target.value === '' ? null : Number(e.target.value) })} /></label></div>}<button disabled={salvando || carregando} className="w-full rounded-xl bg-red-600 p-3 font-bold disabled:opacity-40">{editandoId ? 'Salvar alterações' : 'Cadastrar categoria'}</button>{editandoId && <button type="button" onClick={cancelarEdicao} className="w-full rounded-xl border border-white/10 p-3 text-sm text-zinc-300">Cancelar edição</button>}</form>}
      </section>

      <section><label className="sr-only" htmlFor="busca-categoria">Buscar categoria</label><input id="busca-categoria" className={campo} placeholder="Buscar nome, faixa ou divisão" value={busca} onChange={e => setBusca(e.target.value)} /><p className="my-4 text-xs text-zinc-400">{categorias.length} categorias cadastradas</p><div className="space-y-3">{categorias.filter(c => rotuloCategoria(c).toLowerCase().includes(busca.toLowerCase())).map(c => { const emUso = categoriasEmUso.has(c.id); return <article key={c.id} className={`rounded-xl border p-4 ${c.ativa ? 'border-white/10' : 'border-yellow-500/20 bg-yellow-500/5 opacity-75'}`}><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-bold">{c.nome}</h2><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${emUso ? 'bg-cyan-500/10 text-cyan-300' : c.ativa ? 'bg-green-500/10 text-green-300' : 'bg-yellow-500/10 text-yellow-300'}`}>{c.tipo === 'absoluto' ? 'Absoluto · ' : ''}{emUso ? 'Em uso · protegida' : c.ativa ? 'Ativa' : 'Pausada'}</span></div><p className="text-sm text-zinc-400 mt-1">{rotuloCategoria(c)}</p><p className="text-xs text-red-300 mt-2">{c.tempo_minutos} minutos</p>{emUso ? <p className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2 text-[10px] text-cyan-100">Possui inscrição ou chave vinculada. Os dados foram bloqueados para preservar o campeonato.</p> : <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => editarCategoria(c)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold">Editar</button><button type="button" disabled={salvando} onClick={() => alternarCategoria(c)} className="rounded-lg border border-yellow-500/20 px-3 py-2 text-xs font-bold text-yellow-300 disabled:opacity-40">{c.ativa ? 'Pausar' : 'Reativar'}</button><button type="button" onClick={() => setCategoriaExcluir(c)} className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold text-red-300">Excluir</button></div>}</article>; })}</div>{!categorias.length && !carregando && <p className="text-zinc-400 text-sm">Nenhuma categoria cadastrada. Escolha uma das três opções ao lado para começar.</p>}</section>
    </div>
    {mensagem && <p role="status" className="mt-5 rounded-xl border border-white/10 p-4 text-sm">{mensagem}</p>}
    {categoriaExcluir && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4"><div role="dialog" aria-modal="true" aria-labelledby="titulo-excluir-categoria" className="w-full max-w-md rounded-2xl border border-red-500/30 bg-zinc-950 p-6 shadow-2xl"><h2 id="titulo-excluir-categoria" className="text-lg font-black">Excluir categoria?</h2><p className="mt-2 text-sm text-zinc-400">A categoria <strong className="text-white">{categoriaExcluir.nome}</strong> será removida deste campeonato. Essa ação é permitida somente enquanto ela não possuir inscrições ou chaves.</p><div className="mt-5 flex gap-3"><button type="button" onClick={() => setCategoriaExcluir(null)} className="flex-1 rounded-xl border border-white/10 p-3 text-sm font-bold">Cancelar</button><button type="button" disabled={salvando} onClick={excluirCategoria} className="flex-1 rounded-xl bg-red-600 p-3 text-sm font-bold disabled:opacity-40">Confirmar exclusão</button></div></div></div>}
  </>;
}
