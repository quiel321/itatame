'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase'; 
import { Scanner } from '@yudiel/react-qr-scanner';
import { CheckCircle, XCircle, Scale, ArrowLeft, QrCode } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { obterTempoRegulamentar } from '@/app/lib/cronograma';
import { garantirVinculoStaff } from '@/app/lib/staff-sessao';
import { processarAvancosAutomaticosChaves } from '@/app/lib/chaves-auto-avanco';
import ProgramacaoLutas from './ProgramacaoLutas';
import { AVISO_TATAMES, categoriasComTatamesProntos } from '@/app/lib/planejamento-operacao';
import { FILTRO_INSCRICOES_ATIVAS } from '@/app/lib/inscricao-ativa';
import { executarOperacao, contextoOperacao, notificarSemBloquear } from '@/app/lib/operacao-segura';
import { guardarRascunho, lerRascunho } from '@/app/lib/operacao-persistente';
import { dataOperacionalEvento } from '@/app/lib/evento-datas';
import { categoriasRecepcaoOrdenadas, filtrarCheckin, listaCheckinPorChave, todasCategoriasRecepcaoFinalizadas, type ChaveCheckin, type InscritoCheckin } from '@/app/lib/operacao-campeonato';

export default function RecepcaoOperacao({ ativa = true }: { ativa?: boolean }) {
  const router = useRouter();
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [atleta, setAtleta] = useState<any>(null);
  const [opcoesQr, setOpcoesQr] = useState<any[]>([]);
  const topoRecepcaoRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!ativa) return;
    // A operação tem rolagem própria dentro de um painel fixo. Voltar apenas
    // o window não reposiciona a pesagem ao selecionar um atleta no fim da lista.
    for (let elemento = topoRecepcaoRef.current; elemento; elemento = elemento.parentElement) {
      elemento.scrollTo({ top: 0, left: elemento.scrollLeft, behavior: 'instant' });
    }
  }, [ativa, atleta?.id, opcoesQr.length]);
  const [loading, setLoading] = useState(false);
  const [erro, setErroInterno] = useState('');
  const [eventoStaff, setEventoStaff] = useState('');
  const [lista, setLista] = useState<InscritoCheckin[]>([]);
  const [planejamento, setPlanejamento] = useState<ChaveCheckin[]>([]);
  const atualizacaoRef = useRef<Promise<void> | null>(null);
  const repetirAtualizacaoRef = useRef(false);
  const [categoriasFechadas, setCategoriasFechadas] = useState<string[]>([]);
  const [tatamesProntos, setTatamesProntos] = useState<string[]>([]);
  const [controleRecepcao, setControleRecepcao] = useState<Record<number, { chamadas: number; ausente: boolean }>>({});
  const [controlePronto, setControlePronto] = useState(false);
  const [acaoRecepcao, setAcaoRecepcao] = useState<string | null>(null);
  const [avisoRecepcao, setAvisoRecepcao] = useState('');
  const [avancoPendente, setAvancoPendente] = useState<string | null>(null);
  const [erroLista, setErroListaInterno] = useState('');
  const [avisoVersao, setAvisoVersao] = useState(0);
  const avisoRef = useRef<HTMLDivElement>(null);
  const conclusaoRef = useRef<HTMLDivElement>(null);
  const recepcaoFinalizada = controlePronto && !acaoRecepcao && !avancoPendente
    && todasCategoriasRecepcaoFinalizadas(lista, planejamento, categoriasFechadas);
  useEffect(() => {
    if (ativa && !atleta && recepcaoFinalizada) {
      conclusaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [ativa, atleta, recepcaoFinalizada]);
  function setErro(mensagem: string) { setErroInterno(mensagem); if (mensagem) setAvisoVersao(v => v + 1); }
  function setErroLista(mensagem: string) { setErroListaInterno(mensagem); }
  useEffect(() => {
    if (!erro && !erroLista && !avancoPendente) return;
    avisoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    avisoRef.current?.focus({ preventScroll: true });
  }, [avisoVersao, erro, erroLista, avancoPendente]);
  const [busca, setBusca] = useState('');
  const [categoriaLista, setCategoriaLista] = useState('');
  const [situacaoLista, setSituacaoLista] = useState<'pendentes' | 'aprovados' | 'desclassificados' | 'todos'>('pendentes');
  const selecao = filtrarCheckin(lista, busca, categoriaLista);
  const categoriaInteira = filtrarCheckin(lista, '', categoriaLista);
  const visiveis = selecao.filter(i => situacaoLista === 'todos' || (situacaoLista === 'desclassificados' ? i.status_checkin?.startsWith('desclassificado_') : situacaoLista === 'aprovados' ? i.status_checkin === 'aprovado' && !controleRecepcao[i.id]?.ausente : (!i.status_checkin || i.status_checkin === 'pendente') && !controleRecepcao[i.id]?.ausente));
  const categoriaSelecionadaId = categoriaLista ? categoriaInteira[0]?.categoria_id : null;
  const categoriaFechada = Boolean(categoriaSelecionadaId && categoriasFechadas.includes(categoriaSelecionadaId));
  const categoriaTatamePronto = Boolean(categoriaSelecionadaId && tatamesProntos.includes(categoriaSelecionadaId));
  const habilitados = categoriaInteira.filter(i => i.pagamento_ok);
  const pendentesRecepcao = habilitados.filter(i => (!i.status_checkin || i.status_checkin === 'pendente') && !controleRecepcao[i.id]?.ausente).length;
  const aprovadosRecepcao = habilitados.filter(i => i.status_checkin === 'aprovado' && !controleRecepcao[i.id]?.ausente).length;
  const ausentesRecepcao = habilitados.filter(i => controleRecepcao[i.id]?.ausente).length;
  const [modoEntrada, setModoEntrada] = useState<'lista' | 'qr'>('lista');
  const [documentoConferido, setDocumentoConferido] = useState(false);
  const canalOperacaoRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [pesoAferido, setPesoAferido] = useState('');
  const [kimonoAprovado, setKimonoAprovado] = useState(false);
  useEffect(() => {
    if (!atleta?.id) return;
    try { guardarRascunho(localStorage,contextoOperacao(),'pesagem',String(atleta.id),{peso:pesoAferido,kimono:kimonoAprovado,documento:documentoConferido,statusAnterior:atleta.status_checkin||'pendente',confirmada:false}); }
    catch(e) { setErro((e as Error).message); }
  },[atleta?.id,pesoAferido,kimonoAprovado,documentoConferido]);

  // =========================================================================
  // SEGURANÇA DE PORTA: Garante que o operador está logado via PIN
  // =========================================================================
  useEffect(() => {
    document.body.classList.add('hide-global-nav');
    
    const sessaoSalva = localStorage.getItem('itatame_staff_session');
    if (!sessaoSalva) {
      router.replace('/staff/login');
      return;
    }

    const sessaoParse = sessaoSalva ? JSON.parse(sessaoSalva) : null;
    if (!sessaoParse || !['checkin', 'operacao'].includes(sessaoParse.funcao)) {
      router.replace('/staff/login');
      return;
    }
    setEventoStaff(sessaoParse.evento_id);
    void carregarLista(sessaoParse.evento_id);

    const canal = supabase.channel(`recepcao-tatames-${sessaoParse.evento_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inscricoes', filter: `evento_id=eq.${sessaoParse.evento_id}` }, () => { void carregarLista(sessaoParse.evento_id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recepcao_categorias', filter: `evento_id=eq.${sessaoParse.evento_id}` }, () => { void carregarLista(sessaoParse.evento_id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recepcao_inscricoes', filter: `evento_id=eq.${sessaoParse.evento_id}` }, () => { void carregarLista(sessaoParse.evento_id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chaves', filter: `evento_id=eq.${sessaoParse.evento_id}` }, () => { void carregarLista(sessaoParse.evento_id); }).subscribe();
    canalOperacaoRef.current = canal;
    const aoConfirmar = () => { void carregarLista(sessaoParse.evento_id); };
    window.addEventListener('itatame:operacao-confirmada',aoConfirmar);
    const intervalo = window.setInterval(() => void carregarLista(sessaoParse.evento_id), 10000);
    const aoReconectar = () => { void carregarLista(sessaoParse.evento_id); };
    window.addEventListener('itatame:conexao-restabelecida', aoReconectar);

    return () => {
      document.body.classList.remove('hide-global-nav');
      canalOperacaoRef.current = null;
      window.clearInterval(intervalo);
      window.removeEventListener('itatame:operacao-confirmada',aoConfirmar);
      window.removeEventListener('itatame:conexao-restabelecida', aoReconectar);
      void supabase.removeChannel(canal);
    };
  }, [router]);

  async function carregarLista(eventoId: string) {
    if (atualizacaoRef.current) { repetirAtualizacaoRef.current = true; return atualizacaoRef.current; }
    const tarefa = async () => {
      do { repetirAtualizacaoRef.current = false; await lerLista(eventoId); } while (repetirAtualizacaoRef.current);
    };
    atualizacaoRef.current = tarefa().finally(() => { atualizacaoRef.current = null; });
    return atualizacaoRef.current;
  }

  async function lerLista(eventoId: string) {
    try {
    const vinculo = await garantirVinculoStaff();
    if (!vinculo.ok) throw new Error(vinculo.erro || 'Entre novamente com o PIN.');
    const [categorias, controles, mesarios] = await Promise.all([
      supabase.from('recepcao_categorias').select('categoria_id,fechada').eq('evento_id', eventoId),
      supabase.from('recepcao_inscricoes').select('inscricao_id,chamadas,ausente').eq('evento_id', eventoId),
      supabase.from('staff_eventos').select('identificacao').eq('evento_id', eventoId).eq('funcao', 'mesario'),
    ]);
    if (categorias.error || controles.error) {
      throw new Error('Não foi possível atualizar o controle da recepção. Confira a conexão e atualize a lista.');
    }
    if (mesarios.error) throw new Error('Não foi possível conferir os tatames. Atualize a lista antes de operar.');
    const todas: InscritoCheckin[] = [];
    for (let inicio = 0; ; inicio += 500) {
      const { data, error } = await supabase.from('inscricoes')
        .select('id,user_id,atleta_id,categoria_id,atleta,equipe,categoria,faixa,pagamento_ok,status_checkin,pesagem_ok,kimono_aprovado')
        .eq('evento_id', eventoId).or(FILTRO_INSCRICOES_ATIVAS).order('atleta').range(inicio, inicio + 499);
      if (error) throw new Error('Não foi possível carregar os atletas. Atualize a lista.');
      todas.push(...(data || []) as InscritoCheckin[]);
      if (!data || data.length < 500) break;
    }
    const chaves: ChaveCheckin[] = [];
    for (let inicio = 0; ; inicio += 500) {
      const { data, error } = await supabase.from('chaves').select('categoria,categoria_id,tatame,ordem_tatame,atleta_1_id,atleta_2_id')
        .eq('evento_id',eventoId).order('id').range(inicio,inicio+499);
      if (error) throw new Error('Não foi possível conferir as chaves. Despacho bloqueado até atualizar a lista.');
      chaves.push(...(data || []) as ChaveCheckin[]);
      if (!data || data.length < 500) break;
    }
    setLista(listaCheckinPorChave(todas,chaves));
    setPlanejamento(chaves);
    setCategoriasFechadas((categorias.data || []).filter(c => c.fechada).map(c => c.categoria_id));
    setControleRecepcao(Object.fromEntries((controles.data || []).map(c => [c.inscricao_id, { chamadas: c.chamadas, ausente: c.ausente }])));
    setTatamesProntos(categoriasComTatamesProntos(chaves, mesarios.data || []));
    setControlePronto(true);
    setErroLista('');
    } catch (error) {
      setControlePronto(false);
      setErroLista(error instanceof Error ? error.message : 'Falha na conexão. Atualize a lista antes de operar.');
    }
  }

  async function operarRecepcao(acao: 'chamar' | 'ausente' | 'retirar_ausencia' | 'fechar', item?: InscritoCheckin) {
    const categoriaId = item?.categoria_id || categoriaSelecionadaId;
    if (!categoriaId || acaoRecepcao || !controlePronto) return;
    if (acao === 'fechar' && !tatamesProntos.includes(categoriaId)) { setErro(AVISO_TATAMES); return; }
    if (acao === 'ausente' && !window.confirm(`Confirmar que ${item?.atleta} não compareceu após três chamadas? O avanço da chave ocorre ao fechar a categoria.`)) return;
    if (acao === 'fechar' && !window.confirm(`Fechar check-in e despachar esta categoria? ${aprovadosRecepcao} aprovado(s), ${ausentesRecepcao} ausente(s), ${habilitados.length - aprovadosRecepcao - ausentesRecepcao} reprovado(s). Ausências e reprovações serão tratadas na chave.`)) return;
    setAcaoRecepcao(`${acao}-${item?.id || categoriaId}`); setAvisoRecepcao(''); setErro('');
    try {
      const vinculo = await garantirVinculoStaff();
      if (!vinculo.ok) throw new Error(vinculo.erro);
      const data = await executarOperacao('recepcao',categoriaId,{acao,inscricao:item?.id||null});
      if (acao === 'fechar') {
        setAvisoRecepcao(`Categoria despachada. ${aprovadosRecepcao} aprovado(s) liberado(s) para Chamada / Tatames. ${Number(data?.avancos_por_ausencia || 0)} avanço(s) por ausência/reprovação.`);
        try {
          await processarAvancosAutomaticosChaves(supabase, eventoStaff, categoriaId);
          setAvancoPendente(null);
        } catch { setAvancoPendente(categoriaId); }
      } else if (acao === 'chamar') setAvisoRecepcao(`${data.chamadas}ª chamada: ${item?.atleta}. Anuncie o nome e aguarde a apresentação.`);
      else setAvisoRecepcao(acao === 'ausente' ? 'Ausência registrada. Nenhuma presença foi confirmada automaticamente.' : 'Ausência retirada. Confira documento e pesagem do atleta.');
      await carregarLista(eventoStaff);
      window.dispatchEvent(new CustomEvent('itatame:recepcao-atualizada', { detail: { eventoId: eventoStaff } }));
    } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível registrar a ação.'); }
    finally { setAcaoRecepcao(null); }
  }

  async function atualizarAvancos() {
    if (!avancoPendente || acaoRecepcao) return;
    setAcaoRecepcao('atualizar-avancos');
    try {
      const vinculo = await garantirVinculoStaff();
      if (!vinculo.ok) throw new Error(vinculo.erro);
      await processarAvancosAutomaticosChaves(supabase, eventoStaff, avancoPendente);
      setAvancoPendente(null);
      await carregarLista(eventoStaff);
      window.dispatchEvent(new CustomEvent('itatame:recepcao-atualizada', { detail: { eventoId: eventoStaff } }));
    } catch { /* Mantém o aviso e permite tentar novamente sem fechar a categoria outra vez. */ }
    finally { setAcaoRecepcao(null); }
  }

  // =========================================================================
  // LEITOR BLINDADO: Só aceita o QR Code do Evento. Bloqueia a Carteirinha!
  // =========================================================================
  const handleScan = (detectedCodes: any[]) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    const textoLido = detectedCodes[0].rawValue;
    if (!textoLido) return;

    // 1. LER O INGRESSO DO EVENTO (Padrão: ITATAME|EVENTO_ID|USER_ID)
    if (textoLido.includes('ITATAME|')) {
      const partes = textoLido.split('|');
      // Importante: Passaporte do evento tem sempre 3 partes (exclui o DIGITAL)
      if (partes.length === 3 && partes[1] !== 'DIGITAL') {
        const evId = partes[1];
        const usrId = partes[2];
        setScannedId('QR-VALIDADO');
        fetchAtleta(evId, usrId);
        return;
      }
    }

    // 2. BLOQUEIO DA CARTEIRINHA DIGITAL (Evita fraude de Instagram)
    if (textoLido.includes('/atleta/') || textoLido.includes('|DIGITAL|')) {
      setErro('QR Code da carteira. Peça ao atleta para abrir "Minhas Inscrições" e apresentar o Passaporte deste evento específico.');
      return;
    }

    // SE CHEGOU AQUI, TENTARAM BURLAR OU LERAM OUTRA COISA
    setErro('QR Code inválido ou falsificado. Acesso negado.');
  };

  const obterFimInscricoes = (evento: any) => {
    const valor = evento?.data_fim_inscricoes || evento?.lote3_data_fim || evento?.lote2_data_fim || evento?.lote1_data_fim;
    if (!valor) return null;
    return dataOperacionalEvento(valor, true, evento.estado);
  };

  const formatarDataHora = (data: Date) => {
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', ' às');
  };

  // =========================================================================
  // BUSCA NO BANCO DE DADOS (100% amarrada aos UUIDs Evento + Usuario)
  // =========================================================================
  const fetchAtleta = async (eventoId: string, userId: string, inscricaoId?: number) => {
    if (!controlePronto) { setErro('Controle de recepção indisponível. Atualize a lista antes de conferir.'); return; }
    if (!eventoStaff || eventoId !== eventoStaff) { setErro('Este atleta pertence a outro campeonato. Use somente o evento do seu posto.'); return; }
    setLoading(true);
    setErro('');
    setAtleta(null);

    const { data: eventoData, error: eventoError } = await supabase
      .from('eventos')
      .select('id, nome, status, estado, data_fim_inscricoes, lote1_data_fim, lote2_data_fim, lote3_data_fim')
      .eq('id', eventoId)
      .single();

    if (eventoError || !eventoData) {
      setErro('Evento não encontrado. Confira se este passaporte pertence ao evento correto.');
      setLoading(false);
      return;
    }

    const fimInscricoes = obterFimInscricoes(eventoData);
    if (!fimInscricoes) {
      setErro('Check-in bloqueado: o organizador ainda não definiu o encerramento das inscrições deste evento.');
      setLoading(false);
      return;
    }

    if (new Date() < fimInscricoes) {
      setErro(`Check-in bloqueado: as inscrições ainda estão abertas até ${formatarDataHora(fimInscricoes)}. Gere/valide o check-in somente após o fechamento.`);
      setLoading(false);
      return;
    }

    // Busca exata cruzando o Evento e o Usuario
    let consulta = supabase
      .from('inscricoes')
      .select('*')
      .eq('evento_id', eventoId)
      .eq('user_id', userId).or(FILTRO_INSCRICOES_ATIVAS);
    if (inscricaoId != null) consulta = consulta.eq('id', inscricaoId);
    const { data: inscricoesData, error: inscricaoError } = await consulta;

    if (inscricaoError || !inscricoesData || inscricoesData.length === 0) {
      setErro('Inscrição não encontrada ou não autorizada para este evento.');
      setLoading(false);
      return;
    }

    if (inscricaoId == null && inscricoesData.length > 1) {
      setOpcoesQr(inscricoesData); setLoading(false); return;
    }
    setOpcoesQr([]);
    const pendentes = inscricoesData.filter((inscricao: any) => inscricao.pagamento_ok !== true);
    if (pendentes.length > 0) {
      setErro('Check-in bloqueado: existe pagamento pendente para este atleta. Somente pagamento aprovado, evento gratuito ou cupom de isenção total liberam a pesagem.');
      setLoading(false);
      return;
    }

    // Pega o primeiro registro (cobre casos de Peso e Absoluto juntos)
    const inscricaoData = inscricoesData[0];
    if (categoriasFechadas.includes(inscricaoData.categoria_id)) { setErro('Check-in desta categoria fechado. Procure o organizador.'); setLoading(false); return; }
    if (controleRecepcao[inscricaoData.id]?.ausente) { setErro('Retire a ausência antes de conferir este atleta.'); setLoading(false); return; }

    const { data: categoriaPesagem, error: limiteError } = await supabase.from('categorias_evento')
      .select('nome,tipo,peso_min,peso_max').eq('id', inscricaoData.categoria_id).eq('evento_id', eventoId).maybeSingle();
    if (limiteError || !categoriaPesagem) { setErro('Não foi possível carregar o limite da categoria. Atualize a leitura antes de pesar.'); setLoading(false); return; }
    const limiteMaximo = categoriaPesagem.peso_max != null ? Number(categoriaPesagem.peso_max) : null;
    const pesoMinimo = Number(categoriaPesagem.peso_min || 0);
    const limiteCategoria = categoriaPesagem.tipo === 'absoluto' ? 'Sem limite de peso'
      : limiteMaximo != null && Number.isFinite(limiteMaximo) ? `Limite da categoria: até ${limiteMaximo.toLocaleString('pt-BR')} kg`
      : limiteMaximo === null ? pesoMinimo > 0 ? `Acima de ${pesoMinimo.toLocaleString('pt-BR')} kg · sem limite máximo` : 'Sem limite máximo de peso'
      : 'Limite da categoria indisponível';

    let fotoUrl = null;
    if (inscricaoData.user_id) {
      const { data: atletaData } = await supabase
        .from('atletas_publico')
        .select('foto_url')
        .eq('id', inscricaoData.atleta_id)
        .single();
        
      if (atletaData && atletaData.foto_url) {
        fotoUrl = atletaData.foto_url;
      }
    }

    setAtleta({ ...inscricaoData, limite_categoria: limiteCategoria, foto_url: fotoUrl, evento_nome: eventoData.nome, inscricoes_liberadas: inscricoesData.length });
    try {
      const r=lerRascunho<any>(localStorage,contextoOperacao(),'pesagem',String(inscricaoData.id));
      const recuperar=r&&!r.confirmada&&r.statusAnterior===(inscricaoData.status_checkin||'pendente');
      setPesoAferido(recuperar?r.peso:(inscricaoData.peso||''));
      setKimonoAprovado(recuperar?Boolean(r.kimono):false);
      setDocumentoConferido(false);
      if(recuperar)setAvisoRecepcao('Pesagem digitada recuperada deste aparelho. Confira novamente o documento e os dados antes de confirmar.');
    }catch(e){setErro((e as Error).message);}
    setLoading(false);
  };
  // =========================================================================
  // SALVAR CHECK-IN (Com Blindagem de UUID)
  // =========================================================================
  const processarCheckin = async (status: 'aprovado' | 'desclassificado_peso' | 'desclassificado_kimono') => {
    if (loading || !controlePronto) return;
    if (scannedId === 'MANUAL' && !documentoConferido) { setErro('Confira o documento e confirme a identidade do atleta antes de registrar.'); return; }
    if (status === 'aprovado' && !kimonoAprovado) { setErro('Confirme Kimono / Faixa antes de aprovar o atleta.'); return; }
    setLoading(true);
    const statusFinal = status;
    const peso = Number(String(pesoAferido).replace(',', '.'));
    if (!Number.isFinite(peso) || peso <= 0 || peso > 500) {
      setErro('Informe o peso aferido em kg, entre 0 e 500.');
      setLoading(false);
      return;
    }

    // Renova o vínculo antes de gravar: o banco só aceita a pesagem de quem está no posto do evento.
    const vinculo = await garantirVinculoStaff();
    if (!vinculo.ok) {
      setErro(vinculo.erro || 'Posto sem autorização para gravar a pesagem.');
      setLoading(false);
      return;
    }

    if (statusFinal === 'aprovado' && atleta.categoria_id) {
      const { data: categoria, error: categoriaError } = await supabase
        .from('categorias_evento')
        .select('nome,peso_min,peso_max,tipo')
        .eq('id', atleta.categoria_id)
        .maybeSingle();
      if (categoriaError || !categoria) {
        setErro('Não foi possível validar o limite da categoria. Confira a categoria antes de aprovar.');
        setLoading(false);
        return;
      }
      if (categoria.tipo === 'peso' && (peso <= Number(categoria.peso_min) || (categoria.peso_max != null && peso > Number(categoria.peso_max)))) {
        setErro(`Peso fora da categoria ${categoria.nome}. Confira a balança e marque a decisão correta.`);
        setLoading(false);
        return;
      }
    }
    
    // Atualização segura: Atualiza usando o cruzamento absoluto (Evento + User_ID)
    try {
      await executarOperacao('checkin',atleta.id,{peso,kimono:kimonoAprovado,status:statusFinal,estado_anterior:atleta.status_checkin||'pendente'});
      guardarRascunho(localStorage,contextoOperacao(),'pesagem',String(atleta.id),{confirmada:true});
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível confirmar a pesagem. A ação permanece protegida neste aparelho.');
      setLoading(false);
      return;
    }


    void canalOperacaoRef.current?.send({
      type: 'broadcast',
      event: 'checkin_atualizado',
      payload: { evento_id: atleta.evento_id, atleta_id: atleta.atleta_id, status: statusFinal },
    });
    window.dispatchEvent(new CustomEvent('itatame:recepcao-atualizada', { detail: { eventoId: atleta.evento_id } }));

    if(statusFinal === 'aprovado') {
        const { data: lutasEvento } = await supabase
          .from('chaves')
          .select('id, categoria, faixa, tatame, atleta_1, atleta_2, atleta_1_id, atleta_2_id, status_luta, ordem_tatame, ordem, horario_estimado')
          .eq('evento_id', atleta.evento_id)
          .neq('status_luta', 'concluida')
          .order('ordem_tatame', { ascending: true })
          .order('ordem', { ascending: true });

        const fila = (lutasEvento || []).filter((luta) => luta.atleta_1_id && luta.atleta_2_id);
        const minhaLuta = fila.find((luta) => Number(luta.atleta_1_id) === Number(atleta.atleta_id) || Number(luta.atleta_2_id) === Number(atleta.atleta_id));
        let mensagemPush = `${atleta.atleta}, seu check-in foi aprovado. Acompanhe o painel ao vivo para saber a hora da chamada.`;
        if (minhaLuta) {
          const indice = fila.filter((luta) => String(luta.tatame || '') === String(minhaLuta.tatame || '')).findIndex((luta) => luta.id === minhaLuta.id);
          const lutasNaFrente = Math.max(0, indice);
          const minutosFila = Math.max(5, lutasNaFrente * (obterTempoRegulamentar(minhaLuta.categoria || '', minhaLuta.faixa || '') + 2));
          const horario = minhaLuta.horario_estimado ? new Date(minhaLuta.horario_estimado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
          mensagemPush = `${atleta.atleta}, check-in aprovado. Há ${lutasNaFrente} luta(s) antes da sua no ${minhaLuta.tatame || 'tatame'}. Previsão dinâmica: cerca de ${minutosFila} min${horario ? ` (cronograma ${horario})` : ''}.`;
        }
        notificarSemBloquear({ atleta_id: atleta.atleta_id, titulo: 'Check-in aprovado', mensagem: mensagemPush, url: '/evento/'+atleta.evento_id+'/ao-vivo' });
        alert(`Atleta ${atleta.atleta} aprovado no check-in.`);
    } else {
        alert(`Atleta ${atleta.atleta} desclassificado no check-in.`);
    }

    resetarTela();
  };

  const resetarTela = () => {
    setScannedId(null);
    setAtleta(null);
    setOpcoesQr([]);
    setPesoAferido('');
    setKimonoAprovado(false);
    setErro('');
    setLoading(false);
    setDocumentoConferido(false);
    if (eventoStaff) void carregarLista(eventoStaff);
  };

  const getCorFaixa = (nomeFaixa: string) => {
    if (!nomeFaixa) return "bg-zinc-800 text-zinc-400 border-zinc-700";
    const f = nomeFaixa.toLowerCase();
    if (f.includes("branca")) return "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]";
    if (f.includes("azul")) return "bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]";
    if (f.includes("roxa")) return "bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.4)]";
    if (f.includes("marrom")) return "bg-amber-800 text-white border-amber-700 shadow-[0_0_15px_rgba(146,64,14,0.4)]";
    if (f.includes("preta")) return "bg-black text-white border-zinc-700 shadow-[0_0_15px_rgba(255,255,255,0.1)]";
    return "bg-zinc-800 text-zinc-300 border-zinc-700";
  };

  return (
    <main ref={topoRecepcaoRef} className="relative min-h-full bg-[#050505] text-white overflow-y-auto overflow-x-hidden font-sans pb-10 selection:bg-red-500/30 flex flex-col">
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-global-nav > header:first-of-type,
        .hide-global-nav nav:first-of-type { display: none !important; }
        @keyframes scan { 0%, 100% { top: 5%; } 50% { top: 95%; } }
        .animate-scan { animation: scan 3s ease-in-out infinite; }
      `}} />

      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-red-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <header className="hidden relative z-10 border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {atleta && (
              <button onClick={resetarTela} className="text-zinc-400 hover:text-white bg-white/5 p-2 rounded-full transition-colors active:scale-95 shrink-0">
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="flex items-center gap-1.5 pt-1">
              <img src="/logo.svg" alt="iTatame" className="h-6 md:h-7 w-auto object-contain" />
              <span className="text-red-600 text-lg md:text-xl font-black tracking-tight mt-0.5">.STAFF</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg shadow-[0_0_20px_rgba(220,38,38,0.4)] shrink-0">
            <CheckCircle size={14} className="text-white" />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">CHECK-IN</span>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-md mx-auto p-3 sm:p-4 flex flex-col gap-3 relative z-10 mt-2">
        {atleta && <button onClick={resetarTela} className="flex min-h-11 items-center gap-2 self-start rounded-lg bg-white/5 px-3 text-sm"><ArrowLeft size={16} /> Voltar à lista</button>}
        {!atleta && recepcaoFinalizada && <div ref={conclusaoRef} role="status" className="scroll-mt-24 rounded-xl border border-emerald-400/40 bg-emerald-950/50 p-4 text-emerald-100">
          <span className="mb-2 inline-flex text-emerald-400"><CheckCircle size={24} aria-hidden="true" /></span>
          <h2 className="text-base font-bold">Todas as categorias finalizadas!</h2>
          <p className="mt-1 text-sm">Check-in e pesagem encerrados. Todas as categorias foram despachadas para os tatames.</p>
        </div>}
        {avisoRecepcao && <div role="status" className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 p-3 text-xs text-cyan-100">{avisoRecepcao}</div>}
        {(erro || erroLista) && <div ref={avisoRef} role="alert" tabIndex={-1} className="scroll-mt-24 rounded-xl border border-red-500/40 bg-red-950/70 p-3 text-sm text-red-200 outline-none">{erro || erroLista}</div>}
        {avancoPendente && <div ref={avisoRef} role="alert" tabIndex={-1} className="scroll-mt-24 rounded-xl border border-amber-400/50 bg-amber-950/50 p-3 text-sm text-amber-100 outline-none">
          <p>A categoria foi despachada, mas a atualização dos avanços da chave está pendente. Não é necessário fechar novamente.</p>
          <button disabled={Boolean(acaoRecepcao)} onClick={() => void atualizarAvancos()} className="mt-3 min-h-11 rounded-lg border border-amber-300/50 bg-amber-400/15 px-3 font-bold disabled:opacity-40">{acaoRecepcao === 'atualizar-avancos' ? 'Atualizando...' : 'Tentar atualizar avanços'}</button>
        </div>}
        
        {opcoesQr.length > 0 && <section className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3"><h2 className="text-sm font-bold">Quem vai fazer o check-in?</h2><p className="mt-1 text-xs text-zinc-400">Este passaporte possui mais de uma inscrição. Selecione o atleta e a categoria.</p><div className="mt-3 space-y-2">{opcoesQr.map(i => <button key={i.id} disabled={!i.pagamento_ok} onClick={() => void fetchAtleta(eventoStaff,i.user_id,i.id)} className="min-h-12 w-full rounded-lg border border-white/10 p-3 text-left text-xs disabled:opacity-40"><strong className="block">{i.atleta}</strong>{i.categoria} · #{i.id}{!i.pagamento_ok && ' · Pagamento pendente'}</button>)}</div></section>}
        {!atleta && <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0a0a0e] p-3">
          <div className="grid grid-cols-2 gap-2"><button onClick={() => setModoEntrada('lista')} className={`min-h-12 rounded-xl text-sm font-bold ${modoEntrada === 'lista' ? 'bg-red-600' : 'bg-white/5'}`}>Atletas por categoria</button><button onClick={() => setModoEntrada('qr')} className={`min-h-12 rounded-xl text-sm font-bold ${modoEntrada === 'qr' ? 'bg-red-600' : 'bg-white/5'}`}>Ler QR</button></div>
          {modoEntrada === 'lista' && <>
            <p className="text-xs text-zinc-400">Chame a categoria para o aquecimento. Sem celular? Encontre o atleta, confira o documento e faça a mesma pesagem do QR.</p>
            <ProgramacaoLutas eventoId={eventoStaff} categoriaId={categoriaSelecionadaId} ativa={ativa} />
            <input aria-label="Buscar atleta ou número de inscrição" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome ou nº da inscrição" className="min-h-12 w-full rounded-xl border border-white/15 bg-black px-3 text-sm" />
            <select aria-label="Categoria do check-in" value={categoriaLista} onChange={e => setCategoriaLista(e.target.value)} className="min-h-12 w-full rounded-xl border border-white/15 bg-black px-3 text-sm"><option value="">Todas as categorias</option>{categoriasRecepcaoOrdenadas(lista, planejamento).map(c => <option key={c.nome} value={c.nome}>{c.tatame ? `${c.tatame} · ` : 'Sem distribuição · '}{c.nome}</option>)}</select>
            {categoriaSelecionadaId && <section className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3"><div className="grid grid-cols-3 gap-2 text-center text-xs"><div><strong className="block text-lg text-green-300">{aprovadosRecepcao}</strong>Aprovados</div><div><strong className="block text-lg text-yellow-300">{pendentesRecepcao}</strong>Pendentes</div><div><strong className="block text-lg text-red-300">{ausentesRecepcao}</strong>Ausentes</div></div><button disabled={!controlePronto || !categoriaTatamePronto || categoriaFechada || pendentesRecepcao > 0 || Boolean(acaoRecepcao)} onClick={() => void operarRecepcao('fechar')} className="mt-3 min-h-12 w-full rounded-xl bg-cyan-400 px-2 text-sm font-bold text-black disabled:opacity-40">{categoriaFechada ? 'Categoria despachada para os tatames' : 'Fechar check-in e despachar'}</button><p className="mt-2 text-xs text-zinc-400">{!categoriaTatamePronto ? AVISO_TATAMES : categoriaFechada ? 'Os aprovados estão liberados em Chamada / Tatames.' : pendentesRecepcao > 0 ? 'Resolva os pendentes: confira quem chegou ou confirme ausência após três chamadas.' : 'Confira o resumo antes de liberar a categoria. Reprovados e ausentes não entram na fila do tatame.'}</p></section>}
            <div role="group" aria-label="Situação do check-in" className="grid grid-cols-2 gap-1 sm:grid-cols-4">{(['pendentes','aprovados','todos','desclassificados'] as const).map(status => <button key={status} aria-pressed={situacaoLista === status} onClick={() => setSituacaoLista(status)} className={`min-h-11 rounded-lg px-1 text-xs font-bold ${situacaoLista === status ? 'bg-white text-black' : 'bg-white/5 text-zinc-300'}`}>{status === 'pendentes' ? 'Pendentes' : status === 'aprovados' ? 'Aprovados' : status === 'desclassificados' ? 'Desclassificados' : 'Todos'}</button>)}</div>
            {visiveis.length === 0 && <p role="status" className="rounded-lg bg-white/5 p-3 text-xs text-zinc-400">{situacaoLista === 'pendentes' ? 'Nenhum check-in pendente nesta seleção. Consulte os outros filtros.' : situacaoLista === 'desclassificados' ? 'Nenhum atleta desclassificado nesta seleção.' : 'Nenhuma inscrição nesta seleção.'}</p>}
            <div className="flex justify-between gap-2 text-xs text-zinc-400"><span>{visiveis.length} inscrições nesta seleção</span><button onClick={() => void carregarLista(eventoStaff)} className="min-h-10 px-2 font-bold text-cyan-300">Atualizar lista</button></div>
            <div className="space-y-2">{visiveis.map(i => {
              const controle = controleRecepcao[i.id] || { chamadas: 0, ausente: false };
              const fechado = Boolean(i.categoria_id && categoriasFechadas.includes(i.categoria_id));
              const pendente = !i.status_checkin || i.status_checkin === 'pendente';
              return <article key={i.id} className="rounded-xl border border-white/10 bg-black/40 p-3">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block text-sm">{i.atleta}</strong><span className="text-xs text-zinc-400">Inscrição #{i.id} · {i.equipe}</span></div><span className={`shrink-0 text-xs ${i.pagamento_ok ? 'text-green-300' : 'text-amber-300'}`}>{i.pagamento_ok ? 'Confirmado' : 'Pagamento pendente'}</span></div>
                <p className="mt-2 text-xs text-zinc-400">{i.categoria}{i.tatames?.length ? ` · ${i.tatames.join(' / ')}` : ''}</p>
                <p className="mt-2 text-xs">{controle.ausente ? 'Ausência confirmada na recepção' : i.status_checkin === 'aprovado' ? 'Check-in aprovado' : i.status_checkin?.startsWith('desclassificado') ? 'Reprovado no check-in' : 'Aguardando check-in'}{fechado ? ' · Categoria despachada' : ''}</p>
                {!fechado && controle.ausente ? <button disabled={Boolean(acaoRecepcao)} onClick={() => void operarRecepcao('retirar_ausencia',i)} className="mt-3 min-h-11 w-full rounded-lg border border-white/10 text-xs text-cyan-300">Atleta chegou · retirar ausência</button> : <>
                <button disabled={fechado || !controlePronto || !i.pagamento_ok || loading || !i.user_id || Boolean(acaoRecepcao)} onClick={() => { setScannedId('MANUAL'); setDocumentoConferido(false); void fetchAtleta(eventoStaff,i.user_id,i.id); }} className="mt-3 min-h-12 w-full rounded-xl bg-red-600 px-3 text-sm font-bold disabled:opacity-40">{fechado ? 'Check-in fechado' : i.status_checkin === 'aprovado' ? 'Conferir check-in' : 'Conferir documento e pesar'}</button>
                {!fechado && pendente && i.pagamento_ok && <div className="mt-2 grid grid-cols-2 gap-2"><button disabled={!controlePronto || controle.chamadas >= 3 || Boolean(acaoRecepcao)} onClick={() => void operarRecepcao('chamar',i)} className="min-h-11 rounded-lg border border-yellow-500/30 text-xs text-yellow-200 disabled:opacity-40">{controle.chamadas >= 3 ? '3 chamadas feitas' : `${controle.chamadas + 1}ª chamada`}</button><button disabled={!controlePronto || controle.chamadas < 3 || Boolean(acaoRecepcao)} onClick={() => void operarRecepcao('ausente',i)} className="min-h-11 rounded-lg border border-red-500/30 text-xs text-red-200 disabled:opacity-30">Confirmar ausência</button></div>}
                </>}
              </article>;
            })}</div>
          </>}
        </section>}
        {!atleta && modoEntrada === 'qr' && ativa && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
            <div className="bg-[#0a0a0e]/80 backdrop-blur-sm border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col items-center">
              <h2 className="text-xs text-zinc-400 font-bold uppercase tracking-widest mb-4 flex items-center justify-center gap-2">
                <QrCode size={16} className="text-red-500" /> Escaneie a Credencial
              </h2>
              <div className="w-full rounded-2xl overflow-hidden relative bg-black aspect-square flex items-center justify-center border-2 border-white/5 shadow-inner">
                <div className="absolute inset-0 border-2 border-red-600/30 rounded-2xl z-10 pointer-events-none"></div>
                <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_20px_rgba(239,68,68,1)] animate-scan z-10 pointer-events-none"></div>
                
                {/* LEITOR DA CÂMERA */}
                <Scanner onScan={handleScan} />
                
              </div>

              {loading && (
                <div className="mt-5 flex items-center gap-3 text-red-500 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">Autenticando...</span>
                </div>
              )}

            </div>
          </div>
        )}

        {atleta && !loading && (
          <div className="animate-in slide-in-from-right-8 duration-300 flex flex-col gap-3">
            {scannedId === 'MANUAL' && <label className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100"><input type="checkbox" checked={documentoConferido} onChange={e => setDocumentoConferido(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-amber-500" />Conferi o documento e confirmo que esta pessoa é o atleta selecionado.</label>}
            <div className="bg-[#0a0a0e] border border-white/10 rounded-2xl overflow-hidden p-3 sm:p-5 relative">
              <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 rounded-full border-2 border-[#161622] bg-zinc-900 flex items-center justify-center text-xl font-black text-zinc-600 overflow-hidden">
                {atleta.foto_url ? (
                  <img src={atleta.foto_url} alt="Foto do atleta" className="w-full h-full object-cover" />
                ) : (
                  atleta.atleta.charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1">
              
              <h2 className="break-words text-lg font-black text-white uppercase tracking-tight leading-tight mb-2">
                {atleta.atleta}
              </h2>
              
              <div className={`inline-block px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${getCorFaixa(atleta.faixa)}`}>
                Faixa {atleta.faixa}
              </div>
              </div>
              </div>

              <div className="mt-3 w-full grid grid-cols-2 gap-2 text-center border-t border-white/10 pt-2">
                <div className="flex flex-col items-center justify-center">
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5">Equipe</span>
                  <span className="block text-sm font-bold text-zinc-200 truncate w-full px-1">{atleta.equipe || "-"}</span>
                </div>
                <div className="flex flex-col items-center justify-center border-l border-white/10 pl-2">
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5">Categoria</span>
                  <span className="block text-xs font-bold text-zinc-200 w-full px-1 leading-tight">{atleta.categoria}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0a0a0e] border border-white/10 rounded-2xl p-3 sm:p-5 flex flex-col gap-3">
              <div className="relative">
                <label className="text-[11px] font-bold text-zinc-400 flex items-center justify-center gap-2 mb-2 uppercase tracking-widest w-full">
                  <Scale size={16} className="text-red-500" /> Peso na Balança (kg)
                </label>
                <div className="relative flex items-center justify-center">
                  <input 
                    type="number" 
                    step="0.1"
                    value={pesoAferido}
                    onChange={(e) => setPesoAferido(e.target.value)}
                    className="min-h-14 w-full bg-black/60 border border-white/10 p-2.5 rounded-xl text-3xl font-black text-center text-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all tracking-tighter [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0.0"
                  />
                  <span className="absolute right-6 text-zinc-600 font-bold uppercase text-sm pointer-events-none">KG</span>
                </div>
                <div className="flex justify-center mt-3">
                  <span className="bg-white/5 border border-white/10 text-zinc-300 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    {atleta.limite_categoria}
                  </span>
                </div>
              </div>

              <hr className="border-white/5" />

              <label className={`flex min-h-14 items-center justify-between gap-2 p-3 rounded-xl border transition-colors cursor-pointer group ${kimonoAprovado ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/40 bg-red-950/20'}`}>
                <span className="font-bold text-zinc-200 text-sm uppercase tracking-wider flex flex-col group-hover:text-white transition-colors">
                  Kimono / Faixa
                  <span className={`text-[10px] font-bold mt-1 tracking-widest normal-case ${kimonoAprovado ? 'text-green-500/80' : 'text-red-400'}`}>
                    {kimonoAprovado ? 'Dentro dos padrões' : 'Confirmação obrigatória para aprovar'}
                  </span>
                </span>
                <input 
                  type="checkbox" 
                  checked={kimonoAprovado}
                  onChange={(e) => setKimonoAprovado(e.target.checked)}
                  className="w-7 h-7 rounded-lg bg-black/50 border-white/20 text-red-600 focus:ring-red-600 focus:ring-offset-0 cursor-pointer"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <button 
                onClick={() => processarCheckin('aprovado')}
                disabled={loading || !kimonoAprovado || (scannedId === 'MANUAL' && !documentoConferido)}
                className="min-h-12 w-full bg-green-600 hover:bg-green-500 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 text-sm uppercase tracking-wide active:scale-[0.98] transition-all border border-green-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle size={22} /> Aprovar Atleta
              </button>
              {(!kimonoAprovado || (scannedId === 'MANUAL' && !documentoConferido)) && <p className="text-xs text-amber-200">Para aprovar, confirme Kimono / Faixa{scannedId === 'MANUAL' ? ' e a conferência do documento' : ''}.</p>}

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => processarCheckin('desclassificado_peso')}
                  className="w-full bg-[#0a0a0e] text-red-500 font-bold min-h-12 py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-widest border border-red-900/50 hover:bg-red-950/30 hover:border-red-500/50 active:scale-[0.98] transition-all"
                >
                  <XCircle size={20} className="text-red-500" />
                  Falhou no Peso
                </button>
                <button 
                  onClick={() => processarCheckin('desclassificado_kimono')}
                  className="w-full bg-[#0a0a0e] text-red-500 font-bold min-h-12 py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-widest border border-red-900/50 hover:bg-red-950/30 hover:border-red-500/50 active:scale-[0.98] transition-all"
                >
                  <XCircle size={20} className="text-red-500" />
                  Kimono Ilegal
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
