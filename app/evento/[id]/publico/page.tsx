"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/app/lib/supabase"
import Link from "next/link"
import { Clock } from "lucide-react"

const formatarHorarioEstimado = (isoString: string | null) => {
  if (!isoString) return '';
  const data = new Date(isoString);
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// 🔥 COMPONENTES DE DESENHO DA ÁRVORE (Mantidos Inalterados)
function Atleta({ nome, equipe, numero, foto, reverso = false, centralizado = false, ocultarLinha = false, larguraClass = "w-[100px] md:w-[140px]", campeao = false, horario, status, tatame }: any) {
  const isBye = !nome || ["BYE", "TBD"].includes(nome.toString().trim().toUpperCase()) || nome.toString().trim().toUpperCase().includes("SEM OPONENTE");
  const nomeExibicao = isBye ? "" : nome;
  const equipeExibicao = isBye ? "" : equipe;

  if (campeao) {
    return (
      <div className="relative flex flex-col items-center justify-center gap-1.5 w-full py-2">
        <div className="w-[50px] h-[50px] md:w-[70px] md:h-[70px] rounded-full border-[3px] border-yellow-500 overflow-hidden flex items-center justify-center bg-black shrink-0 shadow-[0_0_20px_rgba(234,179,8,0.5)]">
          {foto && !isBye ? <img src={foto} alt={nomeExibicao} className="w-full h-full object-cover" /> : <svg className="w-6 h-6 md:w-10 md:h-10 text-yellow-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>}
        </div>
        <span className="text-yellow-500 text-[10px] md:text-[12px] font-black uppercase text-center w-full drop-shadow-[0_0_10px_rgba(234,179,8,0.6)] truncate px-1">
          {nomeExibicao || "A DEFINIR"}
        </span>
        <span className="text-yellow-600/80 text-[9px] md:text-[11px] font-bold uppercase text-center w-full truncate px-1">{equipeExibicao}</span>
      </div>
    )
  }

  return (
    <div className={`relative h-[60px] flex-shrink-0 ${larguraClass} group`}>
      {!centralizado && (
        <div className={`hidden md:flex absolute top-[12px] w-[36px] h-[36px] rounded-full bg-[#0a0a0e] border border-zinc-700 overflow-hidden items-center justify-center z-10 transition-transform group-hover:scale-110 group-hover:border-cyan-500/50 ${reverso ? 'right-0' : 'left-0'}`}>
          {foto && !isBye ? <img src={foto} className="w-full h-full object-cover" /> : <svg className="w-5 h-5 text-zinc-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>}
        </div>
      )}
      <div className={`absolute top-[4px] md:top-[2px] flex items-center ${centralizado ? 'justify-center left-0 right-0' : reverso ? 'left-0 right-0 md:left-0 md:right-[48px] flex-row-reverse' : 'left-0 right-0 md:left-[48px] md:right-0 flex-row'}`}>
        {numero && <span className={`text-zinc-600 text-[9px] md:text-[10px] font-black ${reverso ? 'ml-1.5' : 'mr-1.5'}`}>{numero}</span>}
        <span className={`text-[#57d8ff] text-[10px] md:text-[13px] font-bold tracking-tight truncate flex-1 transition-colors group-hover:text-white ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>
          {nomeExibicao}
        </span>
      </div>
      {!ocultarLinha && <div className={`absolute top-[30px] border-t border-zinc-600/70 transition-colors group-hover:border-[#57d8ff]/50 ${centralizado ? 'left-0 right-0' : reverso ? 'left-0 right-0 md:left-auto md:right-[48px]' : 'left-0 right-0 md:right-auto md:left-[48px]'}`} />}
      <div className={`absolute top-[34px] flex items-center ${centralizado ? 'justify-center left-0 right-0' : reverso ? 'left-0 right-0 md:left-0 md:right-[48px] flex-row-reverse' : 'left-0 right-0 md:left-[48px] md:right-0 flex-row'}`}>
        <span className={`text-zinc-500 text-[8px] md:text-[9.5px] font-medium uppercase truncate flex-1 ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>
          {equipeExibicao}
        </span>
      </div>
      {!isBye && horario && status !== 'concluida' && status !== 'em_andamento' && (
        <div className={`absolute top-[48px] flex items-center ${centralizado ? 'justify-center left-0 right-0' : reverso ? 'left-0 right-0 md:left-0 md:right-[48px] flex-row-reverse' : 'left-0 right-0 md:left-[48px] md:right-0 flex-row'}`}>
          <span className="text-yellow-500 text-[7px] md:text-[8px] font-black uppercase tracking-widest bg-yellow-500/10 px-1.5 py-[1px] rounded border border-yellow-500/20 whitespace-nowrap z-20 shadow-[0_0_10px_rgba(234,179,8,0.1)] flex items-center gap-1">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {formatarHorarioEstimado(horario)} {tatame && `| ${tatame}`}
          </span>
        </div>
      )}
      {!isBye && status === 'em_andamento' && (
        <div className={`absolute top-[48px] flex items-center ${centralizado ? 'justify-center left-0 right-0' : reverso ? 'left-0 right-0 md:left-0 md:right-[48px] flex-row-reverse' : 'left-0 right-0 md:left-[48px] md:right-0 flex-row'}`}>
          <span className="text-red-500 text-[7px] md:text-[8px] font-black uppercase tracking-widest bg-red-500/10 px-1.5 py-[1px] rounded border border-red-500/20 whitespace-nowrap z-20 animate-pulse flex items-center gap-1 cursor-default shadow-[0_0_10px_rgba(239,68,68,0.2)]">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span> LUTANDO AGORA
          </span>
        </div>
      )}
    </div>
  )
}
function ConectorPequeno({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[80px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[81px] border-zinc-500 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[40px] w-[6px] md:w-[15px] border-t border-zinc-500 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }
function ConectorMedio({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[160px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[161px] border-zinc-500 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[80px] w-[6px] md:w-[15px] border-t border-zinc-500 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }
function ConectorGrande({ reverso = false }: any) { return ( <div className="relative w-[12px] md:w-[30px] h-[320px] flex-shrink-0"> <div className={`absolute top-0 w-[6px] md:w-[15px] h-[321px] border-zinc-500 border-y ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} /> <div className={`absolute top-[160px] w-[6px] md:w-[15px] border-t border-zinc-500 ${reverso ? 'left-0' : 'right-0'}`} /> </div> ) }

export default function ChavesPublicoPage() {
  const params = useParams()
  const idEvento = params.id as string || params.eventoId as string;
  
  const [tipoCategoria, setTipoCategoria] = useState("peso")
  const [categoriasMenu, setCategoriasMenu] = useState<string[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("")
  const [lutas, setLutas] = useState<any[]>([])
  const [abaAtual, setAbaAtual] = useState(1) 
  const [atletasDB, setAtletasDB] = useState<any[]>([])
  const [temPendencia, setTemPendencia] = useState(false)

  async function verificarPagamento() {
    if (!idEvento) return;
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return; 
    const { data: inscricoes } = await supabase.from("inscricoes").select("pagamento_ok").eq("evento_id", idEvento).eq("user_id", authData.user.id);
    if (inscricoes && inscricoes.length > 0) {
      setTemPendencia(inscricoes.some(insc => insc.pagamento_ok === false));
    }
  }

  async function carregarCategorias() {
    if (!idEvento) return;
    const { data } = await supabase.from("chaves").select("categoria, faixa").eq("evento_id", idEvento)
    if (data) {
      const unicas = Array.from(new Set(data.map(d => `${d.categoria}__${d.faixa}`)))
      setCategoriasMenu(unicas)
    }
  }

  async function carregarFotos() {
    const { data } = await supabase.from('atletas').select('id, nome, foto_url');
    if (data) setAtletasDB(data);
  }

  async function carregarChaves() {
    if (!categoriaSelecionada || !idEvento) return
    const [cat, fx] = categoriaSelecionada.split("__")
    const { data } = await supabase.from("chaves").select("*").eq("evento_id", idEvento).eq("categoria", cat).eq("faixa", fx)
    setLutas(data || [])
  }

  useEffect(() => { 
    verificarPagamento();
    carregarCategorias();
    carregarFotos();
  }, [])

  useEffect(() => { 
    carregarChaves() 
    const subscription = supabase
      .channel('public-chaves-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chaves' }, payload => {
        carregarChaves();
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); }
  }, [categoriaSelecionada])

  const categoriasFiltradas = categoriasMenu.filter((cat) => {
    const isAbsoluto = cat.toLowerCase().includes("absoluto");
    return tipoCategoria === "peso" ? !isAbsoluto : isAbsoluto;
  })

  useEffect(() => {
    setCategoriaSelecionada(categoriasFiltradas[0] || "")
    setAbaAtual(1) 
  }, [tipoCategoria, categoriasMenu])

  const atletas = lutas.flatMap((luta: any) => [
    { numero: String(luta.numero_1 || ""), nome: luta.atleta_1 || "", equipe: luta.equipe_1 || "" },
    { numero: String(luta.numero_2 || ""), nome: luta.atleta_2 || "", equipe: luta.equipe_2 || "" }
  ])

  const maxNumero = atletas.length > 0 ? Math.max(...atletas.map(a => parseInt(a.numero) || 0)) : 0;
  const totalAbas = Math.max(1, Math.ceil(maxNumero / 16));

  const getFase1VisualId = (posicaoColuna: number, lado: "esquerda" | "direita") => {
    const lutasPorLado = totalAbas * 4;
    if (lado === "esquerda") return (abaAtual - 1) * 4 + posicaoColuna; 
    return lutasPorLado + (abaAtual - 1) * 4 + posicaoColuna;
  }

  const limparNome = (nome: string | null) => {
    if (!nome) return "";
    const strLimpa = String(nome).trim().toUpperCase();
    if (strLimpa === "BYE" || strLimpa === "TBD" || strLimpa.includes("SEM OPONENTE")) return "";
    return String(nome);
  }

  const isGhost = (nome: string | null) => !nome || ["BYE", "TBD"].includes(String(nome).trim().toUpperCase()) || String(nome).trim().toUpperCase().includes("SEM OPONENTE");
  const isAtletaValido = (nome: string | null) => !isGhost(nome);

  const controleChamador = (valor: any) => {
    if (!valor) return { presente: false, chamadas: 0 };
    try {
      const dados = typeof valor === 'string' ? JSON.parse(valor) : valor;
      return {
        presente: Boolean(dados?.chamador_presente),
        chamadas: Number(dados?.chamador_chamadas || 0),
      };
    } catch {
      return { presente: false, chamadas: 0 };
    }
  };

  const buscarFotoPorId = (idNumerico: number | null) => {
    if (!idNumerico) return null;
    const match = atletasDB.find(a => a.id === idNumerico);
    return match ? match.foto_url : null;
  }

  const getLutaFinal = () => {
    const finalNormal = lutas.find(l => String(l.id_visual) === "999");
    if (finalNormal) return finalNormal;
    return lutas.find(l => !l.proxima_luta); 
  };

  const getAtletaDaPrimeiraFase = (posicaoColuna: number, slot: number, lado: "esquerda" | "direita") => {
    const idLutaVisual = getFase1VisualId(posicaoColuna, lado);
    const luta = lutas.find(l => String(l.id_visual) === String(idLutaVisual));
    if (!luta) return { nome: "", equipe: "", numero: "", foto: null };
    const nomeBruto = slot === 1 ? luta.atleta_1 : luta.atleta_2;
    const idBruto = slot === 1 ? luta.atleta_1_id : luta.atleta_2_id;
    const nomeLimpo = limparNome(nomeBruto);
    return { 
      numero: slot === 1 ? luta.numero_1 : luta.numero_2, 
      nome: nomeLimpo, 
      equipe: nomeLimpo === "" ? "" : (slot === 1 ? luta.equipe_1 : luta.equipe_2), 
      foto: buscarFotoPorId(idBruto),
      horario: luta.horario_estimado, status: luta.status_luta, tatame: luta.tatame 
    }
  }

  const getAtletaDoMeio = (idBase: number, multiplicador: number, slotDelta: number, slot: number) => {
    const idLutaVisual = idBase + (abaAtual - 1) * multiplicador + slotDelta;
    const luta = lutas.find(l => String(l.id_visual) === String(idLutaVisual));
    if (!luta) return { nome: "", equipe: "", foto: null };
    const nomeBruto = slot === 1 ? luta.atleta_1 : luta.atleta_2;
    const idBruto = slot === 1 ? luta.atleta_1_id : luta.atleta_2_id;
    const nomeLimpo = limparNome(nomeBruto);
    return { 
      nome: nomeLimpo, 
      equipe: nomeLimpo === "" ? "" : (slot === 1 ? luta.equipe_1 : luta.equipe_2), 
      foto: buscarFotoPorId(idBruto),
      horario: luta.horario_estimado, status: luta.status_luta, tatame: luta.tatame
    }
  }

  const getAtletaDaFinal = (slot: number) => {
    const luta = getLutaFinal();
    if (!luta) return { nome: "", equipe: "", foto: null };
    const nomeBruto = slot === 1 ? luta.atleta_1 : luta.atleta_2;
    const idBruto = slot === 1 ? luta.atleta_1_id : luta.atleta_2_id;
    const nomeLimpo = limparNome(nomeBruto);
    return { 
      nome: nomeLimpo, 
      equipe: nomeLimpo === "" ? "" : (slot === 1 ? luta.equipe_1 : luta.equipe_2), 
      foto: buscarFotoPorId(idBruto),
      horario: luta.horario_estimado, status: luta.status_luta, tatame: luta.tatame
    }
  }

  const getCampeao = () => {
    const lutaFinal = getLutaFinal();
    const campeao = limparNome(lutaFinal?.vencedor || null);
    const idCampeao = lutaFinal?.vencedor_id || null;
    return { nome: campeao, equipe: "", foto: buscarFotoPorId(idCampeao) }
  }

  const getNomeDaFase = (luta: any, todasLutas: any[]) => {
    if (String(luta.id_visual) === "999" || !luta.proxima_luta) return "FINAL - DISPUTA DO OURO";
    const semis = todasLutas.filter(l => String(l.proxima_luta) === "999" || !l.proxima_luta).map(l => String(l.id_visual));
    if (semis.includes(String(luta.proxima_luta))) return "SEMIFINAL";
    const quartas = todasLutas.filter(l => semis.includes(String(l.proxima_luta))).map(l => String(l.id_visual));
    if (quartas.includes(String(luta.proxima_luta))) return "QUARTAS DE FINAL";
    const oitavas = todasLutas.filter(l => quartas.includes(String(l.proxima_luta))).map(l => String(l.id_visual));
    if (oitavas.includes(String(luta.proxima_luta))) return "OITAVAS DE FINAL";
    const dezesseis = todasLutas.filter(l => oitavas.includes(String(l.proxima_luta))).map(l => String(l.id_visual));
    if (dezesseis.includes(String(luta.proxima_luta))) return "16 AVOS DE FINAL";
    return "FASE ELIMINATÓRIA";
  }

  const campeaoData = getCampeao();
  const temCampeao = campeaoData.nome && campeaoData.nome !== "";

  // 🔥 LÓGICA DE ORGANIZAÇÃO DOS CARDS
  const lutasAtivas = lutas.filter(l => l.status_luta !== 'concluida' && l.status_luta !== 'em_andamento');
  const lutasEmAndamento = lutas.filter(l => l.status_luta === 'em_andamento');
  
  // Exibe apenas confrontos reais (duas pessoas)
  const confrontosReais = [...lutasEmAndamento, ...lutasAtivas]
    .filter(l => isAtletaValido(l.atleta_1) && isAtletaValido(l.atleta_2))
    .sort((a, b) => (parseInt(a.id_visual) || 0) - (parseInt(b.id_visual) || 0));

  // Atletas na "Baia" (Tem apenas 1 atleta válido na luta agendada)
  const atletasNaBaia = lutasAtivas.flatMap((luta) => ([
    {
      chave: `${luta.id}-1`, luta, nome: limparNome(luta.atleta_1), equipe: luta.equipe_1,
      atletaId: luta.atleta_1_id, controle: controleChamador(luta.pontuacao_atleta_1),
    },
    {
      chave: `${luta.id}-2`, luta, nome: limparNome(luta.atleta_2), equipe: luta.equipe_2,
      atletaId: luta.atleta_2_id, controle: controleChamador(luta.pontuacao_atleta_2),
    },
  ])).filter((item) => isAtletaValido(item.nome) && item.controle.presente);

  const atletasAguardandoDefinicao = lutasAtivas.filter(l => (isAtletaValido(l.atleta_1) && !isAtletaValido(l.atleta_2)) || (!isAtletaValido(l.atleta_1) && isAtletaValido(l.atleta_2)));

  // Descobre de onde vem o oponente do atleta que está na Baia
  const getTextoBaia = (lutaWait: any) => {
    const lutasAlimentadoras = lutas.filter(l => String(l.proxima_luta) === String(lutaWait.id_visual));
    if (lutasAlimentadoras.length > 0) {
      const atletaPresente = isAtletaValido(lutaWait.atleta_1) ? lutaWait.atleta_1 : lutaWait.atleta_2;
      const feederOponente = lutasAlimentadoras.find(l => limparNome(l.vencedor) !== limparNome(atletaPresente));
      if (feederOponente) {
        if (feederOponente.status_luta === 'concluida') return `Aguardando chamada ao tatame`;
        return `Aguardando vencedor da Luta ${feederOponente.id_visual}`;
      }
    }
    return "Avanço Direto - Aguardando oponente";
  };

  return (
    <main className="min-h-screen bg-black p-0 md:p-6">
      <div className="w-full max-w-[1400px] mx-auto pt-6 md:pt-0">
        
        {temPendencia && (
          <div className="mx-4 md:mx-0 mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-in slide-in-from-top-4">
            <div className="flex items-start gap-3">
              <div className="bg-red-500/20 p-2 rounded-full mt-1 shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div>
                <h4 className="text-red-500 font-black uppercase tracking-widest text-xs mb-1">Aviso: Inscrição Pendente</h4>
                <p className="text-red-200/80 text-[10px] md:text-xs leading-relaxed max-w-2xl">
                  Identificamos que o seu pagamento ainda não foi confirmado. O algoritmo de chaves oficial exclui automaticamente atletas inadimplentes. Se você não encontrar o seu nome, regularize a sua inscrição.
                </p>
              </div>
            </div>
            <Link href="/pagamento" className="shrink-0 w-full md:w-auto text-center bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg text-[10px] md:text-xs">
              Regularizar Agora
            </Link>
          </div>
        )}

        <div className="flex flex-col justify-between items-center mb-6 md:mb-10 px-4 md:px-0 mt-8">
          <h1 className="text-white text-3xl md:text-5xl font-black uppercase tracking-tighter w-full">Chaveamento Oficial</h1>
        </div>

        <div className="bg-[#050816] border-y md:border border-white/10 md:rounded-3xl p-4 md:p-6 mb-4 mx-0 flex flex-col md:flex-row gap-4 items-end shadow-lg">
          <div className="flex-1 w-full flex flex-col gap-2">
            <label className="text-[#57d8ff] text-[10px] font-black uppercase tracking-widest pl-1">Tipo Categoria</label>
            <select value={tipoCategoria} onChange={(e) => setTipoCategoria(e.target.value)} className="w-full bg-black/50 border border-[#57d8ff]/30 text-white rounded-xl p-3.5 outline-none focus:border-[#57d8ff] text-xs font-bold uppercase cursor-pointer">
              <option value="peso">Categoria de Peso Jiu-Jitsu</option>
              <option value="absoluto">Categoria Absoluto Jiu-Jitsu</option>
            </select>
          </div>
          <div className="flex-[2] w-full flex flex-col gap-2">
            <label className="text-[#57d8ff] text-[10px] font-black uppercase tracking-widest pl-1">Categoria e Faixa</label>
            <select value={categoriaSelecionada} onChange={(e) => setCategoriaSelecionada(e.target.value)} className="w-full bg-black/50 border border-[#57d8ff]/30 text-white rounded-xl p-3.5 outline-none focus:border-[#57d8ff] text-xs font-bold uppercase cursor-pointer">
              {categoriasFiltradas.length === 0 && <option value="">Nenhuma chave nesta modalidade...</option>}
              {categoriasFiltradas.map((cat) => {
                const [nomeCategoria, faixa] = cat.split("__");
                const catFormatada = nomeCategoria.replace("-", "").trim(); 
                return <option key={cat} value={cat}>{catFormatada} • Faixa {faixa}</option>
              })}
            </select>
          </div>
        </div>

        {totalAbas > 1 && (
          <div className="flex justify-center gap-2 mb-6 flex-wrap px-4">
            {Array.from({ length: totalAbas }).map((_, i) => (
              <button key={i} onClick={() => setAbaAtual(i + 1)} className={`px-6 py-2 rounded-lg font-bold transition-all ${abaAtual === i + 1 ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>
                {i + 1}/{totalAbas}
              </button>
            ))}
          </div>
        )}

        {/* ============================================== */}
        {/* ÁRVORE GRÁFICA (VISUAL DESKTOP) */}
        {/* ============================================== */}
        <div className="hidden md:flex bg-[#050816] md:border md:border-white/10 md:rounded-3xl py-6 md:p-10 w-full overflow-x-auto min-w-0 flex-col items-center scrollbar-hide relative shadow-2xl">
          {totalAbas > 1 && <p className="text-zinc-500 font-bold mb-4 uppercase tracking-widest text-sm absolute top-4 left-4">Chave {abaAtual}/{totalAbas}</p>}

          <div className="flex w-max md:w-full justify-center px-2 md:px-0 opacity-90 transition-all pt-6 md:pt-0 pb-8">
            <div className="flex">
              <div className="flex flex-col gap-[20px]">
                <Atleta {...getAtletaDaPrimeiraFase(1, 1, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(1, 2, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(2, 1, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(2, 2, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(3, 1, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(3, 2, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(4, 1, "esquerda")} />
                <Atleta {...getAtletaDaPrimeiraFase(4, 2, "esquerda")} />
              </div>
              <div className="flex flex-col gap-[80px] pt-[30px]"><ConectorPequeno /><ConectorPequeno /><ConectorPequeno /><ConectorPequeno /></div>
              <div className="flex flex-col gap-[100px] pt-[40px]">
                <Atleta larguraClass="w-[16px] md:w-[140px]" {...getAtletaDoMeio(100, 2, 1, 1)} />
                <Atleta larguraClass="w-[16px] md:w-[140px]" {...getAtletaDoMeio(100, 2, 1, 2)} />
                <Atleta larguraClass="w-[16px] md:w-[140px]" {...getAtletaDoMeio(100, 2, 2, 1)} />
                <Atleta larguraClass="w-[16px] md:w-[140px]" {...getAtletaDoMeio(100, 2, 2, 2)} />
              </div>
              <div className="flex flex-col gap-[160px] pt-[70px]"><ConectorMedio /><ConectorMedio /></div>
              <div className="flex flex-col gap-[260px] pt-[120px]">
                <Atleta larguraClass="w-[16px] md:w-[140px]" {...getAtletaDoMeio(200, 1, 1, 1)} />
                <Atleta larguraClass="w-[16px] md:w-[140px]" {...getAtletaDoMeio(200, 1, 1, 2)} />
              </div>
              <div className="flex flex-col pt-[150px]"><ConectorGrande /></div>
            </div>

            <div className="flex flex-col w-[160px] md:w-[170px] shrink-0 relative items-center mx-0">
              <div className="absolute top-[310px] left-[-10px] right-[-10px] border-t border-zinc-500 z-0" />
              <div className="absolute top-[260px] flex flex-col gap-[10px] bg-[#050816] px-2 py-4 border border-zinc-800 rounded-xl z-10 shadow-2xl w-full">
                <span className="text-red-600 font-black text-[10px] md:text-[11px] uppercase text-center mb-1 tracking-widest">Luta Final</span>
                <Atleta {...getAtletaDaFinal(1)} larguraClass="w-full" centralizado />
                <Atleta {...getAtletaDaFinal(2)} larguraClass="w-full" centralizado />
              </div>

              <div className="absolute top-[75px] md:top-[80px] flex flex-col items-center z-10 w-full">
                <span className="text-yellow-500 font-black text-[12px] md:text-lg mb-2 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)] tracking-widest">🏆 CAMPEÃO</span>
                <div className="bg-gradient-to-t from-yellow-500/10 to-black/80 border border-yellow-500/50 rounded-xl py-2 px-2 shadow-[0_0_20px_rgba(234,179,8,0.2)] w-full flex flex-col items-center">
                  <Atleta {...campeaoData} larguraClass="w-full" centralizado ocultarLinha campeao={true} />
                </div>
              </div>
            </div>

            <div className="flex">
              <div className="flex flex-col pt-[150px]"><ConectorGrande reverso /></div>
              <div className="flex flex-col gap-[260px] pt-[120px]">
                <Atleta larguraClass="w-[16px] md:w-[140px]" {...getAtletaDoMeio(200, 1, 2, 1)} reverso />
                <Atleta larguraClass="w-[16px] md:w-[140px]" {...getAtletaDoMeio(200, 1, 2, 2)} reverso />
              </div>
              <div className="flex flex-col gap-[160px] pt-[70px]"><ConectorMedio reverso /><ConectorMedio reverso /></div>
              <div className="flex flex-col gap-[100px] pt-[40px]">
                <Atleta larguraClass="w-[16px] md:w-[140px]" {...getAtletaDoMeio(100, 2, 3, 1)} reverso />
                <Atleta larguraClass="w-[16px] md:w-[140px]" {...getAtletaDoMeio(100, 2, 3, 2)} reverso />
                <Atleta larguraClass="w-[16px] md:w-[140px]" {...getAtletaDoMeio(100, 2, 4, 1)} reverso />
                <Atleta larguraClass="w-[16px] md:w-[140px]" {...getAtletaDoMeio(100, 2, 4, 2)} reverso />
              </div>
              <div className="flex flex-col gap-[80px] pt-[30px]"><ConectorPequeno reverso /><ConectorPequeno reverso /><ConectorPequeno reverso /><ConectorPequeno reverso /></div>
              <div className="flex flex-col gap-[20px]">
                <Atleta {...getAtletaDaPrimeiraFase(1, 1, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(1, 2, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(2, 1, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(2, 2, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(3, 1, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(3, 2, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(4, 1, "direita")} reverso />
                <Atleta {...getAtletaDaPrimeiraFase(4, 2, "direita")} reverso />
              </div>
            </div>
          </div>
        </div>


        {/* ============================================== */}
        {/* LISTAGEM DE CARDS (VISÍVEL NO PC E MOBILE) */}
        {/* ============================================== */}
        <div className="flex flex-col w-full px-4 md:px-0 mb-20 mt-8 md:mt-12">
          
          {/* CARD DE CAMPEÃO OFICIAL (Apenas Mobile, pois no PC já está na árvore) */}
          {temCampeao && (
            <div className="md:hidden bg-gradient-to-t from-yellow-600/20 to-[#0c1220] border border-yellow-500/30 rounded-2xl p-6 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.15)] mb-8 animate-in fade-in zoom-in duration-500">
              <span className="text-yellow-500 font-black text-sm mb-3 tracking-widest drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">🏆 CAMPEÃO OFICIAL</span>
              <div className="w-16 h-16 rounded-full border-[3px] border-yellow-500 overflow-hidden bg-black flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)] mb-3 shrink-0">
                {campeaoData.foto ? <img src={campeaoData.foto} className="w-full h-full object-cover" /> : <span className="text-2xl text-yellow-500 font-black">{campeaoData.nome.charAt(0)}</span>}
              </div>
              <h2 className="text-white text-lg font-black uppercase tracking-tight text-center">{campeaoData.nome}</h2>
            </div>
          )}

          {/* 🔥 SEÇÃO: ATLETAS NA BAIA (Avanço Direto) */}
          {atletasNaBaia.length > 0 && (
            <div className="mb-10">
              <h3 className="text-cyan-400 font-black uppercase tracking-widest text-xs md:text-sm mb-4 flex items-center gap-2 border-b border-cyan-500/20 pb-3">
                <Clock size={16} /> Na baia · prontos para chamada
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {atletasNaBaia.map((item) => {
                  const fotoAtl = buscarFotoPorId(item.atletaId);
                  return (
                    <div key={item.chave} className="bg-gradient-to-r from-cyan-500/10 to-[#0c1220] border border-cyan-500/25 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black border-2 border-cyan-400/60 flex items-center justify-center overflow-hidden shrink-0">
                        {fotoAtl ? <img src={fotoAtl} className="w-full h-full object-cover" alt={item.nome} /> : <span className="text-cyan-400 font-black text-sm">{item.nome.charAt(0)}</span>}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="block truncate text-sm font-black uppercase text-white">{item.nome}</span>
                        <span className="mb-2 block truncate text-[9px] font-bold uppercase text-zinc-400">{item.equipe || 'Sem equipe'}</span>
                        <span className="inline-flex w-max max-w-full items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-emerald-300">
                          Presença confirmada · {item.luta.tatame || 'Tatame a definir'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {atletasAguardandoDefinicao.length > 0 && (
            <div className="mb-10 rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-4">
              <h3 className="mb-3 text-[10px] font-black uppercase tracking-widest text-yellow-400">Atletas de chapéu · aguardando definição</h3>
              <div className="flex flex-wrap gap-2">
                {atletasAguardandoDefinicao.map((luta) => {
                  const isA1 = isAtletaValido(luta.atleta_1);
                  const nome = isA1 ? limparNome(luta.atleta_1) : limparNome(luta.atleta_2);
                  return <span key={`aguarda-${luta.id}`} className="rounded-lg border border-yellow-500/20 bg-black/40 px-3 py-2 text-[9px] font-black uppercase text-zinc-300">{nome} · {getTextoBaia(luta)}</span>;
                })}
              </div>
            </div>
          )}

          {/* 🔥 SEÇÃO: CONFRONTOS REAIS (Agendados e Em Andamento) */}
          {confrontosReais.length > 0 && (
            <div className="mb-10">
              <h3 className="text-white font-black uppercase tracking-widest text-xs md:text-sm mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                Cronograma de Lutas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {confrontosReais.map(luta => {
                  const a1 = limparNome(luta.atleta_1); const a2 = limparNome(luta.atleta_2);
                  const foto1 = buscarFotoPorId(luta.atleta_1_id); const foto2 = buscarFotoPorId(luta.atleta_2_id);
                  
                  return (
                    <div key={luta.id} className={`bg-[#0c1220] border ${luta.status_luta === 'em_andamento' ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-[#57d8ff]/20'} rounded-xl flex flex-col relative overflow-hidden transition-all hover:border-[#57d8ff]/50`}>
                      <div className={`py-2 px-3 flex justify-between items-center border-b ${luta.status_luta === 'em_andamento' ? 'bg-red-500/10 border-red-500/20' : 'bg-[#57d8ff]/10 border-[#57d8ff]/20'}`}>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${luta.status_luta === 'em_andamento' ? 'text-red-400' : 'text-[#57d8ff]'}`}>{getNomeDaFase(luta, lutas)} • Luta {luta.id_visual}</span>
                        {luta.status_luta === 'em_andamento' && <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded font-black uppercase animate-pulse shadow-sm">Lutando</span>}
                      </div>

                      <div className="p-3 flex flex-col gap-1.5">
                        {/* Atleta 1 */}
                        <div className="flex justify-between items-center p-2 rounded-lg border bg-black/40 border-white/5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-400 border border-zinc-600 overflow-hidden shrink-0">
                              {foto1 ? <img src={foto1} className="w-full h-full object-cover"/> : a1 ? a1.charAt(0) : "?"}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-black text-white uppercase tracking-tight truncate">{a1 || "A DEFINIR"}</span>
                              <span className="text-[9px] text-zinc-500 uppercase truncate">{luta.equipe_1 || "Sem Equipe"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="relative h-1 w-full flex justify-center items-center my-0.5">
                          <div className="absolute w-6 h-6 bg-[#0c1220] border border-[#57d8ff]/30 rounded-full flex items-center justify-center text-[8px] font-black text-[#57d8ff] z-10">VS</div>
                          <div className="w-full border-t border-white/5"></div>
                        </div>

                        {/* Atleta 2 */}
                        <div className="flex justify-between items-center p-2 rounded-lg border bg-black/40 border-white/5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-400 border border-zinc-600 overflow-hidden shrink-0">
                              {foto2 ? <img src={foto2} className="w-full h-full object-cover"/> : a2 ? a2.charAt(0) : "?"}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-black text-white uppercase tracking-tight truncate">{a2 || "A DEFINIR"}</span>
                              <span className="text-[9px] text-zinc-500 uppercase truncate">{luta.equipe_2 || "Sem Equipe"}</span>
                            </div>
                          </div>
                        </div>

                        {luta.horario_estimado && (
                          <div className="mt-1 flex items-center justify-between px-1 bg-black/30 rounded p-1.5 border border-white/5">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{luta.tatame || 'Sem Tatame'}</span>
                            <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">Previsto: {formatarHorarioEstimado(luta.horario_estimado)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {lutasAtivas.length === 0 && lutasEmAndamento.length === 0 && (
            <div className="text-center text-zinc-500 py-10 text-sm font-bold uppercase tracking-widest border border-dashed border-white/10 rounded-2xl bg-[#0a0a0e]">Nenhum confronto pendente.</div>
          )}

        </div>
      </div>
    </main>
  )
}
