'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { rotuloCategoria, validarCategoria, type CategoriaCompeticao } from '@/app/lib/categorias-competicao';
import { fonteCategoriasIBJJF, modelosPesoIBJJF } from '@/app/lib/categorias-ibjjf';
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
  const [form, setForm] = useState(inicial);
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [modeloId, setModeloId] = useState(modelosPesoIBJJF[0].id);

  useEffect(() => {
    let ativo = true;
    if (!eventoId) return;
    async function carregar() {
      const { data: authData } = await supabase.auth.getUser();
      const [categoriasResposta, eventosResposta] = await Promise.all([
        supabase.from('categorias_evento').select('*').eq('evento_id', eventoId).order('idade_min'),
        authData.user ? supabase.from('eventos').select('id,nome').eq('organizador_id', authData.user.id).neq('id', eventoId).order('id', { ascending: false }) : Promise.resolve({ data: [] }),
      ]);
      if (!ativo) return;
      setCategorias(categoriasResposta.data || []);
      setEventos((eventosResposta.data || []) as EventoOpcao[]);
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
    } catch (error) { setMensagem((error as Error).message); }
    finally { setSalvando(false); }
  }

  async function importarModelo() {
    const modelo = modelosPesoIBJJF.find(item => item.id === modeloId) || modelosPesoIBJJF[0];
    const lista = modelo.pesos.map(peso => ({ ...form, ...peso, sexo: modelo.sexo, nome: `${peso.nome} · ${form.faixa}`, tipo: 'peso' as const, ativa: true }));
    await inserir(lista, `${modelo.pesos.length} categorias de referência IBJJF importadas. Revise faixa, idade, tempo e regulamento antes de abrir as inscrições.`);
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
    await inserir([{ ...form, nome: form.nome.trim(), faixa: form.faixa.trim(), modalidade: form.modalidade.trim() }], 'Categoria cadastrada e disponível para os atletas elegíveis.');
    setForm(atual => ({ ...atual, nome: '' }));
  }

  const seletorBase = <>
    {(['modalidade','faixa'] as const).map(k => <label key={k} className="block text-xs capitalize">{k}<input required maxLength={80} className={campo + ' mt-1'} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} /></label>)}
    <label className="block text-xs">Sexo competitivo<select className={campo + ' mt-1'} value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })}><option>Masculino</option><option>Feminino</option></select></label>
    <div className="grid grid-cols-2 gap-3">{(['idade_min','idade_max','tempo_minutos'] as const).map(k => <label key={k} className="text-xs">{{ idade_min:'Idade mínima', idade_max:'Idade máxima', tempo_minutos:'Tempo de luta' }[k]}<input required type="number" min={k.startsWith('idade') ? 4 : 1} max={k.startsWith('idade') ? 100 : 30} step="1" className={campo + ' mt-1'} value={form[k]} onChange={e => setForm({ ...form, [k]: Number(e.target.value) })} /></label>)}</div>
  </>;

  const seletorModelo = <>
    <label className="block text-xs">Tabela de referência<select className={campo + ' mt-1'} value={modeloId} onChange={e => setModeloId(e.target.value as typeof modeloId)}>{modelosPesoIBJJF.map(modelo => <option key={modelo.id} value={modelo.id}>{modelo.titulo}</option>)}</select></label>
    <p className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-zinc-400">{modelosPesoIBJJF.find(item => item.id === modeloId)?.descricao}</p>
    {(['modalidade','faixa'] as const).map(k => <label key={k} className="block text-xs capitalize">{k}<input required maxLength={80} className={campo + ' mt-1'} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} /></label>)}
    <div className="grid grid-cols-2 gap-3">{(['idade_min','idade_max','tempo_minutos'] as const).map(k => <label key={k} className="text-xs">{{ idade_min:'Idade mínima', idade_max:'Idade máxima', tempo_minutos:'Tempo de luta' }[k]}<input required type="number" min={k.startsWith('idade') ? 4 : 1} max={k.startsWith('idade') ? 100 : 30} step="1" className={campo + ' mt-1'} value={form[k]} onChange={e => setForm({ ...form, [k]: Number(e.target.value) })} /></label>)}</div>
  </>;

  return <>
    <section className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
      <h2 className="font-bold">Como funciona</h2>
      <div className="mt-3 grid gap-3 text-sm text-zinc-400 md:grid-cols-3">
        <p><strong className="block text-white mb-1">1. Monte a tabela</strong>Importe um modelo, copie outro campeonato ou cadastre manualmente.</p>
        <p><strong className="block text-white mb-1">2. O atleta se inscreve</strong>O sistema filtra automaticamente pelas informações do perfil.</p>
        <p><strong className="block text-white mb-1">3. Gere as chaves</strong>Cada categoria forma seu próprio grupo, sem misturar divisões.</p>
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
        {modo === 'modelo' && <div className="space-y-4"><h2 className="font-bold">Categorias de referência IBJJF</h2><p className="text-xs leading-relaxed text-zinc-400">Importa os limites Adult Gi usados pela IBJJF. A pesagem inclui o kimono. O organizador deve conferir faixa, idade, tempo e o regulamento específico do evento.</p>{seletorModelo}<a href={fonteCategoriasIBJJF} target="_blank" rel="noopener noreferrer" className="block text-xs font-bold text-cyan-400 underline underline-offset-4">Consultar regras oficiais da IBJJF</a><button type="button" disabled={salvando} onClick={importarModelo} className="w-full rounded-xl bg-red-600 p-3 font-bold disabled:opacity-40">Importar tabela selecionada</button></div>}
        {modo === 'copiar' && <div className="space-y-4"><h2 className="font-bold">Copiar de outro campeonato</h2><p className="text-xs text-zinc-400">Copia todas as categorias de outro evento seu. As categorias do evento original permanecem intactas.</p><label className="block text-xs">Campeonato de origem<select className={campo + ' mt-1'} value={eventoOrigem} onChange={e => setEventoOrigem(e.target.value)}><option value="">Selecione</option>{eventos.map(evento => <option key={evento.id} value={String(evento.id)}>{evento.nome || `Evento ${evento.id}`}</option>)}</select></label><button type="button" disabled={salvando || !eventoOrigem} onClick={copiarCampeonato} className="w-full rounded-xl bg-red-600 p-3 font-bold disabled:opacity-40">Copiar tabela</button></div>}
        {modo === 'manual' && <form onSubmit={salvarManual} className="space-y-4"><h2 className="font-bold">Nova categoria</h2><p className="text-xs text-zinc-400">Use para uma divisão especial ou para completar uma tabela.</p><label className="block text-xs">Nome da categoria<input required maxLength={80} className={campo + ' mt-1'} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>{seletorBase}<div className="grid grid-cols-2 gap-3"><label className="text-xs">Peso acima de (kg)<input required type="number" min="0" max="500" step="0.1" className={campo + ' mt-1'} value={form.peso_min} onChange={e => setForm({ ...form, peso_min: Number(e.target.value) })} /></label><label className="text-xs">Peso máximo (kg)<input type="number" min="0.1" max="500" step="0.1" placeholder="Sem limite" className={campo + ' mt-1'} value={form.peso_max ?? ''} onChange={e => setForm({ ...form, peso_max: e.target.value === '' ? null : Number(e.target.value) })} /></label></div><button disabled={salvando || carregando} className="w-full rounded-xl bg-red-600 p-3 font-bold disabled:opacity-40">Cadastrar categoria</button></form>}
      </section>

      <section><label className="sr-only" htmlFor="busca-categoria">Buscar categoria</label><input id="busca-categoria" className={campo} placeholder="Buscar nome, faixa ou divisão" value={busca} onChange={e => setBusca(e.target.value)} /><p className="my-4 text-xs text-zinc-400">{categorias.length} categorias cadastradas</p><div className="space-y-3">{categorias.filter(c => rotuloCategoria(c).toLowerCase().includes(busca.toLowerCase())).map(c => <article key={c.id} className="rounded-xl border border-white/10 p-4"><h2 className="font-bold">{c.nome}</h2><p className="text-sm text-zinc-400 mt-1">{rotuloCategoria(c)}</p><p className="text-xs text-red-300 mt-2">{c.tempo_minutos} minutos</p></article>)}</div>{!categorias.length && !carregando && <p className="text-zinc-400 text-sm">Nenhuma categoria cadastrada. Escolha uma das três opções ao lado para começar.</p>}</section>
    </div>
    {mensagem && <p role="status" className="mt-5 rounded-xl border border-white/10 p-4 text-sm">{mensagem}</p>}
  </>;
}
