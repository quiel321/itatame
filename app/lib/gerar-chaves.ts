/* eslint-disable @typescript-eslint/no-explicit-any */
import { grupoInscricao, absolutoDaInscricao, chaveDoGrupo, normalizarCompeticao, type InscricaoCompeticao, type CategoriaCompeticao } from './categorias-competicao';
type Participante = InscricaoCompeticao & { equipe_atleta: string; equipe_chave: string };

function chaveEquipe(inscricao: InscricaoCompeticao) {
  if (inscricao.equipe_id) return `ID:${inscricao.equipe_id}`;
  const nome = normalizarCompeticao(inscricao.equipe);
  // Sem uma equipe informada, atletas diferentes não podem ser presumidos como companheiros.
  return nome && nome !== 'SEM EQUIPE' ? `NOME:${nome}` : `ATLETA:${inscricao.atleta_id ?? inscricao.id}`;
}

function chaveAcademia(inscricao: InscricaoCompeticao) {
  const nome = normalizarCompeticao(inscricao.academia);
  return nome && nome !== 'SEM ACADEMIA' ? `ACAD:${nome}` : '';
}

function ehByeParticipante(atleta?: Participante | null) {
  const nome = String(atleta?.atleta || atleta?.nome || '').trim().toUpperCase();
  return !atleta || nome === 'BYE' || nome === 'TBD';
}

function conflitoPrimeiraLuta(a: Participante, b: Participante) {
  if (ehByeParticipante(a) || ehByeParticipante(b)) return 0;
  let score = 0;
  if (a.equipe_chave && a.equipe_chave === b.equipe_chave) score += 2;
  const academiaA = chaveAcademia(a);
  const academiaB = chaveAcademia(b);
  if (academiaA && academiaB && academiaA === academiaB) score += 1;
  return score;
}

function ordenarTrio(atletas: Participante[]) {
  const trio = atletas.slice(0, 3);
  let melhor = trio;
  let melhorScore = Infinity;
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const k = [0, 1, 2].find(indice => indice !== i && indice !== j) as number;
      const score = conflitoPrimeiraLuta(trio[i], trio[j]);
      if (score < melhorScore) {
        melhorScore = score;
        melhor = [trio[i], trio[j], trio[k]];
      }
    }
  }
  return melhor;
}

function combinacoes(tamanho: number, escolha: number) {
  const resultado: number[][] = [];
  const atual: number[] = [];
  const recuar = (inicio: number) => {
    if (atual.length === escolha) {
      resultado.push([...atual]);
      return;
    }
    for (let i = inicio; i < tamanho; i++) {
      atual.push(i);
      recuar(i + 1);
      atual.pop();
    }
  };
  recuar(0);
  return resultado;
}

function dividirDoisTrios(atletas: Participante[]) {
  const lista = atletas.slice(0, 6);
  let melhor: { esquerda: Participante[]; direita: Participante[] } | null = null;
  let melhorScore = Infinity;
  for (const indices of combinacoes(lista.length, 3)) {
    const esquerdaBruta = indices.map(indice => lista[indice]);
    const direitaBruta = lista.filter((_, indice) => !indices.includes(indice));
    const esquerda = ordenarTrio(esquerdaBruta);
    const direita = ordenarTrio(direitaBruta);
    const conflito = conflitoPrimeiraLuta(esquerda[0], esquerda[1]) + conflitoPrimeiraLuta(direita[0], direita[1]);
    const equipesEsquerda = new Set(esquerda.map(atleta => atleta.equipe_chave));
    const equipesDireita = new Set(direita.map(atleta => atleta.equipe_chave));
    const academiasEsquerda = new Set(esquerda.map(chaveAcademia).filter(Boolean));
    const academiasDireita = new Set(direita.map(chaveAcademia).filter(Boolean));
    let ladosCompartilhados = 0;
    equipesEsquerda.forEach(equipe => { if (equipesDireita.has(equipe)) ladosCompartilhados += 1; });
    academiasEsquerda.forEach(academia => { if (academiasDireita.has(academia)) ladosCompartilhados += 1; });
    const score = conflito * 10 - ladosCompartilhados;
    if (score < melhorScore) {
      melhorScore = score;
      melhor = { esquerda, direita };
    }
  }
  return melhor || { esquerda: ordenarTrio(lista.slice(0, 3)), direita: ordenarTrio(lista.slice(3, 6)) };
}

function dadosAtleta(atleta?: Participante) {
  return {
    nome: atleta?.atleta || atleta?.nome || 'BYE',
    equipe: atleta?.equipe_atleta || '',
    atleta_id: atleta?.atleta_id || null,
  };
}

