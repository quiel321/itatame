"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "../lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function FormularioInscricao() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventoId = searchParams.get("evento");

  // Estados do Evento e Loading
  const [eventoNome, setEventoNome] = useState("");
  const [loading, setLoading] = useState(true);

  // Estados do Atleta
  const [nome, setNome] = useState("");
  const [equipe, setEquipe] = useState("");
  const [professor, setProfessor] = useState("");
  const [faixa, setFaixa] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [pesoReal, setPesoReal] = useState("");
  const [sexo, setSexo] = useState("Masculino");
  const [fotoUrl, setFotoUrl] = useState(""); // NOVO: Estado para a foto
  
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

  // Feedbacks
  const [inscricaoFeita, setInscricaoFeita] = useState(false);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState(false);

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

      if (eventoId) {
        const { data: ev } = await supabase.from("eventos").select("nome").eq("id", eventoId).single();
        if (ev) setEventoNome(ev.nome);
      }

      const { data: atleta, error } = await supabase.from("atletas").select("*").eq("user_id", authData.user.id).single();
      
      if (error) { 
        console.log(error); 
      } else if (atleta) {
        setNome(atleta.nome || "");
        setEquipe(atleta.equipe || "");
        setProfessor(atleta.professor || "");
        setFaixa(atleta.faixa || "");
        setPesoReal(atleta.peso || "");
        setSexo(atleta.sexo || "Masculino"); 
        setCategoria(calcularCategoria(Number(atleta.peso)));
        setModalidade(atleta.modalidade || "");
        setFotoUrl(atleta.foto_url || ""); // NOVO: Puxando do banco
      }
      
      setLoading(false);
    }
    carregarAmbiente();
  }, [eventoId, router]);

  function aplicarCupom() {
    if (cupom === "ITATAME10") {
      setDesconto(10.00);
      setCupomMensagem("Cupom aplicado: -R$ 10,00");
    } else if (cupom.length > 0) {
      setDesconto(0);
      setCupomMensagem("Cupom inválido ou expirado.");
    } else {
      setDesconto(0);
      setCupomMensagem("");
    }
  }

  async function finalizarInscricao() {
    setProcessando(true);
    setErro("");
    
    if (!termoAceito) {
      setErro("Você precisa aceitar os termos do evento.");
      setProcessando(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    
    if (!idade || (tipoInscricao !== "absoluto" && !categoria)) {
      setErro("Por favor, preencha sua Idade e Categoria.");
      setProcessando(false);
      return;
    }

    const vaiLutarAbsoluto = tipoInscricao === "absoluto" || tipoInscricao === "ambos";
    const categoriaFinal = tipoInscricao === "absoluto" ? "Absoluto" : categoria;

    const { error } = await supabase
      .from("inscricoes")
      .insert([{
          user_id: user?.id,
          atleta: nome,
          equipe,
          faixa,
          sexo, 
          categoria: categoriaFinal, 
          absoluto: vaiLutarAbsoluto, 
          idade,
          observacoes,
          peso: pesoReal,
          evento_id: eventoId,
      }]);

    if (error) { 
      setErro(error.message); 
      setProcessando(false);
      return; 
    }
    
    setErro("");
    setInscricaoFeita(true);
    setProcessando(false);
  }

  const precos = {
    peso: 90.00,
    absoluto: 90.00,
    ambos: 140.00
  };
  const valorBase = precos[tipoInscricao as keyof typeof precos];
  const valorTotal = Math.max(0, valorBase - desconto);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-[10px]">
        Preparando credencial...
      </div>
    );
  }

  if (inscricaoFeita) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 bg-[#0a0a0e] border border-green-500/30 rounded-2xl text-center shadow-[0_0_40px_rgba(34,197,94,0.1)]">
        <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl">✓</div>
        <h2 className="text-2xl font-black text-white mb-3">Inscrição Confirmada!</h2>
        <p className="text-zinc-400 text-xs mb-8 font-medium">Dados enviados. Realize o pagamento para garantir seu nome nas chaves.</p>
        <Link href={`/pagamento`} className="inline-block bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-xs px-8 py-3.5 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all">
          Ir para Pagamento
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      
      {/* CABEÇALHO */}
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-2xl md:text-3xl font-black text-white mb-1 tracking-tight">Finalizar Inscrição</h1>
        <p className="text-zinc-400 text-xs font-medium flex items-center justify-center md:justify-start gap-1.5">
          <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>
          {eventoNome || "Carregando evento..."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: Dados e Formulário */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* PASSO 1: DADOS CADASTRAIS (ATUALIZADO COM FOTO) */}
          <section className="bg-[#0a0a0e] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
            
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">1</span>
                Credencial do Atleta
              </h2>
              <Link href="/perfil" className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-red-500 transition-colors underline decoration-white/20 underline-offset-4">Editar</Link>
            </div>
            
            {/* CONTAINER FLEX: FOTO + GRADE DE DADOS */}
            <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start bg-black/40 p-4 md:p-5 rounded-xl border border-white/5">
              
              {/* ÁREA DA FOTO */}
              <div className="shrink-0">
                {fotoUrl ? (
                  <img 
                    src={fotoUrl} 
                    alt={`Foto de ${nome}`} 
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-2 border-white/10 shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-zinc-900 border-2 border-white/10 flex items-center justify-center text-zinc-600 shadow-lg">
                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  </div>
                )}
              </div>

              {/* ÁREA DE DADOS */}
              <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-4">
                <div className="col-span-2 md:col-span-1">
                  <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Nome</p>
                  <p className="text-white font-bold text-xs truncate">{nome || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Equipe</p>
                  <p className="text-white font-bold text-xs truncate">{equipe || "Sem equipe"}</p>
                </div>
                <div>
                  <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Professor</p>
                  <p className="text-white font-bold text-xs truncate">{professor || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Faixa</p>
                  <p className="text-white font-bold text-xs">{faixa || "Branca"}</p>
                </div>
                <div>
                  <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Peso Oficial</p>
                  <p className="text-white font-bold text-xs">{pesoReal ? `${pesoReal} kg` : "0 kg"}</p>
                </div>
                <div>
                  <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Sexo</p>
                  <p className="text-white font-bold text-xs">{sexo}</p>
                </div>
              </div>
            </div>

          </section>

          {/* PASSO 2: ENCAIXE NA CHAVE */}
          <section className="bg-[#0a0a0e] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl">
            <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-5">
              <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">2</span>
              Encaixe na Chave
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1.5">Sua Idade</label>
                <input type="number" placeholder="Ex: 28" value={idade} onChange={(e) => setIdade(e.target.value)} className="w-full bg-black border border-white/10 focus:border-red-500/50 outline-none rounded-lg px-3 py-2.5 text-white text-xs transition-colors" />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1.5">Sexo Competitivo</label>
                <select value={sexo} onChange={(e) => setSexo(e.target.value)} className="w-full bg-black border border-white/10 focus:border-red-500/50 outline-none rounded-lg px-3 py-2.5 text-white text-xs transition-colors appearance-none">
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                </select>
              </div>
            </div>
            {tipoInscricao !== "absoluto" && (
              <div>
                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1.5">Categoria de Peso Oficial</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full bg-black border border-white/10 focus:border-red-500/50 outline-none rounded-lg px-3 py-2.5 text-white text-xs transition-colors appearance-none">
                  <option value="">Selecione a categoria exata...</option>
                  <option value="Pluma (Até 64.500 kg)">Pluma (Até 64.500 kg)</option>
                  <option value="Leve (Até 72.500 kg)">Leve (Até 72.500 kg)</option>
                  <option value="Meio Pesado (Até 80.000 kg)">Meio Pesado (Até 80.000 kg)</option>
                  <option value="Super Pesado (Até 85.500 kg)">Super Pesado (Até 85.500 kg)</option>
                  <option value="Pesadíssimo (Acima de 85.5 kg)">Pesadíssimo (Acima de 85.5 kg)</option>
                </select>
              </div>
            )}
          </section>

          {/* PASSO 3: PACOTE DE INSCRIÇÃO */}
          <section className="bg-[#0a0a0e] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl">
            <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-5">
              <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">3</span>
              Pacote
            </h2>
            <div className="space-y-2.5">
              <label className={`block relative p-3 md:p-4 rounded-xl border cursor-pointer transition-all ${tipoInscricao === 'peso' ? 'border-red-500 bg-red-500/5' : 'border-white/5 bg-black hover:border-white/20'}`}>
                <input type="radio" name="tipoInscricao" value="peso" checked={tipoInscricao === 'peso'} onChange={() => setTipoInscricao('peso')} className="absolute opacity-0 w-0 h-0" />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${tipoInscricao === 'peso' ? 'border-red-500' : 'border-zinc-600'}`}>
                      {tipoInscricao === 'peso' && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                    </div>
                    <div>
                      <h3 className={`font-bold text-xs ${tipoInscricao === 'peso' ? 'text-white' : 'text-zinc-400'}`}>Categoria de Peso</h3>
                    </div>
                  </div>
                  <span className={`font-black text-sm ${tipoInscricao === 'peso' ? 'text-red-400' : 'text-zinc-500'}`}>R$ 90</span>
                </div>
              </label>

              <label className={`block relative p-3 md:p-4 rounded-xl border cursor-pointer transition-all ${tipoInscricao === 'absoluto' ? 'border-red-500 bg-red-500/5' : 'border-white/5 bg-black hover:border-white/20'}`}>
                <input type="radio" name="tipoInscricao" value="absoluto" checked={tipoInscricao === 'absoluto'} onChange={() => setTipoInscricao('absoluto')} className="absolute opacity-0 w-0 h-0" />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${tipoInscricao === 'absoluto' ? 'border-red-500' : 'border-zinc-600'}`}>
                      {tipoInscricao === 'absoluto' && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                    </div>
                    <div>
                      <h3 className={`font-bold text-xs ${tipoInscricao === 'absoluto' ? 'text-white' : 'text-zinc-400'}`}>Apenas Absoluto</h3>
                    </div>
                  </div>
                  <span className={`font-black text-sm ${tipoInscricao === 'absoluto' ? 'text-red-400' : 'text-zinc-500'}`}>R$ 90</span>
                </div>
              </label>

              <label className={`block relative p-3 md:p-4 rounded-xl border cursor-pointer transition-all ${tipoInscricao === 'ambos' ? 'border-red-500 bg-red-500/5' : 'border-white/5 bg-black hover:border-white/20'}`}>
                <input type="radio" name="tipoInscricao" value="ambos" checked={tipoInscricao === 'ambos'} onChange={() => setTipoInscricao('ambos')} className="absolute opacity-0 w-0 h-0" />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${tipoInscricao === 'ambos' ? 'border-red-500' : 'border-zinc-600'}`}>
                      {tipoInscricao === 'ambos' && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-bold text-xs ${tipoInscricao === 'ambos' ? 'text-white' : 'text-zinc-400'}`}>Peso + Absoluto</h3>
                        <span className="hidden sm:inline-block bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase px-2 py-0.5 rounded">Recomendado</span>
                      </div>
                    </div>
                  </div>
                  <span className={`font-black text-sm ${tipoInscricao === 'ambos' ? 'text-red-400' : 'text-zinc-500'}`}>R$ 140</span>
                </div>
              </label>
            </div>
          </section>

          {/* PASSO 4: TERMOS DE ACEITE */}
          <section className="bg-[#0a0a0e] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl">
            <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4">
              <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">4</span>
              Termos de Aceite
            </h2>
            <div className="bg-black/50 border border-white/5 p-4 rounded-xl text-[10px] text-zinc-400 space-y-2 mb-4 h-24 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700">
              <p>• Declaro estar em perfeitas condições físicas e de saúde para participar deste evento.</p>
              <p>• Estou ciente de que a modalidade é um esporte de contato e assumo os riscos inerentes.</p>
              <p>• Autorizo o uso da minha imagem (fotos e vídeos) para fins de divulgação do evento e da plataforma iTATAME.</p>
              <p>• O pagamento da inscrição não é reembolsável em caso de desistência ou não comparecimento.</p>
              <p>• Concordo com todas as regras de pesagem e diretrizes estabelecidas no edital oficial da competição.</p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-white/5 bg-black hover:bg-white/5 transition-colors">
              <input type="checkbox" checked={termoAceito} onChange={(e) => setTermoAceito(e.target.checked)} className="mt-0.5 w-4 h-4 accent-red-600 rounded cursor-pointer" />
              <span className="text-xs text-white font-bold leading-tight mt-0.5">Declaro que li e concordo com os termos de responsabilidade e o edital do evento.</span>
            </label>
          </section>

        </div>

        {/* COLUNA DIREITA: Resumo e Checkout (Sticky) */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 bg-[#0a0a0e] border border-white/10 rounded-2xl p-5 md:p-6 shadow-2xl">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-5 border-b border-white/5 pb-3">
              Resumo da Compra
            </h3>
            
            <div className="space-y-3 mb-5">
              <div className="flex justify-between items-start text-xs">
                <span className="text-zinc-400 font-medium">Inscrição Evento</span>
                <span className="text-white font-bold">R$ 90,00</span>
              </div>
              
              {tipoInscricao === 'ambos' && (
                <div className="flex justify-between items-start text-xs">
                  <span className="text-zinc-400 font-medium">Add-on: Absoluto</span>
                  <span className="text-white font-bold">R$ 50,00</span>
                </div>
              )}

              {desconto > 0 && (
                <div className="flex justify-between items-start text-xs text-green-400">
                  <span className="font-bold">Desconto Aplicado</span>
                  <span className="font-bold">- R$ {desconto.toFixed(2).replace('.', ',')}</span>
                </div>
              )}
            </div>

            {/* SEÇÃO DO CUPOM */}
            <div className="border-t border-white/10 pt-4 mb-5">
              <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-2">Possui Cupom?</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={cupom} 
                  onChange={(e) => setCupom(e.target.value.toUpperCase())} 
                  placeholder="DIGITE O CÓDIGO" 
                  className="w-full bg-black border border-white/10 outline-none rounded-lg px-3 py-2.5 text-white text-xs uppercase" 
                />
                <button 
                  onClick={aplicarCupom} 
                  className="bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold uppercase tracking-widest px-4 rounded-lg transition-colors"
                >
                  Aplicar
                </button>
              </div>
              {cupomMensagem && (
                <p className={`text-[10px] mt-2 font-bold ${desconto > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {cupomMensagem}
                </p>
              )}
            </div>

            <div className="border-t border-white/10 pt-4 mb-6 flex justify-between items-end">
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Total</span>
              <span className="text-2xl font-black text-red-500">R$ {valorTotal.toFixed(2).replace('.', ',')}</span>
            </div>

            {erro && <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-lg p-3 text-center font-bold">❌ {erro}</div>}

            <button 
              disabled={processando || (tipoInscricao !== 'absoluto' && !categoria) || !termoAceito}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-[11px] py-4 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={finalizarInscricao}
            >
              {processando ? "Processando..." : "Confirmar Inscrição"}
            </button>

            <div className="mt-5 flex flex-col items-center justify-center gap-1 opacity-50">
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-zinc-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Ambiente 100% Seguro</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function PageInscricao() {
  return (
    <main className="min-h-screen bg-[#050505]">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-[10px]">
          Carregando módulo...
        </div>
      }>
        <FormularioInscricao />
      </Suspense>
    </main>
  );
}