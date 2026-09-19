"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  ImagePlus,
  Info,
  MapPin,
  Medal,
  Save,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { dataHoraLocalParaIso, fusoHorarioEvento, paraInputDateTimeEvento } from "../../lib/evento-datas";
import { IDADE_MAX_INFANTIL_PADRAO, regrasValoresInscricao, valorOpcional } from "../../lib/valor-inscricao";

type ModoFormulario = "criar" | "editar";

type EventoFormProps = {
  modo: ModoFormulario;
  eventoId?: string;
};

type RegrasPontuacao = {
  ouro?: number;
  prata?: number;
  bronze?: number;
  vitoria?: number;
  absoluto_pontua?: boolean;
  wo_pontua?: boolean;
  valor_absoluto?: number;
  valor_absoluto_infantil?: number;
  valor_absoluto_avulso?: number;
  valor_absoluto_avulso_infantil?: number;
  lote1_valor_infantil?: number;
  lote2_valor_infantil?: number;
  lote3_valor_infantil?: number;
  idade_max_infantil?: number;
};

function textoValorOpcional(valor: unknown) {
  const parsed = valorOpcional(valor);
  return parsed === undefined ? "" : String(parsed);
}

const inputClass = "w-full rounded-lg border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none transition focus:border-red-500 placeholder:text-zinc-700";
const labelClass = "mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500";
const cardClass = "rounded-xl border border-white/10 bg-[#0b0b0f] p-4 md:p-5";

