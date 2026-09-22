'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Layers, Search, Shield, TriangleAlert, Users } from 'lucide-react';
import { formatarDataHoraEvento, obterEtapaEvento, periodoCorrecaoChecagem } from '@/app/lib/evento-etapas';
import { type CategoriaCompeticao } from '@/app/lib/categorias-competicao';
import {
  chaveProfessor,
  letraAtleta,
  montarInscritosChecagem,
  rotuloPesoDeclarado,
  type AbaChecagem,
  type EquipeChecagem,
  type InscritoChecagem,
} from '@/app/lib/checagem-publico';

type FiltrosCategoria = { categoria: string; faixa: string; peso: string; sexo: string; busca: string };

const ABAS: Array<{ id: AbaChecagem; rotulo: string }> = [
  { id: 'geral', rotulo: 'Geral' },
  { id: 'absoluto', rotulo: 'Absoluto' },
  { id: 'peso', rotulo: 'Categoria de peso' },
  { id: 'equipe', rotulo: 'Equipe' },
  { id: 'professor', rotulo: 'Equipe e professor' },
];

function LogoEquipe({ src, nome, tamanho = 'h-11 w-11' }: { src?: string | null; nome: string; tamanho?: string }) {
  const iniciais = nome.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase();
  if (src) return <img src={src} alt="" className={`${tamanho} shrink-0 rounded-full border border-white/10 object-cover bg-black`} />;
  return <span className={`${tamanho} inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-black text-zinc-400`}>{iniciais || <Shield size={14} />}</span>;
}

function SeloPagamento({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-[9px] font-medium text-emerald-400">
      <CheckCircle2 size={11} /> Confirmado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[9px] font-medium text-amber-300">
      <TriangleAlert size={11} /> Pendente
    </span>
  );
}

function CardAtleta({
  insc,
  onEquipe,
  onProfessor,
  onCategoria,
}: {
  insc: InscritoChecagem;
  onEquipe: (equipe: string) => void;
  onProfessor: (professor: string) => void;
  onCategoria: (chave: string, aba: AbaChecagem) => void;
}) {
  const peso = insc.chaves.find((chave) => chave.tipo === 'peso');
  const absoluto = insc.chaves.find((chave) => chave.tipo === 'absoluto');
  const inicial = letraAtleta(insc.atleta_nome);
  return (
    <article className="border-b border-white/5 px-3 py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-black text-zinc-200" aria-hidden="true">{inicial === '#' ? '•' : inicial}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold tracking-tight text-white">{insc.atleta_nome}</p>
          <p className="mt-0.5 text-[11px] font-medium text-zinc-300">{rotuloPesoDeclarado(insc.peso)}</p>
          {peso && (
            <button type="button" onClick={() => onCategoria(peso.chave, 'peso')} className="mt-0.5 block text-left text-[10px] font-medium text-cyan-300 hover:underline">
              Categoria · {peso.rotulo}
            </button>
          )}
          {absoluto && (
            <button type="button" onClick={() => onCategoria(absoluto.chave, 'absoluto')} className="mt-0.5 block text-left text-[10px] font-medium text-amber-300 hover:underline">
              Absoluto · {absoluto.rotulo}
            </button>
          )}
          {!peso && !absoluto && <p className="mt-0.5 text-[10px] text-zinc-500">{insc.categoria_rotulo}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onEquipe(insc.equipe)} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-red-300 hover:underline">
              <LogoEquipe src={insc.logo_url} nome={insc.equipe} tamanho="h-4 w-4" />
              {insc.equipe}
            </button>
            <button type="button" onClick={() => onProfessor(chaveProfessor(insc.professor, insc.academia, insc.equipe))} className="text-[10px] font-medium text-zinc-400 hover:text-white hover:underline">
              {insc.professor}
            </button>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">Pagamento</p>
          <div className="mt-1"><SeloPagamento ok={insc.pagamento_ok} /></div>
        </div>
      </div>
    </article>
  );
}