function priorizarConfrontosDiversos(porSeed: Participante[], posicoes: number[], tamanho: number) {
  const capacidade = tamanho / 2;
  const otimizarMetade = (seeds: number[]) => {
    const indices = seeds.map(seed => seed - 1);
    const pares: Array<[number, number]> = [];
    for (let i = 0; i < indices.length; i += 2) pares.push([indices[i], indices[i + 1]]);
    const score = () => pares.reduce((acc, [a, b]) => acc + conflitoPrimeiraLuta(porSeed[a], porSeed[b]), 0);
    let atual = score();
    if (atual === 0) return;
    for (let rodada = 0; rodada < 8 && atual > 0; rodada++) {
      let melhorou = false;
      for (let i = 0; i < indices.length; i++) {
        if (ehByeParticipante(porSeed[indices[i]])) continue;
        for (let j = i + 1; j < indices.length; j++) {
          if (ehByeParticipante(porSeed[indices[j]])) continue;
          [porSeed[indices[i]], porSeed[indices[j]]] = [porSeed[indices[j]], porSeed[indices[i]]];
          const novo = score();
          if (novo < atual) {
            atual = novo;
            melhorou = true;
            if (atual === 0) return;
          } else {
            [porSeed[indices[i]], porSeed[indices[j]]] = [porSeed[indices[j]], porSeed[indices[i]]];
          }
        }
      }
      if (!melhorou) break;
    }
  };
  otimizarMetade(posicoes.slice(0, capacidade));
  otimizarMetade(posicoes.slice(capacidade));
  return porSeed;
}
export function prepararGrupos(inscricoes: InscricaoCompeticao[], tipo: 'peso' | 'absoluto', categorias: CategoriaCompeticao[]) {
  const grupos: Record<string, Participante[]> = {};
  const metadados: Record<string, ReturnType<typeof grupoInscricao>> = {};
  for (const inscricao of inscricoes) {
    if (inscricao.status_checkin?.startsWith('desclassificado')) continue;
    if (tipo === 'peso' && String(inscricao.categoria).toLowerCase().includes('absoluto')) continue;
    if (tipo === 'absoluto' && !inscricao.absoluto) continue;
    if (tipo === 'absoluto' && !absolutoDaInscricao(inscricao, categorias)) continue;
    if (!inscricao.atleta_id) throw new Error(`Inscrição ${inscricao.id}: atleta não vinculado.`);
    let grupo;
    try { grupo = grupoInscricao(inscricao, tipo, categorias); }
    catch (error) { throw new Error(`Inscrição ${inscricao.id} (${inscricao.atleta}): ${(error as Error).message}`); }
    const chave = chaveDoGrupo(grupo);
    (grupos[chave] ||= []).push({
      ...inscricao,
      equipe_atleta: inscricao.equipe?.trim() || 'SEM EQUIPE',
      equipe_chave: chaveEquipe(inscricao),
    });
    metadados[chave] = grupo;
  }
  for (const [chave, atletas] of Object.entries(grupos)) {
    if (new Set(atletas.map(a => a.atleta_id)).size !== atletas.length) throw new Error(`${chave}: atleta duplicado.`);
  }
  dividirGruposAcimaDe64(grupos, metadados);
  return { grupos, metadados };
}

const LIMITE_ATLETAS_POR_CHAVE = 64;

function distribuirEmChaves(atletas: Participante[], partes: number) {
  const baldes: Participante[][] = Array.from({ length: partes }, () => []);
  const porEquipe = new Map<string, Participante[]>();
  atletas.forEach((atleta) => {
    const lista = porEquipe.get(atleta.equipe_chave) || [];
    lista.push(atleta);
    porEquipe.set(atleta.equipe_chave, lista);
  });
  [...porEquipe.values()]
    .sort((a, b) => b.length - a.length)
    .forEach((equipe) => {
      equipe.forEach((atleta) => {
        const destino = baldes
          .map((balde, indice) => ({ indice, total: balde.length }))
          .sort((a, b) => a.total - b.total || a.indice - b.indice)[0];
        baldes[destino.indice].push(atleta);
      });
    });
  return baldes.filter((balde) => balde.length > 0);
}