function dinheiro(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(valor: string) {
  if (!valor) return "A definir";
  const data = new Date(valor.includes("T") ? valor : valor + "T12:00:00");
  if (Number.isNaN(data.getTime())) return "A definir";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function EventoForm({ modo, eventoId }: EventoFormProps) {
  const router = useRouter();
  const editando = modo === "editar";

  const [carregandoInicial, setCarregandoInicial] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");
  const [comprimindo, setComprimindo] = useState(false);
  const [trava, setTrava] = useState<"nenhuma" | "inscricoes" | "chaves" | "lutas">("nenhuma");
  const originalRef = useRef<Record<string, string | number | null>>({});

  const [nome, setNome] = useState("");
  const [modalidade, setModalidade] = useState("Jiu-Jitsu");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("MT");
  const [local, setLocal] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [status, setStatus] = useState("ABERTO");
  const [linkInscricao, setLinkInscricao] = useState("");

  const [sobreEvento, setSobreEvento] = useState("");
  const [valoresLotes, setValoresLotes] = useState("");
  const [regrasPesagem, setRegrasPesagem] = useState("");

  const [pontosEquipeOuro, setPontosEquipeOuro] = useState(9);
  const [pontosEquipePrata, setPontosEquipePrata] = useState(3);
  const [pontosEquipeBronze, setPontosEquipeBronze] = useState(1);
  const [pontosEquipeVitoria, setPontosEquipeVitoria] = useState(0);
  const [absolutoPontuaEquipe, setAbsolutoPontuaEquipe] = useState(false);
  const [woPontuaEquipe, setWoPontuaEquipe] = useState(false);

  const [limiteVagas, setLimiteVagas] = useState(500);
  const [dataInicioInscricoes, setDataInicioInscricoes] = useState("");
  const [dataFimInscricoes, setDataFimInscricoes] = useState("");
  const [dataFimPagamento, setDataFimPagamento] = useState("");
  const [dataInicioChecagem, setDataInicioChecagem] = useState("");
  const [dataFimChecagem, setDataFimChecagem] = useState("");
  const [dataDivulgacaoChaves, setDataDivulgacaoChaves] = useState("");
  const [dataDivulgacaoCronograma, setDataDivulgacaoCronograma] = useState("");

  const [lote1Valor, setLote1Valor] = useState(0);
  const [lote1DataFim, setLote1DataFim] = useState("");
  const [lote2Valor, setLote2Valor] = useState(0);
  const [lote2DataFim, setLote2DataFim] = useState("");
  const [lote3Valor, setLote3Valor] = useState(0);
  const [lote3DataFim, setLote3DataFim] = useState("");
  const [valorAbsoluto, setValorAbsoluto] = useState(0);
  const [lote1ValorInfantil, setLote1ValorInfantil] = useState("");
  const [lote2ValorInfantil, setLote2ValorInfantil] = useState("");
  const [lote3ValorInfantil, setLote3ValorInfantil] = useState("");
  const [valorAbsolutoInfantil, setValorAbsolutoInfantil] = useState("");
  const [valorAbsolutoAvulso, setValorAbsolutoAvulso] = useState("");
  const [valorAbsolutoAvulsoInfantil, setValorAbsolutoAvulsoInfantil] = useState("");
  const [idadeMaxInfantil, setIdadeMaxInfantil] = useState(IDADE_MAX_INFANTIL_PADRAO);

  const [bannerAtualUrl, setBannerAtualUrl] = useState("");
  const [regulamentoAtualUrl, setRegulamentoAtualUrl] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [regulamentoFile, setRegulamentoFile] = useState<File | null>(null);

  useEffect(() => {
    async function carregarEvento() {
      if (!editando || !eventoId) return;

      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) throw new Error("Acesso negado.");

        const { data: evento, error } = await supabase
          .from("eventos")
          .select("*")
          .eq("id", eventoId)
          .single();

        if (error || !evento) throw new Error("Evento não encontrado.");
        const regras = regrasValoresInscricao(evento) as RegrasPontuacao;
        originalRef.current = {
          data_evento: evento.data_evento || "",
          status: evento.status || "ABERTO",
          lote1_valor: Number(evento.lote1_valor) || 0,
          lote2_valor: Number(evento.lote2_valor) || 0,
          lote3_valor: Number(evento.lote3_valor) || 0,
          valor_absoluto: Number(evento.valor_absoluto ?? regras.valor_absoluto) || 0,
          lote1_data_fim: paraInputDateTimeEvento(evento.lote1_data_fim, evento.estado),
          lote2_data_fim: paraInputDateTimeEvento(evento.lote2_data_fim, evento.estado),
          lote3_data_fim: paraInputDateTimeEvento(evento.lote3_data_fim, evento.estado),
          lote1_valor_infantil: valorOpcional(regras.lote1_valor_infantil) ?? null,
          lote2_valor_infantil: valorOpcional(regras.lote2_valor_infantil) ?? null,
          lote3_valor_infantil: valorOpcional(regras.lote3_valor_infantil) ?? null,
          valor_absoluto_infantil: valorOpcional(regras.valor_absoluto_infantil) ?? null,
          valor_absoluto_avulso: valorOpcional(regras.valor_absoluto_avulso) ?? null,
          valor_absoluto_avulso_infantil: valorOpcional(regras.valor_absoluto_avulso_infantil) ?? null,
          idade_max_infantil: Number(regras.idade_max_infantil) || IDADE_MAX_INFANTIL_PADRAO,
        };
        const [{ count: inscricoes }, { data: lutas }] = await Promise.all([
          supabase.from("inscricoes").select("id", { count: "exact", head: true }).eq("evento_id", eventoId),
          supabase.from("chaves").select("id,status_luta,iniciada_em,vencedor").eq("evento_id", eventoId),
        ]);
        setTrava((lutas || []).some(luta => luta.iniciada_em || luta.vencedor || ['em_andamento', 'concluida'].includes(luta.status_luta))
          ? "lutas" : lutas?.length ? "chaves" : inscricoes ? "inscricoes" : "nenhuma");

        setNome(evento.nome || "");
        setModalidade(evento.descricao || "Jiu-Jitsu");
        setCidade(evento.cidade || "");
        setEstado(evento.estado || "MT");
        setLocal(evento.local || "");
        setDataEvento(evento.data_evento || "");
        setStatus(evento.status || "ABERTO");
        setLinkInscricao(evento.link_inscricao || "");
        setSobreEvento(evento.sobre_evento || "");
        setValoresLotes(evento.valores_lotes || "");
        setRegrasPesagem(evento.regras_pesagem || "");
        setLimiteVagas(Number(evento.limite_vagas) || 500);

        setLote1Valor(Number(evento.lote1_valor) || 0);
        setLote1DataFim(paraInputDateTimeEvento(evento.lote1_data_fim, evento.estado));
        setLote2Valor(Number(evento.lote2_valor) || 0);
        setLote2DataFim(paraInputDateTimeEvento(evento.lote2_data_fim, evento.estado));
        setLote3Valor(Number(evento.lote3_valor) || 0);
        setLote3DataFim(paraInputDateTimeEvento(evento.lote3_data_fim, evento.estado));

        setDataInicioInscricoes(paraInputDateTimeEvento(evento.data_inicio_inscricoes, evento.estado));
        setDataFimInscricoes(paraInputDateTimeEvento(evento.data_fim_inscricoes, evento.estado));
        setDataFimPagamento(paraInputDateTimeEvento(evento.data_fim_pagamento, evento.estado));
        setDataInicioChecagem(paraInputDateTimeEvento(evento.data_inicio_checagem, evento.estado));
        setDataFimChecagem(paraInputDateTimeEvento(evento.data_fim_checagem, evento.estado));
        setDataDivulgacaoChaves(paraInputDateTimeEvento(evento.data_divulgacao_chaves, evento.estado));
        setDataDivulgacaoCronograma(paraInputDateTimeEvento(evento.data_divulgacao_cronograma, evento.estado));

        setValorAbsoluto(Number(evento.valor_absoluto ?? regras.valor_absoluto) || 0);
        setLote1ValorInfantil(textoValorOpcional(regras.lote1_valor_infantil));
        setLote2ValorInfantil(textoValorOpcional(regras.lote2_valor_infantil));
        setLote3ValorInfantil(textoValorOpcional(regras.lote3_valor_infantil));
        setValorAbsolutoInfantil(textoValorOpcional(regras.valor_absoluto_infantil));
        setValorAbsolutoAvulso(textoValorOpcional(regras.valor_absoluto_avulso));
        setValorAbsolutoAvulsoInfantil(textoValorOpcional(regras.valor_absoluto_avulso_infantil));
        setIdadeMaxInfantil(Number(regras.idade_max_infantil) || IDADE_MAX_INFANTIL_PADRAO);
        setPontosEquipeOuro(Number(regras.ouro) || 9);
        setPontosEquipePrata(Number(regras.prata) || 3);
        setPontosEquipeBronze(Number(regras.bronze) || 1);
        setPontosEquipeVitoria(Number(regras.vitoria) || 0);
        setAbsolutoPontuaEquipe(Boolean(regras.absoluto_pontua));
        setWoPontuaEquipe(Boolean(regras.wo_pontua));

        setBannerAtualUrl(evento.banner_url || "");
        setRegulamentoAtualUrl(evento.regulamento_url || "");
      } catch (err: any) {
        alert(err.message);
        router.push("/admin");
      } finally {
        setCarregandoInicial(false);
      }
    }

    carregarEvento();
  }, [editando, eventoId, router]);

  const fimInscricoesFinal = useMemo(
    () => dataFimInscricoes || lote3DataFim || lote2DataFim || lote1DataFim,
    [dataFimInscricoes, lote1DataFim, lote2DataFim, lote3DataFim]
  );

  const fases = [
    { nome: "Inscrições", data: fimInscricoesFinal, texto: "Encerra inscrições e trava a geração de chaves." },
    { nome: "Pagamento", data: dataFimPagamento, texto: "Limite para quitar inscrições pendentes." },
    { nome: "Checagem", data: dataInicioChecagem, texto: "Prazo para o atleta corrigir categoria e peso. A lista já fica pública durante as inscrições." },
    { nome: "Chaves", data: dataDivulgacaoChaves, texto: "Previsão de divulgação das chaves." },
    { nome: "Cronograma", data: dataDivulgacaoCronograma, texto: "Horários e tatames estimados." },
    { nome: "Evento", data: dataEvento, texto: "Dia oficial do campeonato." },
  ];

  async function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    try {
      setComprimindo(true);
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.4,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: "image/webp",
      });
      setBannerFile(compressedFile);
      setBannerPreview(URL.createObjectURL(compressedFile));
    } catch {
      alert("Não foi possível otimizar a imagem. Tente outro arquivo.");
    } finally {
      setComprimindo(false);
    }
  }

  async function salvarEvento(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    setSucesso(false);

    if (!nome || !cidade || !dataEvento) {
      setErro("Nome, cidade e data do evento são obrigatórios.");
      setSalvando(false);
      return;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Usuário não autenticado.");

      if (editando && eventoId) {
        const [{ count: inscricoes }, { data: lutas }] = await Promise.all([
          supabase.from("inscricoes").select("id", { count: "exact", head: true }).eq("evento_id", eventoId),
          supabase.from("chaves").select("id,status_luta,iniciada_em,vencedor").eq("evento_id", eventoId),
        ]);
        const infantilAtual = {
          lote1_valor_infantil: lote1ValorInfantil === "" ? null : Number(lote1ValorInfantil),
          lote2_valor_infantil: lote2ValorInfantil === "" ? null : Number(lote2ValorInfantil),
          lote3_valor_infantil: lote3ValorInfantil === "" ? null : Number(lote3ValorInfantil),
          valor_absoluto_infantil: valorAbsolutoInfantil === "" ? null : Number(valorAbsolutoInfantil),
          valor_absoluto_avulso: valorAbsolutoAvulso === "" ? null : Number(valorAbsolutoAvulso),
          valor_absoluto_avulso_infantil: valorAbsolutoAvulsoInfantil === "" ? null : Number(valorAbsolutoAvulsoInfantil),
        };
        const alterouInfantilJaDefinido = (Object.keys(infantilAtual) as (keyof typeof infantilAtual)[]).some((campo) => {
          const original = originalRef.current[campo];
          if (original === null || original === undefined || original === "") return false;
          return original !== infantilAtual[campo];
        });
        const tinhaInfantil = ["lote1_valor_infantil", "lote2_valor_infantil", "lote3_valor_infantil", "valor_absoluto_infantil", "valor_absoluto_avulso", "valor_absoluto_avulso_infantil"]
          .some((campo) => originalRef.current[campo] !== null && originalRef.current[campo] !== undefined && originalRef.current[campo] !== "");
        const alterouPrecos = [
          ['lote1_valor', lote1Valor], ['lote2_valor', lote2Valor], ['lote3_valor', lote3Valor],
          ['lote1_data_fim', lote1DataFim], ['lote2_data_fim', lote2DataFim], ['lote3_data_fim', lote3DataFim],
        ].some(([campo, valor]) => originalRef.current[String(campo)] !== valor)
          || alterouInfantilJaDefinido
          || (tinhaInfantil && originalRef.current.idade_max_infantil !== idadeMaxInfantil);
        if ((inscricoes || lutas?.length) && alterouPrecos) throw new Error("Já há inscrições ou chaves. Os preços e prazos dos lotes não podem mais ser alterados; restaure os valores anteriores para salvar as outras informações.");
        if (lutas?.length && originalRef.current.data_evento !== dataEvento) throw new Error("As chaves já foram geradas. A data do evento está bloqueada para preservar o cronograma.");
        if ((lutas || []).some(luta => luta.iniciada_em || luta.vencedor || ['em_andamento', 'concluida'].includes(luta.status_luta)) && originalRef.current.status !== status) {
          throw new Error("As lutas já começaram. A situação manual do evento não pode ser alterada.");
        }
      }

      let finalBannerUrl = bannerAtualUrl;
      let finalRegulamentoUrl = regulamentoAtualUrl;

      if (bannerFile) {
        const fileExt = bannerFile.type.split("/")[1] || "webp";
        const filePath = editando
          ? "banners/banner-" + eventoId + "-" + Date.now() + "." + fileExt
          : "banners/banner-" + Date.now() + "." + fileExt;
        const { error: uploadError } = await supabase.storage.from("eventos").upload(filePath, bannerFile, { upsert: false });
        if (uploadError) throw new Error("Erro no upload do banner: " + uploadError.message);
        finalBannerUrl = supabase.storage.from("eventos").getPublicUrl(filePath).data.publicUrl;
      }

      if (regulamentoFile) {
        const fileExt = regulamentoFile.name.split(".").pop() || "pdf";
        const filePath = editando
          ? "regulamentos/reg-" + eventoId + "-" + Date.now() + "." + fileExt
          : "regulamentos/reg-" + Date.now() + "." + fileExt;
        const { error: uploadError } = await supabase.storage.from("eventos").upload(filePath, regulamentoFile, { upsert: false });
        if (uploadError) throw new Error("Erro no upload do regulamento: " + uploadError.message);
        finalRegulamentoUrl = supabase.storage.from("eventos").getPublicUrl(filePath).data.publicUrl;
      }

      const regrasPontuacaoEquipes: RegrasPontuacao = {
        ouro: pontosEquipeOuro,
        prata: pontosEquipePrata,
        bronze: pontosEquipeBronze,
        vitoria: pontosEquipeVitoria,
        absoluto_pontua: absolutoPontuaEquipe,
        wo_pontua: woPontuaEquipe,
        valor_absoluto: valorAbsoluto,
        idade_max_infantil: idadeMaxInfantil,
      };
      if (lote1ValorInfantil !== "") regrasPontuacaoEquipes.lote1_valor_infantil = Number(lote1ValorInfantil);
      if (lote2ValorInfantil !== "") regrasPontuacaoEquipes.lote2_valor_infantil = Number(lote2ValorInfantil);
      if (lote3ValorInfantil !== "") regrasPontuacaoEquipes.lote3_valor_infantil = Number(lote3ValorInfantil);
      if (valorAbsolutoInfantil !== "") regrasPontuacaoEquipes.valor_absoluto_infantil = Number(valorAbsolutoInfantil);
      if (valorAbsolutoAvulso !== "") regrasPontuacaoEquipes.valor_absoluto_avulso = Number(valorAbsolutoAvulso);
      if (valorAbsolutoAvulsoInfantil !== "") regrasPontuacaoEquipes.valor_absoluto_avulso_infantil = Number(valorAbsolutoAvulsoInfantil);

      const payload = {
        nome,
        descricao: modalidade,
        cidade,
        estado,
        local,
        data_evento: dataEvento,
        status,
        link_inscricao: linkInscricao,
        sobre_evento: sobreEvento,
        valores_lotes: valoresLotes,
        regras_pesagem: regrasPesagem,
        banner_url: finalBannerUrl,
        regulamento_url: finalRegulamentoUrl,
        limite_vagas: limiteVagas,
        lote1_valor: lote1Valor,
        lote1_data_fim: dataHoraLocalParaIso(lote1DataFim, estado),
        lote2_valor: lote2Valor,
        lote2_data_fim: dataHoraLocalParaIso(lote2DataFim, estado),
        lote3_valor: lote3Valor,
        lote3_data_fim: dataHoraLocalParaIso(lote3DataFim, estado),
        data_inicio_inscricoes: dataHoraLocalParaIso(dataInicioInscricoes, estado),
        data_fim_inscricoes: dataHoraLocalParaIso(fimInscricoesFinal, estado),
        data_fim_pagamento: dataHoraLocalParaIso(dataFimPagamento, estado),
        data_inicio_checagem: dataHoraLocalParaIso(dataInicioChecagem, estado),
        data_fim_checagem: dataHoraLocalParaIso(dataFimChecagem, estado),
        data_divulgacao_chaves: dataHoraLocalParaIso(dataDivulgacaoChaves, estado),
        data_divulgacao_cronograma: dataHoraLocalParaIso(dataDivulgacaoCronograma, estado),
        regras_pontuacao_equipes: regrasPontuacaoEquipes,
      };

      let error;
      if (editando && eventoId) {
        const result = await supabase.from("eventos").update(payload).eq("id", eventoId);
        error = result.error;
      } else {
        const result = await supabase.from("eventos").insert([{ ...payload, organizador_id: authData.user.id }]);
        error = result.error;
      }

      if (error && error.message.toLowerCase().includes("regras_pontuacao_equipes")) {
        const payloadSemPontuacao = { ...payload };
        delete (payloadSemPontuacao as { regras_pontuacao_equipes?: unknown }).regras_pontuacao_equipes;

        if (editando && eventoId) {
          const retry = await supabase.from("eventos").update(payloadSemPontuacao).eq("id", eventoId);
          error = retry.error;
        } else {
          const retry = await supabase.from("eventos").insert([{ ...payloadSemPontuacao, organizador_id: authData.user.id }]);
          error = retry.error;
        }
      }

      if (error) throw new Error(error.message);
      setSucesso(true);
      setTimeout(() => router.push("/admin"), 900);
    } catch (err: any) {
      setErro(err.message || "Não foi possível salvar o evento.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregandoInicial) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Carregando evento...</div>;
  }

  const bannerMostrado = bannerPreview || bannerAtualUrl || "/arena.png";

  return (
    <main className="min-h-screen bg-[#050505] px-3 py-4 text-white md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push("/admin")} className="rounded-lg border border-white/10 bg-white/5 p-3 text-zinc-300 hover:bg-white/10" aria-label="Voltar">
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-500">Painel do evento</p>
              <h1 className="text-2xl font-black uppercase tracking-tight md:text-4xl">{editando ? "Editar evento" : "Lançar evento"}</h1>
            </div>
          </div>
          <button form="evento-form" disabled={salvando || comprimindo} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(239,68,68,0.25)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60">
            <Save size={16} />
            {salvando ? "Salvando..." : "Salvar evento"}
          </button>
        </header>
        {editando && trava !== "nenhuma" && <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-100">
          {trava === "inscricoes" ? "Já existem inscrições: preços e datas dos lotes estão protegidos." : trava === "chaves" ? "As chaves foram geradas: preços, lotes e data do evento estão protegidos." : "Lutas iniciadas: preços, lotes, data e situação manual estão protegidos."}
          {' '}Outros dados, como local, descrição, regulamento e banner, ainda podem ser corrigidos.
        </p>}

        {(erro || sucesso || comprimindo) && (
          <div className={"rounded-lg border px-4 py-3 text-sm font-bold " + (erro ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200")}>
            {erro || (comprimindo ? "Otimizando imagem..." : "Evento salvo com sucesso.")}
          </div>
        )}

        <form id="evento-form" onSubmit={salvarEvento} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5">
            <div className={cardClass}>
              <SectionTitle icon={<Info size={16} />} title="Informações gerais" subtitle="Dados que o atleta vê antes de se inscrever." />
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Field label="Nome oficial" className="md:col-span-3"><input required value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} placeholder="Ex: Spartan Open Jiu-Jitsu CJ" /></Field>
                <Field label="Situação manual"><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}><option value="EM BREVE">Em breve</option><option value="ABERTO">Inscrições abertas</option><option value="OFICIAL">Inscrições encerradas</option><option value="ENCERRADO">Encerrado</option></select></Field>
                <p className="md:col-span-4 text-xs text-zinc-400">As datas configuradas controlam automaticamente as inscrições, a checagem e a publicação das chaves. Use “Inscrições encerradas” para fechar manualmente um evento sem data final definida.</p>
                <Field label="Modalidade"><input value={modalidade} onChange={(e) => setModalidade(e.target.value)} className={inputClass} /></Field>
                <Field label="Data do evento"><input required type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} className={inputClass + " [color-scheme:dark]"} /></Field>
                <Field label="Cidade"><input required value={cidade} onChange={(e) => setCidade(e.target.value)} className={inputClass} /></Field>
                <Field label="UF"><input value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2} className={inputClass} /></Field>
                <Field label="Ginásio / local" className="md:col-span-2"><input value={local} onChange={(e) => setLocal(e.target.value)} className={inputClass} placeholder="Local do campeonato" /></Field>
                <Field label="Link externo de inscrição" className="md:col-span-2"><input value={linkInscricao} onChange={(e) => setLinkInscricao(e.target.value)} className={inputClass} placeholder="Use somente se a inscrição não for pelo iTatame" /></Field>
              </div>
            </div>

            <div className={cardClass}>
              <SectionTitle icon={<Users size={16} />} title="Inscrições e lotes" subtitle="Controle de vagas, datas e valores por etapa." />
              <p className="mt-3 text-xs text-cyan-300">Todos os horários abaixo seguem o fuso do evento: {fusoHorarioEvento(estado).replace("America/", "").replaceAll("_", " ")} ({estado || "UF não informada"}).</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Field label="Limite de vagas"><input type="number" min={1} value={limiteVagas} onChange={(e) => setLimiteVagas(Number(e.target.value))} className={inputClass} /></Field>
                <Field label="Início das inscrições"><input type="datetime-local" value={dataInicioInscricoes} onChange={(e) => setDataInicioInscricoes(e.target.value)} className={inputClass + " [color-scheme:dark]"} /></Field>
                <Field label="Fim das inscrições"><input type="datetime-local" value={dataFimInscricoes} onChange={(e) => setDataFimInscricoes(e.target.value)} className={inputClass + " [color-scheme:dark]"} /></Field>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <LoteCard numero="1" valor={lote1Valor} setValor={setLote1Valor} valorInfantil={lote1ValorInfantil} setValorInfantil={setLote1ValorInfantil} dataFim={lote1DataFim} setDataFim={setLote1DataFim} destaque="Promocional" />
                <LoteCard numero="2" valor={lote2Valor} setValor={setLote2Valor} valorInfantil={lote2ValorInfantil} setValorInfantil={setLote2ValorInfantil} dataFim={lote2DataFim} setDataFim={setLote2DataFim} destaque="Intermediário" />
                <LoteCard numero="3" valor={lote3Valor} setValor={setLote3Valor} valorInfantil={lote3ValorInfantil} setValorInfantil={setLote3ValorInfantil} dataFim={lote3DataFim} setDataFim={setLote3DataFim} destaque="Final" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label={`Idade máxima da tarifa infantil`}>
                  <input type="number" min={4} max={17} step="1" value={idadeMaxInfantil} onChange={(e) => setIdadeMaxInfantil(Number(e.target.value) || IDADE_MAX_INFANTIL_PADRAO)} className={inputClass} />
                </Field>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">Deixe o valor infantil em branco para cobrar o mesmo preço do adulto. A tarifa vale até {idadeMaxInfantil} anos na data do evento. O Mercado Pago continua cobrando o valor calculado da inscrição.</p>
              <div className="mt-4 rounded-xl border border-white/10 bg-black p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Extra do Absoluto no combo (adulto)">
                    <input type="number" min={0} step="0.01" value={valorAbsoluto} onChange={(e) => setValorAbsoluto(Number(e.target.value))} className={inputClass} />
                  </Field>
                  <Field label="Extra do combo infantil">
                    <input type="number" min={0} step="0.01" value={valorAbsolutoInfantil} onChange={(e) => setValorAbsolutoInfantil(e.target.value)} placeholder="Igual ao adulto" className={inputClass} />
                  </Field>
                  <Field label="Absoluto sozinho (adulto)">
                    <input type="number" min={0} step="0.01" value={valorAbsolutoAvulso} onChange={(e) => setValorAbsolutoAvulso(e.target.value)} placeholder="Igual ao extra do combo" className={inputClass} />
                  </Field>
                  <Field label="Absoluto sozinho infantil">
                    <input type="number" min={0} step="0.01" value={valorAbsolutoAvulsoInfantil} onChange={(e) => setValorAbsolutoAvulsoInfantil(e.target.value)} placeholder="Igual ao sozinho adulto" className={inputClass} />
                  </Field>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">Peso cobra o lote. Absoluto sozinho cobra o valor avulso — use para mirim sem categoria de peso. O combo soma o lote + o extra, mais barato que comprar os dois separados. Em branco, o sozinho usa o mesmo valor do extra.</p>
                <p className="mt-2 text-xs font-bold text-zinc-500">Prévia extra combo: <span className="text-white">{dinheiro(valorAbsoluto)}</span>{valorAbsolutoInfantil !== "" ? <> · infantil: <span className="text-white">{dinheiro(Number(valorAbsolutoInfantil))}</span></> : null} · sozinho: <span className="text-white">{dinheiro(valorAbsolutoAvulso === "" ? valorAbsoluto : Number(valorAbsolutoAvulso))}</span></p>
              </div>
            </div>

            <div className={cardClass}>
              <SectionTitle icon={<CalendarDays size={16} />} title="Fases e checagem" subtitle="A lista de inscritos fica pública desde as inscrições. As datas de checagem liberam só a troca de categoria." />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label="Fim do pagamento"><input type="datetime-local" value={dataFimPagamento} onChange={(e) => setDataFimPagamento(e.target.value)} className={inputClass + " [color-scheme:dark]"} /></Field>
                <Field label="Início da checagem"><input type="datetime-local" value={dataInicioChecagem} onChange={(e) => setDataInicioChecagem(e.target.value)} className={inputClass + " [color-scheme:dark]"} /></Field>
                <Field label="Fim da checagem"><input type="datetime-local" value={dataFimChecagem} onChange={(e) => setDataFimChecagem(e.target.value)} className={inputClass + " [color-scheme:dark]"} /></Field>
                <Field label="Divulgação das chaves"><input type="datetime-local" value={dataDivulgacaoChaves} onChange={(e) => setDataDivulgacaoChaves(e.target.value)} className={inputClass + " [color-scheme:dark]"} /></Field>
                <Field label="Divulgação do cronograma"><input type="datetime-local" value={dataDivulgacaoCronograma} onChange={(e) => setDataDivulgacaoCronograma(e.target.value)} className={inputClass + " [color-scheme:dark]"} /></Field>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-zinc-500">A checagem (lista de atletas, equipes e professores) já aparece no evento enquanto as inscrições estão abertas. Início e fim da checagem controlam apenas o período em que o atleta pode corrigir peso e categoria no perfil. Deixe um intervalo depois desse fim até a divulgação das chaves; na hora da divulgação o sistema gera as chaves se inscrições e correções já tiverem encerrado.</p>
            </div>

            <div className={cardClass}>
              <SectionTitle icon={<Trophy size={16} />} title="Regras editáveis" subtitle="Pontuação por equipe e observações oficiais do organizador." />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <NumberField label="Ouro" value={pontosEquipeOuro} onChange={setPontosEquipeOuro} />
                <NumberField label="Prata" value={pontosEquipePrata} onChange={setPontosEquipePrata} />
                <NumberField label="Bronze" value={pontosEquipeBronze} onChange={setPontosEquipeBronze} />
                <NumberField label="Vitória" value={pontosEquipeVitoria} onChange={setPontosEquipeVitoria} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Toggle checked={absolutoPontuaEquipe} onChange={setAbsolutoPontuaEquipe} title="Absoluto pontua por equipe" text="Use somente quando o edital permitir." />
                <Toggle checked={woPontuaEquipe} onChange={setWoPontuaEquipe} title="W.O. soma vitória" text="Define se vitória por W.O. entra na pontuação." />
              </div>
            </div>

            <div className={cardClass}>
              <SectionTitle icon={<FileText size={16} />} title="Textos oficiais" subtitle="Conteúdo que aparece no painel público do evento." />
              <div className="mt-4 grid gap-3">
                <Field label="Resumo do evento"><textarea value={sobreEvento} onChange={(e) => setSobreEvento(e.target.value)} className={inputClass + " min-h-28 resize-y"} placeholder="Organização, endereço, premiação, horário de abertura..." /></Field>
                <Field label="Valores, pacotes e observações"><textarea value={valoresLotes} onChange={(e) => setValoresLotes(e.target.value)} className={inputClass + " min-h-24 resize-y"} placeholder="Ex: Peso, peso + absoluto, descontos por lote..." /></Field>
                <Field label="Regras de pesagem"><textarea value={regrasPesagem} onChange={(e) => setRegrasPesagem(e.target.value)} className={inputClass + " min-h-24 resize-y"} placeholder="Informe tolerância, documentos, kimono, horários e penalidades." /></Field>
              </div>
            </div>

            <div className={cardClass}>
              <SectionTitle icon={<ImagePlus size={16} />} title="Arquivos" subtitle="Banner do evento e regulamento em PDF." />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label="Banner"><input type="file" accept="image/*" onChange={handleBannerChange} className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-widest file:text-black" /></Field>
                <Field label="Regulamento"><input type="file" accept="application/pdf" onChange={(e) => setRegulamentoFile(e.target.files?.[0] || null)} className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-widest file:text-black" /></Field>
              </div>
              {regulamentoAtualUrl && <a href={regulamentoAtualUrl} target="_blank" className="mt-3 inline-flex text-xs font-bold text-cyan-300 hover:text-cyan-200">Regulamento atual cadastrado</a>}
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0f]">
              <div className="aspect-[16/10] bg-black"><img src={bannerMostrado} alt="Prévia do banner" className="h-full w-full object-cover" /></div>
              <div className="space-y-3 p-4">
                <span className="inline-flex rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-red-200">{status}</span>
                <h2 className="text-xl font-black uppercase leading-tight">{nome || "Nome do evento"}</h2>
                <div className="space-y-2 text-sm text-zinc-300">
                  <p className="flex items-center gap-2"><MapPin size={15} className="text-red-500" />{cidade || "Cidade"} - {estado || "UF"}</p>
                  <p className="flex items-center gap-2"><CalendarDays size={15} className="text-red-500" />{formatarData(dataEvento)}</p>
                  <p className="flex items-center gap-2"><Users size={15} className="text-red-500" />{limiteVagas || 0} vagas</p>
                </div>
              </div>
            </div>

            <div className={cardClass}>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-white">Linha do tempo</h3>
              <div className="space-y-3">
                {fases.map((fase) => (
                  <div key={fase.nome} className="flex gap-3 rounded-lg border border-white/10 bg-black p-3">
                    <CheckCircle2 size={17} className={fase.data ? "mt-0.5 shrink-0 text-emerald-400" : "mt-0.5 shrink-0 text-zinc-600"} />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-white">{fase.nome}</p>
                      <p className="text-xs text-zinc-400">{fase.data ? formatarData(fase.data) : "A definir"}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">{fase.texto}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={cardClass}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-white"><Medal size={16} className="text-yellow-400" /> Pontuação</h3>
              <div className="grid grid-cols-4 gap-2 text-center">
                <Score label="Ouro" value={pontosEquipeOuro} />
                <Score label="Prata" value={pontosEquipePrata} />
                <Score label="Bronze" value={pontosEquipeBronze} />
                <Score label="Vitória" value={pontosEquipeVitoria} />
              </div>
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-400">{icon}</div>
      <div>
        <h2 className="text-base font-black uppercase tracking-tight text-white md:text-lg">{title}</h2>
        <p className="text-xs leading-relaxed text-zinc-500">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={className}><span className={labelClass}>{label}</span>{children}</label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label}><input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputClass} /></Field>;
}

