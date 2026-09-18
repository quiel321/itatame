"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "../lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { categoriaCompativel, idadeCompetitiva, rotuloCategoria, type CategoriaCompeticao } from '@/app/lib/categorias-competicao';
import { tarifaInfantilAplicavel, valorAddonAbsoluto, valorLoteVigente, type EventoValoresInscricao } from '@/app/lib/valor-inscricao';
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

  // Estados do Cupom
  const [cupom, setCupom] = useState("");
  const [desconto, setDesconto] = useState(0);
  const [cupomMensagem, setCupomMensagem] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState("");

  const [inscricaoFeita, setInscricaoFeita] = useState(false);
  const [erro, setErro] = useState("");
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

  const categoriasElegiveis = categoriasEvento.filter(c => c.tipo === 'peso' && categoriaCompativel(c, { idade, sexo, faixa, peso: pesoReal }));
  useEffect(() => {
    if (categoriaId && !categoriasElegiveis.some(c => c.id === categoriaId)) { setCategoriaId(''); setCategoria(''); }
  }, [idade, sexo, faixa, pesoReal, categoriaId, categoriasEvento]);

  const valorLoteAtual = eventoValores ? valorLoteVigente(eventoValores, new Date(), idade) : 0;
  const valorAbsoluto = eventoValores ? valorAddonAbsoluto(eventoValores, idade) : 0;
  const usaTarifaInfantil = Boolean(eventoValores && tarifaInfantilAplicavel(eventoValores, idade));
  const valorBase = (tipoInscricao === "ambos") ? valorLoteAtual + valorAbsoluto : valorLoteAtual;
  const valorTotal = Math.max(0, valorBase - desconto);
  const isGratis = valorBase === 0;

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

    if (perfilIncompleto) {
      setErro("Complete nome, equipe e faixa deste atleta no perfil antes de inscrever.");
      setProcessando(false);
      return;
    }

    if (inscricoesEncerradas) {
      setErro(motivoInscricaoIndisponivel || "As inscrições deste evento não estão disponíveis.");
      setProcessando(false);
      return;
    }

    if (equipesEvento.length > 0 && !equipeId) {
      setErro("Selecione a equipe oficial deste campeonato.");
      setProcessando(false);
      return;
    }

    if (limiteVagas > 0 && eventoId) {
      const { count: ocupadas } = await supabase.from("inscricoes").select("id", { count: "exact", head: true }).eq("evento_id", eventoId);
      if ((ocupadas || 0) >= limiteVagas) {
        setInscricoesEncerradas(true);
        setMotivoInscricaoIndisponivel(`As vagas deste campeonato esgotaram (${ocupadas}/${limiteVagas}). Novas inscrições ficam bloqueadas até o organizador ampliar o limite.`);
        setErro(`As vagas deste campeonato esgotaram (${ocupadas}/${limiteVagas}).`);
        setProcessando(false);
        return;
      }
    }

    if (tipoInscricao === "absoluto") {
      setErro("No Jiu-Jitsu, o absoluto só pode ser contratado junto com a categoria de peso.");
      setProcessando(false);
      return;
    }

    if (!termoAceito) {
      setErro("Você precisa aceitar os termos do evento.");
      setProcessando(false);
      return;
    }

    if (tabelaCarregando || tabelaErro || !categoriasEvento.length || !categoriasElegiveis.some(c => c.id === categoriaId)) {
      setErro(tabelaErro || (!categoriasEvento.length
        ? "O organizador ainda não cadastrou as categorias deste evento."
        : "Escolha uma categoria cadastrada compatível com sua idade, sexo, faixa e peso."));
      setProcessando(false);
      return;
    }
    if (!idade || !Number.isInteger(Number(idade)) || Number(idade) < 4 || Number(idade) > 100) {
      setErro("Por favor, preencha sua idade.");
      setProcessando(false);
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
      .select("id")
      .eq("evento_id", eventoId)
      .or(`user_id.eq.${userIdInscricao},atleta_id.eq.${atletaId || 0}`);

    if (inscricaoExistente && inscricaoExistente.length > 0) {
      setErro("Este atleta já está inscrito neste campeonato.");
      setProcessando(false);
      return;
    }

    if (cpfAtleta) {
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

    if (emailAtleta && userIdInscricao === usuarioAtualId) {
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
    let isLiberado = !cupomAplicado && valorTotal === 0;
    const inscricaoParaSalvar = {
      user_id: userIdInscricao,
      atleta_id: atletaId,
      atleta: nome,
      equipe: equipeOficial?.nome || equipe,
      faixa,
      sexo,
      categoria,
      ...(categoriaId ? { categoria_id: categoriaId, modalidade: categoriasEvento.find(c => c.id === categoriaId)?.modalidade } : { modalidade }),
      ...(equipeId ? { equipe_id: equipeId } : {}),
      absoluto: tipoInscricao === "ambos",
      idade,
      observacoes,
      peso: pesoReal,
      evento_id: eventoId,
      pagamento_ok: isLiberado,
      valor_inscricao: valorBase,
      valor_total: cupomAplicado ? valorBase : valorTotal,
      cpf: cpfAtleta || null,
      email: emailAtleta || null
    };

    let { data: inscricaoCriada, error } = await supabase.from("inscricoes").insert([inscricaoParaSalvar]).select("id").single();

    if (error && (error.message.toLowerCase().includes("cpf") || error.message.toLowerCase().includes("email"))) {
      const { cpf, email, ...payloadSemCamposNovos } = inscricaoParaSalvar;
      const retry = await supabase.from("inscricoes").insert([payloadSemCamposNovos]).select("id").single();
      error = retry.error;
      inscricaoCriada = retry.data;
    }

    if (error) {
      setErro("Erro ao registrar: " + error.message);
      setProcessando(false);
      return;
    }

    const { data: sessao } = await supabase.auth.getSession();
    const authorization = `Bearer ${sessao.session?.access_token || ""}`;

    if (cupomAplicado && inscricaoCriada?.id) {
      const response = await fetch("/api/vouchers/aplicar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authorization },
        body: JSON.stringify({ inscricaoId: inscricaoCriada.id, codigo: cupomAplicado }),
      });
      const resultado = await response.json();
      if (!response.ok) {
        await supabase.from("inscricoes").delete().eq("id", inscricaoCriada.id);
        setErro(resultado.error || "Não foi possível reservar esta cortesia.");
        setProcessando(false);
        return;
      }
      isLiberado = resultado.gratuito === true;
    } else if (isLiberado && inscricaoCriada?.id) {
      await fetch("/api/enviar-ingresso-confirmado", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authorization },
        body: JSON.stringify({ inscricaoId: inscricaoCriada.id }),
      });
    } else if (inscricaoCriada?.id) {
      await fetch("/api/enviar-pagamento-pendente", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authorization },
        body: JSON.stringify({ inscricaoId: inscricaoCriada.id, meio: "inscricao" }),
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
          {inscricoesEncerradas && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-red-400 font-bold text-xs uppercase tracking-widest mb-1">Inscrições encerradas</p>
              <p className="text-red-100/70 text-xs">{motivoInscricaoIndisponivel || "As inscrições deste evento não estão disponíveis."}</p>
            </div>
          )}

          {perfilIncompleto && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
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
              <div>
                <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1.5">Idade na data do evento</label>
                <input type="number" placeholder="Ex: 8" value={idade} onChange={(e) => setIdade(e.target.value)} disabled={idadePeloCadastro} className={`w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs ${idadePeloCadastro ? 'opacity-70 cursor-not-allowed' : ''}`} />
                {idadePeloCadastro ? <p className="text-[10px] text-zinc-500 mt-1">Calculada pela data de nascimento do cadastro.</p> : <p className="text-[10px] text-zinc-500 mt-1">Informe a idade ou complete a data de nascimento no perfil.</p>}
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1.5">Sexo Competitivo</label>
                <input type="text" value={sexo} disabled className="w-full bg-black/30 border border-transparent rounded-lg px-3 py-2.5 text-zinc-500 text-xs cursor-not-allowed" />
              </div>
            </div>
            <div>
                <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1.5">Categoria de Peso Oficial</label>
                {tabelaCarregando ? (
                  <p className="text-zinc-500 text-xs">Carregando categorias do evento...</p>
                ) : categoriasEvento.length > 0 ? (
                  <select aria-label="Categoria de peso" value={categoriaId} onChange={e => { const c = categoriasEvento.find(c => c.id === e.target.value);setCategoriaId(e.target.value);setCategoria(c ? rotuloCategoria(c) : ''); }} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs"><option value="">Selecione sua categoria</option>{categoriasElegiveis.map(c => <option key={c.id} value={c.id}>{rotuloCategoria(c)}</option>)}</select>
                ) : (
                  <p className="text-amber-300 text-xs">A inscrição usa só as categorias cadastradas pelo organizador. Nenhuma está disponível neste evento ainda.</p>
                )}
                {categoriasEvento.length > 0 && !categoriasElegiveis.length && <p className="text-amber-300 text-xs mt-2">Nenhuma categoria cadastrada combina com idade, sexo, faixa e peso deste atleta. Confira o perfil ou fale com a organização.</p>}
                {tabelaErro && <p role="alert" className="text-red-400 text-xs mt-2">{tabelaErro}</p>}
                {equipesEvento.length > 0 && <label className="block mt-4 text-xs text-zinc-400">Equipe no campeonato<select value={equipeId} onChange={e => {const eq=equipesEvento.find(q=>q.id===e.target.value);setEquipeId(e.target.value);if(eq){setEquipe(eq.nome);}}} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white mt-1"><option value="">Selecione a equipe deste evento</option>{equipesEvento.map(eq=><option key={eq.id} value={eq.id}>{eq.nome}</option>)}</select></label>}

              </div>
          </section>

          {/* PACOTE */}
          <section className="bg-[#0a0a0e] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl">
            <h2 className="text-xs font-black text-white uppercase tracking-widest mb-2">Escolha seu Pacote</h2>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-5">Modalidade: <strong className="text-white">{nomeLoteAtual}</strong>{usaTarifaInfantil ? <span className="ml-2 rounded bg-cyan-500/20 px-2 py-0.5 text-cyan-300">Tarifa infantil</span> : null}</p>

            <div className="space-y-2.5">
              <label className={`block relative p-4 rounded-xl border cursor-pointer transition-all ${tipoInscricao === 'peso' ? 'border-red-500 bg-red-500/5' : 'border-white/5 bg-black'}`}>
                <input type="radio" name="tipoInscricao" value="peso" checked={tipoInscricao === 'peso'} onChange={() => setTipoInscricao('peso')} className="absolute opacity-0 w-0 h-0" />
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xs">Categoria de Peso</h3>
                  <span className="font-black text-sm">{isGratis ? "GRÁTIS" : `R$ ${valorLoteAtual.toFixed(2)}`}</span>
                </div>
              </label>



              <label className={`block relative p-4 rounded-xl border cursor-pointer transition-all ${tipoInscricao === 'ambos' ? 'border-red-500 bg-red-500/5' : 'border-white/5 bg-black'}`}>
                <input type="radio" name="tipoInscricao" value="ambos" checked={tipoInscricao === 'ambos'} onChange={() => setTipoInscricao('ambos')} className="absolute opacity-0 w-0 h-0" />
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xs">Categoria de Peso + Absoluto <span className="bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase px-2 py-0.5 rounded ml-2">Dupla Oportunidade</span></h3>
                  <span className="font-black text-sm">{isGratis ? "GRÁTIS" : `R$ ${(valorLoteAtual + valorAbsoluto).toFixed(2)}`}</span>
                </div>
              </label>
            </div>
          </section>

          {/* TERMOS */}
          <section className="bg-[#0a0a0e] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl">
            <h2 className="text-xs font-black text-white uppercase tracking-widest mb-4">Termos de Aceite</h2>
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-white/5 bg-black">
              <input type="checkbox" checked={termoAceito} onChange={(e) => setTermoAceito(e.target.checked)} className="mt-0.5 w-4 h-4 accent-red-600 rounded" />
              <span className="text-xs text-white font-bold">Declaro que li e concordo com os termos de responsabilidade e o edital oficial.</span>
            </label>
          </section>
        </div>

        {/* CHECHOUT RESUMO */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 bg-[#0a0a0e] border border-white/10 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-5 border-b border-white/5 pb-3">Resumo da Inscrição</h3>

            <div className="space-y-3 mb-5 text-xs">
              <div className="flex justify-between"><span className="text-zinc-400">Inscrição Campeonato{usaTarifaInfantil ? " (infantil)" : ""}</span><span className="text-white font-bold">{isGratis ? "R$ 0,00" : `R$ ${valorLoteAtual.toFixed(2)}`}</span></div>
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

            {erro && <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-lg p-3 text-center font-bold">❌ {erro}</div>}

            <button disabled={processando || perfilIncompleto || !categoriaId || !termoAceito || inscricoesEncerradas || tabelaCarregando || !!tabelaErro || !categoriasEvento.length || (equipesEvento.length > 0 && !equipeId)} className="cursor-pointer w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-[11px] py-4 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all disabled:opacity-50 flex items-center justify-center" onClick={finalizarInscricao}>
              {processando ? "Salvando Inscrição..." : "Confirmar Inscrição Oficial"}
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