function dividirGruposAcimaDe64(
  grupos: Record<string, Participante[]>,
  metadados: Record<string, ReturnType<typeof grupoInscricao>>,
) {
  for (const [chave, atletas] of Object.entries(grupos)) {
    if (atletas.length <= LIMITE_ATLETAS_POR_CHAVE) continue;
    const meta = metadados[chave];
    const partes = Math.ceil(atletas.length / LIMITE_ATLETAS_POR_CHAVE);
    const fatias = distribuirEmChaves(atletas, partes);
    delete grupos[chave];
    delete metadados[chave];
    fatias.forEach((fatia, indice) => {
      const novaChave = `${chave}::chave-${indice + 1}`;
      grupos[novaChave] = fatia;
      metadados[novaChave] = { ...meta, categoria: `${meta.categoria} · Chave ${indice + 1}` };
    });
  }
}
  function embaralhar<T>(lista: T[]) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
  }
  function gerarMapaPosicoes(tamanho: number): number[] {
    if (tamanho === 2) return [1, 2];
    const mapaAnterior = gerarMapaPosicoes(tamanho / 2);
    const novoMapa: number[] = [];
    for (let i = 0; i < mapaAnterior.length; i++) {
      novoMapa.push(mapaAnterior[i]);
      novoMapa.push(tamanho - mapaAnterior[i] + 1);
    }
    return novoMapa;
  }

  function distribuirEquipesEmLadosOpostos(atletas: Participante[], tamanho: number, posicoes: number[]) {
    const grupos = new Map<string, Participante[]>();
    atletas.forEach((atleta) => {
      const equipe = atleta.equipe_chave;
      const lista = grupos.get(equipe) || [];
      lista.push(atleta);
      grupos.set(equipe, lista);
    });

    const esquerda: Participante[] = [];
    const direita: Participante[] = [];
    const capacidade = tamanho / 2;
    const gruposOrdenados = Array.from(grupos.values())
      .map((grupo) => embaralhar([...grupo]))
      .sort((a, b) => b.length - a.length);

    // Escolhe globalmente quantos atletas de cada equipe irão para cada metade.
    // Para dois atletas da mesma equipe, a única distribuição possível é 1 + 1,
    // garantindo que eles só possam se encontrar na final.
    let possibilidades = new Map<number, number[]>([[0, []]]);
    gruposOrdenados.forEach((grupo) => {
      const minimo = Math.floor(grupo.length / 2);
      const maximo = Math.ceil(grupo.length / 2);
      const opcoes = minimo === maximo ? [minimo] : [minimo, maximo];
      const proximas = new Map<number, number[]>();
      possibilidades.forEach((escolhas, totalEsquerda) => {
        opcoes.forEach((quantidadeEsquerda) => {
          const novoTotal = totalEsquerda + quantidadeEsquerda;
          if (novoTotal <= capacidade && !proximas.has(novoTotal)) {
            proximas.set(novoTotal, [...escolhas, quantidadeEsquerda]);
          }
        });
      });
      possibilidades = proximas;
    });

    const minimoEsquerda = Math.max(0, atletas.length - capacidade);
    const solucao = Array.from(possibilidades.entries())
      .filter(([total]) => total >= minimoEsquerda)
      .sort(([a], [b]) => Math.abs(atletas.length - 2 * a) - Math.abs(atletas.length - 2 * b))[0];
    if (!solucao) throw new Error('Não foi possível distribuir as equipes com segurança na chave.');

    gruposOrdenados.forEach((grupo, indice) => {
      const quantidadeEsquerda = solucao[1][indice];
      esquerda.push(...grupo.slice(0, quantidadeEsquerda));
      direita.push(...grupo.slice(quantidadeEsquerda));
    });

    embaralhar(esquerda);
    embaralhar(direita);
    const bye = () => ({ atleta: 'BYE', nome: 'BYE', equipe_atleta: '', equipe_chave: `BYE:${Math.random()}` } as Participante);
    while (esquerda.length < capacidade) esquerda.push(bye());
    while (direita.length < capacidade) direita.push(bye());

    const porSeed = Array.from({ length: tamanho }, () => bye());
    posicoes.slice(0, capacidade).forEach((seed, indice) => { porSeed[seed - 1] = esquerda[indice]; });
    posicoes.slice(capacidade).forEach((seed, indice) => { porSeed[seed - 1] = direita[indice]; });
    return porSeed;
  }


