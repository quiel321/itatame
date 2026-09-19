"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/app/lib/supabase"
import Link from "next/link"
import { Clock, Search } from "lucide-react"
import { rotuloLuta } from "@/app/lib/lutas-rotulos"
import { semFaixaDuplicada } from "@/app/lib/categorias-competicao"
import { lutasFormamChaveDeTres, placeholderSlotChaveDeTres, resumoHumanoChave, textoAguardandoChaveDeTres, textoOuroAposChecagem } from "@/app/lib/chave-de-tres"
import { ChaveTriangularPainel } from "@/app/components/ChaveDeTresPainel"
import ArvoreChaveDesktop from "@/app/components/ArvoreChaveDesktop"

const formatarHorarioEstimado = (isoString: string | null) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

type IndiceLuta = {
  categoria: string;
  faixa: string;
  atleta_1?: string | null;
  atleta_2?: string | null;
  equipe_1?: string | null;
  equipe_2?: string | null;
};

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
  const [versaoChaves, setVersaoChaves] = useState(0)
  const [eventoNome, setEventoNome] = useState("")
  const [busca, setBusca] = useState("")
  const [indice, setIndice] = useState<IndiceLuta[]>([])

  async function verificarPagamento() {
    if (!idEvento) return;
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;
    const { data: depsData } = await supabase.from("atletas").select("user_id").eq("responsavel_id", authData.user.id);
    const idsFamilia = [authData.user.id, ...(depsData || []).map(item => item.user_id)];
    const { data: inscricoes } = await supabase.from("inscricoes").select("pagamento_ok").eq("evento_id", idEvento).in("user_id", idsFamilia);
    if (inscricoes && inscricoes.length > 0) {
      setTemPendencia(inscricoes.some(insc => insc.pagamento_ok === false));
    }
  }

  async function carregarCategorias() {
    if (!idEvento) return;
    const { data } = await supabase.from("chaves").select("categoria, faixa, atleta_1, atleta_2, equipe_1, equipe_2").eq("evento_id", idEvento)
    if (data) {
      setIndice(data as IndiceLuta[])
      setCategoriasMenu(Array.from(new Set(data.map(d => `${d.categoria}__${d.faixa}`))))
    }
  }

  async function carregarFotos() {
    const { data } = await supabase.from('atletas_publico').select('id, nome, foto_url');
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
    if (idEvento) {
      void supabase.from("eventos").select("nome").eq("id", idEvento).maybeSingle().then(({ data }) => {
        if (data?.nome) setEventoNome(String(data.nome));
      });
      void fetch(`/api/eventos/${idEvento}/gerar-chaves-auto`).then(() => {
        carregarCategorias();
        setVersaoChaves(atual => atual + 1);
      });
    }
  }, [])

  useEffect(() => {
    carregarChaves()
    const subscription = supabase
      .channel('public-chaves-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chaves' }, () => {
        carregarChaves();
        carregarCategorias();
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); }
  }, [categoriaSelecionada, versaoChaves])

  const categoriasFiltradas = categoriasMenu.filter((cat) => {
    const isAbsoluto = cat.toLowerCase().includes("absoluto");
    return tipoCategoria === "peso" ? !isAbsoluto : isAbsoluto;
  })

  const termoBusca = busca.trim().toUpperCase();
  const categoriasVisiveis = categoriasFiltradas.filter((chave) => {
    if (!termoBusca) return true;
    if (chave.toUpperCase().includes(termoBusca)) return true;
    const [cat, fx] = chave.split("__");
    return indice.some((luta) => luta.categoria === cat && luta.faixa === fx && [luta.atleta_1, luta.atleta_2, luta.equipe_1, luta.equipe_2].some((valor) => String(valor || "").toUpperCase().includes(termoBusca)));
  })

  useEffect(() => {
    setCategoriaSelecionada((atual) => {
      if (atual && categoriasFiltradas.includes(atual)) return atual;
      return categoriasFiltradas[0] || "";
    })
    setAbaAtual(1)
  }, [tipoCategoria, categoriasMenu])

  useEffect(() => {
    if (!termoBusca || categoriasVisiveis.length === 0) return;
    if (!categoriasVisiveis.includes(categoriaSelecionada)) {
      setCategoriaSelecionada(categoriasVisiveis[0]);
    }
  }, [termoBusca, categoriasVisiveis, categoriaSelecionada])

  const atletas = lutas.flatMap((luta: any) => [
    { numero: String(luta.numero_1 || ""), nome: luta.atleta_1 || "", equipe: luta.equipe_1 || "" },
    { numero: String(luta.numero_2 || ""), nome: luta.atleta_2 || "", equipe: luta.equipe_2 || "" }
  ])

  const maxNumero = atletas.length > 0 ? Math.max(...atletas.map(a => parseInt(a.numero) || 0)) : 0;
  const totalAbas = Math.max(1, Math.ceil(maxNumero / 16));

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

  const buscarFotoPorId = (idNumerico?: number | null): string | null => {
    if (!idNumerico) return null;
    const match = atletasDB.find(a => Number(a.id) === Number(idNumerico));
    const foto = match?.foto_url;
    return typeof foto === 'string' && foto ? foto : null;
  }

  const getLutaFinal = () => {
    const finalNormal = lutas.find(l => String(l.id_visual) === "999");
    if (finalNormal) return finalNormal;
    return lutas.find(l => !l.proxima_luta);
  };

  const getCampeao = () => {
    const lutaFinal = getLutaFinal();
    const campeao = limparNome(lutaFinal?.vencedor || null);
    const idCampeao = lutaFinal?.vencedor_id || null;
    return { nome: campeao, equipe: "", foto: buscarFotoPorId(idCampeao) }
  }

  const campeaoData = getCampeao();
  const temCampeao = campeaoData.nome && campeaoData.nome !== "";
  const ehChaveDeTres = lutasFormamChaveDeTres(lutas);
  const nomeSlot = (luta: any, lado: 1 | 2) => {
    const bruto = lado === 1 ? luta.atleta_1 : luta.atleta_2;
    const limpo = limparNome(bruto);
    if (limpo) return limpo;
    return placeholderSlotChaveDeTres(luta, lado) || "A definir";
  };

  const lutasAtivas = lutas.filter(l => l.status_luta !== 'concluida' && l.status_luta !== 'em_andamento');
  const lutasEmAndamento = lutas.filter(l => l.status_luta === 'em_andamento');

  const confrontosReais = [...lutasEmAndamento, ...lutasAtivas]
    .filter(l => ehChaveDeTres || (isAtletaValido(l.atleta_1) && isAtletaValido(l.atleta_2)))
    .sort((a, b) => (parseInt(a.id_visual) || 0) - (parseInt(b.id_visual) || 0));

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

  const atletasAguardandoDefinicao = lutasAtivas.filter(luta => {
    const umSo = (isAtletaValido(luta.atleta_1) && !isAtletaValido(luta.atleta_2)) || (!isAtletaValido(luta.atleta_1) && isAtletaValido(luta.atleta_2));
    if (!umSo) return false;
    const fantasmaNome = isAtletaValido(luta.atleta_1) ? luta.atleta_2 : luta.atleta_1;
    const aguardaChaveAnterior = lutas.some(item => String(item.proxima_luta) === String(luta.id_visual));
    const nomeFantasma = String(fantasmaNome || '').trim().toUpperCase();
    return aguardaChaveAnterior || nomeFantasma === 'TBD' || nomeFantasma === '' || nomeFantasma === 'BYE' || nomeFantasma.includes('SEM OPONENTE');
  });

  const getTextoBaia = (lutaWait: any) => {
    const textoTres = textoAguardandoChaveDeTres(lutaWait);
    if (textoTres) return textoTres;
    const lutasAlimentadoras = lutas.filter(l => String(l.proxima_luta) === String(lutaWait.id_visual));
    if (lutasAlimentadoras.length > 0) {
      const atletaPresente = isAtletaValido(lutaWait.atleta_1) ? lutaWait.atleta_1 : lutaWait.atleta_2;
      const feederOponente = lutasAlimentadoras.find(l => limparNome(l.vencedor) !== limparNome(atletaPresente));
      if (feederOponente) {
        if (feederOponente.status_luta === 'concluida') return `Aguardando chamada ao tatame`;
        return `Aguardando vencedor da ${rotuloLuta(feederOponente)}`;
      }
    }
    const reais = new Set<string>();
    lutas.forEach((luta) => {
      [luta.atleta_1, luta.atleta_2].forEach((nome, indice) => {
        if (!isAtletaValido(nome)) return;
        const id = indice === 0 ? luta.atleta_1_id : luta.atleta_2_id;
        reais.add(id ? `ID:${id}` : `NOME:${String(nome).trim().toUpperCase()}`);
      });
    });
    return textoOuroAposChecagem(reais.size);
  };

  const resumo = useMemo(() => resumoHumanoChave(lutas), [lutas]);
  const lutaAgora = lutasEmAndamento[0];
  const [nomeCategoria, faixaCategoria] = categoriaSelecionada.split("__");
  const tituloCategoria = categoriaSelecionada
    ? `${semFaixaDuplicada(String(nomeCategoria || "").replace("-", "").trim(), faixaCategoria || "")} · ${faixaCategoria || ""}`
    : "Escolha uma categoria";

  const rotuloChip = (chave: string) => {
    const [nome, faixa] = chave.split("__");
    return `${semFaixaDuplicada(String(nome || "").replace("-", "").trim(), faixa || "")} · ${faixa || ""}`;
  };

  return (
    <main className="min-h-screen bg-black p-0 md:p-6">
      <div className="mx-auto w-full max-w-[1400px] pt-6 md:pt-0">

        {temPendencia && (
          <div className="mx-4 mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 shadow-[0_0_20px_rgba(239,68,68,0.15)] md:mx-0 md:flex-row md:items-center md:p-5">
            <div className="flex items-start gap-3">
              <div className="mt-1 shrink-0 rounded-full bg-red-500/20 p-2">
                <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div>
                <h4 className="mb-1 text-xs font-black uppercase tracking-widest text-red-500">Inscrição pendente</h4>
                <p className="max-w-2xl text-[10px] leading-relaxed text-red-200/80 md:text-xs">
                  Se o pagamento ainda não caiu, o nome pode não aparecer na chave oficial. Regularize para garantir a vaga.
                </p>
              </div>
            </div>
            <Link href="/pagamento" className="w-full shrink-0 rounded-xl bg-red-600 px-6 py-3 text-center text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-red-500 md:w-auto md:text-xs">
              Regularizar agora
            </Link>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4 px-4 md:mt-4 md:flex-row md:items-end md:justify-between md:px-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">{eventoNome || "Campeonato"}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-5xl">Quem enfrenta quem</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">Veja a árvore, a baia e o caminho até a final. A chave atualiza sozinha quando uma luta termina.</p>
          </div>
          <Link href={`/ranking?evento=${idEvento}`} className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-yellow-400 hover:bg-yellow-500/20">
            Ranking deste campeonato
          </Link>
        </div>

        <div className="mx-0 mt-6 border-y border-white/10 bg-[#050816] p-4 shadow-lg md:rounded-3xl md:border md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex rounded-2xl border border-white/10 bg-black/40 p-1">
              <button type="button" onClick={() => setTipoCategoria("peso")} className={`flex-1 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest ${tipoCategoria === "peso" ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}>Por peso</button>
              <button type="button" onClick={() => setTipoCategoria("absoluto")} className={`flex-1 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest ${tipoCategoria === "absoluto" ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}>Absoluto</button>
            </div>
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Procurar atleta, equipe ou categoria"
                className="w-full rounded-2xl border border-white/10 bg-black/50 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-400/50"
              />
            </label>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {categoriasVisiveis.length === 0 && (
              <span className="rounded-full border border-dashed border-white/10 px-4 py-2 text-[11px] text-zinc-500">Nenhuma chave neste filtro.</span>
            )}
            {categoriasVisiveis.map((chave) => (
              <button
                key={chave}
                type="button"
                onClick={() => setCategoriaSelecionada(chave)}
                className={`max-w-[280px] shrink-0 truncate rounded-full border px-4 py-2 text-left text-[11px] font-bold ${categoriaSelecionada === chave ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-black/30 text-zinc-400 hover:border-white/20 hover:text-white"}`}
              >
                {rotuloChip(chave)}
              </button>
            ))}
          </div>
        </div>

        {categoriaSelecionada && (
          <section className="mx-4 mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 md:mx-0 md:p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">{tituloCategoria}</p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-cyan-50 md:text-base">{resumo}</p>
            {lutaAgora && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-red-300">
                <span className="h-2 w-2 animate-ping rounded-full bg-red-500" />
                Agora no tatame: {limparNome(lutaAgora.atleta_1)} vs {limparNome(lutaAgora.atleta_2)}
              </p>
            )}
          </section>
        )}

        {totalAbas > 1 && (
          <div className="mb-4 mt-5 flex flex-wrap justify-center gap-2 px-4">
            {Array.from({ length: totalAbas }).map((_, i) => (
              <button key={i} onClick={() => setAbaAtual(i + 1)} className={`rounded-lg px-6 py-2 font-bold transition-all ${abaAtual === i + 1 ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"}`}>
                {i + 1}/{totalAbas}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5">
          <ArvoreChaveDesktop
            lutas={lutas}
            abaAtual={abaAtual}
            totalAbas={totalAbas}
            buscarFoto={buscarFotoPorId}
            destaque={busca}
          />
        </div>

        {ehChaveDeTres && (
          <div className="mt-5 bg-[#050816] py-6 md:hidden">
            <div className="px-4">
              <ChaveTriangularPainel lutas={lutas} buscarFoto={buscarFotoPorId} />
            </div>
          </div>
        )}

        <div className="mb-20 mt-8 flex w-full flex-col px-4 md:mt-12 md:px-0">

          {temCampeao && (
            <div className="mb-8 flex flex-col items-center justify-center rounded-2xl border border-yellow-500/30 bg-gradient-to-t from-yellow-600/20 to-[#0c1220] p-6 shadow-[0_0_20px_rgba(234,179,8,0.15)] md:hidden">
              <span className="mb-3 text-sm font-black tracking-widest text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">Campeão desta chave</span>
              <div className="mb-3 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-yellow-500 bg-black shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                {campeaoData.foto ? <img src={campeaoData.foto} className="h-full w-full object-cover" alt="" /> : <span className="text-2xl font-black text-yellow-500">{campeaoData.nome.charAt(0)}</span>}
              </div>
              <h2 className="text-center text-lg font-black uppercase tracking-tight text-white">{campeaoData.nome}</h2>
            </div>
          )}

          {atletasNaBaia.length > 0 && (
            <div className="mb-10">
              <h3 className="mb-4 flex items-center gap-2 border-b border-cyan-500/20 pb-3 text-xs font-black uppercase tracking-widest text-cyan-400 md:text-sm">
                <Clock size={16} /> Na baia, prontos para a próxima
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {atletasNaBaia.map((item) => {
                  const fotoAtl = buscarFotoPorId(item.atletaId);
                  return (
                    <div key={item.chave} className="flex items-center gap-4 rounded-xl border border-cyan-500/25 bg-gradient-to-r from-cyan-500/10 to-[#0c1220] p-4 shadow-sm">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-400/60 bg-black md:h-14 md:w-14">
                        {fotoAtl ? <img src={fotoAtl} className="h-full w-full object-cover" alt={item.nome} /> : <span className="text-sm font-black text-cyan-400">{item.nome.charAt(0)}</span>}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="block truncate text-sm font-black uppercase text-white">{item.nome}</span>
                        <span className="mb-2 block truncate text-[9px] font-bold uppercase text-zinc-400">{item.equipe || "Sem equipe"}</span>
                        <span className="inline-flex w-max max-w-full items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-emerald-300">
                          Presença confirmada · {item.luta.tatame || "Tatame a definir"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!ehChaveDeTres && atletasAguardandoDefinicao.length > 0 && (
            <div className="mb-10 rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-4">
              <h3 className="mb-3 text-[10px] font-black uppercase tracking-widest text-yellow-400">Esperando o adversário sair da luta anterior</h3>
              <div className="flex flex-wrap gap-2">
                {atletasAguardandoDefinicao.map((luta) => {
                  const isA1 = isAtletaValido(luta.atleta_1);
                  const nome = isA1 ? limparNome(luta.atleta_1) : limparNome(luta.atleta_2);
                  return <span key={`aguarda-${luta.id}`} className="rounded-lg border border-yellow-500/20 bg-black/40 px-3 py-2 text-[9px] font-black uppercase text-zinc-300">{nome} · {getTextoBaia(luta)}</span>;
                })}
              </div>
            </div>
          )}

          {confrontosReais.length > 0 && (
            <div className="mb-10">
              <h3 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-xs font-black uppercase tracking-widest text-white md:text-sm">
                Lutas desta chave
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {confrontosReais.map(luta => {
                  const a1 = nomeSlot(luta, 1); const a2 = nomeSlot(luta, 2);
                  const foto1 = buscarFotoPorId(luta.atleta_1_id); const foto2 = buscarFotoPorId(luta.atleta_2_id);

                  return (
                    <div key={luta.id} className={`relative flex flex-col overflow-hidden rounded-xl border bg-[#0c1220] transition-all hover:border-[#57d8ff]/50 ${luta.status_luta === "em_andamento" ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]" : "border-[#57d8ff]/20"}`}>
                      <div className={`flex items-center justify-between border-b px-3 py-2 ${luta.status_luta === "em_andamento" ? "border-red-500/20 bg-red-500/10" : "border-[#57d8ff]/20 bg-[#57d8ff]/10"}`}>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${luta.status_luta === "em_andamento" ? "text-red-400" : "text-[#57d8ff]"}`}>{rotuloLuta(luta)}</span>
                        {luta.status_luta === "em_andamento" && <span className="rounded bg-red-500 px-1.5 py-0.5 text-[8px] font-black uppercase text-white shadow-sm animate-pulse">Lutando</span>}
                      </div>

                      <div className="flex flex-col gap-1.5 p-3">
                        <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/40 p-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-600 bg-zinc-800 text-xs font-black text-zinc-400">
                              {foto1 ? <img src={foto1} className="h-full w-full object-cover" alt="" /> : a1 ? a1.charAt(0) : "?"}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-xs font-black uppercase tracking-tight text-white">{a1 || "A definir"}</span>
                              <span className="truncate text-[9px] uppercase text-zinc-500">{luta.equipe_1 || "Sem equipe"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="relative my-0.5 flex h-1 w-full items-center justify-center">
                          <div className="absolute z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[#57d8ff]/30 bg-[#0c1220] text-[8px] font-black text-[#57d8ff]">VS</div>
                          <div className="w-full border-t border-white/5"></div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/40 p-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-600 bg-zinc-800 text-xs font-black text-zinc-400">
                              {foto2 ? <img src={foto2} className="h-full w-full object-cover" alt="" /> : a2 ? a2.charAt(0) : "?"}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-xs font-black uppercase tracking-tight text-white">{a2 || "A definir"}</span>
                              <span className="truncate text-[9px] uppercase text-zinc-500">{luta.equipe_2 || "Sem equipe"}</span>
                            </div>
                          </div>
                        </div>

                        {luta.horario_estimado && (
                          <div className="mt-1 flex items-center justify-between rounded border border-white/5 bg-black/30 p-1.5 px-1">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{luta.tatame || "Sem tatame"}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-yellow-500">Previsto: {formatarHorarioEstimado(luta.horario_estimado)}</span>
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
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0a0a0e] py-10 text-center text-sm font-bold text-zinc-500">
              {temCampeao ? `${campeaoData.nome} já fechou esta chave.` : "Nenhum confronto pendente nesta categoria."}
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