function LoteCard({ numero, destaque, valor, setValor, valorInfantil, setValorInfantil, dataFim, setDataFim }: { numero: string; destaque: string; valor: number; setValor: (value: number) => void; valorInfantil: string; setValorInfantil: (value: string) => void; dataFim: string; setDataFim: (value: string) => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white">{numero}º lote</h3>
        <span className="rounded border border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-zinc-500">{destaque}</span>
      </div>
      <div className="grid gap-3">
        <Field label="Valor adulto"><input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(Number(e.target.value))} className={inputClass} /></Field>
        <Field label="Valor infantil"><input type="number" min={0} step="0.01" value={valorInfantil} onChange={(e) => setValorInfantil(e.target.value)} placeholder="Igual ao adulto" className={inputClass} /></Field>
        <Field label="Término"><input type="datetime-local" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className={inputClass + " [color-scheme:dark]"} /></Field>
      </div>
      <p className="mt-3 text-xs font-bold text-zinc-500">Prévia adulto: <span className="text-white">{dinheiro(valor)}</span>{valorInfantil !== "" ? <> · infantil: <span className="text-white">{dinheiro(Number(valorInfantil))}</span></> : null}</p>
    </div>
  );
}

function Toggle({ checked, onChange, title, text }: { checked: boolean; onChange: (value: boolean) => void; title: string; text: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={"rounded-xl border p-4 text-left transition " + (checked ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-black hover:bg-white/5")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.12em] text-white">{title}</p>
          <p className="mt-1 text-xs text-zinc-500">{text}</p>
        </div>
        <ShieldCheck size={20} className={checked ? "text-emerald-400" : "text-zinc-600"} />
      </div>
    </button>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-white/10 bg-black p-2"><p className="text-lg font-black text-white">{value}</p><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</p></div>;
}