export function montarChaves(eventoId: string, preparados: ReturnType<typeof prepararGrupos>) {
 const { grupos, metadados } = preparados;
 const resultado: Record<string, unknown>[] = [];
      for (const grupo in grupos) {
        let atletasDoGrupo: any[] = grupos[grupo];
        
        // Embaralha antes de distribuir as equipes nos dois lados da chave.
        atletasDoGrupo = embaralhar([...atletasDoGrupo]);

        const categoria = metadados[grupo].categoria;
        const faixa = metadados[grupo].faixa;

        const baseLutaTriangular = {
          evento_id: eventoId,
          categoria,
          categoria_id: metadados[grupo].categoria_id,
          tempo_minutos: metadados[grupo].tempo_minutos,
          faixa,
          vencedor: null,
          vencedor_id: null,
          status_luta: 'agendada',
          pontuacao_atleta_1: { pontos: 0, punicoes: 0, vantagens: 0 },
          pontuacao_atleta_2: { pontos: 0, punicoes: 0, vantagens: 0 },
        };
        const numeroVisual = (valor: number) => String(valor).padStart(2, '0');
        const montarTrio = (
          atletas: Participante[],
          ids: { luta1: number; luta2: number; decisao: number },
          proximaDecisao: number | null,
          lado: 'esquerda' | 'direita',
          numeros: [number, number, number],
          fases: { luta1: string; luta2: string; decisao: string },
        ) => {
          const primeiro = dadosAtleta(atletas[0]);
          const segundo = dadosAtleta(atletas[1]);
          const terceiro = dadosAtleta(atletas[2]);
          return [
            {
              ...baseLutaTriangular,
              id_visual: String(ids.luta1),
              atleta_1: primeiro.nome, equipe_1: primeiro.equipe, numero_1: numeroVisual(numeros[0]), atleta_1_id: primeiro.atleta_id,
              atleta_2: segundo.nome, equipe_2: segundo.equipe, numero_2: numeroVisual(numeros[1]), atleta_2_id: segundo.atleta_id,
              fase: fases.luta1, ordem: ids.luta1, lado, proxima_luta: ids.decisao,
            },
            {
              ...baseLutaTriangular,
              id_visual: String(ids.luta2),
              atleta_1: 'TBD', equipe_1: '', numero_1: '', atleta_1_id: null,
              atleta_2: terceiro.nome, equipe_2: terceiro.equipe, numero_2: numeroVisual(numeros[2]), atleta_2_id: terceiro.atleta_id,
              fase: fases.luta2, ordem: ids.luta2, lado, proxima_luta: ids.decisao,
            },
            {
              ...baseLutaTriangular,
              id_visual: String(ids.decisao),
              atleta_1: 'TBD', equipe_1: '', numero_1: '', atleta_1_id: null,
              atleta_2: 'TBD', equipe_2: '', numero_2: '', atleta_2_id: null,
              fase: fases.decisao, ordem: ids.decisao, lado: ids.decisao === 999 ? 'centro' : lado, proxima_luta: proximaDecisao,
            },
          ];
        };

        // Três atletas: vencedor da luta 1 vai à final; o perdedor enfrenta a baia.
        if (atletasDoGrupo.length === 3) {
          const trio = ordenarTrio(atletasDoGrupo);
          resultado.push(...montarTrio(
            trio,
            { luta1: 1, luta2: 2, decisao: 999 },
            null,
            'esquerda',
            [1, 2, 3],
            {
              luta1: 'Semifinal 1 · Chave de 3',
              luta2: 'Semifinal 2 · Chave de 3',
              decisao: 'Final · Chave de 3',
            },
          ));
          continue;
        }

        // Seis atletas: duas chaves de 3, uma em cada lado, e a final entre os vencedores.
        if (atletasDoGrupo.length === 6) {
          const { esquerda, direita } = dividirDoisTrios(atletasDoGrupo);
          resultado.push(...montarTrio(
            esquerda,
            { luta1: 1, luta2: 2, decisao: 101 },
            999,
            'esquerda',
            [1, 2, 3],
            {
              luta1: 'Luta 1 esquerda · Chave de 3',
              luta2: 'Baia esquerda · Chave de 3',
              decisao: 'Decisão esquerda · Chave de 3',
            },
          ));
          resultado.push(...montarTrio(
            direita,
            { luta1: 3, luta2: 4, decisao: 102 },
            999,
            'direita',
            [4, 5, 6],
            {
              luta1: 'Luta 1 direita · Chave de 3',
              luta2: 'Baia direita · Chave de 3',
              decisao: 'Decisão direita · Chave de 3',
            },
          ));
          resultado.push({
            ...baseLutaTriangular,
            id_visual: '999',
            atleta_1: 'TBD', equipe_1: '', numero_1: '', atleta_1_id: null,
            atleta_2: 'TBD', equipe_2: '', numero_2: '', atleta_2_id: null,
            fase: 'Final · Chave de 6', ordem: 999, lado: 'centro', proxima_luta: null,
          });
          continue;
        }

        let tamanhoChave = 2;
        while (tamanhoChave < atletasDoGrupo.length) tamanhoChave *= 2;
        if (tamanhoChave > 64) throw new Error("Categoria com mais de 64 atletas. Divida a categoria antes de gerar.");

        const posicoes = gerarMapaPosicoes(tamanhoChave);
        atletasDoGrupo = distribuirEquipesEmLadosOpostos(atletasDoGrupo.slice(0, tamanhoChave), tamanhoChave, posicoes);
        atletasDoGrupo = priorizarConfrontosDiversos(atletasDoGrupo, posicoes, tamanhoChave);

        const lutas: any[] = [];
        
        const at = (idx: number) => ({
          nome: atletasDoGrupo[idx]?.atleta || atletasDoGrupo[idx]?.nome || "BYE",
          equipe: atletasDoGrupo[idx]?.equipe_atleta || "",
          atleta_id: atletasDoGrupo[idx]?.atleta_id || null 
        });

        let faseInicialNome = "Final";
        if (tamanhoChave === 4) faseInicialNome = "Semifinal";
        if (tamanhoChave === 8) faseInicialNome = "Quartas";
        if (tamanhoChave === 16) faseInicialNome = "Oitavas";
        if (tamanhoChave === 32) faseInicialNome = "16-Avos";
        if (tamanhoChave === 64) faseInicialNome = "32-Avos";

        // PRIMEIRA RODADA
        for (let i = 0; i < tamanhoChave / 2; i++) {
          const seed1 = posicoes[i * 2];
          const seed2 = posicoes[i * 2 + 1];
          const idAtual = String(i + 1);
          const proxId = tamanhoChave === 2 ? null : (tamanhoChave === 4 ? 999 : 101 + Math.floor(i / 2));

          lutas.push({
            id_visual: idAtual, 
            evento_id: eventoId, 
            categoria,
            categoria_id: metadados[grupo].categoria_id, tempo_minutos: metadados[grupo].tempo_minutos, 
            faixa,
            atleta_1: at(seed1 - 1).nome, 
            equipe_1: at(seed1 - 1).equipe, 
            numero_1: String(seed1).padStart(2, '0'),
            atleta_1_id: at(seed1 - 1).atleta_id,
            
            atleta_2: at(seed2 - 1).nome, 
            equipe_2: at(seed2 - 1).equipe, 
            numero_2: String(seed2).padStart(2, '0'),
            atleta_2_id: at(seed2 - 1).atleta_id,
            
            vencedor: null,
            vencedor_id: null, 
            fase: faseInicialNome, 
            ordem: i + 1,
            lado: (i + 1) <= (tamanhoChave / 4) ? "esquerda" : "direita",
            proxima_luta: proxId,
            status_luta: "agendada",
            pontuacao_atleta_1: {"pontos":0,"punicoes":0,"vantagens":0},
            pontuacao_atleta_2: {"pontos":0,"punicoes":0,"vantagens":0}
          });
        }

        // TBDs (O RESTANTE DA ÁRVORE DE LUTAS)
        let faseAtual = tamanhoChave / 2;
        let idFase = 1;
        
        while (faseAtual > 1) {
          faseAtual /= 2; 
          
          let nomeFase = "Fase";
          if (faseAtual === 16) nomeFase = "16-Avos";
          if (faseAtual === 8) nomeFase = "Oitavas";
          if (faseAtual === 4) nomeFase = "Quartas";
          if (faseAtual === 2) nomeFase = "Semifinal";
          if (faseAtual === 1) nomeFase = "Final";

          for (let i = 0; i < faseAtual; i++) {
            const isFinal = faseAtual === 1;
            const idVis = isFinal ? "999" : String(idFase * 100 + i + 1);
            const prox = isFinal ? null : (faseAtual === 2 ? 999 : ((idFase + 1) * 100 + Math.floor(i / 2) + 1));
            
            lutas.push({
              id_visual: idVis, 
              evento_id: eventoId, 
              categoria,
            categoria_id: metadados[grupo].categoria_id, tempo_minutos: metadados[grupo].tempo_minutos, 
              faixa,
              atleta_1: "TBD", 
              equipe_1: "", 
              numero_1: "", 
              atleta_1_id: null,
              
              atleta_2: "TBD", 
              equipe_2: "", 
              numero_2: "", 
              atleta_2_id: null,
              
              vencedor: null, 
              vencedor_id: null,
              fase: nomeFase,  
              ordem: i + 1,
              lado: isFinal ? "centro" : (i + 1) <= (faseAtual / 2) ? "esquerda" : "direita",
              proxima_luta: prox,
              status_luta: "agendada",
              pontuacao_atleta_1: {"pontos":0,"punicoes":0,"vantagens":0},
              pontuacao_atleta_2: {"pontos":0,"punicoes":0,"vantagens":0}
            });
          }
          idFase++;
        }

        resultado.push(...lutas);
      }
      

return resultado;
}
