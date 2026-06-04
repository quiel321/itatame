'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; 
import { LayoutGrid, Map, Users, CheckCircle, RefreshCw, AlertCircle, Search } from 'lucide-react';

export default function GestaoTatames() {
  // ESTADOS DO EVENTO E CARREGAMENTO
  const [eventos, setEventos] = useState<any[]>([]);
  const [eventoSelecionado, setEventoSelecionado] = useState<string>('');
  const [loadingInit, setLoadingInit] = useState(true);
  
  // ESTADOS DAS LUTAS E TATAMES
  const [categorias, setCategorias] = useState<any[]>([]);
  const [tatamesDisponiveis, setTatamesDisponiveis] = useState<string[]>([]); // AGORA É DINÂMICO
  const [busca, setBusca] = useState('');
  const [loadingLutas, setLoadingLutas] = useState(false);
  const [salvando, setSaving] = useState<string | null>(null);

  // 1. CARREGA OS EVENTOS DO ORGANIZADOR LOGADO
  useEffect(() => {
    async function inicializar() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      const { data: meusEventos } = await supabase
        .from('eventos')
        .select('id, nome')
        .eq('organizador_id', authData.user.id)
        .order('id', { ascending: false });

      if (meusEventos && meusEventos.length > 0) {
        setEventos(meusEventos);
        setEventoSelecionado(meusEventos[0].id.toString());
      }
      setLoadingInit(false);
    }
    inicializar();
  }, []);

  // 2. CARREGA AS CHAVES E OS TATAMES SEMPRE QUE MUDAR O EVENTO
  useEffect(() => {
    if (eventoSelecionado) {
      carregarLutas();
      carregarTatamesConfigurados();
    }
  }, [eventoSelecionado]);

  // BUSCA OS TATAMES REAIS CRIADOS PELO ORGANIZADOR NO PAINEL DE STAFF
  const carregarTatamesConfigurados = async () => {
    const { data } = await supabase
      .from('staff_eventos')
      .select('identificacao')
      .eq('evento_id', eventoSelecionado)
      .eq('funcao', 'mesario');

    if (data) {
      // Extrai apenas os nomes, remove espaços em branco e evita duplicatas
      const nomes = Array.from(new Set(data.map(t => t.identificacao.trim()))).filter(n => n !== "");
      setTatamesDisponiveis(nomes.sort());
    }
  };

  const carregarLutas = async () => {
    setLoadingLutas(true);

    const { data: lutas } = await supabase
      .from('chaves')
      .select('id, categoria, faixa, tatame, status_luta')
      .eq('evento_id', eventoSelecionado);

    if (lutas) {
      const categoriasAgrupadas: Record<string, any> = {};

      lutas.forEach((luta) => {
        const chaveGrupo = `${luta.categoria}__${luta.faixa}`;
        
        if (!categoriasAgrupadas[chaveGrupo]) {
          categoriasAgrupadas[chaveGrupo] = {
            idUnico: chaveGrupo,
            nome: luta.categoria,
            faixa: luta.faixa,
            tatameAtual: luta.tatame || 'Não Definido',
            totalLutas: 0,
            lutasConcluidas: 0
          };
        }

        categoriasAgrupadas[chaveGrupo].totalLutas += 1;
        if (luta.status_luta === 'concluida') {
          categoriasAgrupadas[chaveGrupo].lutasConcluidas += 1;
        }
      });

      setCategorias(Object.values(categoriasAgrupadas).sort((a, b) => a.nome.localeCompare(b.nome)));
    }
    setLoadingLutas(false);
  };

  // 3. TRANSFERE A CATEGORIA DE TATAME NO BANCO
  const alterarTatame = async (categoriaObj: any, novoTatame: string) => {
    setSaving(categoriaObj.idUnico);

    const { error } = await supabase
      .from('chaves')
      .update({ tatame: novoTatame })
      .eq('evento_id', eventoSelecionado)
      .eq('categoria', categoriaObj.nome)
      .eq('faixa', categoriaObj.faixa);

    if (!error) {
      setCategorias(prev => prev.map(cat => 
        cat.idUnico === categoriaObj.idUnico ? { ...cat, tatameAtual: novoTatame } : cat
      ));
    } else {
      alert("Erro ao transferir categoria: " + error.message);
    }

    setSaving(null);
  };

  const categoriasFiltradas = categorias.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase()) || 
    c.faixa.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-8 font-sans selection:bg-red-500/30 relative overflow-hidden">
      
      {/* EFEITOS DE LUZ PREMIUM */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-900/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 pb-6 border-b border-white/10">
          <div>
            <span className="text-red-500 text-[10px] font-black uppercase tracking-widest bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-md mb-3 inline-block">
              Central de Operações
            </span>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight flex items-center gap-3">
              Gestão de Tatames
            </h1>
            <p className="text-zinc-500 text-xs md:text-sm font-medium mt-1.5 max-w-2xl">
              Distribua as categorias pelas áreas de luta. As atualizações refletirão no painel dos mesários em tempo real, sem a necessidade de recarregar a página.
            </p>
          </div>

          <button onClick={() => { carregarLutas(); carregarTatamesConfigurados(); }} disabled={loadingLutas} className="flex items-center gap-2 bg-[#0e0e12] hover:bg-white/5 border border-white/10 px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors active:scale-95 shadow-lg">
            <RefreshCw size={14} className={loadingLutas ? "animate-spin text-red-500" : "text-zinc-400"} />
            Sincronizar
          </button>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="bg-[#0e0e12] border border-white/5 rounded-2xl p-4 mb-8 flex flex-col md:flex-row items-center gap-4 shadow-xl">
          <div className="relative w-full md:w-1/3">
            <label className="text-zinc-500 font-black uppercase tracking-widest text-[9px] mb-1.5 block pl-1">Selecione o Campeonato</label>
            <select 
              value={eventoSelecionado} 
              onChange={(e) => setEventoSelecionado(e.target.value)} 
              className="cursor-pointer w-full bg-black border border-white/10 focus:border-red-500 outline-none rounded-xl px-4 py-3 text-white transition-all appearance-none font-bold text-xs shadow-inner" 
              disabled={loadingInit || eventos.length === 0}
            >
              {loadingInit && <option>Carregando...</option>}
              {!loadingInit && eventos.length === 0 && <option value="">Nenhum evento criado...</option>}
              {eventos.map(ev => <option key={ev.id} value={ev.id.toString()}>🏆 {ev.nome}</option>)}
            </select>
            <svg className="w-4 h-4 text-zinc-500 absolute right-4 bottom-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>

          <div className="relative w-full md:flex-1">
            <label className="text-zinc-500 font-black uppercase tracking-widest text-[9px] mb-1.5 block pl-1">Buscar Categoria ou Faixa</label>
            <div className="relative cursor-text">
              <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Ex: Pesadíssimo..." 
                value={busca} 
                onChange={(e) => setBusca(e.target.value)} 
                className="w-full bg-black border border-white/10 rounded-xl pl-11 pr-4 py-3 outline-none focus:border-red-500 text-white transition-colors text-xs placeholder:text-zinc-600 shadow-inner" 
              />
            </div>
          </div>
        </div>

        {/* ÁREA DE LISTAGEM */}
        {loadingInit || loadingLutas ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#0e0e12] rounded-3xl border border-white/5 shadow-xl">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Mapeando Ginásio...</p>
          </div>
        ) : categoriasFiltradas.length === 0 ? (
          <div className="text-center py-20 bg-[#0e0e12] rounded-3xl border border-dashed border-white/10 shadow-xl">
            <AlertCircle size={40} className="mx-auto text-zinc-700 mb-4" />
            <h2 className="text-lg md:text-xl font-black uppercase text-white tracking-tight">Nenhuma chave mapeada</h2>
            <p className="text-zinc-500 text-xs mt-2 max-w-md mx-auto">Não encontramos blocos de chaves para este campeonato. Certifique-se de que o gerador de chaves foi executado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {categoriasFiltradas.map((cat) => {
              const progresso = Math.round((cat.lutasConcluidas / cat.totalLutas) * 100) || 0;
              const concluida = cat.lutasConcluidas === cat.totalLutas;

              return (
                <div key={cat.idUnico} className={`bg-[#0e0e12] border rounded-2xl p-5 relative overflow-hidden transition-all shadow-xl group hover:-translate-y-1 ${concluida ? 'border-green-500/20 opacity-80' : 'border-white/5 hover:border-white/20'}`}>
                  
                  {/* BARRA DE PROGRESSO NO TOPO */}
                  <div className="absolute top-0 left-0 h-1.5 bg-zinc-900 w-full">
                    <div className={`h-full transition-all duration-1000 relative ${concluida ? 'bg-green-500' : 'bg-red-600'}`} style={{ width: `${progresso}%` }}>
                      {!concluida && <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 animate-pulse"></div>}
                    </div>
                  </div>

                  <div className="flex justify-between items-start mb-5 mt-1">
                    <div className="pr-2 flex-1">
                      <span className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        🥋 Faixa {cat.faixa}
                      </span>
                      <h3 className="text-sm md:text-base font-black text-white uppercase leading-tight line-clamp-2" title={cat.nome}>
                        {cat.nome}
                      </h3>
                    </div>
                    
                    <div className="shrink-0 flex flex-col items-end">
                      <span className="bg-black border border-white/5 text-zinc-300 text-[9px] md:text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-inner">
                        <Users size={12} className={concluida ? "text-green-500" : "text-red-500"} />
                        {cat.lutasConcluidas}/{cat.totalLutas} Lutas
                      </span>
                      {concluida && <span className="text-[8px] text-green-500 font-bold uppercase mt-2 tracking-wider">✔ 100% Finalizada</span>}
                    </div>
                  </div>

                  {/* SELECT PARA DEFINIR O TATAME */}
                  <div className="mt-auto pt-4 border-t border-white/5 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-black border flex items-center justify-center shrink-0 shadow-inner ${cat.tatameAtual !== 'Não Definido' ? 'border-red-500/30 text-red-500' : 'border-white/5 text-zinc-600'}`}>
                      {salvando === cat.idUnico ? (
                        <RefreshCw size={16} className="animate-spin text-red-500" />
                      ) : (
                        <Map size={16} />
                      )}
                    </div>
                    
                    <div className="flex-1 relative">
                      <select 
                        disabled={concluida || salvando === cat.idUnico}
                        value={cat.tatameAtual}
                        onChange={(e) => alterarTatame(cat, e.target.value)}
                        className={`w-full bg-black border rounded-xl px-4 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest outline-none transition-all cursor-pointer appearance-none shadow-inner ${
                          cat.tatameAtual === 'Não Definido' ? 'border-yellow-500/50 text-yellow-500 hover:border-yellow-500' : 'border-white/10 hover:border-white/20 focus:border-red-500 text-white'
                        }`}
                      >
                        {tatamesDisponiveis.length === 0 ? (
                          <option value="Não Definido" disabled>Configure Tatames no Staff</option>
                        ) : (
                          <>
                            <option value="Não Definido" disabled>Mapear Área...</option>
                            {tatamesDisponiveis.map(t => (
                              <option key={t} value={t}>📍 {t}</option>
                            ))}
                          </>
                        )}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                         {cat.tatameAtual !== 'Não Definido' && !concluida ? <CheckCircle size={14} className="text-green-500" /> : <LayoutGrid size={14} className="text-zinc-600" />}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}