export default function ChecagemGeralPage() {
  const params = useParams();
  const router = useRouter();
  const eventoId = params.id as string;

  const [evento, setEvento] = useState<any>(null);
  const [inscricoes, setInscricoes] = useState<InscritoChecagem[]>([]);
  const [equipes, setEquipes] = useState<EquipeChecagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<AbaChecagem>('geral');
  const [buscaGeral, setBuscaGeral] = useState('');
  const [filtroPagamento, setFiltroPagamento] = useState<'todos' | 'ok' | 'pendente'>('todos');
  const [equipeAberta, setEquipeAberta] = useState('');
  const [professorAberto, setProfessorAberto] = useState('');
  const [filtrosPeso, setFiltrosPeso] = useState<FiltrosCategoria>({ categoria: '', faixa: '', peso: '', sexo: '', busca: '' });
  const [filtrosAbs, setFiltrosAbs] = useState<FiltrosCategoria>({ categoria: '', faixa: '', peso: '', sexo: '', busca: '' });

  useEffect(() => {
    async function carregar() {
      const resposta = await fetch(`/api/eventos/${eventoId}/checagem`).catch(() => null);
      if (!resposta?.ok) {
        setLoading(false);
        return;
      }
      const dados = await resposta.json();
      setEvento(dados.evento);
      setEquipes(dados.equipes || []);
      setInscricoes(montarInscritosChecagem(dados.inscricoes || [], dados.atletas || [], (dados.categorias || []) as CategoriaCompeticao[], dados.equipes || [], dados.academias || [], dados.evento?.data_evento));
      setLoading(false);
    }
    if (eventoId) void carregar();
  }, [eventoId]);

  const etapa = evento ? obterEtapaEvento(evento) : null;
  const correcaoAberta = evento ? periodoCorrecaoChecagem(evento) : false;

  const filtrarPagamento = (lista: InscritoChecagem[]) => {
    if (filtroPagamento === 'ok') return lista.filter((item) => item.pagamento_ok);
    if (filtroPagamento === 'pendente') return lista.filter((item) => !item.pagamento_ok);
    return lista;
  };

  const geral = useMemo(() => {
    const termo = buscaGeral.trim().toLowerCase();
    return filtrarPagamento(inscricoes).filter((item) => !termo || [item.atleta_nome, item.equipe, item.academia, item.professor, item.categoria_rotulo, item.peso, rotuloPesoDeclarado(item.peso), ...item.chaves.map((chave) => chave.rotulo)].join(' ').toLowerCase().includes(termo));
  }, [inscricoes, buscaGeral, filtroPagamento]);

  const letras = useMemo(() => {
    const mapa = new Map<string, InscritoChecagem[]>();
    for (const insc of geral) {
      const letra = letraAtleta(insc.atleta_nome);
      mapa.set(letra, [...(mapa.get(letra) || []), insc]);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [geral]);

  const gruposPorTipo = (tipo: 'peso' | 'absoluto', filtros: FiltrosCategoria) => {
    const lista = filtrarPagamento(inscricoes).filter((insc) => insc.chaves.some((chave) => chave.tipo === tipo));
    const mapa = new Map<string, { rotulo: string; faixa: string; sexo: string; atletas: InscritoChecagem[] }>();
    for (const insc of lista) {
      for (const chave of insc.chaves.filter((item) => item.tipo === tipo)) {
        const atual = mapa.get(chave.chave) || { rotulo: chave.rotulo, faixa: insc.faixa, sexo: insc.sexo, atletas: [] };
        atual.atletas.push(insc);
        mapa.set(chave.chave, atual);
      }
    }
    return [...mapa.entries()].map(([chave, grupo]) => ({ chave, ...grupo })).filter((grupo) => {
      const termo = filtros.busca.trim().toLowerCase();
      const atletas = grupo.atletas.filter((insc) => !termo || [insc.atleta_nome, insc.equipe, insc.professor].join(' ').toLowerCase().includes(termo));
      if (filtros.categoria && !grupo.rotulo.toLowerCase().includes(filtros.categoria.toLowerCase())) return false;
      if (filtros.faixa && !grupo.faixa.toLowerCase().includes(filtros.faixa.toLowerCase())) return false;
      if (filtros.sexo && grupo.sexo.toLowerCase() !== filtros.sexo.toLowerCase()) return false;
      if (filtros.peso && !grupo.rotulo.toLowerCase().includes(filtros.peso.toLowerCase())) return false;
      grupo.atletas = atletas;
      return atletas.length > 0;
    }).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  };

  const gruposPeso = useMemo(() => gruposPorTipo('peso', filtrosPeso), [inscricoes, filtrosPeso, filtroPagamento]);
  const gruposAbs = useMemo(() => gruposPorTipo('absoluto', filtrosAbs), [inscricoes, filtrosAbs, filtroPagamento]);

  const gruposEquipe = useMemo(() => {
    const mapa = new Map<string, { nome: string; logo_url?: string | null; atletas: InscritoChecagem[] }>();
    for (const insc of filtrarPagamento(inscricoes)) {
      const atual = mapa.get(insc.equipe) || { nome: insc.equipe, logo_url: insc.logo_url, atletas: [] };
      atual.atletas.push(insc);
      if (!atual.logo_url) atual.logo_url = insc.logo_url;
      mapa.set(insc.equipe, atual);
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [inscricoes, filtroPagamento]);

  const gruposProfessor = useMemo(() => {
    const mapa = new Map<string, { titulo: string; logo_url?: string | null; atletas: InscritoChecagem[] }>();
    for (const insc of filtrarPagamento(inscricoes)) {
      const chave = chaveProfessor(insc.professor, insc.academia, insc.equipe);
      const atual = mapa.get(chave) || { titulo: chave, logo_url: insc.academia_logo_url, atletas: [] };
      atual.atletas.push(insc);
      if (!atual.logo_url) atual.logo_url = insc.academia_logo_url;
      mapa.set(chave, atual);
    }
    return [...mapa.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  }, [inscricoes, filtroPagamento]);

  const opcoes = useMemo(() => {
    const faixas = [...new Set(inscricoes.map((item) => item.faixa).filter(Boolean))].sort();
    const sexos = [...new Set(inscricoes.map((item) => item.sexo).filter(Boolean))].sort();
    const categorias = [...new Set(inscricoes.flatMap((item) => item.chaves.map((chave) => chave.rotulo)))].sort();
    return { faixas, sexos, categorias };
  }, [inscricoes]);

  const irParaEquipe = (equipe: string) => { setEquipeAberta(equipe); setAbaAtiva('equipe'); };
  const irParaProfessor = (professor: string) => { setProfessorAberto(professor); setAbaAtiva('professor'); };
  const irParaCategoria = (chave: string, aba: AbaChecagem) => {
    setAbaAtiva(aba);
    window.setTimeout(() => document.getElementById(`cat-${chave}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#050505] text-xs font-black uppercase tracking-widest text-red-500">Carregando checagem...</div>;
  }

  if (etapa && !etapa.listaChecagemVisivel) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0a0e] p-6 text-center">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-red-500">Checagem em breve</p>
          <h1 className="mb-2 text-xl font-black uppercase">{evento?.nome || 'Evento'}</h1>
          <p className="mb-6 text-sm leading-relaxed text-zinc-400">A lista de inscritos abre junto com as inscrições.</p>
          <button onClick={() => router.back()} className="w-full rounded-xl bg-white py-3 text-xs font-black uppercase tracking-widest text-black">Voltar ao evento</button>
        </section>
      </main>
    );
  }

  const confirmados = inscricoes.filter((item) => item.pagamento_ok).length;
  const pendentes = inscricoes.length - confirmados;

  return (
    <main className="min-h-screen bg-[#050505] pb-32 text-white">
      <header className="border-b border-white/10 bg-zinc-950 px-4 pb-4 pt-6">
        <div className="mx-auto max-w-5xl">
          <Link href={`/evento/${eventoId}`} className="mb-3 inline-flex items-center gap-2 text-[10px] font-medium text-zinc-400 hover:text-white">
            <ArrowLeft size={14} /> Página do evento
          </Link>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-red-500">Lista de atletas</p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight md:text-xl">{evento?.nome || 'Checagem'}</h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-400">
            {correcaoAberta
              ? `Correção de categoria liberada até ${formatarDataHoraEvento(evento?.data_fim_checagem, true, evento?.estado)}. O atleta ajusta no perfil.`
              : evento?.data_inicio_checagem
                ? `A lista já está aberta. Mudança de categoria só de ${formatarDataHoraEvento(evento.data_inicio_checagem, false, evento.estado)} até ${formatarDataHoraEvento(evento.data_fim_checagem, true, evento.estado)}.`
                : 'A lista acompanha as inscrições. A troca de categoria abre no período definido pelo organizador.'}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"><p className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">Inscritos</p><p className="mt-0.5 text-base font-semibold">{inscricoes.length}</p></div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2"><p className="text-[9px] font-medium uppercase tracking-wider text-emerald-300">Confirmados</p><p className="mt-0.5 text-base font-semibold text-emerald-200">{confirmados}</p></div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2"><p className="text-[9px] font-medium uppercase tracking-wider text-amber-300">Pendentes</p><p className="mt-0.5 text-base font-semibold text-amber-200">{pendentes}</p></div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"><p className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">Equipes</p><p className="mt-0.5 text-base font-semibold">{gruposEquipe.length}</p></div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-5">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {ABAS.map((aba) => (
            <button key={aba.id} type="button" onClick={() => setAbaAtiva(aba.id)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-semibold ${abaAtiva === aba.id ? 'bg-red-600 text-white' : 'border border-white/10 bg-white/5 text-zinc-400 hover:text-white'}`}>
              {aba.rotulo}
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {[{ id: 'todos', rotulo: 'Todos' }, { id: 'ok', rotulo: 'Pagamento confirmado' }, { id: 'pendente', rotulo: 'Pagamento pendente' }].map((item) => (
            <button key={item.id} type="button" onClick={() => setFiltroPagamento(item.id as typeof filtroPagamento)} className={`rounded-md px-2.5 py-1 text-[10px] font-medium ${filtroPagamento === item.id ? 'bg-white text-black' : 'border border-white/10 text-zinc-400'}`}>
              {item.rotulo}
            </button>
          ))}
        </div>

        {abaAtiva === 'geral' && (
          <section>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input value={buscaGeral} onChange={(e) => setBuscaGeral(e.target.value)} placeholder="Buscar atleta, equipe, professor ou categoria" className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm outline-none placeholder:text-zinc-600 focus:border-red-500" />
            </div>
            <p className="mb-3 text-[11px] font-medium text-zinc-500">{geral.length} {geral.length === 1 ? 'atleta' : 'atletas'}</p>
            {letras.length > 1 && (
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                {letras.map(([letra]) => (
                  <button key={letra} type="button" onClick={() => document.getElementById(`letra-${letra}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="h-7 w-7 shrink-0 rounded-full border border-white/10 text-[11px] font-semibold text-zinc-300 hover:bg-white/10">
                    {letra}
                  </button>
                ))}
              </div>
            )}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b10]">
              {geral.length === 0 ? <p className="p-8 text-center text-sm text-zinc-500">Nenhum atleta encontrado.</p> : letras.flatMap(([letra, atletas]) => atletas.map((insc, indice) => (
                <div key={insc.id} id={indice === 0 ? `letra-${letra}` : undefined}>
                  <CardAtleta insc={insc} onEquipe={irParaEquipe} onProfessor={irParaProfessor} onCategoria={irParaCategoria} />
                </div>
              )))}
            </div>
          </section>
        )}

        {(abaAtiva === 'peso' || abaAtiva === 'absoluto') && (
          <ListaPorCategoria
            titulo={abaAtiva === 'peso' ? 'Categoria de peso' : 'Absoluto'}
            grupos={abaAtiva === 'peso' ? gruposPeso : gruposAbs}
            filtros={abaAtiva === 'peso' ? filtrosPeso : filtrosAbs}
            setFiltros={abaAtiva === 'peso' ? setFiltrosPeso : setFiltrosAbs}
            opcoes={opcoes}
            onEquipe={irParaEquipe}
            onProfessor={irParaProfessor}
            onCategoria={irParaCategoria}
          />
        )}

        {abaAtiva === 'equipe' && (
          <section className="space-y-3">
            {gruposEquipe.map((grupo) => {
              const aberta = equipeAberta === grupo.nome;
              return (
                <article key={grupo.nome} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b10]">
                  <button type="button" onClick={() => setEquipeAberta(aberta ? '' : grupo.nome)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <LogoEquipe src={grupo.logo_url} nome={grupo.nome} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-red-300">{grupo.nome}</p>
                      <p className="text-[10px] font-medium text-zinc-500">{grupo.atletas.length} {grupo.atletas.length === 1 ? 'atleta inscrito' : 'atletas inscritos'}</p>
                    </div>
                    <Search size={16} className="text-zinc-600" />
                  </button>
                  {aberta && grupo.atletas.map((insc) => (
                    <CardAtleta key={insc.id} insc={insc} onEquipe={irParaEquipe} onProfessor={irParaProfessor} onCategoria={irParaCategoria} />
                  ))}
                </article>
              );
            })}
          </section>
        )}

        {abaAtiva === 'professor' && (
          <section className="space-y-3">
            {gruposProfessor.map((grupo) => {
              const aberta = professorAberto === grupo.titulo;
              return (
                <article key={grupo.titulo} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b10]">
                  <button type="button" onClick={() => setProfessorAberto(aberta ? '' : grupo.titulo)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <LogoEquipe src={grupo.logo_url} nome={grupo.titulo} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-red-300">{grupo.titulo}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-zinc-500">{grupo.atletas.length} {grupo.atletas.length === 1 ? 'aluno' : 'alunos'}</p>
                    </div>
                    <Users size={16} className="text-zinc-600" />
                  </button>
                  {aberta && grupo.atletas.map((insc) => (
                    <CardAtleta key={insc.id} insc={insc} onEquipe={irParaEquipe} onProfessor={irParaProfessor} onCategoria={irParaCategoria} />
                  ))}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function ListaPorCategoria({
  titulo,
  grupos,
  filtros,
  setFiltros,
  opcoes,
  onEquipe,
  onProfessor,
  onCategoria,
}: {
  titulo: string;
  grupos: Array<{ chave: string; rotulo: string; atletas: InscritoChecagem[] }>;
  filtros: FiltrosCategoria;
  setFiltros: (valor: FiltrosCategoria) => void;
  opcoes: { faixas: string[]; sexos: string[]; categorias: string[] };
  onEquipe: (equipe: string) => void;
  onProfessor: (professor: string) => void;
  onCategoria: (chave: string, aba: AbaChecagem) => void;
}) {
  const campo = 'w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-xs text-white outline-none focus:border-red-500';
  return (
    <section>
      <div className="mb-5 grid gap-3 rounded-2xl border border-white/10 bg-[#0b0b10] p-4 md:grid-cols-5">
        <select value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })} className={campo}>
          <option value="">Categoria</option>
          {opcoes.categorias.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={filtros.faixa} onChange={(e) => setFiltros({ ...filtros, faixa: e.target.value })} className={campo}>
          <option value="">Faixa</option>
          {opcoes.faixas.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input value={filtros.peso} onChange={(e) => setFiltros({ ...filtros, peso: e.target.value })} placeholder="Peso" className={campo} />
        <select value={filtros.sexo} onChange={(e) => setFiltros({ ...filtros, sexo: e.target.value })} className={campo}>
          <option value="">Sexo</option>
          {opcoes.sexos.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input value={filtros.busca} onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })} placeholder="Buscar atleta" className={campo} />
      </div>
      {grupos.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">Nenhuma {titulo.toLowerCase()} com esses filtros.</p> : grupos.map((grupo) => (
        <div key={grupo.chave} id={`cat-${grupo.chave}`} className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b10]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <h2 className="flex items-center gap-2 text-[12px] font-semibold text-cyan-300"><Layers size={13} /> {grupo.rotulo}</h2>
            <span className="text-[10px] font-medium text-zinc-500">{grupo.atletas.length} {grupo.atletas.length === 1 ? 'atleta' : 'atletas'}</span>
          </div>
          {grupo.atletas.map((insc) => (
            <CardAtleta key={insc.id} insc={insc} onEquipe={onEquipe} onProfessor={onProfessor} onCategoria={onCategoria} />
          ))}
        </div>
      ))}
    </section>
  );
}
