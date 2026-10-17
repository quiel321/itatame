"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { processarAvancosAutomaticosChaves, propagarResultadoChave } from "../../../lib/chaves-auto-avanco";
import { idBaiaDaPrimeiraChaveDeTres } from "@/app/lib/chave-de-tres";
import { garantirVinculoStaff } from "../../../lib/staff-sessao";
import ConexaoOperacao from '@/app/components/staff/ConexaoOperacao';
import PendenciasOperacao from '@/app/components/staff/PendenciasOperacao';
import { executarOperacao, contextoOperacao, baseLuta, baseRelogio, recuperarOperacao } from '@/app/lib/operacao-segura';
import { guardarRascunho, lerRascunho, pendenciasOperacao } from '@/app/lib/operacao-persistente';
import { corrigirResultadoLuta, METODOS_RESULTADO, type MetodoResultado } from '@/app/lib/corrigir-resultado';
import { liberadaParaMesario, vencedorPorPlacar, type LadoPlacar } from '@/app/lib/placar-operacao';
import { obterTempoRegulamentar } from "../../../lib/cronograma";

export default function PlacarMesarioDB() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  // ESTADOS DO BANCO DE DADOS
  const [lutaAtual, setLutaAtual] = useState<any>(null);
  const [todasLutasCategoria, setTodasLutasCategoria] = useState<any[]>([]);
  const [loadingDB, setLoadingDB] = useState(true);
  const [erroCarregamento,setErroCarregamento] = useState('');
  const [tentativaCarregamento,setTentativaCarregamento] = useState(0);

  // CONFIGURAÇÕES DA LUTA
  const [configOpen, setConfigOpen] = useState(true);
  const [editarTempo, setEditarTempo] = useState(false);
  const [minutoEditado, setMinutoEditado] = useState(0);
  const [segundoEditado, setSegundoEditado] = useState(0);
  const [erroTempo, setErroTempo] = useState('');
  const [salvandoTempo, setSalvandoTempo] = useState(false);
  const [showResumo, setShowResumo] = useState(false);
  const [ladosInvertidos, setLadosInvertidos] = useState(false);
  const [encerrarAberto, setEncerrarAberto] = useState(false);
  const [metodoEncerramento, setMetodoEncerramento] = useState<MetodoResultado>('pontos');
  const [tempoMinutos, setTempoMinutos] = useState(5);
  const [modoCorrecao, setModoCorrecao] = useState(false);
  const [metodoCorrecao, setMetodoCorrecao] = useState('pontos');
  const [salvandoResultado, setSalvandoResultado] = useState(false);
  const resultadoGravandoRef = useRef(false);
  const estadoOperacaoRef = useRef<any>(null);
  const rascunhoPlacarRef = useRef<any>(null);
  function protegerPlacar(patch: Record<string, unknown>) {
    const novo = { ...rascunhoPlacarRef.current, ...patch, atleta1: estadoOperacaoRef.current?.atleta_1_id, atleta2: estadoOperacaoRef.current?.atleta_2_id };
    guardarRascunho(localStorage, contextoOperacao(), 'placar', matchId, novo);
    rascunhoPlacarRef.current = novo;
  }
  useEffect(() => {
    const confirmar = (e: Event) => {
      const { pedido, resposta } = (e as CustomEvent).detail;
      if (pedido.alvo === matchId && resposta.luta) {
        estadoOperacaoRef.current = resposta.luta;
        setLutaAtual(resposta.luta);
        if(pedido.tipo==='relogio') {
          const l=resposta.luta;
          const fim=l.status_luta==='em_andamento'&&l.iniciada_em?new Date(l.iniciada_em).getTime()+Number(l.duracao_segundos)*1000:null;
          timerFimRef.current=fim;setTimerAtivo(Boolean(fim&&fim>Date.now()));setTempoRestante(fim?Math.max(0,Math.ceil((fim-Date.now())/1000)):Number(l.duracao_segundos));
        }
        if (resposta.luta.status_luta === 'concluida') {
          const lado = resposta.luta.vencedor_id === resposta.luta.atleta_1_id ? 'azul' : 'vermelho';
          setVencedor(lado); setTimerAtivo(false); timerFimRef.current = null;
          setShowResumo(true); setAvisoPontuacao('');
        }
      }
    };
    window.addEventListener('itatame:operacao-confirmada', confirmar);
    return () => window.removeEventListener('itatame:operacao-confirmada', confirmar);
  }, [matchId]);
  const [avisoResultado, setAvisoResultado] = useState('');
  const [avisoPontuacao, setAvisoPontuacao] = useState('');
  const [reenviandoPontuacao, setReenviandoPontuacao] = useState(false);
  const versaoPontuacaoRef = useRef({ azul: 0, vermelho: 0 });
  const pontuacoesPendentesRef = useRef(new Set<'azul' | 'vermelho'>());
  const filasPontuacaoRef = useRef({ azul: Promise.resolve(), vermelho: Promise.resolve() });

  // ESTADOS DO PLACAR
  const [tempoRestante, setTempoRestante] = useState(0);
  const [timerAtivo, setTimerAtivo] = useState(false);

  // Atleta 1 = AZUL | Atleta 2 = VERMELHO
  const [pontosAzul, setPontosAzul] = useState(0);
  const [vantagensAzul, setVantagensAzul] = useState(0);
  const [punicoesAzul, setPunicoesAzul] = useState(0);

  const [pontosVermelho, setPontosVermelho] = useState(0);
  const [vantagensVermelho, setVantagensVermelho] = useState(0);
  const [punicoesVermelho, setPunicoesVermelho] = useState(0);

  const [vencedor, setVencedor] = useState<"azul" | "vermelho" | "empate" | null>(null);
  const [perfilAzul, setPerfilAzul] = useState<any>(null);
  const [perfilVermelho, setPerfilVermelho] = useState<any>(null);

  const [stats, setStats] = useState({
    azul: { quedas: 0, passagens: 0, montadas: 0 },
    vermelho: { quedas: 0, passagens: 0, montadas: 0 }
  });

  const placarRef = useRef<HTMLDivElement>(null);
  const timerFimRef = useRef<number | null>(null);
  const timerSalvandoRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 🛡️ ESTADOS DE SEGURANÇA (CLIQUE TRIPLO)
  const [clicksFinalizarAzul, setClicksFinalizarAzul] = useState(0);
  const [clicksFinalizarVermelho, setClicksFinalizarVermelho] = useState(0);
  const timeoutAzulRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutVermelhoRef = useRef<NodeJS.Timeout | null>(null);

  // ESTADOS MOBILE
  const [isMobile, setIsMobile] = useState(false);
  const [clockPos, setClockPos] = useState({ x: 0, y: 0 });
  const [clockScale, setClockScale] = useState(1);
  const dragRef = useRef({ startX: 0, startY: 0, isDragging: false });
  const pinchRef = useRef({ startDist: 0, startScale: 1 });
  const orientationRef = useRef(true);

  // ==========================================
  // 1. CARREGAMENTO DO BANCO DE DADOS
  // ==========================================
  useEffect(() => {
    async function carregarLuta() {
      if (!matchId) return;
      setErroCarregamento('');setLoadingDB(true);

      const sessaoSalva = localStorage.getItem('itatame_staff_session');
      if (!sessaoSalva) {
        router.replace('/staff/login');
        return;
      }

      let sessaoStaff: { evento_id: string | number; funcao: string; identificacao: string };
      try {
        sessaoStaff = JSON.parse(sessaoSalva);
      } catch {
        localStorage.removeItem('itatame_staff_session');
        router.replace('/staff/login');
        return;
      }
      if (sessaoStaff.funcao !== 'mesario') {
        router.replace('/staff/login');
        return;
      }

      const vinculo = await garantirVinculoStaff();
      if (!vinculo.ok) { setErroCarregamento(vinculo.erro || 'Não foi possível conferir o posto.');setLoadingDB(false);return; }
      const { data: luta, error } = await supabase
        .from("chaves")
        .select("*")
        .eq("id", matchId)
        .maybeSingle();

      if (error || !luta) {
        setErroCarregamento(error
          ? 'Não foi possível consultar a luta agora. Confira a conexão e tente novamente. Os rascunhos deste aparelho foram preservados.'
          : 'Esta luta não está disponível para este posto. Confira a fila com o organizador.');
        setLoadingDB(false);
        return;
      }

      if (String(luta.evento_id) !== String(sessaoStaff.evento_id) || String(luta.tatame || '').trim().toUpperCase() !== String(sessaoStaff.identificacao || '').trim().toUpperCase()) {
        alert('Esta luta pertence a outro posto de operação.');
        router.replace('/staff/painel');
        return;
      }

      if (luta.status_luta !== 'concluida') {
        if (!liberadaParaMesario(luta)) {
          setErroCarregamento('Aguardando liberação do chamador. O mesário só pode abrir a luta depois do envio ao tatame.');
          setLoadingDB(false);return;
        }
        const {data: inscritos, error: erroCheckin} = await supabase.from('inscricoes')
          .select('atleta_id,status_checkin,pesagem_ok,kimono_aprovado,pagamento_ok,estorno_status')
          .eq('evento_id',luta.evento_id).eq('categoria_id',luta.categoria_id).in('atleta_id',[luta.atleta_1_id,luta.atleta_2_id].filter(Boolean));
        const aprovados = new Set((inscritos||[]).filter(i=>i.status_checkin==='aprovado' && i.pesagem_ok && i.kimono_aprovado && i.pagamento_ok && i.estorno_status!=='estornado').map(i=>i.atleta_id));
        if (erroCheckin || !luta.atleta_1_id || !luta.atleta_2_id || !aprovados.has(luta.atleta_1_id) || !aprovados.has(luta.atleta_2_id)) {
          alert('Este confronto não está liberado: ambos os atletas precisam estar aprovados na recepção.'); router.replace('/staff/painel'); return;
        }
      }
      setLutaAtual(luta);
      estadoOperacaoRef.current = luta;
      try {
        const lados = lerRascunho<any>(localStorage,contextoOperacao(),'lados-placar',matchId);
        setLadosInvertidos(Boolean(lados&&lados.atleta1===luta.atleta_1_id&&lados.atleta2===luta.atleta_2_id&&lados.invertidos));
      } catch(e) { setAvisoPontuacao((e as Error).message); }
      let tempoCategoria = Number(luta.tempo_minutos);
      if ((!Number.isFinite(tempoCategoria) || tempoCategoria <= 0) && luta.categoria_id) {
        const { data: categoriaTempo, error: erroTempo } = await supabase.from('categorias_evento')
          .select('tempo_minutos').eq('id', luta.categoria_id).eq('evento_id', luta.evento_id).maybeSingle();
        if (erroTempo || !categoriaTempo) {
          alert('Não foi possível conferir o tempo da categoria. Atualize a fila antes de iniciar o combate.');
          router.replace('/staff/painel');
          return;
        }
        tempoCategoria = Number(categoriaTempo.tempo_minutos);
      }
      if (!Number.isFinite(tempoCategoria) || tempoCategoria <= 0) tempoCategoria = obterTempoRegulamentar(luta.categoria, luta.faixa);
      setTempoMinutos(tempoCategoria);
      if (luta.status_luta === 'em_andamento' && !luta.iniciada_em && Number(luta.duracao_segundos) >= 0) {
        setConfigOpen(false);
        setTempoRestante(Number(luta.duracao_segundos));
        setTimerAtivo(false);
      }
      if (luta.status_luta === 'concluida') {
        setModoCorrecao(true);
        setConfigOpen(false);
        setTempoRestante(0);
        setVencedor(String(luta.vencedor_id) === String(luta.atleta_1_id) || luta.vencedor === luta.atleta_1 ? 'azul' : 'vermelho');
        setMetodoCorrecao(luta.metodo_vitoria || 'pontos');
      }

      const idsAtletas = [luta.atleta_1_id, luta.atleta_2_id].filter(Boolean);
      if (idsAtletas.length > 0) {
        const { data: perfis } = await supabase
          .from("atletas_publico")
          .select("id, nome, foto_url, equipe, academia, faixa")
          .in("id", idsAtletas);

        setPerfilAzul(perfis?.find((perfil) => perfil.id === luta.atleta_1_id) || null);
        setPerfilVermelho(perfis?.find((perfil) => perfil.id === luta.atleta_2_id) || null);
      }

      if (luta.pontuacao_atleta_1) {
        setPontosAzul(luta.pontuacao_atleta_1.pontos || 0);
        setVantagensAzul(luta.pontuacao_atleta_1.vantagens || 0);
        setPunicoesAzul(luta.pontuacao_atleta_1.punicoes || 0);
      }
      if (luta.pontuacao_atleta_2) {
        setPontosVermelho(luta.pontuacao_atleta_2.pontos || 0);
        setVantagensVermelho(luta.pontuacao_atleta_2.vantagens || 0);
        setPunicoesVermelho(luta.pontuacao_atleta_2.punicoes || 0);
      }

      rascunhoPlacarRef.current = { pontosAzul:luta.pontuacao_atleta_1?.pontos||0, vantagensAzul:luta.pontuacao_atleta_1?.vantagens||0, punicoesAzul:luta.pontuacao_atleta_1?.punicoes||0, pontosVermelho:luta.pontuacao_atleta_2?.pontos||0, vantagensVermelho:luta.pontuacao_atleta_2?.vantagens||0, punicoesVermelho:luta.pontuacao_atleta_2?.punicoes||0, confirmada:true };
      if (luta.status_luta === 'em_andamento' && luta.iniciada_em) {
        const fim = new Date(luta.iniciada_em).getTime() + Number(luta.duracao_segundos ?? tempoCategoria * 60) * 1000;
        timerFimRef.current = fim; setTempoRestante(Math.max(0,Math.ceil((fim-Date.now())/1000))); setTimerAtivo(fim>Date.now()); setConfigOpen(false);
      }
      try {
        const salvo = lerRascunho<any>(localStorage,contextoOperacao(),'placar',matchId);
        if (salvo && !salvo.confirmada && luta.status_luta !== 'concluida') {
          if (salvo.atleta1 !== luta.atleta_1_id || salvo.atleta2 !== luta.atleta_2_id) {
            setAvisoPontuacao('Há um rascunho preservado com participantes diferentes. Não será aplicado. Procure o organizador.');
          } else {
            rascunhoPlacarRef.current = salvo;
            setPontosAzul(salvo.pontosAzul);setVantagensAzul(salvo.vantagensAzul);setPunicoesAzul(salvo.punicoesAzul);
            setPontosVermelho(salvo.pontosVermelho);setVantagensVermelho(salvo.vantagensVermelho);setPunicoesVermelho(salvo.punicoesVermelho);
            if (salvo.tempoRestante != null) { setTempoRestante(salvo.fimEm ? Math.max(0,Math.ceil((salvo.fimEm-Date.now())/1000)) : salvo.tempoRestante); timerFimRef.current=salvo.fimEm||null;setTimerAtivo(Boolean(salvo.fimEm&&salvo.fimEm>Date.now()));setConfigOpen(false); }
            setAvisoPontuacao('Rascunho recuperado deste aparelho. Confira as ações pendentes e salve a pontuação antes de continuar.');
          }
        }
      } catch(e) { setAvisoPontuacao((e as Error).message); }

      const { data: todas } = await supabase
        .from("chaves")
        .select("*")
        .eq("evento_id", luta.evento_id)
        .eq("categoria", luta.categoria)
        .eq("faixa", luta.faixa);

      if (todas) setTodasLutasCategoria(todas);
      setLoadingDB(false);
    }

    void carregarLuta().catch(()=>{setErroCarregamento('Não foi possível carregar a operação. Preserve os dados deste navegador e tente novamente.');setLoadingDB(false);});
  }, [matchId, router,tentativaCarregamento]);

  // ==========================================
  // 2. ATUALIZAÇÃO NO SUPABASE (PLACAR AO VIVO)
  // ==========================================
  const salvarPontuacaoDB = async (lado: "azul" | "vermelho", pts: number, vts: number, pun: number) => {
    if (!lutaAtual) return;
    const campo = lado === "azul" ? "pontuacao_atleta_1" : "pontuacao_atleta_2";
    const payload = { pontos: pts, vantagens: vts, punicoes: pun };
    const versao = ++versaoPontuacaoRef.current[lado];
    pontuacoesPendentesRef.current.add(lado);
    // Mantém a ordem de cliques do mesmo lado mesmo em uma rede lenta.
    const gravar = async () => {
      try {
        const atual = estadoOperacaoRef.current;
        const resposta = await executarOperacao('pontuacao',matchId,{tatame:atual.tatame,lado:lado==='azul'?1:2,pontuacao:payload},{...baseLuta(atual),pontuacao:atual[campo]});
        estadoOperacaoRef.current = resposta.luta;
        if (versao === versaoPontuacaoRef.current[lado]) pontuacoesPendentesRef.current.delete(lado);
        if (!pontuacoesPendentesRef.current.size) { setAvisoPontuacao(''); protegerPlacar({confirmada:true}); }
      } catch {
        setAvisoPontuacao('A pontuação deste aparelho ainda não foi confirmada no servidor. Mantenha a tela aberta e salve novamente quando a conexão voltar.');
      }
    };
    filasPontuacaoRef.current[lado] = Promise.all(Object.values(filasPontuacaoRef.current)).then(gravar, gravar);
    await filasPontuacaoRef.current[lado];
  };

  const reenviarPontuacao = async () => {
    if (reenviandoPontuacao) return;
    setReenviandoPontuacao(true);
    try {
      for(const p of pendenciasOperacao(localStorage,contextoOperacao()).filter(p=>p.alvo===matchId&&p.tipo==='pontuacao')) await recuperarOperacao(p);
      await Promise.all([
        salvarPontuacaoDB('azul', pontosAzul, vantagensAzul, punicoesAzul),
        salvarPontuacaoDB('vermelho', pontosVermelho, vantagensVermelho, punicoesVermelho),
      ]);
    } catch(e) { setAvisoPontuacao((e as Error).message); } finally { setReenviandoPontuacao(false); }
  };

  const updatePontos = (lado: 'azul' | 'vermelho', tipo: 'pontos' | 'vantagens' | 'punicoes', valor: number, acao: 'quedas' | 'passagens' | 'montadas' | null = null) => {
    if (resultadoGravandoRef.current || vencedor || modoCorrecao) return;
    const r=rascunhoPlacarRef.current;
    if(!r)return;
    const azul=lado==='azul';
    let pts=Number(azul?r.pontosAzul:r.pontosVermelho),vts=Number(azul?r.vantagensAzul:r.vantagensVermelho),pun=Number(azul?r.punicoesAzul:r.punicoesVermelho);
    if(tipo==='pontos')pts=Math.max(0,pts+valor);
    if(tipo==='vantagens')vts=Math.max(0,vts+valor);
    if(tipo==='punicoes')pun=Math.max(0,pun+valor);
    try { protegerPlacar(azul?{pontosAzul:pts,vantagensAzul:vts,punicoesAzul:pun,confirmada:false}:{pontosVermelho:pts,vantagensVermelho:vts,punicoesVermelho:pun,confirmada:false}); }
    catch(e){setAvisoPontuacao((e as Error).message);return;}
    if(azul){setPontosAzul(pts);setVantagensAzul(vts);setPunicoesAzul(pun);}else{setPontosVermelho(pts);setVantagensVermelho(vts);setPunicoesVermelho(pun);}
    if(acao&&valor>0)setStats(atual=>({...atual,[lado]:{...atual[lado],[acao]:atual[lado][acao]+1}}));
    void salvarPontuacaoDB(lado,pts,vts,pun);
  };

  const processarFimDeLuta = async (vencedorLado: "azul" | "vermelho" | "empate", metodo: string) => {
    if (!lutaAtual || vencedorLado === "empate") return false;
    if (lutaAtual.status_luta === "concluida" || lutaAtual.vencedor) return true;
    if (resultadoGravandoRef.current) return false;
    resultadoGravandoRef.current = true;
    setAvisoResultado('');

    const nomeVencedor = vencedorLado === "azul" ? lutaAtual.atleta_1 : lutaAtual.atleta_2;
    const equipeVencedor = vencedorLado === "azul" ? lutaAtual.equipe_1 : lutaAtual.equipe_2;
    const idVencedor = vencedorLado === "azul" ? lutaAtual.atleta_1_id : lutaAtual.atleta_2_id;
    const nomePerdedor = vencedorLado === "azul" ? lutaAtual.atleta_2 : lutaAtual.atleta_1;
    const equipePerdedor = vencedorLado === "azul" ? lutaAtual.equipe_2 : lutaAtual.equipe_1;
    const idPerdedor = vencedorLado === "azul" ? lutaAtual.atleta_2_id : lutaAtual.atleta_1_id;

    // Renova o vínculo antes de gravar: as medalhas só entram para atletas inscritos neste evento.
    try {
    await Promise.all(Object.values(filasPontuacaoRef.current));
    const vinculo = await garantirVinculoStaff();
    if (!vinculo.ok) {
      resultadoGravandoRef.current = false;
      alert(vinculo.erro || 'Posto sem autorização para registrar o resultado.');
      return false;
    }

      if(pontuacoesPendentesRef.current.size) throw new Error('Há pontuação sem confirmação. Salve o placar antes de encerrar.');
      const atual = estadoOperacaoRef.current;
      const resposta = await executarOperacao('finalizar',matchId,{tatame:atual.tatame,lado:vencedorLado==='azul'?1:2,metodo:metodo==='ausencia'?'wo':metodo},
        {...baseLuta(atual),pontuacao_atleta_1:atual.pontuacao_atleta_1,pontuacao_atleta_2:atual.pontuacao_atleta_2});
      estadoOperacaoRef.current = resposta.luta; setLutaAtual(resposta.luta);
      pontuacoesPendentesRef.current.clear();setAvisoPontuacao('');protegerPlacar({confirmada:true});
      try { await processarAvancosAutomaticosChaves(supabase,lutaAtual.evento_id,lutaAtual.categoria_id||undefined); }
      catch { setAvisoResultado('Resultado, avanço e medalhas confirmados juntos. Confira os demais avanços automáticos da categoria quando a conexão voltar.'); }
      return true;
    } catch (error: any) {
      alert(`Não foi possível concluir a luta: ${error?.message || 'erro inesperado'}`);
      return false;
    } finally { resultadoGravandoRef.current = false; }
  };

  // NOVO: FUNÇÃO DO CLIQUE TRIPLO DE SEGURANÇA
  const handleFinalizarClick = (lado: "azul" | "vermelho") => {
    if (modoCorrecao || vencedor || showResumo) return;

    if (lado === "azul") {
      const novosClicks = clicksFinalizarAzul + 1;
      if (novosClicks >= 3) {
        if (timeoutAzulRef.current) clearTimeout(timeoutAzulRef.current);
        setClicksFinalizarAzul(0);
        declararFinalizacao("azul");
      } else {
        setClicksFinalizarAzul(novosClicks);
        if (timeoutAzulRef.current) clearTimeout(timeoutAzulRef.current);
        timeoutAzulRef.current = setTimeout(() => setClicksFinalizarAzul(0), 3000); // Reseta após 3 segundos
      }
    } else {
      const novosClicks = clicksFinalizarVermelho + 1;
      if (novosClicks >= 3) {
        if (timeoutVermelhoRef.current) clearTimeout(timeoutVermelhoRef.current);
        setClicksFinalizarVermelho(0);
        declararFinalizacao("vermelho");
      } else {
        setClicksFinalizarVermelho(novosClicks);
        if (timeoutVermelhoRef.current) clearTimeout(timeoutVermelhoRef.current);
        timeoutVermelhoRef.current = setTimeout(() => setClicksFinalizarVermelho(0), 3000); // Reseta após 3 segundos
      }
    }
  };

  const declararFinalizacao = async (lado: "azul" | "vermelho") => {
    if (resultadoGravandoRef.current) return;
    timerFimRef.current = null;
    setTimerAtivo(false);
    const salvou = await processarFimDeLuta(lado, "finalizacao");
    if (!salvou) return;
    tocarSom('fim');
    setVencedor(lado);
    setTimeout(() => setShowResumo(true), 3500);
  };

  useEffect(() => {
    document.body.classList.add('ocultar-nav-global');
    document.documentElement.classList.add('ocultar-nav-global');
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      const currentPortrait = window.innerHeight > window.innerWidth;
      if (mobile && currentPortrait !== orientationRef.current) {
        orientationRef.current = currentPortrait;
        if (currentPortrait) {
          setClockScale(0.55); setClockPos({ x: 0, y: 0 });
        } else {
          setClockScale(0.35); setClockPos({ x: 0, y: -45 });
        }
      }
    };
    if (window.innerWidth <= 1024) {
      const isPort = window.innerHeight > window.innerWidth;
      orientationRef.current = isPort;
      setIsMobile(true);
      if (isPort) { setClockScale(0.55); setClockPos({ x: 0, y: 0 }); }
      else { setClockScale(0.35); setClockPos({ x: 0, y: -45 }); }
    }
    window.addEventListener("resize", handleResize);
    return () => {
      document.body.classList.remove('ocultar-nav-global');
      document.documentElement.classList.remove('ocultar-nav-global');
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    if (e.touches.length === 1) {
      dragRef.current = { startX: e.touches[0].clientX - clockPos.x, startY: e.touches[0].clientY - clockPos.y, isDragging: true };
    } else if (e.touches.length === 2) {
      dragRef.current.isDragging = false;
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchRef.current = { startDist: dist, startScale: clockScale };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;
    if (e.touches.length === 1 && dragRef.current.isDragging) {
      setClockPos({ x: e.touches[0].clientX - dragRef.current.startX, y: e.touches[0].clientY - dragRef.current.startY });
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const newScale = pinchRef.current.startScale * (dist / pinchRef.current.startDist);
      setClockScale(Math.min(Math.max(newScale, 0.3), 1.2));
    }
  };

  const onTouchEnd = () => dragRef.current.isDragging = false;

  const tocarSom = (tipo: 'inicio' | 'fim' | 'pause') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      if (tipo === 'inicio') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
      } else if (tipo === 'pause') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(400, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
      } else if (tipo === 'fim') {
        const tocarNota = (frequencia: number, inicio: number, duracao: number) => {
          const nota = ctx.createOscillator();
          const envelope = ctx.createGain();
          nota.type = 'sine';
          nota.frequency.setValueAtTime(frequencia, ctx.currentTime + inicio);
          envelope.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
          envelope.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + inicio + 0.03);
          envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracao);
          nota.connect(envelope);
          envelope.connect(ctx.destination);
          nota.start(ctx.currentTime + inicio);
          nota.stop(ctx.currentTime + inicio + duracao + 0.03);
        };
        tocarNota(523.25, 0, 0.28);
        tocarNota(659.25, 0.24, 0.32);
        tocarNota(783.99, 0.52, 0.45);
      }
    } catch (error) { console.log("Áudio não suportado", error); }
  };

  useEffect(() => {
    if (!timerAtivo || !timerFimRef.current) return;
    const atualizarPeloRelogioReal = () => {
      const fim = timerFimRef.current;
      if (fim === null) return;
      const restante = Math.max(0, Math.ceil((fim - Date.now()) / 1000));
      setTempoRestante(restante);
    };
    atualizarPeloRelogioReal();
    const intervalo = window.setInterval(atualizarPeloRelogioReal, 200);
    return () => window.clearInterval(intervalo);
  }, [timerAtivo]);

  const salvarRelogio = async (segundos: number, rodando: boolean) => {
    await Promise.all(Object.values(filasPontuacaoRef.current));
    const atual = estadoOperacaoRef.current;
    const resposta = await executarOperacao('relogio',matchId,{tatame:atual.tatame,segundos,rodando},baseRelogio(atual));
    estadoOperacaoRef.current = resposta.luta;
    if (!pontuacoesPendentesRef.current.size) setAvisoPontuacao('');
    return resposta.luta;
  };

  useEffect(() => {
    const pararNoTempoEsgotado = async () => {
      if (tempoRestante === 0 && timerAtivo && timerFimRef.current !== null && Date.now() >= timerFimRef.current) {
        tocarSom('fim');
        setTimerAtivo(false);
        timerFimRef.current = null;

        // Zerar o relógio não declara vencedor nem bloqueia pontos/punições.
        // O mesário encerra depois da conferência e da decisão do árbitro.
        try {
          protegerPlacar({tempoRestante:0,fimEm:null,confirmada:false});
          await salvarRelogio(0,false);
          protegerPlacar({tempoRestante:0,fimEm:null,confirmada:!pontuacoesPendentesRef.current.size});
        } catch(e) { setAvisoPontuacao((e as Error).message); }
      }
    };
    void pararNoTempoEsgotado();
  }, [tempoRestante, timerAtivo]);

  const toggleTimer = async () => {
    if (timerSalvandoRef.current || editarTempo || modoCorrecao || vencedor) return;
    timerSalvandoRef.current = true;
    try {
    if (!timerAtivo && tempoRestante > 0) {
      const luta = await salvarRelogio(tempoRestante,true);
      timerFimRef.current = new Date(luta.iniciada_em).getTime() + Number(luta.duracao_segundos)*1000;
      setTimerAtivo(true);
      protegerPlacar({tempoRestante,fimEm:timerFimRef.current,confirmada:!pontuacoesPendentesRef.current.size});
      tocarSom('inicio');
    } else if (timerAtivo) {
      const restante = Math.max(0, Math.ceil(((timerFimRef.current || Date.now()) - Date.now()) / 1000));
      // Desarmar a expiração antes de aguardar a rede: pausar nunca encerra a luta.
      timerFimRef.current = null;
      setTimerAtivo(false);
      setTempoRestante(restante);
      tocarSom('pause');
      protegerPlacar({tempoRestante:restante,fimEm:null,confirmada:false});
      await salvarRelogio(restante,false);
      protegerPlacar({tempoRestante:restante,fimEm:null,confirmada:!pontuacoesPendentesRef.current.size});

    }
    } catch(e) { setAvisoPontuacao((e as Error).message); } finally {
      timerSalvandoRef.current = false;
    }
  };

  const formatarTempo = (segundos: number) => {
    const m = Math.floor(segundos / 60).toString().padStart(2, "0");
    const s = (segundos % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const iniciarLuta = () => {
    timerFimRef.current = null;
    setTempoRestante(tempoMinutos * 60);
    setTimerAtivo(false);
    setConfigOpen(false);
    setShowResumo(false);
    tocarSom('pause');
  };

  const trocarLados = () => {
    if (timerAtivo || resultadoGravandoRef.current) return;
    try {
      guardarRascunho(localStorage,contextoOperacao(),'lados-placar',matchId,{atleta1:lutaAtual.atleta_1_id,atleta2:lutaAtual.atleta_2_id,invertidos:!ladosInvertidos});
      setLadosInvertidos(!ladosInvertidos);
    } catch(e) { setAvisoPontuacao((e as Error).message); }
  };

  const encerrarResultado = async (lado: LadoPlacar) => {
    if (timerAtivo || salvandoResultado) return;
    const nome = lado === 'azul' ? atletaAzul : atletaVermelho;
    if (!window.confirm(`Confirmar ${nome} como vencedor por ${METODOS_RESULTADO.find(m=>m.id===metodoEncerramento)?.label}?`)) return;
    setSalvandoResultado(true);
    try {
      if (await processarFimDeLuta(lado,metodoEncerramento)) {
        setEncerrarAberto(false);setVencedor(lado);setShowResumo(true);
      }
    } finally { setSalvandoResultado(false); }
  };

  const salvarCorrecaoResultado = async (lado: 'azul' | 'vermelho') => {
    if (!lutaAtual || !window.confirm('Confirmar a correção deste resultado oficial?')) return;

    const vinculo = await garantirVinculoStaff();
    if (!vinculo.ok) {
      alert(vinculo.erro || 'Posto sem autorização para corrigir o resultado.');
      return;
    }

    try {
      await corrigirResultadoLuta(supabase,todasLutasCategoria,estadoOperacaoRef.current,lado==='azul'?1:2,metodoCorrecao as MetodoResultado);
      alert('Correção confirmada no servidor.'); router.push('/staff/painel');
    } catch(e) { setAvisoResultado((e as Error).message); }
  };

  const abrirAjusteTempo = () => {
    if (timerAtivo || timerSalvandoRef.current || modoCorrecao || vencedor) return;
    setMinutoEditado(Math.floor(tempoRestante / 60));
    setSegundoEditado(tempoRestante % 60);
    setErroTempo('');
    setEditarTempo(true);
  };

  const aplicarTempo = async () => {
    if (timerAtivo || timerSalvandoRef.current || modoCorrecao || vencedor || salvandoTempo) return;
    const total = minutoEditado * 60 + segundoEditado;
    if (!Number.isInteger(minutoEditado) || !Number.isInteger(segundoEditado) || minutoEditado < 0 || segundoEditado < 0 || segundoEditado > 59 || total <= 0 || total > tempoMinutos * 60) {
      setErroTempo(`Informe um tempo entre 00:01 e ${formatarTempo(tempoMinutos * 60)}.`); return;
    }
    setSalvandoTempo(true);
    timerSalvandoRef.current = true;
    try {
      const atual=estadoOperacaoRef.current;
      const resposta=await executarOperacao('relogio',matchId,{tatame:atual.tatame,segundos:total,rodando:false},baseRelogio(atual));
      estadoOperacaoRef.current=resposta.luta;
      protegerPlacar({tempoRestante:total,fimEm:null,confirmada:false});
    timerFimRef.current = null;
    setTimerAtivo(false);
      setTempoRestante(total);
      setEditarTempo(false);
    } catch (error) { setErroTempo(error instanceof Error ? error.message : 'Não foi possível ajustar o tempo.'); }
    finally { timerSalvandoRef.current = false; setSalvandoTempo(false); }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      placarRef.current?.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loadingDB) {
    return <div className="h-screen bg-black flex items-center justify-center text-white text-xl font-bold animate-pulse">Carregando Luta do Banco de Dados...</div>;
  }
  if (erroCarregamento) return <main className="min-h-screen bg-black text-white"><ConexaoOperacao/><PendenciasOperacao/><section className="mx-auto max-w-lg p-6"><h1 className="text-xl font-bold">Não foi possível abrir o placar</h1><p role="alert" className="my-4 text-amber-200">{erroCarregamento}</p><button type="button" onClick={()=>setTentativaCarregamento(n=>n+1)} className="min-h-11 rounded-lg bg-amber-400 px-4 font-bold text-black">Tentar novamente</button><button type="button" onClick={()=>router.push('/staff/painel')} className="ml-3 min-h-11 rounded-lg border px-4">Voltar à fila</button></section></main>;

  const atletaAzul = lutaAtual?.atleta_1 || "TBD";
  const atletaVermelho = lutaAtual?.atleta_2 || "TBD";

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .ocultar-nav-global header:not(.header-placar),
        .ocultar-nav-global nav, .ocultar-nav-global .nav-global-mobile { display: none !important; }
        .ocultar-nav-global body > div, .ocultar-nav-global body > main, .ocultar-nav-global #__next { padding-top: 0 !important; margin-top: 0 !important; height: 100vh; overflow: hidden; }

        @media screen and (max-width: 768px) and (orientation: portrait) {
          .placar-wrapper { flex-direction: column !important; }
          .placar-side { width: 100% !important; height: 50% !important; border: none !important; padding: 1rem !important; }
          .placar-side-azul { border-bottom: 3px solid #000 !important; }
          .placar-side-verm { border-top: 3px solid #000 !important; }
          .nome-container { padding: 0 !important; text-align: center !important; margin: 0 !important; }
          .atleta-nome { font-size: 2.0rem !important; text-align: center !important; }
          .pontos-container { align-items: center !important; }
          .pontos-gigantes { font-size: 7.5rem !important; }
          .botoes-grid { gap: 0.5rem !important; }
          .botoes-grid button { padding: 0.4rem !important; }
          .botoes-grid span:first-child { font-size: 1.5rem !important; }
          .vantagens-punicoes { gap: 0.5rem !important; }
          .vantagens-punicoes > div { padding: 0.5rem !important; }
          .vantagens-punicoes span.text-5xl { font-size: 2.5rem !important; }
          .vantagens-punicoes button { width: 2rem !important; height: 2rem !important; font-size: 1.5rem !important; }
          .vencedor-overlay { transform: scale(0.6) !important; padding: 1rem 2rem !important; }
          .resumo-modal { transform: scale(0.7) !important; padding: 1.5rem !important; width: 95% !important; }
          .resumo-grid { grid-template-columns: 1fr !important; gap: 1rem !important; }
        }

        @media screen and (max-height: 500px) and (orientation: landscape) {
          .placar-side { padding: 0.5rem 1rem !important; }
          .placar-com-acoes .placar-side > button { top: 32% !important; }
          .nome-container { padding-right: 5% !important; padding-left: 5% !important; }
          .atleta-nome { font-size: 1.8rem !important; }
          .pontos-gigantes { font-size: 6.5rem !important; }
          .botoes-grid { gap: 0.25rem !important; }
          .botoes-grid button { padding: 0.25rem !important; }
          .botoes-grid span:first-child { font-size: 1.2rem !important; }
          .vantagens-punicoes { gap: 0.5rem !important; }
          .vantagens-punicoes > div { padding: 0.25rem !important; }
          .vantagens-punicoes span.text-5xl { font-size: 2rem !important; }
          .vantagens-punicoes button { width: 1.8rem !important; height: 1.8rem !important; font-size: 1.2rem !important; }
          .modal-config { transform: scale(0.7) !important; }
          .vencedor-overlay { transform: scale(0.5) !important; }
          .resumo-modal { transform: scale(0.65) !important; }
        }
        .placar-com-acoes .placar-side { padding-bottom: 3.5rem !important; }
      `}} />

      <div ref={placarRef} className={`placar-wrapper ${!configOpen&&!modoCorrecao&&!vencedor?'placar-com-acoes':''} bg-black h-screen w-screen flex flex-row font-sans select-none text-white relative overflow-hidden`}>
        <div className="absolute inset-x-0 top-0 z-[200]">
          <ConexaoOperacao /><PendenciasOperacao compacto />
          {avisoPontuacao && <details className="absolute right-2 top-12 max-w-[min(36rem,calc(100vw-1rem))] rounded-lg border border-red-400/50 bg-red-950 px-3 py-2 text-sm text-red-100">
            <summary className="cursor-pointer text-xs font-bold">Conferir sincronização do placar</summary>
            <p>{avisoPontuacao}</p>
            <button type="button" disabled={reenviandoPontuacao} onClick={() => void reenviarPontuacao()} className="mt-2 min-h-11 rounded-lg border border-red-300/50 px-3 text-xs font-bold disabled:opacity-50">{reenviandoPontuacao ? 'Salvando pontuação…' : 'Salvar pontuação deste aparelho'}</button>
          </details>}
        </div>

        {!configOpen && !modoCorrecao && !vencedor && <div className="absolute bottom-2 left-2 z-[80] flex flex-wrap gap-2">
          <button disabled={timerAtivo || salvandoTempo} onClick={abrirAjusteTempo} className="rounded-lg border border-white/20 bg-black/80 px-3 py-2 text-xs font-bold disabled:opacity-40">Ajustar tempo</button>
          <button disabled={timerAtivo} onClick={trocarLados} aria-pressed={ladosInvertidos} className="rounded-lg border border-white/20 bg-black/80 px-3 py-2 text-xs font-bold disabled:opacity-40">Trocar lados</button>
          <button disabled={timerAtivo || salvandoResultado} onClick={()=>{setMetodoEncerramento(vencedorPorPlacar({pontos:pontosAzul,vantagens:vantagensAzul,punicoes:punicoesAzul},{pontos:pontosVermelho,vantagens:vantagensVermelho,punicoes:punicoesVermelho})?'pontos':'decisao_arbitro');setEncerrarAberto(true);}} className="rounded-lg border border-yellow-400/50 bg-black/80 px-3 py-2 text-xs font-bold text-yellow-200 disabled:opacity-40">Encerrar luta</button>
        </div>}
        {encerrarAberto&&<div role="dialog" aria-modal="true" aria-label="Confirmar resultado da luta" className="absolute inset-0 z-[120] flex items-center justify-center bg-black/90 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/20 bg-zinc-950 p-5">
            <h2 className="text-xl font-bold">Confirmar resultado</h2>
            <p className="mt-2 text-sm text-zinc-400">Confira os pontos e a decisão do árbitro antes de encerrar. Em desclassificação, escolha o atleta que venceu.</p>
            <label className="my-4 block text-sm">Método<select value={metodoEncerramento} onChange={e=>setMetodoEncerramento(e.target.value as MetodoResultado)} className="mt-2 w-full rounded-lg border border-white/20 bg-black p-3">{METODOS_RESULTADO.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button disabled={salvandoResultado} onClick={()=>void encerrarResultado('azul')} className="min-h-16 rounded-lg bg-blue-700 p-3 font-bold">Venceu: {atletaAzul}</button>
              <button disabled={salvandoResultado} onClick={()=>void encerrarResultado('vermelho')} className="min-h-16 rounded-lg bg-red-700 p-3 font-bold">Venceu: {atletaVermelho}</button>
            </div>
            <button disabled={salvandoResultado} onClick={()=>setEncerrarAberto(false)} className="mt-4 min-h-11 w-full rounded-lg border border-white/20 p-3">Voltar ao placar e ajustar</button>
          </div>
        </div>}
        {editarTempo && <div role="dialog" aria-modal="true" aria-label="Ajustar tempo restante" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4">
          <div className="max-h-[calc(100dvh-3rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/20 bg-zinc-950 p-5">
            <h2 className="text-lg font-bold">Tempo restante</h2>
            <p className="mt-2 text-sm text-zinc-400">O placar será mantido. A luta continua pausada após salvar.</p>
            <div className="my-4 grid grid-cols-2 gap-3">
              <label>Minutos<input aria-label="Minutos restantes" type="number" min="0" max={tempoMinutos} value={minutoEditado} onChange={e => setMinutoEditado(Number(e.target.value))} className="mt-1 w-full rounded bg-zinc-800 p-3" /></label>
              <label>Segundos<input aria-label="Segundos restantes" type="number" min="0" max="59" value={segundoEditado} onChange={e => setSegundoEditado(Number(e.target.value))} className="mt-1 w-full rounded bg-zinc-800 p-3" /></label>
            </div>
            {erroTempo && <p role="alert" className="mb-3 text-sm text-red-300">{erroTempo}</p>}
            <div className="flex gap-3"><button disabled={salvandoTempo} onClick={() => setEditarTempo(false)} className="rounded bg-zinc-800 p-3">Cancelar</button><button disabled={salvandoTempo} onClick={aplicarTempo} className="flex-1 rounded bg-white p-3 font-bold text-black">{salvandoTempo ? 'Salvando...' : 'Salvar tempo'}</button></div>
          </div>
        </div>}

        {configOpen && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="modal-config bg-[#111] border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-white font-black text-2xl italic tracking-tighter"><span className="text-red-600">i</span>TATAME</span>
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest bg-zinc-800 px-2 py-1 rounded">Scoreboard Lincado</span>
              </div>

              <div className="bg-black/50 p-4 rounded-xl border border-white/5 mb-6 text-center">
                <p className="text-blue-400 font-bold uppercase">{atletaAzul}</p>
                <p className="text-zinc-500 text-xs font-black my-1">VS</p>
                <p className="text-red-500 font-bold uppercase">{atletaVermelho}</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 pl-1">Tempo de Luta</label>
                  <p className="mb-2 text-xs text-cyan-200">Carregado da categoria. Confira antes de iniciar.</p>
                  <div className="flex items-center gap-4">
                    <input type="range" min="1" max="10" value={tempoMinutos} onChange={(e) => setTempoMinutos(Number(e.target.value))} className="w-full accent-white cursor-pointer" />
                    <span className="text-lg font-black text-white w-12 text-center bg-zinc-800 py-1 rounded-md">{tempoMinutos}m</span>
                  </div>
                </div>
                <button onClick={iniciarLuta} className="cursor-pointer w-full bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-widest py-3.5 rounded-lg transition-colors mt-4 shadow-xl">
                  Abrir placar
                </button>
                <button onClick={() => router.push('/staff/painel')} className="cursor-pointer w-full bg-transparent text-zinc-500 py-2 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">
                  Cancelar e Voltar
                </button>
              </div>
            </div>
          </div>
        )}

        {modoCorrecao && (
          <div className="absolute left-1/2 top-2 z-[90] w-[min(760px,calc(100%-1rem))] -translate-x-1/2 rounded-2xl border border-yellow-500/35 bg-black/95 p-3 shadow-[0_0_35px_rgba(234,179,8,0.2)] backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-yellow-400">Correção de luta concluída</span>
                <p className="mt-1 text-[10px] font-bold text-zinc-400">Ajuste o placar abaixo, escolha o método e confirme o vencedor correto.</p>
              </div>
              <select value={metodoCorrecao} onChange={(event) => setMetodoCorrecao(event.target.value)} className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-[10px] font-black uppercase text-white outline-none">
                <option value="pontos">Pontos</option>
                <option value="finalizacao">Finalização</option>
                <option value="decisao_arbitro">Decisão do árbitro</option>
                <option value="desclassificacao">Desclassificação</option>
                <option value="wo">W.O.</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => salvarCorrecaoResultado('azul')} className="rounded-xl bg-blue-600 px-3 py-2 text-[9px] font-black uppercase text-white">Venceu azul</button>
                <button onClick={() => salvarCorrecaoResultado('vermelho')} className="rounded-xl bg-red-600 px-3 py-2 text-[9px] font-black uppercase text-white">Venceu vermelho</button>
              </div>
            </div>
          </div>
        )}

        <div className="clock-island absolute z-[60] flex flex-col items-center" style={isMobile ? { left: '50%', top: '42%', transform: `translate(calc(-50% + ${clockPos.x}px), calc(-50% + ${clockPos.y}px)) scale(${clockScale})`, touchAction: 'none'} : { left: '50%', top: '42%', transform: 'translate(-50%, -50%)' }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="bg-[#09090b]/95 backdrop-blur-xl px-6 py-4 md:px-10 md:py-6 rounded-[2rem] border border-zinc-800 shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col items-center">
            <span className={`text-[5.5rem] md:text-[7.5rem] lg:text-[8.5rem] leading-none font-black font-mono tracking-tighter drop-shadow-[0_0_25px_rgba(255,215,0,0.6)] text-[#FFD700] ${tempoRestante <= 60 && tempoRestante > 0 ? 'animate-pulse' : ''}`}>
              {formatarTempo(tempoRestante)}
            </span>
            <div className="flex gap-2 md:gap-4 mt-2 md:mt-4 w-full justify-center">
              <button disabled={!timerAtivo&&tempoRestante===0} onClick={toggleTimer} className={`cursor-pointer flex-1 py-2.5 md:py-3 rounded-xl flex items-center justify-center font-black text-sm md:text-lg uppercase tracking-widest transition-transform active:scale-95 shadow-lg disabled:opacity-50 ${timerAtivo ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-green-500 text-black hover:bg-green-400'}`}>
                {timerAtivo ? 'PAUSAR' : tempoRestante===0 ? 'TEMPO ESGOTADO' : 'INICIAR'}
              </button>
              <button onClick={toggleFullscreen} className="cursor-pointer w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-transform active:scale-95 border border-white/5">
                <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">{isFullscreen ? (<path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />) : (<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />)}</svg>
              </button>
            </div>
          </div>
        </div>

        {/* LADO AZUL */}
        <div style={{order:ladosInvertidos?2:0}} data-atleta-id={lutaAtual?.atleta_1_id} className={`placar-side placar-side-azul w-1/2 h-full bg-[#05142b] border-r-[2px] border-black flex flex-col pt-5 md:pt-8 px-3 md:px-5 pb-5 relative z-10 transition-all duration-1000 ${vencedor === 'vermelho' ? 'opacity-20 grayscale' : vencedor === 'azul' ? 'brightness-125' : ''}`}>

          {/* BOTÃO DE FINALIZAR - CLIQUE TRIPLO (AZUL) */}
          <button
            onClick={() => handleFinalizarClick("azul")}
            className={`absolute top-1/2 -translate-y-1/2 ${ladosInvertidos?'right-2 md:right-6':'left-2 md:left-6'} z-50 flex flex-col items-center justify-center text-center font-bold uppercase transition-all duration-300 cursor-pointer shadow-[0_0_15px_rgba(0,0,0,0.5)] px-2
              ${clicksFinalizarAzul === 0 ? 'bg-black/60 border border-white/30 text-white w-16 h-16 md:w-20 md:h-20 rounded-full opacity-40 hover:opacity-100 hover:border-blue-500 hover:scale-110' : ''}
              ${clicksFinalizarAzul === 1 ? 'bg-orange-600 border-2 border-orange-400 text-white w-32 md:w-40 h-16 md:h-20 rounded-2xl opacity-100 scale-110' : ''}
              ${clicksFinalizarAzul === 2 ? 'bg-red-700 border-2 border-red-500 text-white w-32 md:w-40 h-16 md:h-20 rounded-2xl opacity-100 scale-110 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.8)]' : ''}
            `}
          >
            {clicksFinalizarAzul === 0 && (
              <><span className="text-[8px] md:text-[10px] leading-tight">Finalizar</span><span className="text-[10px] md:text-[13px] leading-tight text-blue-400 mt-0.5">Luta</span></>
            )}
            {clicksFinalizarAzul === 1 && (
              <><span className="text-[8px] md:text-[10px] leading-tight">MAIS 2 CLIQUES</span><span className="text-[9px] md:text-[11px] leading-tight text-white mt-0.5">PARA CONFIRMAR</span></>
            )}
            {clicksFinalizarAzul === 2 && (
              <><span className="text-[9px] md:text-[11px] leading-tight text-white">MAIS 1 CLIQUE PARA</span><span className="text-[10px] md:text-[13px] leading-tight text-red-200 mt-0.5 font-black">ENCERRAR AGORA!</span></>
            )}
          </button>

          {vencedor === 'azul' && (
            <div className="vencedor-overlay absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="bg-black/90 px-8 py-4 md:px-12 md:py-6 rounded-[3rem] border-4 border-blue-500 shadow-[0_0_100px_rgba(59,130,246,0.8)] -rotate-12 animate-pulse">
                <span className="text-blue-400 font-black text-5xl md:text-7xl lg:text-[7rem] uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(59,130,246,1)]">Venceu</span>
              </div>
            </div>
          )}

          <div className={`nome-container w-full text-center px-4 ${ladosInvertidos?'md:pr-8 md:pl-[20%]':'md:pl-8 md:pr-[20%]'} shrink-0 pt-2 flex flex-col items-center`}>
            <h2 title={atletaAzul} className="atleta-nome text-2xl md:text-3xl lg:text-[2.45rem] xl:text-[2.8rem] leading-none pb-1 font-black uppercase text-white truncate drop-shadow-md w-full block">{atletaAzul}</h2>
            <span className="text-blue-400 text-[10px] md:text-xs font-bold uppercase tracking-widest truncate max-w-full">{lutaAtual?.equipe_1}</span>
          </div>

          <div className={`pontos-container flex-1 flex items-center justify-center w-full min-h-[0] ${ladosInvertidos?'md:pl-12 lg:pl-20':'md:pr-12 lg:pr-20'}`}>
            <span className="pontos-gigantes text-[9rem] md:text-[12rem] lg:text-[13rem] font-black text-white leading-none tracking-tighter drop-shadow-lg">{pontosAzul}</span>
          </div>

          <div className="flex flex-col gap-4 md:gap-6 w-full max-w-[600px] mx-auto mt-4 shrink-0">
            <div className="botoes-grid grid grid-cols-4 gap-3 md:gap-4">
              <button onClick={() => updatePontos("azul", "pontos", 2, "quedas")} className="cursor-pointer bg-blue-600 hover:bg-blue-500 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">+2</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight w-full pointer-events-none">Queda / Rasp<br/>Joelho na Barriga</span>
              </button>
              <button onClick={() => updatePontos("azul", "pontos", 3, "passagens")} className="cursor-pointer bg-blue-600 hover:bg-blue-500 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">+3</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight w-full pointer-events-none">Passagem<br/>de Guarda</span>
              </button>
              <button onClick={() => updatePontos("azul", "pontos", 4, "montadas")} className="cursor-pointer bg-blue-600 hover:bg-blue-500 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">+4</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight w-full pointer-events-none">Montada<br/>Costas</span>
              </button>
              <button onClick={() => updatePontos("azul", "pontos", -1)} className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">-1</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight text-zinc-400 w-full pointer-events-none">Retirar<br/>Ponto</span>
              </button>
            </div>
            <div className="vantagens-punicoes flex justify-between gap-4 md:gap-6">
              <div className="flex-1 bg-black/40 rounded-2xl p-4 flex flex-col items-center border border-white/5 shadow-inner">
                <span className="text-yellow-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 pointer-events-none">Vantagens</span>
                <div className="flex items-center gap-4 md:gap-6 w-full justify-center">
                  <button onClick={() => updatePontos("azul", "vantagens", -1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">-</button>
                  <span className="text-5xl md:text-6xl font-black text-yellow-500 pointer-events-none">{vantagensAzul}</span>
                  <button onClick={() => updatePontos("azul", "vantagens", 1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">+</button>
                </div>
              </div>
              <div className="flex-1 bg-black/40 rounded-2xl p-4 flex flex-col items-center border border-white/5 shadow-inner">
                <span className="text-red-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 pointer-events-none">Punições</span>
                <div className="flex items-center gap-4 md:gap-6 w-full justify-center">
                  <button onClick={() => updatePontos("azul", "punicoes", -1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">-</button>
                  <span className="text-5xl md:text-6xl font-black text-red-500 pointer-events-none">{punicoesAzul}</span>
                  <button onClick={() => updatePontos("azul", "punicoes", 1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LADO VERMELHO */}
        <div style={{order:ladosInvertidos?0:2}} data-atleta-id={lutaAtual?.atleta_2_id} className={`placar-side placar-side-verm w-1/2 h-full bg-[#2f0404] border-l border-black flex flex-col pt-5 md:pt-8 px-3 md:px-5 pb-5 relative z-10 transition-all duration-1000 ${vencedor === 'azul' ? 'opacity-20 grayscale' : vencedor === 'vermelho' ? 'brightness-125' : ''}`}>

          {/* BOTÃO DE FINALIZAR - CLIQUE TRIPLO (VERMELHO) */}
          <button
            onClick={() => handleFinalizarClick("vermelho")}
            className={`absolute top-1/2 -translate-y-1/2 ${ladosInvertidos?'left-2 md:left-6':'right-2 md:right-6'} z-50 flex flex-col items-center justify-center text-center font-bold uppercase transition-all duration-300 cursor-pointer shadow-[0_0_15px_rgba(0,0,0,0.5)] px-2
              ${clicksFinalizarVermelho === 0 ? 'bg-black/60 border border-white/30 text-white w-16 h-16 md:w-20 md:h-20 rounded-full opacity-40 hover:opacity-100 hover:border-red-500 hover:scale-110' : ''}
              ${clicksFinalizarVermelho === 1 ? 'bg-orange-600 border-2 border-orange-400 text-white w-32 md:w-40 h-16 md:h-20 rounded-2xl opacity-100 scale-110' : ''}
              ${clicksFinalizarVermelho === 2 ? 'bg-red-700 border-2 border-red-500 text-white w-32 md:w-40 h-16 md:h-20 rounded-2xl opacity-100 scale-110 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.8)]' : ''}
            `}
          >
            {clicksFinalizarVermelho === 0 && (
              <><span className="text-[8px] md:text-[10px] leading-tight">Finalizar</span><span className="text-[10px] md:text-[13px] leading-tight text-red-400 mt-0.5">Luta</span></>
            )}
            {clicksFinalizarVermelho === 1 && (
              <><span className="text-[8px] md:text-[10px] leading-tight">MAIS 2 CLIQUES</span><span className="text-[9px] md:text-[11px] leading-tight text-white mt-0.5">PARA CONFIRMAR</span></>
            )}
            {clicksFinalizarVermelho === 2 && (
              <><span className="text-[9px] md:text-[11px] leading-tight text-white">MAIS 1 CLIQUE PARA</span><span className="text-[10px] md:text-[13px] leading-tight text-red-200 mt-0.5 font-black">ENCERRAR AGORA!</span></>
            )}
          </button>

          {vencedor === 'vermelho' && (
            <div className="vencedor-overlay absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="bg-black/90 px-8 py-4 md:px-12 md:py-6 rounded-[3rem] border-4 border-red-500 shadow-[0_0_100px_rgba(239,68,68,0.8)] -rotate-12 animate-pulse">
                <span className="text-red-500 font-black text-5xl md:text-7xl lg:text-[7rem] uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(239,68,68,1)]">Venceu</span>
              </div>
            </div>
          )}

          <div className={`nome-container w-full text-center px-4 ${ladosInvertidos?'md:pl-8 md:pr-[20%]':'md:pr-8 md:pl-[20%]'} shrink-0 pt-2 flex flex-col items-center`}>
            <h2 title={atletaVermelho} className="atleta-nome text-2xl md:text-3xl lg:text-[2.45rem] xl:text-[2.8rem] leading-none pb-1 font-black uppercase text-white truncate drop-shadow-md w-full block">{atletaVermelho}</h2>
            <span className="text-red-400 text-[10px] md:text-xs font-bold uppercase tracking-widest truncate max-w-full">{lutaAtual?.equipe_2}</span>
          </div>

          <div className={`pontos-container flex-1 flex items-center justify-center w-full min-h-[0] ${ladosInvertidos?'md:pr-12 lg:pr-20':'md:pl-12 lg:pl-20'}`}>
            <span className="pontos-gigantes text-[9rem] md:text-[12rem] lg:text-[13rem] font-black text-white leading-none tracking-tighter drop-shadow-lg">{pontosVermelho}</span>
          </div>

          <div className="flex flex-col gap-4 md:gap-6 w-full max-w-[600px] mx-auto mt-4 shrink-0">
            <div className="botoes-grid grid grid-cols-4 gap-3 md:gap-4">
              <button onClick={() => updatePontos("vermelho", "pontos", 2, "quedas")} className="cursor-pointer bg-red-600 hover:bg-red-500 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">+2</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight w-full pointer-events-none">Queda / Rasp<br/>Joelho na Barriga</span>
              </button>
              <button onClick={() => updatePontos("vermelho", "pontos", 3, "passagens")} className="cursor-pointer bg-red-600 hover:bg-red-500 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">+3</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight w-full pointer-events-none">Passagem<br/>de Guarda</span>
              </button>
              <button onClick={() => updatePontos("vermelho", "pontos", 4, "montadas")} className="cursor-pointer bg-red-600 hover:bg-red-500 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">+4</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight w-full pointer-events-none">Montada<br/>Costas</span>
              </button>
              <button onClick={() => updatePontos("vermelho", "pontos", -1)} className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center transition-colors active:scale-95 text-white shadow-lg w-full h-full">
                <span className="text-2xl md:text-3xl font-black pointer-events-none">-1</span>
                <span className="text-[7px] md:text-[9px] uppercase font-bold mt-1 text-center leading-tight text-zinc-400 w-full pointer-events-none">Retirar<br/>Ponto</span>
              </button>
            </div>
            <div className="vantagens-punicoes flex justify-between gap-4 md:gap-6">
              <div className="flex-1 bg-black/40 rounded-2xl p-4 flex flex-col items-center border border-white/5 shadow-inner">
                <span className="text-yellow-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 pointer-events-none">Vantagens</span>
                <div className="flex items-center gap-4 md:gap-6 w-full justify-center">
                  <button onClick={() => updatePontos("vermelho", "vantagens", -1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">-</button>
                  <span className="text-5xl md:text-6xl font-black text-yellow-500 pointer-events-none">{vantagensVermelho}</span>
                  <button onClick={() => updatePontos("vermelho", "vantagens", 1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">+</button>
                </div>
              </div>
              <div className="flex-1 bg-black/40 rounded-2xl p-4 flex flex-col items-center border border-white/5 shadow-inner">
                <span className="text-red-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 pointer-events-none">Punições</span>
                <div className="flex items-center gap-4 md:gap-6 w-full justify-center">
                  <button onClick={() => updatePontos("vermelho", "punicoes", -1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">-</button>
                  <span className="text-5xl md:text-6xl font-black text-red-500 pointer-events-none">{punicoesVermelho}</span>
                  <button onClick={() => updatePontos("vermelho", "punicoes", 1)} className="cursor-pointer text-white/40 hover:text-white text-3xl md:text-4xl font-black transition-colors w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL DE RESUMO */}
        {showResumo && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="resumo-modal bg-[#0c1220] border border-white/10 rounded-3xl p-8 w-full max-w-4xl shadow-[0_0_80px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-10 duration-500">
              {avisoResultado && <p role="status" className="mb-4 rounded-xl border border-amber-400/40 bg-amber-950/40 p-3 text-sm text-amber-100">{avisoResultado}</p>}
              <div className="text-center mb-6">
                <p className={`${vencedor === 'empate' ? 'text-yellow-400' : 'text-green-500'} font-black uppercase tracking-[0.25em] text-[10px] mb-2`}>{vencedor === 'empate' ? 'Decisão do árbitro' : 'Resultado oficial'}</p>
                <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">{vencedor === 'empate' ? 'Quem venceu a luta?' : 'Fim de Combate'}</h2>
                {vencedor === 'empate' && <p className="mx-auto mt-2 max-w-xl text-xs font-bold text-zinc-400">O placar terminou empatado. Confira os atletas e registre a decisão tomada pelo árbitro.</p>}
              </div>

              {vencedor === 'empate' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {([
                    { lado: 'azul' as const, nome: atletaAzul, perfil: perfilAzul, equipe: perfilAzul?.equipe || lutaAtual?.equipe_1, cor: 'blue' },
                    { lado: 'vermelho' as const, nome: atletaVermelho, perfil: perfilVermelho, equipe: perfilVermelho?.equipe || lutaAtual?.equipe_2, cor: 'red' },
                  ]).map((atleta) => (
                    <button
                      key={atleta.lado}
                      disabled={salvandoResultado}
                      onClick={async () => {
                        if (salvandoResultado) return;
                        setSalvandoResultado(true);
                        const salvou = await processarFimDeLuta(atleta.lado, 'decisao_arbitro');
                        if (salvou) setVencedor(atleta.lado);
                        setSalvandoResultado(false);
                      }}
                      className={`group rounded-2xl border p-5 text-left transition hover:-translate-y-1 ${atleta.cor === 'blue' ? 'border-blue-500/40 bg-blue-950/30 hover:border-blue-400' : 'border-red-500/40 bg-red-950/30 hover:border-red-400'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 bg-zinc-900 ${atleta.cor === 'blue' ? 'border-blue-500' : 'border-red-500'}`}>
                          {atleta.perfil?.foto_url ? <img src={atleta.perfil.foto_url} alt={atleta.nome} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-3xl font-black text-white">{atleta.nome.charAt(0)}</span>}
                        </div>
                        <div className="min-w-0">
                          <strong className="block truncate text-xl font-black uppercase text-white">{atleta.nome}</strong>
                          <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-widest text-zinc-400">{atleta.equipe || 'Sem equipe'}</span>
                          <span className={`mt-4 inline-flex rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest ${atleta.cor === 'blue' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'}`}>Declarar vencedor</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (

              <div className="bg-black/35 border border-white/10 rounded-2xl overflow-hidden">
                <div className={"px-5 py-3 text-center font-black uppercase tracking-[0.25em] text-xs " + (vencedor === 'azul' ? 'bg-blue-600 text-white' : vencedor === 'vermelho' ? 'bg-red-600 text-white' : 'bg-zinc-700 text-white')}>
                  Vencedor
                </div>

                <div className="p-5 md:p-7 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-5 items-center">
                  <div className="mx-auto w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-yellow-400/80 bg-zinc-900 flex items-center justify-center shadow-[0_0_35px_rgba(234,179,8,0.2)]">
                    {(vencedor === 'azul' ? perfilAzul?.foto_url : perfilVermelho?.foto_url) ? (
                      <img src={vencedor === 'azul' ? perfilAzul?.foto_url : perfilVermelho?.foto_url} alt="Foto do vencedor" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl font-black text-white">{(vencedor === 'azul' ? atletaAzul : vencedor === 'vermelho' ? atletaVermelho : 'E').charAt(0)}</span>
                    )}
                  </div>

                  <div className="text-center md:text-left">
                    <h3 className="text-3xl md:text-5xl font-black text-white uppercase leading-none mb-2">
                      {vencedor === 'azul' ? atletaAzul : vencedor === 'vermelho' ? atletaVermelho : 'Empate'}
                    </h3>
                    <p className="text-zinc-400 text-sm md:text-base font-bold uppercase tracking-widest mb-4">
                      {vencedor === 'azul' ? (perfilAzul?.equipe || lutaAtual?.equipe_1) : (perfilVermelho?.equipe || lutaAtual?.equipe_2)}
                    </p>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                        <span className="block text-[9px] text-zinc-500 font-black uppercase tracking-widest">Pontos</span>
                        <strong className="text-2xl text-white">{vencedor === 'azul' ? pontosAzul : vencedor === 'vermelho' ? pontosVermelho : pontosAzul + ' x ' + pontosVermelho}</strong>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                        <span className="block text-[9px] text-zinc-500 font-black uppercase tracking-widest">Vant.</span>
                        <strong className="text-2xl text-yellow-400">{vencedor === 'azul' ? vantagensAzul : vencedor === 'vermelho' ? vantagensVermelho : vantagensAzul + ' x ' + vantagensVermelho}</strong>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                        <span className="block text-[9px] text-zinc-500 font-black uppercase tracking-widest">Pun.</span>
                        <strong className="text-2xl text-red-400">{vencedor === 'azul' ? punicoesAzul : vencedor === 'vermelho' ? punicoesVermelho : punicoesAzul + ' x ' + punicoesVermelho}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-t border-white/10 text-xs">
                  <div className="p-4 bg-blue-950/30 border-r border-white/10">
                    <p className="font-black text-blue-300 uppercase truncate">{atletaAzul}</p>
                    <p className="text-zinc-400 mt-1">{pontosAzul} pts | {vantagensAzul} vant. | {punicoesAzul} pun.</p>
                  </div>
                  <div className="p-4 bg-red-950/30">
                    <p className="font-black text-red-300 uppercase truncate">{atletaVermelho}</p>
                    <p className="text-zinc-400 mt-1">{pontosVermelho} pts | {vantagensVermelho} vant. | {punicoesVermelho} pun.</p>
                  </div>
                </div>
              </div>

              )}

              <button onClick={() => router.push('/staff/painel')} disabled={vencedor === 'empate'} className="cursor-pointer w-full mt-8 bg-white hover:bg-zinc-200 text-black py-4 rounded-xl font-black uppercase tracking-widest transition-colors shadow-xl disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
                Voltar para o Chaveamento
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
