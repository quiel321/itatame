"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "../lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { absolutoDaInscricao, categoriaCompativel, idadeCompetitiva, rotuloCategoria, type CategoriaCompeticao } from '@/app/lib/categorias-competicao';
import { tarifaInfantilAplicavel, valorAbsolutoAvulso, valorAddonAbsoluto, valorLoteVigente, pacoteInscricao, pacoteDoTipoInscricao, podeAmpliarPacote, pacoteAposAmpliar, rotuloPacoteInscricao, calcularValorInscricao, valorAindaDevido, type EventoValoresInscricao } from '@/app/lib/valor-inscricao';
import { urlLoginComRetorno } from '@/app/lib/destino-interno';

type PerfilCompetidor = {
  id: number;
  user_id: string;
  nome: string;
  equipe?: string | null;
  professor?: string | null;
  faixa?: string | null;
  peso?: string | number | null;
  sexo?: string | null;
  modalidade?: string | null;
  foto_url?: string | null;
  cpf?: string | null;
  nascimento?: string | null;
};

function FormularioInscricao() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventoId = searchParams.get("evento");

  const [categoriasEvento, setCategoriasEvento] = useState<CategoriaCompeticao[]>([]);
  const [categoriaId, setCategoriaId] = useState('');
  const [equipesEvento, setEquipesEvento] = useState<{ id: string; nome: string; academia: string; professor: string }[]>([]);
  const [equipeId, setEquipeId] = useState('');
  const [tabelaCarregando, setTabelaCarregando] = useState(true);
  const [tabelaErro, setTabelaErro] = useState('');
  const [eventoNome, setEventoNome] = useState("");
  const [eventoValores, setEventoValores] = useState<EventoValoresInscricao | null>(null);
  const [nomeLoteAtual, setNomeLoteAtual] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Estados do Atleta
  const [userId, setUserId] = useState<string>(""); // Guardar para a tela final
  const [atletaId, setAtletaId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [equipe, setEquipe] = useState("");
  const [professor, setProfessor] = useState("");
  const [faixa, setFaixa] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [pesoReal, setPesoReal] = useState("");
  const [sexo, setSexo] = useState("Masculino");
  const [fotoUrl, setFotoUrl] = useState("");
  const [cpfAtleta, setCpfAtleta] = useState("");
  const [emailAtleta, setEmailAtleta] = useState("");
  const [nascimentoAtleta, setNascimentoAtleta] = useState("");
  const [competidorUserId, setCompetidorUserId] = useState("");
  const [familia, setFamilia] = useState<PerfilCompetidor[]>([]);
  const [dataEvento, setDataEvento] = useState("");
  const [inscricoesEncerradas, setInscricoesEncerradas] = useState(false);
  const [motivoInscricaoIndisponivel, setMotivoInscricaoIndisponivel] = useState("");
  const [limiteVagas, setLimiteVagas] = useState(0);
  // Estados do Formulário
  const [categoria, setCategoria] = useState("");
  const [idade, setIdade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [tipoInscricao, setTipoInscricao] = useState("peso");
  const [termoAceito, setTermoAceito] = useState(false);
  const [inscricaoAtual, setInscricaoAtual] = useState<{
    id: string | number;
    absoluto?: boolean | null;
    categoria?: string | null;
    categoria_id?: string | null;
    pagamento_ok?: boolean | null;
    valor_inscricao?: number | string | null;
    valor_total?: number | string | null;
    cupom_id?: string | null;
  } | null>(null);

  // Estados do Cupom
  const [cupom, setCupom] = useState("");
  const [desconto, setDesconto] = useState(0);
  const [cupomMensagem, setCupomMensagem] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState("");

  const [inscricaoFeita, setInscricaoFeita] = useState(false);
  const [erro, setErro] = useState("");
  const [camposInvalidos, setCamposInvalidos] = useState<string[]>([]);
  const [processando, setProcessando] = useState(false);

  const perfilIncompleto = !nome || !equipe || !faixa || !atletaId;
  const idadePeloCadastro = Number.isInteger(idadeCompetitiva(nascimentoAtleta, dataEvento));

  function aplicarCompetidor(
    pessoa: PerfilCompetidor,
    equipesOficiais: { id: string; nome: string }[] = equipesEvento,
    dataRef = dataEvento,
  ) {
    setCompetidorUserId(pessoa.user_id);
    setAtletaId(pessoa.id);
    setNome(pessoa.nome || "");
    setProfessor(pessoa.professor || "");
    setFaixa(pessoa.faixa || "");
    setPesoReal(pessoa.peso ? String(pessoa.peso) : "");
    setSexo(pessoa.sexo || "Masculino");
    setCategoria("");
    setCategoriaId('');
    setModalidade(pessoa.modalidade || "");
    setFotoUrl(pessoa.foto_url || "");
    setCpfAtleta(pessoa.cpf || "");
    setNascimentoAtleta(pessoa.nascimento || "");
    const idadeCalc = idadeCompetitiva(pessoa.nascimento, dataRef);
    setIdade(Number.isInteger(idadeCalc) ? String(idadeCalc) : "");
    setCupom("");
    setDesconto(0);
    setCupomAplicado("");
    setCupomMensagem("");
    const equipeNome = String(pessoa.equipe || "").trim();
    const oficial = equipesOficiais.find(eq => eq.nome.trim().toLocaleLowerCase('pt-BR') === equipeNome.toLocaleLowerCase('pt-BR'));
    if (oficial) {
      setEquipeId(oficial.id);
      setEquipe(oficial.nome);
    } else if (equipesOficiais.length === 1) {
      setEquipeId(equipesOficiais[0].id);
      setEquipe(equipesOficiais[0].nome);
    } else {
      setEquipe(equipeNome);
      if (equipesOficiais.length > 1) setEquipeId('');
    }
  }

  useEffect(() => {
    async function carregarAmbiente() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push(urlLoginComRetorno(`/inscricao?evento=${eventoId}`));
        return;
      }

      setUserId(authData.user.id);
      setEmailAtleta(authData.user.email || "");

      let equipesCarregadas: { id: string; nome: string; academia: string; professor: string }[] = [];
      let dataEventoAtual = "";
      if (eventoId) {
        const { data: ev } = await supabase.from("eventos").select("*").eq("id", eventoId).single();
        if (ev) {
          setEventoNome(ev.nome);
          dataEventoAtual = String(ev.data_evento || "").slice(0, 10);
          setDataEvento(dataEventoAtual);
          const [cats, eqs] = await Promise.all([
            supabase.from('categorias_evento').select('*').eq('evento_id', eventoId).eq('ativa', true),
            supabase.from('equipes_evento').select('id,nome,academia,professor').eq('evento_id', eventoId).eq('ativa', true).order('nome'),
          ]);
          if (cats.error && !['PGRST205','42P01'].includes(cats.error.code)) setTabelaErro('Não foi possível carregar as categorias. Recarregue a página antes de se inscrever.');
          equipesCarregadas = eqs.data || [];
          setCategoriasEvento(cats.data || []); setEquipesEvento(equipesCarregadas);setTabelaCarregando(false);
          const dataFimInscricoes = ev.data_fim_inscricoes || ev.lote3_data_fim || ev.lote2_data_fim || ev.lote1_data_fim;
          const agoraInscricao = new Date();
          const inicioInscricoes = ev.data_inicio_inscricoes ? new Date(ev.data_inicio_inscricoes) : null;
          const statusAberto = String(ev.status || "").trim().toUpperCase() === "ABERTO";
          const limite = Math.max(1, Number(ev.limite_vagas) || 500);
          setLimiteVagas(limite);
          const { count: ocupadas } = await supabase.from("inscricoes").select("id", { count: "exact", head: true }).eq("evento_id", eventoId);
          if (!statusAberto) {
            setInscricoesEncerradas(true);
            setMotivoInscricaoIndisponivel("Este evento ainda não está com as inscrições abertas.");
          } else if (inicioInscricoes && agoraInscricao < inicioInscricoes) {
            setInscricoesEncerradas(true);
            setMotivoInscricaoIndisponivel(`As inscrições começam em ${inicioInscricoes.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.`);
          } else if (dataFimInscricoes && agoraInscricao > new Date(dataFimInscricoes)) {
            setInscricoesEncerradas(true);
            setMotivoInscricaoIndisponivel("O período de inscrições deste evento terminou.");
          } else if ((ocupadas || 0) >= limite) {
            setInscricoesEncerradas(true);
            setMotivoInscricaoIndisponivel(`As vagas deste campeonato esgotaram (${ocupadas}/${limite}). Novas inscrições ficam bloqueadas até o organizador ampliar o limite.`);
          } else {
            setInscricoesEncerradas(false);
            setMotivoInscricaoIndisponivel("");
          }

          const agora = new Date();
          let nomeLote = "Lote Final";
          if (ev.lote1_data_fim && agora <= new Date(ev.lote1_data_fim)) nomeLote = "1º Lote";
          else if (ev.lote2_data_fim && agora <= new Date(ev.lote2_data_fim)) nomeLote = "2º Lote";
          else if (ev.lote3_data_fim && agora <= new Date(ev.lote3_data_fim)) nomeLote = "3º Lote";

          setEventoValores(ev);
          setNomeLoteAtual(nomeLote);
        }
      }

      const { data: atleta, error } = await supabase.from("atletas").select("*").eq("user_id", authData.user.id).single();
      const { data: depsData } = await supabase.from("atletas").select("id,user_id,nome,equipe,professor,faixa,peso,sexo,modalidade,foto_url,cpf,nascimento").eq("responsavel_id", authData.user.id).order("nome");
      const titular = !error && atleta ? atleta as PerfilCompetidor : null;
      const dependentes = (depsData || []) as PerfilCompetidor[];
      const pessoas = [...(titular ? [titular] : []), ...dependentes];
      setFamilia(pessoas);
      if (dependentes[0]) aplicarCompetidor(dependentes[0], equipesCarregadas, dataEventoAtual);
      else if (titular) aplicarCompetidor(titular, equipesCarregadas, dataEventoAtual);

      setLoading(false);
    }
    carregarAmbiente();
  }, [eventoId, router]);

  useEffect(() => {
    let ativo = true;
    async function carregarInscricaoAtual() {
      if (!eventoId || !competidorUserId) {
        if (ativo) setInscricaoAtual(null);
        return;
      }
      const { data } = await supabase
        .from("inscricoes")
        .select("id,absoluto,categoria,categoria_id,pagamento_ok,valor_inscricao,valor_total,cupom_id")
        .eq("evento_id", eventoId)
        .or(`user_id.eq.${competidorUserId},atleta_id.eq.${atletaId || 0}`)
        .limit(1);
      if (ativo) setInscricaoAtual(data?.[0] || null);
    }
    void carregarInscricaoAtual();
    return () => { ativo = false; };
  }, [eventoId, competidorUserId, atletaId]);

  const categoriasElegiveis = categoriasEvento.filter(c => c.tipo === 'peso' && categoriaCompativel(c, { idade, sexo, faixa, peso: pesoReal }));
  const absolutoElegivel = absolutoDaInscricao({ idade, sexo, faixa, modalidade, peso: pesoReal }, categoriasEvento);
  const pesoElegivel = categoriasElegiveis.length > 0;
  useEffect(() => {
    if (categoriaId && !categoriasElegiveis.some(c => c.id === categoriaId)) { setCategoriaId(''); setCategoria(''); }
  }, [idade, sexo, faixa, pesoReal, categoriaId, categoriasEvento]);
  useEffect(() => {
    if (!absolutoElegivel && (tipoInscricao === 'ambos' || tipoInscricao === 'absoluto')) {
      setTipoInscricao('peso');
    } else if (!pesoElegivel && absolutoElegivel && tipoInscricao !== 'absoluto') {
      setTipoInscricao('absoluto');
    }
  }, [absolutoElegivel, pesoElegivel, tipoInscricao]);

  const valorLoteAtual = eventoValores ? valorLoteVigente(eventoValores, new Date(), idade) : 0;
  const valorAbsoluto = eventoValores ? valorAddonAbsoluto(eventoValores, idade) : 0;
  const valorAbsolutoSozinho = eventoValores ? valorAbsolutoAvulso(eventoValores, idade) : 0;
  const usaTarifaInfantil = Boolean(eventoValores && tarifaInfantilAplicavel(eventoValores, idade));
  const valorBase = tipoInscricao === "ambos"
    ? valorLoteAtual + valorAbsoluto
    : tipoInscricao === "absoluto"
      ? valorAbsolutoSozinho
      : valorLoteAtual;
  const valorTotal = Math.max(0, valorBase - desconto);
  const isGratis = valorBase === 0;
  const pacoteJaInscrito = inscricaoAtual ? pacoteInscricao(inscricaoAtual) : null;
  const jaNoCombo = pacoteJaInscrito === "combo";
  const ampliandoPacote = Boolean(pacoteJaInscrito && podeAmpliarPacote(pacoteJaInscrito, pacoteDoTipoInscricao(tipoInscricao)));
  const jaTemCategoriaPeso = Boolean(inscricaoAtual?.categoria_id || (inscricaoAtual?.categoria && String(inscricaoAtual.categoria).trim().toLowerCase() !== "absoluto"));
  const precisaCategoriaPeso = tipoInscricao !== "absoluto" && !jaTemCategoriaPeso;
  const inscricaoBloqueadaPorPeriodo = inscricoesEncerradas && !(inscricaoAtual && motivoInscricaoIndisponivel.includes("vagas deste campeonato esgotaram"));

  function classeCampo(campo: string) {
    return camposInvalidos.includes(campo)
      ? "border-red-500 ring-1 ring-red-500/60"
      : "border-white/10";
  }

  function limparCampoInvalido(campo: string) {
    setCamposInvalidos((atuais) => atuais.filter((item) => item !== campo));
  }

  function apontarCampos(faltando: { campo: string; mensagem: string }[]) {
    setCamposInvalidos(faltando.map((item) => item.campo));
    setErro(faltando.length === 1
      ? faltando[0].mensagem
      : `Não dá para confirmar ainda. ${faltando.map((item) => item.mensagem).join(" ")}`);
    setProcessando(false);
    const primeiro = faltando[0]?.campo;
    window.setTimeout(() => {
      const alvo = document.getElementById(`inscricao-${primeiro}`);
      alvo?.scrollIntoView({ behavior: "smooth", block: "center" });
      const focavel = alvo?.querySelector("select, input:not([disabled]):not([type=hidden]), textarea, a") as HTMLElement | null;
      focavel?.focus({ preventScroll: true });
    }, 50);
  }

  async function aplicarCupom() {
    if (!cupom || !eventoId) return;
    setCupomMensagem("Verificando...");

    const { data: cupomData, error } = await supabase
      .from("cupons")
      .select("*")
      .eq("codigo", cupom.trim().toUpperCase())
      .eq("evento_id", eventoId)
      .maybeSingle();

    if (error || !cupomData) {
      setDesconto(0);
      setCupomAplicado("");
      setCupomMensagem("Cupom inválido para este evento.");
      return;
    }

    if (cupomData.usos_atualmente >= cupomData.limite_usos) {
      setDesconto(0);
      setCupomAplicado("");
      setCupomMensagem("Limite de usos deste cupom esgotado.");
      return;
    }

    if (cupomData.desconto_porcentagem > 0) {
      const calcDesconto = (valorBase * Number(cupomData.desconto_porcentagem)) / 100;
      setDesconto(calcDesconto);
      setCupomMensagem(`Cupom aplicado: -${cupomData.desconto_porcentagem}%`);
    } else if (cupomData.desconto_valor > 0) {
      setDesconto(Number(cupomData.desconto_valor));
      setCupomMensagem(`Cupom aplicado: -R$ ${Number(cupomData.desconto_valor).toFixed(2).replace('.', ',')}`);
    }
    setCupomAplicado(cupom.trim().toUpperCase());
  }

  async function finalizarInscricao() {
    setProcessando(true);
    setErro("");
    setCamposInvalidos([]);

    const faltando: { campo: string; mensagem: string }[] = [];
    if (perfilIncompleto) {
      faltando.push({ campo: "perfil", mensagem: "Complete nome, equipe e faixa deste atleta no perfil." });
    }
    if (!idade || !Number.isInteger(Number(idade)) || Number(idade) < 4 || Number(idade) > 100) {
      faltando.push({ campo: "idade", mensagem: "Informe a idade na data do evento." });
    }
    if (precisaCategoriaPeso && !categoriaId) {
      faltando.push({
        campo: "categoria",
        mensagem: categoriasElegiveis.length
          ? "Selecione a categoria de peso."
          : "Não há categoria de peso compatível. Confira idade, faixa e peso no perfil.",
      });
    }
    if (equipesEvento.length > 0 && !equipeId) {
      faltando.push({ campo: "equipe", mensagem: "Selecione a equipe deste campeonato." });
    }
    if (!termoAceito) {
      faltando.push({ campo: "termos", mensagem: "Marque os termos de aceite." });
    }
    if (faltando.length) {
      apontarCampos(faltando);
      return;
    }

    if (inscricoesEncerradas && !inscricaoAtual) {
      setErro(motivoInscricaoIndisponivel || "As inscrições deste evento não estão disponíveis.");
      setProcessando(false);
      return;
    }

    if (inscricoesEncerradas && inscricaoAtual && !motivoInscricaoIndisponivel.includes("vagas deste campeonato esgotaram")) {
      setErro(motivoInscricaoIndisponivel || "As inscrições deste evento não estão disponíveis.");
      setProcessando(false);
      return;
    }

    if (limiteVagas > 0 && eventoId && !inscricaoAtual) {
      const { count: ocupadas } = await supabase.from("inscricoes").select("id", { count: "exact", head: true }).eq("evento_id", eventoId);
      if ((ocupadas || 0) >= limiteVagas) {
        setInscricoesEncerradas(true);
        setMotivoInscricaoIndisponivel(`As vagas deste campeonato esgotaram (${ocupadas}/${limiteVagas}). Novas inscrições ficam bloqueadas até o organizador ampliar o limite.`);
        setErro(`As vagas deste campeonato esgotaram (${ocupadas}/${limiteVagas}).`);
        setProcessando(false);
        return;
      }
    }

    if (tipoInscricao === "absoluto" && !absolutoElegivel) {
      apontarCampos([{ campo: "pacote", mensagem: "Este atleta não se enquadra em absoluto cadastrado neste campeonato." }]);
      return;
    }

    if ((tipoInscricao === "ambos" || tipoInscricao === "peso") && !pesoElegivel) {
      apontarCampos([{
        campo: "categoria",
        mensagem: absolutoElegivel
          ? "Este atleta não tem categoria de peso. Escolha só o absoluto."
          : "Nenhuma categoria cadastrada combina com idade, sexo, faixa e peso deste atleta.",
      }]);
      return;
    }

    if (tipoInscricao === "ambos" && !absolutoElegivel) {
      apontarCampos([{ campo: "pacote", mensagem: "Este atleta não se enquadra em absoluto cadastrado neste campeonato." }]);
      return;
    }

    if (tabelaCarregando || tabelaErro || !categoriasEvento.length || (precisaCategoriaPeso && !categoriasElegiveis.some(c => c.id === categoriaId))) {
      apontarCampos([{
        campo: precisaCategoriaPeso ? "categoria" : "pacote",
        mensagem: tabelaErro || (!categoriasEvento.length
          ? "O organizador ainda não cadastrou as categorias deste evento."
          : tipoInscricao === "absoluto"
            ? "Este atleta não se enquadra em absoluto cadastrado neste campeonato."
            : "Escolha uma categoria cadastrada compatível com sua idade, sexo, faixa e peso."),
      }]);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const usuarioAtualId = data.user?.id || userId;
    const userIdInscricao = competidorUserId || usuarioAtualId;
    if (familia.length && !familia.some(pessoa => pessoa.user_id === userIdInscricao)) {
      setErro("Escolha um atleta da sua conta ou um dependente cadastrado.");
      setProcessando(false);
      return;
    }

    const { data: inscricaoExistente } = await supabase
      .from("inscricoes")
      .select("id,absoluto,categoria,categoria_id,pagamento_ok,valor_inscricao,valor_total,cupom_id,modalidade")
      .eq("evento_id", eventoId)
      .or(`user_id.eq.${userIdInscricao},atleta_id.eq.${atletaId || 0}`);

    const existente = inscricaoExistente?.[0] || null;
    const pacoteAtual = existente ? pacoteInscricao(existente) : null;
    const pacoteDesejado = pacoteDoTipoInscricao(tipoInscricao);
    const ampliando = Boolean(existente && pacoteAtual && podeAmpliarPacote(pacoteAtual, pacoteDesejado));
    const pacoteFinal = existente && pacoteAtual
      ? (ampliando ? pacoteAposAmpliar(pacoteAtual, pacoteDesejado) : pacoteAtual)
      : pacoteDesejado;

    if (existente && !ampliando) {
      setErro(pacoteAtual === "combo"
        ? "Este atleta já está nas chaves de peso e absoluto deste campeonato."
        : `Este atleta já está inscrito neste campeonato (${rotuloPacoteInscricao(pacoteAtual || "peso").toLowerCase()}).`);
      setProcessando(false);
      return;
    }

    if (!ampliando && cpfAtleta) {
      const { data: cpfJaInscrito, error: erroCpf } = await supabase.rpc('cpf_inscrito_no_evento', {
        p_evento_id: eventoId,
        p_cpf: cpfAtleta,
      });

      if (erroCpf) {
        setErro("Não foi possível conferir este CPF agora. Tente de novo.");
        setProcessando(false);
        return;
      }

      if (cpfJaInscrito) {
        setErro("Já existe inscrição neste evento para este CPF.");
        setProcessando(false);
        return;
      }
    }

    if (!ampliando && emailAtleta && userIdInscricao === usuarioAtualId) {
      const { data: inscricaoMesmoEmail, error: erroEmail } = await supabase
        .from("inscricoes")
        .select("id")
        .eq("evento_id", eventoId)
        .eq("email", emailAtleta);

      if (!erroEmail && inscricaoMesmoEmail && inscricaoMesmoEmail.length > 0) {
        setErro("Já existe inscrição neste evento para este e-mail.");
        setProcessando(false);
        return;
      }
    }

    const equipeOficial = equipesEvento.find(eq => eq.id === equipeId);
    const categoriaPesoNome = existente?.categoria && String(existente.categoria).trim().toLowerCase() !== "absoluto"
      ? existente.categoria
      : categoria;
    const categoriaPesoId = existente?.categoria_id || categoriaId;
    const soAbsoluto = pacoteFinal === "absoluto";
    const inscricaoParaSalvar: Record<string, unknown> = {
      user_id: userIdInscricao,
      atleta_id: atletaId,
      atleta: nome,
      equipe: equipeOficial?.nome || equipe,
      faixa,
      sexo,
      categoria: soAbsoluto ? "Absoluto" : categoriaPesoNome,
      ...(soAbsoluto
        ? { modalidade: absolutoElegivel?.modalidade || modalidade }
        : categoriaPesoId
          ? { categoria_id: categoriaPesoId, modalidade: categoriasEvento.find(c => c.id === categoriaPesoId)?.modalidade || existente?.modalidade || modalidade }
          : { modalidade }),
      ...(equipeId ? { equipe_id: equipeId } : {}),
      absoluto: pacoteFinal !== "peso",
      idade,
      observacoes,
      peso: pesoReal,
      evento_id: eventoId,
      pagamento_ok: false,
      valor_inscricao: valorBase,
      valor_total: cupomAplicado ? valorBase : valorTotal,
      email: emailAtleta || null
    };

    if (ampliando && existente) {
      const novaInscricao = { ...existente, ...inscricaoParaSalvar, absoluto: pacoteFinal !== "peso" };
      const devidoNovo = eventoValores ? calcularValorInscricao(novaInscricao, eventoValores) : valorBase;
      if (existente.pagamento_ok) {
        inscricaoParaSalvar.pagamento_ok = true;
        inscricaoParaSalvar.valor_inscricao = Number(existente.valor_inscricao || 0);
        inscricaoParaSalvar.valor_total = Number(existente.valor_total || existente.valor_inscricao || 0);
      } else {
        inscricaoParaSalvar.valor_inscricao = devidoNovo;
        inscricaoParaSalvar.valor_total = cupomAplicado ? devidoNovo : Math.max(0, devidoNovo - desconto);
      }
    }

    let isLiberado = !cupomAplicado && Number(inscricaoParaSalvar.valor_total || 0) === 0;
    if (ampliando && existente?.pagamento_ok && eventoValores) {
      isLiberado = valorAindaDevido({ ...existente, ...inscricaoParaSalvar, pagamento_ok: true }, eventoValores) === 0;
      inscricaoParaSalvar.pagamento_ok = isLiberado || Boolean(existente.pagamento_ok);
    } else {
      inscricaoParaSalvar.pagamento_ok = isLiberado;
    }

    let inscricaoCriada: { id: string | number } | null = null;
    let error: { message: string } | null = null;

    async function gravarInscricao(payload: Record<string, unknown>) {
      if (ampliando && existente) {
        return supabase.from("inscricoes").update(payload).eq("id", existente.id).select("id").single();
      }
      return supabase.from("inscricoes").insert([payload]).select("id").single();
    }

    let resultado = await gravarInscricao(inscricaoParaSalvar);
    error = resultado.error;
    inscricaoCriada = resultado.data;
    if (error && /cpf|email|column/i.test(error.message)) {
      const { email, ...payloadSemEmail } = inscricaoParaSalvar;
      resultado = await gravarInscricao(payloadSemEmail);
      error = resultado.error;
      inscricaoCriada = resultado.data;
    }

    if (error) {
      setErro("Erro ao registrar: " + error.message);
      setProcessando(false);
      return;
    }

    const { data: sessao } = await supabase.auth.getSession();
    const authorization = `Bearer ${sessao.session?.access_token || ""}`;
    const jaTinhaCupom = Boolean(existente?.cupom_id);

    if (cupomAplicado && inscricaoCriada?.id && !jaTinhaCupom) {
      const response = await fetch("/api/vouchers/aplicar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authorization },
        body: JSON.stringify({ inscricaoId: inscricaoCriada.id, codigo: cupomAplicado }),
      });
      const resultado = await response.json();
      if (!response.ok) {
        if (!ampliando) await supabase.from("inscricoes").delete().eq("id", inscricaoCriada.id);
        setErro(resultado.error || "Não foi possível reservar esta cortesia.");
        setProcessando(false);
        return;
      }
      isLiberado = resultado.gratuito === true;
      if (isLiberado) {
        await supabase.from("inscricoes").update({ pagamento_ok: true }).eq("id", inscricaoCriada.id);
      }
    } else if (isLiberado && inscricaoCriada?.id && !ampliando) {
      await fetch("/api/enviar-ingresso-confirmado", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authorization },
        body: JSON.stringify({ inscricaoId: inscricaoCriada.id }),
      });
    } else if (inscricaoCriada?.id && !(ampliando && existente?.pagamento_ok && isLiberado)) {
      await fetch("/api/enviar-pagamento-pendente", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authorization },
        body: JSON.stringify({ inscricaoId: inscricaoCriada.id, meio: "inscricao" }),
      });
    }

    if (isLiberado && inscricaoCriada?.id && ampliando) {
      await fetch("/api/enviar-ingresso-confirmado", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authorization },
        body: JSON.stringify({ inscricaoId: inscricaoCriada.id }),
      });
    }

    if (inscricaoCriada?.id && !ampliando) {
      await fetch("/api/aviso-professor-inscricao", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authorization },
        body: JSON.stringify({ inscricaoId: inscricaoCriada.id }),
      });
    }

    setErro("");
    setProcessando(false);

    if (isLiberado) {
      setInscricaoFeita(true);
    } else {
      router.push("/pagamento");
    }
  }

  if (loading) return <div className="min-h-[70vh] flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-[10px]"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-500 mr-3"></div>Preparando credencial...</div>;

  if (inscricaoFeita) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 bg-[#0a0a0e] border border-green-500/30 rounded-2xl text-center shadow-[0_0_40px_rgba(34,197,94,0.1)]">
        <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl">✓</div>
        <h2 className="text-2xl font-black text-white mb-3">Inscrição Confirmada!</h2>
        <p className="text-zinc-400 text-xs mb-8 font-medium">
          {valorTotal === 0
            ? "Você está garantido na chave oficial (Cupom / Isenção Aplicada)."
            : "Dados enviados. Realize o pagamento para garantir seu nome nas chaves."}
        </p>
        {valorTotal > 0 ? (
          <Link href={`/pagamento`} className="cursor-pointer inline-block bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-xs px-8 py-3.5 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all">Ir para Pagamento</Link>
        ) : (
          // 🔥 ROTA CORRIGIDA PARA O QR CODE BLINDADO (eventoId / userId)
          <Link href={`/ingresso/${eventoId}/${competidorUserId || userId}`} className="cursor-pointer inline-block bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest text-xs px-8 py-3.5 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all">
            Ver Meu Passaporte & QR Code
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-2xl md:text-3xl font-black text-white mb-1 tracking-tight">Finalizar Inscrição</h1>
        <p className="text-zinc-400 text-xs font-medium flex items-center justify-center md:justify-start gap-1.5">{eventoNome || "Carregando evento..."}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {erro && camposInvalidos.length > 0 && (
            <div role="alert" className="sticky top-16 z-20 bg-red-600 text-white rounded-xl p-3 text-xs font-bold leading-relaxed shadow-lg">
              {erro}
            </div>
          )}

          {inscricaoBloqueadaPorPeriodo && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-red-400 font-bold text-xs uppercase tracking-widest mb-1">Inscrições encerradas</p>
              <p className="text-red-100/70 text-xs">{motivoInscricaoIndisponivel || "As inscrições deste evento não estão disponíveis."}</p>
            </div>
          )}

          {perfilIncompleto && (
            <div id="inscricao-perfil" className={`bg-yellow-500/10 border rounded-xl p-4 ${camposInvalidos.includes("perfil") ? "border-red-500 ring-1 ring-red-500/60" : "border-yellow-500/30"}`}>
              <p className="text-yellow-500 font-bold text-xs uppercase tracking-widest mb-1">Perfil Incompleto</p>
              <p className="text-yellow-200/70 text-xs">Faltam dados obrigatórios no cadastro deste atleta (nome, equipe e faixa). <Link href="/perfil" className="underline font-bold text-yellow-400">Complete em Família / Dependentes</Link></p>
            </div>
          )}

          {/* CREDENCIAL */}
          <section className="bg-[#0a0a0e] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
            <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-5">Credencial do Atleta</h2>
            {familia.some(pessoa => pessoa.user_id !== userId) && (
              <label className="block mb-4 text-[9px] text-zinc-500 font-bold uppercase">
                Quem vai competir neste campeonato
                <select
                  value={competidorUserId}
                  onChange={e => {
                    const pessoa = familia.find(item => item.user_id === e.target.value);
                    if (pessoa) aplicarCompetidor(pessoa);
                  }}
                  className="mt-1.5 w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs"
                >
                  {familia.filter(pessoa => pessoa.user_id !== userId).map(pessoa => (
                    <option key={pessoa.user_id} value={pessoa.user_id}>{pessoa.nome}</option>
                  ))}
                  {familia.filter(pessoa => pessoa.user_id === userId).map(pessoa => (
                    <option key={pessoa.user_id} value={pessoa.user_id}>{pessoa.nome || "Eu"} — só se eu também competir</option>
                  ))}
                </select>
                <span className="mt-1.5 block text-[10px] font-medium normal-case tracking-normal text-zinc-500">O responsável não precisa se inscrever. Escolha o filho, ou faça uma inscrição para cada um.</span>
              </label>
            )}
            <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start bg-black/40 p-4 rounded-xl border border-white/5">
              <div className="shrink-0">
                {fotoUrl ? <img src={fotoUrl} alt="Foto" className="w-24 h-24 rounded-full object-cover border border-white/10" /> : <div className="w-24 h-24 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-600">🥋</div>}
              </div>
              <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><p className="text-[8px] text-zinc-500 font-bold uppercase">Nome</p><p className="font-bold text-xs text-white truncate">{nome}</p></div>
                <div><p className="text-[8px] text-zinc-500 font-bold uppercase">Equipe</p><p className="font-bold text-xs text-white truncate">{equipe}</p></div>
                <div><p className="text-[8px] text-zinc-500 font-bold uppercase">Faixa</p><p className="font-bold text-xs text-white">{faixa}</p></div>
                <div><p className="text-[8px] text-zinc-500 font-bold uppercase">Peso Base</p><p className="font-bold text-xs text-white">{pesoReal} kg</p></div>
                <div><p className="text-[8px] text-zinc-500 font-bold uppercase">Sexo</p><p className="font-bold text-xs text-white">{sexo}</p></div>
              </div>
            </div>
          </section>

          {/* CHAVE */}
          <section className="bg-[#0a0a0e] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl">
            <h2 className="text-xs font-black text-white uppercase tracking-widest mb-5">Encaixe na Chave</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div id="inscricao-idade" className="scroll-mt-24">
                <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1.5">Idade na data do evento</label>
                <input type="number" placeholder="Ex: 8" value={idade} onChange={(e) => { setIdade(e.target.value); limparCampoInvalido("idade"); }} disabled={idadePeloCadastro} aria-invalid={camposInvalidos.includes("idade")} className={`w-full bg-black border rounded-lg px-3 py-2.5 text-white text-xs ${classeCampo("idade")} ${idadePeloCadastro ? 'opacity-70 cursor-not-allowed' : ''}`} />
                {camposInvalidos.includes("idade") ? <p className="text-[11px] text-red-400 mt-1 font-bold">Informe a idade na data do evento.</p> : idadePeloCadastro ? <p className="text-[10px] text-zinc-500 mt-1">Calculada pela data de nascimento do cadastro.</p> : <p className="text-[10px] text-zinc-500 mt-1">Informe a idade ou complete a data de nascimento no perfil.</p>}
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1.5">Sexo Competitivo</label>
                <input type="text" value={sexo} disabled className="w-full bg-black/30 border border-transparent rounded-lg px-3 py-2.5 text-zinc-500 text-xs cursor-not-allowed" />
              </div>
            </div>
            <div>
                <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1.5">{tipoInscricao === 'absoluto' ? 'Absoluto' : 'Categoria de Peso Oficial'}</label>
                <div id="inscricao-categoria" className="scroll-mt-24">
                {tipoInscricao === 'absoluto' ? (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-100">{absolutoElegivel ? rotuloCategoria(absolutoElegivel) : 'Nenhum absoluto compatível.'}</p>
                ) : tabelaCarregando ? (
                  <p className="text-zinc-500 text-xs">Carregando categorias do evento...</p>
                ) : categoriasEvento.length > 0 ? (
                  <select aria-label="Categoria de peso" aria-invalid={camposInvalidos.includes("categoria")} value={categoriaId} onChange={e => { const c = categoriasEvento.find(c => c.id === e.target.value);setCategoriaId(e.target.value);setCategoria(c ? rotuloCategoria(c) : ''); limparCampoInvalido("categoria"); }} className={`w-full bg-black border rounded-lg px-3 py-2.5 text-white text-xs ${classeCampo("categoria")}`}><option value="">Selecione sua categoria</option>{categoriasElegiveis.map(c => <option key={c.id} value={c.id}>{rotuloCategoria(c)}</option>)}</select>
                ) : (
                  <p className="text-amber-300 text-xs">A inscrição usa só as categorias cadastradas pelo organizador. Nenhuma está disponível neste evento ainda.</p>
                )}
                {camposInvalidos.includes("categoria") && <p className="text-[11px] text-red-400 mt-2 font-bold">Selecione a categoria de peso para entrar na chave.</p>}
                {tipoInscricao !== 'absoluto' && categoriasEvento.length > 0 && !categoriasElegiveis.length && <p className="text-amber-300 text-xs mt-2">{absolutoElegivel ? 'Não há categoria de peso para este atleta. Ele pode se inscrever só no absoluto.' : 'Nenhuma categoria cadastrada combina com idade, sexo, faixa e peso deste atleta. Confira o perfil ou fale com a organização.'}</p>}
                {tabelaErro && <p role="alert" className="text-red-400 text-xs mt-2">{tabelaErro}</p>}
                </div>
                {equipesEvento.length > 0 && <label id="inscricao-equipe" className="block mt-4 scroll-mt-24 text-xs text-zinc-400">Equipe no campeonato<select aria-invalid={camposInvalidos.includes("equipe")} value={equipeId} onChange={e => {const eq=equipesEvento.find(q=>q.id===e.target.value);setEquipeId(e.target.value);if(eq){setEquipe(eq.nome);} limparCampoInvalido("equipe");}} className={`w-full bg-black border rounded-lg p-3 text-white mt-1 ${classeCampo("equipe")}`}><option value="">Selecione a equipe deste evento</option>{equipesEvento.map(eq=><option key={eq.id} value={eq.id}>{eq.nome}</option>)}</select>{camposInvalidos.includes("equipe") && <p className="text-[11px] text-red-400 mt-1.5 font-bold">Selecione a equipe deste campeonato.</p>}</label>}

              </div>
          </section>

          {/* PACOTE */}
          <section id="inscricao-pacote" className={`bg-[#0a0a0e] border rounded-2xl p-5 md:p-6 shadow-xl ${camposInvalidos.includes("pacote") ? "border-red-500 ring-1 ring-red-500/60" : "border-white/5"}`}>
            <h2 className="text-xs font-black text-white uppercase tracking-widest mb-2">Escolha seu Pacote</h2>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-5">Modalidade: <strong className="text-white">{nomeLoteAtual}</strong>{usaTarifaInfantil ? <span className="ml-2 rounded bg-cyan-500/20 px-2 py-0.5 text-cyan-300">Tarifa infantil</span> : null}</p>
            {camposInvalidos.includes("pacote") && <p className="mb-4 text-[11px] text-red-400 font-bold">Escolha um pacote compatível com este atleta.</p>}
            {pacoteJaInscrito && (
              <p className={`mb-4 rounded-xl border p-3 text-[11px] leading-relaxed ${jaNoCombo ? "border-green-500/20 bg-green-500/10 text-green-200" : "border-amber-500/20 bg-amber-500/10 text-amber-100"}`}>
                {jaNoCombo
                  ? "Este atleta já está nas duas chaves: categoria de peso e absoluto."
                  : pacoteJaInscrito === "peso"
                    ? "Este atleta já está na categoria de peso. Escolha Absoluto ou o combo para entrar também na chave de absoluto — sem criar uma segunda inscrição."
                    : "Este atleta já está só no absoluto. Escolha a categoria de peso ou o combo para entrar também na chave de peso."}
              </p>
            )}

            <div className="space-y-2.5">
              {pesoElegivel && (
              <label className={`block relative p-4 rounded-xl border cursor-pointer transition-all ${tipoInscricao === 'peso' ? 'border-red-500 bg-red-500/5' : 'border-white/5 bg-black'}`}>
                <input type="radio" name="tipoInscricao" value="peso" checked={tipoInscricao === 'peso'} onChange={() => { setTipoInscricao('peso'); limparCampoInvalido("pacote"); }} className="absolute opacity-0 w-0 h-0" />
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xs">Categoria de Peso</h3>
                  <span className="font-black text-sm">{valorLoteAtual === 0 ? "GRÁTIS" : `R$ ${valorLoteAtual.toFixed(2)}`}</span>
                </div>
              </label>
              )}

              {absolutoElegivel && (
              <label className={`block relative p-4 rounded-xl border cursor-pointer transition-all ${tipoInscricao === 'absoluto' ? 'border-red-500 bg-red-500/5' : 'border-white/5 bg-black'}`}>
                <input type="radio" name="tipoInscricao" value="absoluto" checked={tipoInscricao === 'absoluto'} onChange={() => { setTipoInscricao('absoluto'); limparCampoInvalido("pacote"); limparCampoInvalido("categoria"); }} className="absolute opacity-0 w-0 h-0" />
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <h3 className="font-bold text-xs">Somente Absoluto</h3>
                    <p className="mt-1 text-[10px] font-medium normal-case tracking-normal text-zinc-500">{rotuloCategoria(absolutoElegivel)}</p>
                  </div>
                  <span className="font-black text-sm shrink-0">{valorAbsolutoSozinho === 0 ? "GRÁTIS" : `R$ ${valorAbsolutoSozinho.toFixed(2)}`}</span>
                </div>
              </label>
              )}

              {pesoElegivel && absolutoElegivel ? (
              <label className={`block relative p-4 rounded-xl border cursor-pointer transition-all ${tipoInscricao === 'ambos' ? 'border-red-500 bg-red-500/5' : 'border-white/5 bg-black'}`}>
                <input type="radio" name="tipoInscricao" value="ambos" checked={tipoInscricao === 'ambos'} onChange={() => { setTipoInscricao('ambos'); limparCampoInvalido("pacote"); }} className="absolute opacity-0 w-0 h-0" />
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <h3 className="font-bold text-xs">Categoria de Peso + Absoluto <span className="bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase px-2 py-0.5 rounded ml-2">Combo</span></h3>
                    <p className="mt-1 text-[10px] font-medium normal-case tracking-normal text-zinc-500">{rotuloCategoria(absolutoElegivel)}{valorAbsolutoSozinho > valorAbsoluto ? ` · extra R$ ${valorAbsoluto.toFixed(2)} em vez de R$ ${valorAbsolutoSozinho.toFixed(2)} sozinho` : ""}</p>
                  </div>
                  <span className="font-black text-sm shrink-0">{(valorLoteAtual + valorAbsoluto) === 0 ? "GRÁTIS" : `R$ ${(valorLoteAtual + valorAbsoluto).toFixed(2)}`}</span>
                </div>
              </label>
              ) : !absolutoElegivel ? (
                <p className="text-[10px] text-zinc-500 leading-relaxed">Este atleta não entra em absoluto deste campeonato. O extra só aparece para quem combina com sexo, faixa e idade cadastrados pelo organizador.</p>
              ) : null}
            </div>
          </section>

          {/* TERMOS */}
          <section id="inscricao-termos" className={`scroll-mt-24 bg-[#0a0a0e] border rounded-2xl p-5 md:p-6 shadow-xl ${camposInvalidos.includes("termos") ? "border-red-500 ring-1 ring-red-500/60" : "border-white/5"}`}>
            <h2 className="text-xs font-black text-white uppercase tracking-widest mb-4">Termos de Aceite</h2>
            <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border bg-black ${camposInvalidos.includes("termos") ? "border-red-500" : "border-white/5"}`}>
              <input type="checkbox" checked={termoAceito} onChange={(e) => { setTermoAceito(e.target.checked); if (e.target.checked) limparCampoInvalido("termos"); }} className="mt-0.5 w-4 h-4 accent-red-600 rounded" />
              <span className="text-xs text-white font-bold">Declaro que li e concordo com os termos de responsabilidade e o edital oficial.</span>
            </label>
            {camposInvalidos.includes("termos") && <p className="mt-2 text-[11px] text-red-400 font-bold">Marque os termos de aceite para confirmar a inscrição.</p>}
          </section>
        </div>

        {/* CHECHOUT RESUMO */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 bg-[#0a0a0e] border border-white/10 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-5 border-b border-white/5 pb-3">Resumo da Inscrição</h3>

            <div className="space-y-3 mb-5 text-xs">
              <div className="flex justify-between"><span className="text-zinc-400">{tipoInscricao === "absoluto" ? "Absoluto" : `Inscrição Campeonato${usaTarifaInfantil ? " (infantil)" : ""}`}</span><span className="text-white font-bold">{(tipoInscricao === "absoluto" ? valorAbsolutoSozinho : valorLoteAtual) === 0 ? "R$ 0,00" : `R$ ${(tipoInscricao === "absoluto" ? valorAbsolutoSozinho : valorLoteAtual).toFixed(2)}`}</span></div>
              {tipoInscricao === 'ambos' && valorAbsoluto > 0 && <div className="flex justify-between"><span className="text-zinc-400">Add-on: Absoluto</span><span className="text-white font-bold">R$ {valorAbsoluto.toFixed(2)}</span></div>}
              {desconto > 0 && <div className="flex justify-between text-green-400"><span className="font-bold">Desconto Validado</span><span className="font-bold">- R$ {desconto.toFixed(2)}</span></div>}
            </div>

            {/* AREA CUPOM DO BANCO */}
            {!isGratis && (
              <div className="border-t border-white/10 pt-4 mb-5">
                <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-2">Cupom de Parceria / Cortesia</label>
                <div className="flex gap-2">
                  <input type="text" value={cupom} onChange={(e) => { setCupom(e.target.value.toUpperCase()); setCupomAplicado(""); setDesconto(0); setCupomMensagem(""); }} placeholder="DIGITE O CÓDIGO" className="w-full bg-black border border-white/10 outline-none rounded-lg px-3 py-2 text-white text-xs uppercase" />
                  <button type="button" onClick={aplicarCupom} className="cursor-pointer bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold uppercase px-4 rounded-lg transition-colors">Validar</button>
                </div>
                {cupomMensagem && <p className={`text-[10px] mt-2 font-bold ${desconto > 0 ? 'text-green-400' : 'text-red-400'}`}>{cupomMensagem}</p>}
              </div>
            )}

            <div className="border-t border-white/10 pt-4 mb-6 flex justify-between items-end">
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Total Líquido</span>
              <span className="text-2xl font-black text-red-500">{valorTotal === 0 ? "GRÁTIS" : `R$ ${valorTotal.toFixed(2).replace('.', ',')}`}</span>
            </div>

            {erro && <div role="alert" className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] rounded-lg p-3 text-center font-bold leading-relaxed">❌ {erro}</div>}

            <button type="button" disabled={processando || inscricaoBloqueadaPorPeriodo || jaNoCombo || tabelaCarregando} className="cursor-pointer w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-[11px] py-4 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all disabled:opacity-50 flex items-center justify-center" onClick={finalizarInscricao}>
              {processando ? "Salvando Inscrição..." : jaNoCombo ? "Já inscrito nas duas chaves" : ampliandoPacote ? (pacoteJaInscrito === "peso" ? "Adicionar absoluto à inscrição" : "Adicionar categoria de peso") : "Confirmar Inscrição Oficial"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PageInscricao() {
  return (
    <main className="min-h-screen bg-[#050505]">
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-zinc-500 font-bold text-xs uppercase">Carregando...</div>}><FormularioInscricao /></Suspense>
    </main>
  );
}
