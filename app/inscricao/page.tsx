"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "../lib/supabase"; 
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function FormularioInscricao() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventoId = searchParams.get("evento");

  const [eventoNome, setEventoNome] = useState("");
  const [valorLoteAtual, setValorLoteAtual] = useState<number>(0);
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
  const [inscricoesEncerradas, setInscricoesEncerradas] = useState(false);
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

  const [inscricaoFeita, setInscricaoFeita] = useState(false);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState(false);

  const perfilIncompleto = !nome || !equipe || !faixa || !atletaId;

  function calcularCategoria(peso: number) {
    if (peso <= 64.5) return "Pluma (Até 64.500 kg)";
    if (peso <= 72.5) return "Leve (Até 72.500 kg)";
    if (peso <= 80) return "Meio Pesado (Até 80.000 kg)";
    if (peso <= 85.5) return "Super Pesado (Até 85.500 kg)";
    return "Pesadíssimo (Acima de 85.5 kg)";
  }

  useEffect(() => {
    async function carregarAmbiente() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { 
        router.push(`/login?redirect=/inscricao?evento=${eventoId}`);
        return; 
      }

      setUserId(authData.user.id);
      setEmailAtleta(authData.user.email || "");

      if (eventoId) {
        const { data: ev } = await supabase.from("eventos").select("*").eq("id", eventoId).single();
        if (ev) {
          setEventoNome(ev.nome);
          const dataFimInscricoes = ev.data_fim_inscricoes || ev.lote3_data_fim || ev.lote2_data_fim || ev.lote1_data_fim;
          if (dataFimInscricoes && new Date() > new Date(dataFimInscricoes)) {
            setInscricoesEncerradas(true);
          }
          
          const agora = new Date();
          let valor = 0;
          let nomeLote = "Inscrições Encerradas";

          if (ev.lote1_data_fim && agora <= new Date(ev.lote1_data_fim)) {
            valor = Number(ev.lote1_valor);
            nomeLote = "1º Lote";
          } else if (ev.lote2_data_fim && agora <= new Date(ev.lote2_data_fim)) {
            valor = Number(ev.lote2_valor);
            nomeLote = "2º Lote";
          } else if (ev.lote3_data_fim && agora <= new Date(ev.lote3_data_fim)) {
            valor = Number(ev.lote3_valor);
            nomeLote = "3º Lote";
          } else {
            valor = Number(ev.lote3_valor) || Number(ev.lote2_valor) || Number(ev.lote1_valor) || 0;
            nomeLote = "Lote Final";
          }

          setValorLoteAtual(valor);
          setNomeLoteAtual(nomeLote);
        }
      }

      const { data: atleta, error } = await supabase.from("atletas").select("*").eq("user_id", authData.user.id).single();
      
      if (!error && atleta) {
        setAtletaId(atleta.id);
        setNome(atleta.nome || "");
        setEquipe(atleta.equipe || "");
        setProfessor(atleta.professor || "");
        setFaixa(atleta.faixa || "");
        setPesoReal(atleta.peso || "");
        setSexo(atleta.sexo || "Masculino"); 
        setCategoria(calcularCategoria(Number(atleta.peso)));
        setModalidade(atleta.modalidade || "");
        setFotoUrl(atleta.foto_url || "");
        setCpfAtleta(atleta.cpf || "");
}
      
      setLoading(false);
    }
    carregarAmbiente();
  }, [eventoId, router]);

  const valorBase = (tipoInscricao === "ambos") ? valorLoteAtual + 50.00 : valorLoteAtual;
  const valorTotal = Math.max(0, valorBase - desconto);
  const isGratis = valorLoteAtual === 0;

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
      setCupomMensagem("Cupom inválido para este evento.");
      return;
    }

    if (cupomData.usos_atualmente >= cupomData.limite_usos) {
      setDesconto(0);
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
  }

  async function finalizarInscricao() {
    setProcessando(true);
    setErro("");

    if (perfilIncompleto) {
      setErro("Seu perfil está incompleto. Atualize seu cadastro antes de prosseguir.");
      setProcessando(false);
      return;
    }

    if (inscricoesEncerradas) {
      setErro("As inscrições deste evento já foram encerradas pelo organizador.");
      setProcessando(false);
      return;
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

    if (!idade || !categoria) {
      setErro("Por favor, preencha sua idade e categoria.");
      setProcessando(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const usuarioAtualId = data.user?.id || userId;

    const { data: inscricaoExistente } = await supabase
      .from("inscricoes")
      .select("id")
      .eq("evento_id", eventoId)
      .or(`user_id.eq.${usuarioAtualId},atleta_id.eq.${atletaId || 0}`);

    if (inscricaoExistente && inscricaoExistente.length > 0) {
      setErro("Você já possui uma inscrição registrada para este campeonato.");
      setProcessando(false);
      return;
    }

    if (cpfAtleta) {
      const { data: atletasMesmoCpf } = await supabase
        .from("atletas")
        .select("id")
        .eq("cpf", cpfAtleta);

      const idsMesmoCpf = (atletasMesmoCpf || []).map((atleta) => atleta.id).filter(Boolean);
      if (idsMesmoCpf.length > 0) {
        const { data: inscricaoMesmoCpf } = await supabase
          .from("inscricoes")
          .select("id")
          .eq("evento_id", eventoId)
          .in("atleta_id", idsMesmoCpf);

        if (inscricaoMesmoCpf && inscricaoMesmoCpf.length > 0) {
          setErro("Já existe inscrição neste evento para este CPF.");
          setProcessando(false);
          return;
        }
      }
    }

    if (emailAtleta) {
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

    const isLiberado = valorTotal === 0;
    const inscricaoParaSalvar = {
      user_id: usuarioAtualId,
      atleta_id: atletaId,
      atleta: nome,
      equipe,
      faixa,
      sexo,
      categoria,
      absoluto: tipoInscricao === "ambos",
      idade,
      observacoes,
      peso: pesoReal,
      evento_id: eventoId,
      pagamento_ok: isLiberado,
      cpf: cpfAtleta || null,
      email: emailAtleta || null
    };

    let { error } = await supabase.from("inscricoes").insert([inscricaoParaSalvar]);

    if (error && (error.message.toLowerCase().includes("cpf") || error.message.toLowerCase().includes("email"))) {
      const { cpf, email, ...payloadSemCamposNovos } = inscricaoParaSalvar;
      const retry = await supabase.from("inscricoes").insert([payloadSemCamposNovos]);
      error = retry.error;
    }

    if (error) {
      setErro("Erro ao registrar: " + error.message);
      setProcessando(false);
      return;
    }

    if (desconto > 0 && cupom) {
      const { data: cupomData } = await supabase
        .from("cupons")
        .select("id, usos_atualmente")
        .eq("codigo", cupom.trim().toUpperCase())
        .eq("evento_id", eventoId)
        .maybeSingle();

      if (cupomData) {
        await supabase
          .from("cupons")
          .update({ usos_atualmente: (cupomData.usos_atualmente || 0) + 1 })
          .eq("id", cupomData.id);
      }
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
          <Link href={`/ingresso/${eventoId}/${userId}`} className="cursor-pointer inline-block bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest text-xs px-8 py-3.5 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all">
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
              <p className="text-red-100/70 text-xs">O organizador encerrou o período de inscrições deste evento.</p>
            </div>
          )}

          {perfilIncompleto && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-yellow-500 font-bold text-xs uppercase tracking-widest mb-1">Perfil Incompleto</p>
              <p className="text-yellow-200/70 text-xs">Faltam dados obrigatórios no seu cadastro. <Link href="/perfil" className="underline font-bold text-yellow-400">Clique aqui para Editar</Link></p>
            </div>
          )}

          {/* CREDENCIAL */}
          <section className="bg-[#0a0a0e] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
            <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-5">Credencial do Atleta</h2>
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
                <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1.5">Sua Idade</label>
                <input type="number" placeholder="Ex: 28" value={idade} onChange={(e) => setIdade(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs" />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1.5">Sexo Competitivo</label>
                <input type="text" value={sexo} disabled className="w-full bg-black/30 border border-transparent rounded-lg px-3 py-2.5 text-zinc-500 text-xs cursor-not-allowed" />
              </div>
            </div>
            <div>
                <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1.5">Categoria de Peso Oficial</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs appearance-none">
                  <option value="Pluma (Até 64.500 kg)">Pluma (Até 64.500 kg)</option>
                  <option value="Leve (Até 72.500 kg)">Leve (Até 72.500 kg)</option>
                  <option value="Meio Pesado (Até 80.000 kg)">Meio Pesado (Até 80.000 kg)</option>
                  <option value="Super Pesado (Até 85.500 kg)">Super Pesado (Até 85.500 kg)</option>
                  <option value="Pesadíssimo (Acima de 85.5 kg)">Pesadíssimo (Acima de 85.5 kg)</option>
                </select>
              </div>
          </section>

          {/* PACOTE */}
          <section className="bg-[#0a0a0e] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl">
            <h2 className="text-xs font-black text-white uppercase tracking-widest mb-2">Escolha seu Pacote</h2>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-5">Modalidade: <strong className="text-white">{nomeLoteAtual}</strong></p>
            
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
                  <span className="font-black text-sm">{isGratis ? "GRÁTIS" : `R$ ${(valorLoteAtual + 50).toFixed(2)}`}</span>
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
              <div className="flex justify-between"><span className="text-zinc-400">Inscrição Campeonato</span><span className="text-white font-bold">{isGratis ? "R$ 0,00" : `R$ ${valorLoteAtual.toFixed(2)}`}</span></div>
              {tipoInscricao === 'ambos' && <div className="flex justify-between"><span className="text-zinc-400">Add-on: Absoluto</span><span className="text-white font-bold">R$ 50,00</span></div>}
              {desconto > 0 && <div className="flex justify-between text-green-400"><span className="font-bold">Desconto Validado</span><span className="font-bold">- R$ {desconto.toFixed(2)}</span></div>}
            </div>

            {/* AREA CUPOM DO BANCO */}
            {!isGratis && (
              <div className="border-t border-white/10 pt-4 mb-5">
                <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-2">Cupom de Parceria / Cortesia</label>
                <div className="flex gap-2">
                  <input type="text" value={cupom} onChange={(e) => setCupom(e.target.value.toUpperCase())} placeholder="DIGITE O CÓDIGO" className="w-full bg-black border border-white/10 outline-none rounded-lg px-3 py-2 text-white text-xs uppercase" />
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

            <button disabled={processando || perfilIncompleto || !categoria || !termoAceito || inscricoesEncerradas} className="cursor-pointer w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-[11px] py-4 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all disabled:opacity-50 flex items-center justify-center" onClick={finalizarInscricao}>
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