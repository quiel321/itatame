'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { Search, Users, Layers, Shield, ArrowLeft, Trophy } from 'lucide-react';

type InscricaoCompleta = {
  id: string;
  categoria: string;
  atleta_nome: string;
  equipe: string;
  professor: string;
  faixa: string;
  peso: string;
  sexo: string;
  chave_categoria: string;
  categoria_rotulo: string;
};

export default function ChecagemGeralPage() {
  const params = useParams();
  const router = useRouter();
  const eventoId = params.id as string;

  const [evento, setEvento] = useState<any>(null);
  const [inscricoes, setInscricoes] = useState<InscricaoCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle de Abas e Filtros
  const [abaAtiva, setAbaAtiva] = useState<'atleta' | 'categoria' | 'equipe'>('atleta');
  
  const [buscaAtleta, setBuscaAtleta] = useState(''); // Busca geral da aba "Por Atleta"
  
  // Filtros da aba "Por Categoria"
  const [catSelecionada, setCatSelecionada] = useState('');
  const [nomeFiltroCat, setNomeFiltroCat] = useState('');
  
  // Filtros da aba "Por Equipe"
  const [eqSelecionada, setEqSelecionada] = useState('');
  const [nomeFiltroEq, setNomeFiltroEq] = useState('');

  useEffect(() => {
    async function carregarDados() {
      const { data: ev } = await supabase.from('eventos').select('*').eq('id', eventoId).single();
      if (ev) setEvento(ev);

      const { data: inscData } = await supabase
        .from('inscricoes')
        .select('id, user_id, categoria, pagamento_ok')
        .eq('evento_id', eventoId)
        .eq('pagamento_ok', true);

      if (inscData && inscData.length > 0) {
        const userIds = [...new Set(inscData.map(i => i.user_id))];
        const { data: atletasData } = await supabase
          .from('atletas')
          .select('user_id, nome, equipe, professor, faixa, peso, sexo')
          .in('user_id', userIds);

        const dadosCompletos: InscricaoCompleta[] = inscData.map(insc => {
          const atl = atletasData?.find(a => a.user_id === insc.user_id);
          const categoria = insc.categoria || 'NÃO INFORMADA';
          const faixa = atl?.faixa || 'FAIXA NÃO INFORMADA';
          return {
            id: insc.id,
            categoria,
            atleta_nome: atl?.nome || 'Atleta Desconhecido',
            equipe: atl?.equipe || 'SEM EQUIPE',
            professor: atl?.professor || 'Sem Professor',
            faixa,
            peso: atl?.peso || '',
            sexo: atl?.sexo || '',
            chave_categoria: faixa + '__' + categoria,
            categoria_rotulo: faixa + ' / ' + categoria
          };
        });

        dadosCompletos.sort((a, b) => a.atleta_nome.localeCompare(b.atleta_nome));
        setInscricoes(dadosCompletos);
      }
      setLoading(false);
    }

    if (eventoId) carregarDados();
  }, [eventoId]);

  // Extrair listas únicas para os dropdowns
  const gruposCategoriaFaixa = useMemo(() => [...new Map(inscricoes.map(i => [i.chave_categoria, i.categoria_rotulo])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [inscricoes]);
  const equipesUnicas = useMemo(() => [...new Set(inscricoes.map(i => i.equipe))].sort(), [inscricoes]);

  // Ações de clique nos links da tabela (Navegação Cruzada)
  const irParaCategoria = (categoria: string) => {
    setCatSelecionada(categoria);
    setNomeFiltroCat('');
    setAbaAtiva('categoria');
  };

  const irParaEquipe = (equipe: string) => {
    setEqSelecionada(equipe);
    setNomeFiltroEq('');
    setAbaAtiva('equipe');
  };

  // Filtros calculados para as tabelas
  const atletasFiltradosGeral = useMemo(() => {
    if (!buscaAtleta) return inscricoes;
    const termo = buscaAtleta.toLowerCase();
    return inscricoes.filter(i => [i.atleta_nome, i.equipe, i.professor, i.categoria, i.faixa, i.categoria_rotulo].join(' ').toLowerCase().includes(termo));
  }, [inscricoes, buscaAtleta]);

  const atletasNaCategoria = useMemo(() => {
    if (!catSelecionada) return [];
    let filtrado = inscricoes.filter(i => i.chave_categoria === catSelecionada);
    if (nomeFiltroCat) filtrado = filtrado.filter(i => i.atleta_nome.toLowerCase().includes(nomeFiltroCat.toLowerCase()));
    return filtrado;
  }, [inscricoes, catSelecionada, nomeFiltroCat]);

  const gruposResumo = useMemo(() => gruposCategoriaFaixa.map(([chave, rotulo]) => {
    const total = inscricoes.filter(i => i.chave_categoria === chave).length;
    return { chave, rotulo, total };
  }), [gruposCategoriaFaixa, inscricoes]);

  const grupoSelecionado = gruposResumo.find(grupo => grupo.chave === catSelecionada);

  const atletasNaEquipe = useMemo(() => {
    if (!eqSelecionada) return [];
    let filtrado = inscricoes.filter(i => i.equipe === eqSelecionada);
    if (nomeFiltroEq) filtrado = filtrado.filter(i => i.atleta_nome.toLowerCase().includes(nomeFiltroEq.toLowerCase()));
    return filtrado;
  }, [inscricoes, eqSelecionada, nomeFiltroEq]);
  if (loading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-red-500 font-black uppercase tracking-widest text-xs animate-pulse">Carregando checagem...</div>;
  }

  const agora = new Date();
  const inicioChecagem = evento?.data_inicio_checagem ? new Date(evento.data_inicio_checagem) : null;
  const fimChecagem = evento?.data_fim_checagem ? new Date(evento.data_fim_checagem) : null;
  const checagemAberta = Boolean(inicioChecagem && agora >= inicioChecagem && (!fimChecagem || agora <= fimChecagem));
  const formatarPrazo = (valor?: string | null) => valor ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : "A definir";

  if (!checagemAberta) {
    return (
      <main className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-4">
        <section className="w-full max-w-lg bg-[#0a0a0e] border border-white/10 rounded-2xl p-6 text-center shadow-2xl">
          <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mb-3">Checagem indisponível</p>
          <h1 className="text-xl font-black uppercase mb-2">{evento?.nome || "Evento"}</h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-5">A checagem fica visível apenas no período definido pelo organizador.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-left">
            <div className="bg-black/40 border border-white/10 rounded-xl p-3">
              <span className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Abre</span>
              <p className="text-white text-xs font-bold mt-1">{formatarPrazo(evento?.data_inicio_checagem)}</p>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-xl p-3">
              <span className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Fecha</span>
              <p className="text-white text-xs font-bold mt-1">{formatarPrazo(evento?.data_fim_checagem)}</p>
            </div>
          </div>
          <button onClick={() => router.back()} className="w-full bg-white text-black rounded-xl py-3 text-xs font-black uppercase tracking-widest">Voltar ao evento</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans pb-20 selection:bg-red-500/30">
      
      {/* CABEÇALHO (Estilo Sou Competidor) */}
      <header className="bg-zinc-900 border-b border-white/10 pt-8 pb-6 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <button onClick={() => router.back()} className="text-zinc-400 hover:text-white flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors mb-4 mx-auto md:mx-0">
            <ArrowLeft size={14} /> Voltar para o Evento
          </button>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-red-500 mb-1">
            Checagem do evento "{evento?.nome || "Carregando..."}"
          </h1>
          <p className="text-zinc-400 text-xs uppercase tracking-widest font-medium">
            Confira atentamente à todos os seus dados, como nome, categoria, graduação e peso.
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-6">
        
        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex border-b border-white/10 mb-6 overflow-x-auto scrollbar-hide">
          <button onClick={() => setAbaAtiva('atleta')} className={`cursor-pointer flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${abaAtiva === 'atleta' ? 'border-red-600 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            <Users size={16} className={abaAtiva === 'atleta' ? 'text-red-600' : ''} /> Por Atleta
          </button>
          <button onClick={() => setAbaAtiva('categoria')} className={`cursor-pointer flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${abaAtiva === 'categoria' ? 'border-red-600 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            <Layers size={16} className={abaAtiva === 'categoria' ? 'text-red-600' : ''} /> Por Categoria
          </button>
          <button onClick={() => setAbaAtiva('equipe')} className={`cursor-pointer flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${abaAtiva === 'equipe' ? 'border-red-600 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            <Shield size={16} className={abaAtiva === 'equipe' ? 'text-red-600' : ''} /> Por Equipe
          </button>
        </div>

        {/* ================================================= */}
        {/* CONTEÚDO DA ABA: POR ATLETA */}
        {/* ================================================= */}
        {abaAtiva === 'atleta' && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Pesquisar atleta..." 
                  value={buscaAtleta}
                  onChange={(e) => setBuscaAtleta(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-red-500 outline-none rounded-md pl-9 pr-4 py-2 text-xs text-white transition-colors placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-md overflow-x-auto shadow-xl">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-[#cc0000] text-white">
                  <tr>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Nome do Atleta</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Equipe</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Professor</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Categoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-[10px] md:text-xs">
                  {atletasFiltradosGeral.map((insc, index) => (
                    <tr key={insc.id} className={index % 2 === 0 ? 'bg-transparent' : 'bg-black/20'}>
                      <td className="px-3 py-2.5 font-black text-white uppercase flex items-center gap-2">
                        <span className="text-[10px]">🇧🇷</span> {insc.atleta_nome}
                      </td>
                      <td className="px-3 py-2.5 font-bold">
                        <button onClick={() => irParaEquipe(insc.equipe)} className="text-blue-400 hover:text-blue-300 hover:underline uppercase transition-colors text-left cursor-pointer">
                          {insc.equipe}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-400 uppercase">{insc.professor}</td>
                      <td className="px-3 py-2.5 font-bold">
                        <button onClick={() => irParaCategoria(insc.chave_categoria)} className="text-blue-400 hover:text-blue-300 hover:underline uppercase transition-colors text-left cursor-pointer">
                          {insc.categoria_rotulo}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {atletasFiltradosGeral.length === 0 && (
                    <tr><td colSpan={4} className="p-4 text-center text-zinc-500 text-xs">Nenhum atleta encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* CONTEÚDO DA ABA: POR CATEGORIA */}
        {/* ================================================= */}
        {abaAtiva === 'categoria' && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white/5 border border-white/10 p-4 md:p-6 rounded-md mb-6 max-w-2xl mx-auto shadow-lg">
              <div className="space-y-3">
                <select 
                  value={catSelecionada} 
                  onChange={(e) => setCatSelecionada(e.target.value)}
                  className="w-full bg-[#0a0a0e] border border-white/10 text-white text-xs p-3 rounded outline-none focus:border-red-500 uppercase cursor-pointer"
                >
                  <option value="">------------------------------</option>
                  {gruposCategoriaFaixa.map(([chave, rotulo]) => <option key={chave} value={chave}>{rotulo}</option>)}
                </select>
                <input 
                  type="text" 
                  placeholder="Nome, equipe ou professor (opcional)" 
                  value={nomeFiltroCat}
                  onChange={(e) => setNomeFiltroCat(e.target.value)}
                  className="w-full bg-[#0a0a0e] border border-white/10 text-white text-xs p-3 rounded outline-none focus:border-red-500 uppercase placeholder:text-zinc-600"
                />
                <button className="bg-[#e31837] hover:bg-red-600 text-white font-bold text-xs uppercase px-6 py-3 rounded transition-colors w-max cursor-pointer">
                  Filtrar
                </button>
              </div>
              <p className="text-center text-zinc-500 text-[10px] mt-4">
                Escolha qualquer um dos campos acima e clique no botão filtrar para descobrir quem provavelmente estará em sua chave de luta.<br/>
                <span className="text-red-500">* Todos os campos são opcionais.</span>
              </p>
            </div>

            {!catSelecionada && gruposResumo.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
                {gruposResumo.map((grupo) => (
                  <button key={grupo.chave} onClick={() => setCatSelecionada(grupo.chave)} className={'text-left rounded-xl border p-3 transition-colors ' + (grupo.total === 1 ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
                    <span className="block text-white text-xs font-black uppercase leading-tight">{grupo.rotulo}</span>
                    <span className={'mt-2 inline-flex text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ' + (grupo.total === 1 ? 'bg-yellow-500/20 text-yellow-200' : 'bg-red-500/10 text-red-400')}>{grupo.total === 1 ? 'Sozinho' : grupo.total + ' atletas'}</span>
                  </button>
                ))}
              </div>
            )}

            {catSelecionada && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-red-500 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                    <Layers size={16} /> {grupoSelecionado?.rotulo || catSelecionada}
                  </h3>
                  <span className="text-red-500 font-bold text-xs flex items-center gap-1.5 bg-red-500/10 px-2.5 py-1 rounded">
                    <Users size={14} /> {atletasNaCategoria.length} Inscritos
                  </span>
                </div>
                
                {grupoSelecionado?.total === 1 && (
                  <div className="mb-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-yellow-100 text-xs font-bold leading-relaxed">
                    Este atleta está sozinho nesta faixa + categoria. Durante a checagem, ele pode entrar no perfil e ajustar a inscrição para uma categoria de peso maior, se o regulamento permitir.
                  </div>
                )}

                <div className="bg-white/5 border border-white/10 rounded-md overflow-x-auto shadow-xl">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-[#cc0000] text-white">
                      <tr>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest w-10 text-center">Status</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Nome do Atleta</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Equipe</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Professor</th>
                        {/* 🔥 NOVAS COLUNAS AQUI */}
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Graduação</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Peso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-[10px] md:text-xs">
                      {atletasNaCategoria.map((insc, index) => (
                        <tr key={insc.id} className={index % 2 === 0 ? 'bg-transparent' : 'bg-black/20'}>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-zinc-800 rounded border border-zinc-700 text-zinc-400">
                              <Trophy size={10} />
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-black text-white uppercase flex items-center gap-2">
                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">BR</span> {insc.atleta_nome}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-blue-400 uppercase cursor-pointer hover:underline" onClick={() => irParaEquipe(insc.equipe)}>{insc.equipe}</td>
                          <td className="px-3 py-2.5 text-zinc-400 uppercase">{insc.professor}</td>
                          {/* 🔥 DADOS DAS NOVAS COLUNAS AQUI */}
                          <td className="px-3 py-2.5 font-bold text-zinc-300 uppercase">{insc.faixa || "-"}</td>
                          <td className="px-3 py-2.5 font-bold text-zinc-300 uppercase">{insc.peso ? `${insc.peso}` : "-"}</td>
                        </tr>
                      ))}
                      {atletasNaCategoria.length === 0 && (
                        <tr><td colSpan={6} className="p-4 text-center text-zinc-500 text-xs">Nenhum atleta nesta categoria.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================= */}
        {/* CONTEÚDO DA ABA: POR EQUIPE */}
        {/* ================================================= */}
        {abaAtiva === 'equipe' && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white/5 border border-white/10 p-4 md:p-6 rounded-md mb-6 max-w-2xl mx-auto shadow-lg">
              <div className="flex flex-col md:flex-row gap-3">
                <select 
                  value={eqSelecionada} 
                  onChange={(e) => setEqSelecionada(e.target.value)}
                  className="flex-1 bg-[#0a0a0e] border border-white/10 text-white text-xs p-3 rounded outline-none focus:border-red-500 uppercase cursor-pointer"
                >
                  <option value="">------------------------------</option>
                  {equipesUnicas.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                </select>
                <button className="bg-[#e31837] hover:bg-red-600 text-white font-bold text-xs uppercase px-8 py-3 rounded transition-colors w-full md:w-auto cursor-pointer">
                  Filtrar
                </button>
              </div>
            </div>

            {eqSelecionada && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-red-500 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                    <Shield size={16} /> {eqSelecionada}
                  </h3>
                  <span className="text-red-500 font-bold text-xs flex items-center gap-1.5">
                    <Users size={14} /> {atletasNaEquipe.length} Inscritos
                  </span>
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-md overflow-x-auto shadow-xl">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-[#cc0000] text-white">
                      <tr>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Nome do Atleta</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Professor</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Categoria</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-[10px] md:text-xs">
                      {atletasNaEquipe.map((insc, index) => (
                        <tr key={insc.id} className={index % 2 === 0 ? 'bg-transparent' : 'bg-black/20'}>
                          <td className="px-3 py-2.5 font-black text-white uppercase flex items-center gap-2">
                            <span className="text-[10px]">🇧🇷</span> {insc.atleta_nome}
                          </td>
                          <td className="px-3 py-2.5 text-zinc-400 uppercase">{insc.professor}</td>
                          <td className="px-3 py-2.5 font-bold text-blue-400 uppercase cursor-pointer hover:underline" onClick={() => irParaCategoria(insc.chave_categoria)}>
                            {insc.categoria_rotulo}
                          </td>
                        </tr>
                      ))}
                      {atletasNaEquipe.length === 0 && (
                        <tr><td colSpan={3} className="p-4 text-center text-zinc-500 text-xs">Nenhum atleta nesta equipe.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}