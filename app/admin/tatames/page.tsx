'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; 
import { LayoutGrid, Map, Users, CheckCircle, RefreshCw, AlertCircle, Search, Clock, Play, X } from 'lucide-react';
import { obterTempoRegulamentar } from '../../lib/cronograma'; // 🔥 Importando o nosso motor de tempo!

export default function GestaoTatames() {
  // ESTADOS DO EVENTO E CARREGAMENTO
  const [eventos, setEventos] = useState<any[]>([]);
  const [eventoSelecionado, setEventoSelecionado] = useState<string>('');
  const [loadingInit, setLoadingInit] = useState(true);
  
  // ESTADOS DAS LUTAS E TATAMES
  const [categorias, setCategorias] = useState<any[]>([]);
  const [tatamesDisponiveis, setTatamesDisponiveis] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [loadingLutas, setLoadingLutas] = useState(false);
  const [salvando, setSaving] = useState<string | null>(null);

  // ESTADOS DO MODAL DE CRONOGRAMA
  const [showCronoModal, setShowCronoModal] = useState(false);
  const [cronoTatame, setCronoTatame] = useState('');
  const [cronoHora, setCronoHora] = useState('09:00');
  const [cronoTransicao, setCronoTransicao] = useState<number>(2);
  const [gerandoCrono, setGerandoCrono] = useState(false);

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

  const carregarTatamesConfigurados = async () => {
    const { data } = await supabase
      .from('staff_eventos')
      .select('identificacao')
      .eq('evento_id', eventoSelecionado)
      .eq('funcao', 'mesario');

    if (data) {
      const nomes = Array.from(new Set(data.map(t => t.identificacao.trim()))).filter(n => n !== "");
      setTatamesDisponiveis(nomes.sort());
    }
  };

  const carregarLutas = async () => {
  setLoadingLutas(true);

  // 🔥 Agora trazemos o atleta_1 e atleta_2 para podermos filtrar
  const { data: lutas } = await supabase
    .from('chaves')
    .select('id, categoria, faixa, tatame, status_luta, vencedor, atleta_1, atleta_2')
    .eq('evento_id', eventoSelecionado);

  if (lutas) {
    const categoriasAgrupadas: Record<string, any> = {};

    lutas.forEach((luta) => {
      const chaveGrupo = `${luta.categoria}__${luta.faixa}`;
      
      // 🔥 O EXORCISMO: Verifica se é uma luta fantasma (BYE / W.O.)
      const isFantasma = !luta.atleta_1 || !luta.atleta_2 || 
                         luta.atleta_1.includes('SEM OPONENTE') || luta.atleta_2.includes('SEM OPONENTE') ||
                         luta.atleta_1.includes('BYE') || luta.atleta_2.includes('BYE');

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

      // SÓ CONTABILIZA SE FOR UMA LUTA REAL
      if (!isFantasma) {
        categoriasAgrupadas[chaveGrupo].totalLutas += 1;
        if (luta.status_luta === 'finalizada' || luta.vencedor) {
          categoriasAgrupadas[chaveGrupo].lutasConcluidas += 1;
        }
      }
    });

    // Remove categorias que ficaram com 0 lutas (ex: categoria que só tinha 1 cara e ele passou de BYE pra final que ainda não existe)
    const categoriasComLutas = Object.values(categoriasAgrupadas).filter(cat => cat.totalLutas > 0);
    setCategorias(categoriasComLutas.sort((a, b) => a.nome.localeCompare(b.nome)));
  }
  setLoadingLutas(false);
};

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

  // =========================================================================
  // 🔥 MOTOR DE CRONOGRAMA: GERAÇÃO DA LINHA DO TEMPO
  // =========================================================================
  const gerarCronogramaTatame = async () => {
  if (!cronoTatame) return alert("Selecione um tatame primeiro!");
  setGerandoCrono(true);

  try {
    // 🔥 Correção do Case Sensitive: ilike ignora maiúsculas e minúsculas!
    const { data: lutasDoTatame, error: errFetch } = await supabase
      .from('chaves')
      .select('*')
      .eq('evento_id', eventoSelecionado)
      .ilike('tatame', `%${cronoTatame.trim()}%`);

    if (errFetch || !lutasDoTatame || lutasDoTatame.length === 0) {
      alert(`Nenhuma luta encontrada para ${cronoTatame} no banco de dados.`);
      setGerandoCrono(false);
      return;
    }

    // 🔥 O EXORCISMO NO RELÓGIO: Removemos os fantasmas para eles não ganharem tempo na fila
    const lutasReais = lutasDoTatame.filter(luta => {
      return luta.atleta_1 && luta.atleta_2 && 
             !luta.atleta_1.includes('SEM OPONENTE') && !luta.atleta_2.includes('SEM OPONENTE') &&
             !luta.atleta_1.includes('BYE') && !luta.atleta_2.includes('BYE');
    });

    if (lutasReais.length === 0) {
      alert("Este tatame só tem lutas fantasmas (W.O.). Adicione lutas com oponentes reais.");
      setGerandoCrono(false);
      return;
    }

    const pesoFase: any = { 'PRÉ-OITAVAS': 1, 'OITAVAS DE FINAL': 2, 'QUARTAS DE FINAL': 3, 'SEMIFINAL': 4, 'FINAL': 5 };

    const lutasOrdenadas = lutasReais.sort((a, b) => {
      if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
      if (a.faixa !== b.faixa) return a.faixa.localeCompare(b.faixa);
      const faseA = pesoFase[a.fase?.toUpperCase()] || 99;
      const faseB = pesoFase[b.fase?.toUpperCase()] || 99;
      if (faseA !== faseB) return faseA - faseB;
      return (a.ordem || 0) - (b.ordem || 0);
    });

    const dataBase = new Date();
    const [horas, minutos] = cronoHora.split(':');
    dataBase.setHours(parseInt(horas), parseInt(minutos), 0, 0);
    
    let ponteiroTempo = new Date(dataBase);

    const promessasAtualizacao = lutasOrdenadas.map((luta, index) => {
      const tempoLutaOficial = obterTempoRegulamentar(luta.categoria, luta.faixa);
      const tempoTotalMinutos = tempoLutaOficial + cronoTransicao;

      const horarioEstimadoAtual = new Date(ponteiroTempo);
      ponteiroTempo.setMinutes(ponteiroTempo.getMinutes() + tempoTotalMinutos);

      return supabase.from('chaves').update({
        horario_estimado: horarioEstimadoAtual.toISOString(),
        ordem_tatame: index + 1
      }).eq('id', luta.id);
    });

    await Promise.all(promessasAtualizacao);
    alert(`✅ Cronograma do ${cronoTatame} gerado com sucesso para ${lutasReais.length} lutas reais!`);
    setShowCronoModal(false);

  } catch (err) {
    console.error(err);
    alert("Houve um erro ao gerar o cronograma.");
  } finally {
    setGerandoCrono(false);
  }
};

  const categoriasFiltradas = categorias.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase()) || 
    c.faixa.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-8 font-sans selection:bg-red-500/30 relative overflow-hidden">
      
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-900/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 pb-6 border-b border-white/10">
          <div>
            <span className="text-red-500 text-[10px] font-black uppercase tracking-widest bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-md mb-3 inline-block">
              Central de Operações
            </span>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight flex items-center gap-3">
              Gestão de Tatames
            </h1>
            <p className="text-zinc-500 text-xs md:text-sm font-medium mt-1.5 max-w-2xl">
              Distribua as categorias pelas áreas de luta. As atualizações refletirão no painel dos mesários em tempo real.
            </p>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            {/* 🔥 NOVO BOTÃO DE CRONOGRAMA */}
            <button onClick={() => setShowCronoModal(true)} disabled={loadingLutas || tatamesDisponiveis.length === 0} className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors active:scale-95 shadow-lg">
              <Clock size={14} /> Configurar Horários
            </button>

            <button onClick={() => { carregarLutas(); carregarTatamesConfigurados(); }} disabled={loadingLutas} className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-[#0e0e12] hover:bg-white/5 border border-white/10 px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors active:scale-95 shadow-lg">
              <RefreshCw size={14} className={loadingLutas ? "animate-spin text-red-500" : "text-zinc-400"} /> Sincronizar
            </button>
          </div>
        </div>

        <div className="bg-[#0e0e12] border border-white/5 rounded-2xl p-4 mb-8 flex flex-col md:flex-row items-center gap-4 shadow-xl">
          <div className="relative w-full md:w-1/3">
            <label className="text-zinc-500 font-black uppercase tracking-widest text-[9px] mb-1.5 block pl-1">Selecione o Campeonato</label>
            <select value={eventoSelecionado} onChange={(e) => setEventoSelecionado(e.target.value)} className="cursor-pointer w-full bg-black border border-white/10 focus:border-red-500 outline-none rounded-xl px-4 py-3 text-white transition-all appearance-none font-bold text-xs shadow-inner" disabled={loadingInit || eventos.length === 0}>
              {loadingInit && <option>Carregando...</option>}
              {!loadingInit && eventos.length === 0 && <option value="">Nenhum evento criado...</option>}
              {eventos.map(ev => <option key={ev.id} value={ev.id.toString()}>🏆 {ev.nome}</option>)}
            </select>
          </div>
          <div className="relative w-full md:flex-1">
            <label className="text-zinc-500 font-black uppercase tracking-widest text-[9px] mb-1.5 block pl-1">Buscar Categoria ou Faixa</label>
            <div className="relative cursor-text">
              <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Ex: Pesadíssimo..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl pl-11 pr-4 py-3 outline-none focus:border-red-500 text-white transition-colors text-xs placeholder:text-zinc-600 shadow-inner" />
            </div>
          </div>
        </div>

        {loadingInit || loadingLutas ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#0e0e12] rounded-3xl border border-white/5 shadow-xl">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Mapeando Ginásio...</p>
          </div>
        ) : categoriasFiltradas.length === 0 ? (
          <div className="text-center py-20 bg-[#0e0e12] rounded-3xl border border-dashed border-white/10 shadow-xl">
            <AlertCircle size={40} className="mx-auto text-zinc-700 mb-4" />
            <h2 className="text-lg md:text-xl font-black uppercase text-white tracking-tight">Nenhuma chave mapeada</h2>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {categoriasFiltradas.map((cat) => {
              const progresso = Math.round((cat.lutasConcluidas / cat.totalLutas) * 100) || 0;
              const concluida = cat.lutasConcluidas === cat.totalLutas && cat.totalLutas > 0;

              return (
                <div key={cat.idUnico} className={`bg-[#0e0e12] border rounded-2xl p-5 relative overflow-hidden transition-all shadow-xl group hover:-translate-y-1 ${concluida ? 'border-green-500/20 opacity-80' : 'border-white/5 hover:border-white/20'}`}>
                  
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
                      <h3 className="text-sm md:text-base font-black text-white uppercase leading-tight line-clamp-2" title={cat.nome}>{cat.nome}</h3>
                    </div>
                    
                    <div className="shrink-0 flex flex-col items-end">
                      <span className="bg-black border border-white/5 text-zinc-300 text-[9px] md:text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-inner">
                        <Users size={12} className={concluida ? "text-green-500" : "text-red-500"} />
                        {cat.lutasConcluidas}/{cat.totalLutas} Lutas
                      </span>
                      {concluida && <span className="text-[8px] text-green-500 font-bold uppercase mt-2 tracking-wider">✔ 100% Finalizada</span>}
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-white/5 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-black border flex items-center justify-center shrink-0 shadow-inner ${cat.tatameAtual !== 'Não Definido' ? 'border-red-500/30 text-red-500' : 'border-white/5 text-zinc-600'}`}>
                      {salvando === cat.idUnico ? <RefreshCw size={16} className="animate-spin text-red-500" /> : <Map size={16} />}
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
                            {tatamesDisponiveis.map(t => <option key={t} value={t}>📍 {t}</option>)}
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

      {/* ========================================================= */}
      {/* MODAL DO CRONOGRAMA INTELIGENTE */}
      {/* ========================================================= */}
      {showCronoModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
          <div className="bg-[#0e0e12] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden relative">
            
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/50">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <Clock className="text-yellow-500 w-5 h-5"/> Motor de Horários
                </h2>
                <p className="text-zinc-400 text-xs mt-1 leading-tight">Defina a hora de início e o sistema calculará o cronograma de todas as lutas.</p>
              </div>
              <button onClick={() => setShowCronoModal(false)} className="p-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5 block pl-1">Tatame Alvo</label>
                <select value={cronoTatame} onChange={(e) => setCronoTatame(e.target.value)} className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-yellow-500 text-white text-xs font-bold appearance-none cursor-pointer">
                  <option value="" disabled>Selecione uma área...</option>
                  {tatamesDisponiveis.map(t => <option key={t} value={t}>📍 {t}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5 block pl-1">Horário de Início</label>
                  <input type="time" value={cronoHora} onChange={(e) => setCronoHora(e.target.value)} className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-yellow-500 text-white text-sm font-black cursor-text [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5 block pl-1">Tempo Transição</label>
                  <div className="relative">
                    <input type="number" min="0" max="10" value={cronoTransicao} onChange={(e) => setCronoTransicao(Number(e.target.value))} className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-yellow-500 text-white text-sm font-black cursor-text" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-600 uppercase">Min</span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-xl mt-2">
                <p className="text-[10px] text-yellow-500/80 leading-relaxed font-medium">
                  <strong>💡 Como funciona?</strong> O sistema cruzará as categorias mapeadas para este tatame com a tabela oficial da IBJJF. O cronograma gerado ficará visível nos celulares dos atletas e atualizará em tempo real conforme as lutas terminarem.
                </p>
              </div>

              <button 
                onClick={gerarCronogramaTatame} 
                disabled={gerandoCrono || !cronoTatame} 
                className="mt-2 w-full flex justify-center items-center gap-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(202,138,4,0.3)] active:scale-95 text-xs"
              >
                {gerandoCrono ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                {gerandoCrono ? 'Gerando Fila e Horários...' : 'Gerar Linha do Tempo'}
              </button>

            </div>
          </div>
        </div>
      )}

    </main>
  );
}