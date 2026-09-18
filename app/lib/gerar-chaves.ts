/* eslint-disable @typescript-eslint/no-explicit-any */
import { grupoInscricao, absolutoDaInscricao, chaveDoGrupo, normalizarCompeticao, type InscricaoCompeticao, type CategoriaCompeticao } from './categorias-competicao';
type Participante = InscricaoCompeticao & { equipe_atleta: string; equipe_chave: string };

function chaveEquipe(inscricao: InscricaoCompeticao) {
  if (inscricao.equipe_id) return `ID:${inscricao.equipe_id}`;
  const nome = normalizarCompeticao(inscricao.equipe);
  // Sem uma equipe informada, atletas diferentes não podem ser presumidos como companheiros.
  return nome && nome !== 'SEM EQUIPE' ? `NOME:${nome}` : `ATLETA:${inscricao.atleta_id ?? inscricao.id}`;
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
    if (atletas.length > 64) throw new Error(`${chave}: mais de 64 atletas. Nenhum atleta será descartado.`);
    if (new Set(atletas.map(a => a.atleta_id)).size !== atletas.length) throw new Error(`${chave}: atleta duplicado.`);
  }
  return { grupos, metadados };
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

        // Regra oficial para três atletas: o vencedor da primeira semifinal
        // vai à final; o perdedor enfrenta o terceiro atleta e o vencedor da
        // segunda semifinal completa a final.
        if (atletasDoGrupo.length === 3) {
          if (atletasDoGrupo[0].equipe_atleta === atletasDoGrupo[1].equipe_atleta && atletasDoGrupo[0].equipe_atleta !== atletasDoGrupo[2].equipe_atleta) [atletasDoGrupo[1], atletasDoGrupo[2]] = [atletasDoGrupo[2], atletasDoGrupo[1]];
          const atletaTriangular = (idx: number) => ({
            nome: atletasDoGrupo[idx]?.atleta || atletasDoGrupo[idx]?.nome || "BYE",
            equipe: atletasDoGrupo[idx]?.equipe_atleta || "",
            atleta_id: atletasDoGrupo[idx]?.atleta_id || null,
          });
          const primeiro = atletaTriangular(0);
          const segundo = atletaTriangular(1);
          const terceiro = atletaTriangular(2);
          const baseLuta = {
            evento_id: eventoId,
            categoria,
            categoria_id: metadados[grupo].categoria_id, tempo_minutos: metadados[grupo].tempo_minutos,
            faixa,
            vencedor: null,
            vencedor_id: null,
            status_luta: 'agendada',
            pontuacao_atleta_1: { pontos: 0, punicoes: 0, vantagens: 0 },
            pontuacao_atleta_2: { pontos: 0, punicoes: 0, vantagens: 0 },
          };
          const lutasTriangulares = [
            {
              ...baseLuta,
              id_visual: '1',
              atleta_1: primeiro.nome, equipe_1: primeiro.equipe, numero_1: '01', atleta_1_id: primeiro.atleta_id,
              atleta_2: segundo.nome, equipe_2: segundo.equipe, numero_2: '02', atleta_2_id: segundo.atleta_id,
              fase: 'Semifinal 1 · Chave de 3', ordem: 1, lado: 'esquerda', proxima_luta: 999,
            },
            {
              ...baseLuta,
              id_visual: '2',
              atleta_1: 'TBD', equipe_1: '', numero_1: '', atleta_1_id: null,
              atleta_2: terceiro.nome, equipe_2: terceiro.equipe, numero_2: '03', atleta_2_id: terceiro.atleta_id,
              fase: 'Semifinal 2 · Chave de 3', ordem: 2, lado: 'direita', proxima_luta: 999,
            },
            {
              ...baseLuta,
              id_visual: '999',
              atleta_1: 'TBD', equipe_1: '', numero_1: '', atleta_1_id: null,
              atleta_2: 'TBD', equipe_2: '', numero_2: '', atleta_2_id: null,
              fase: 'Final · Chave de 3', ordem: 3, lado: 'centro', proxima_luta: null,
            },
          ];

          resultado.push(...lutasTriangulares);
          continue;
        }

        let tamanhoChave = 2;
        while (tamanhoChave < atletasDoGrupo.length) tamanhoChave *= 2;
        if (tamanhoChave > 64) throw new Error("Categoria com mais de 64 atletas. Divida a categoria antes de gerar.");

        const posicoes = gerarMapaPosicoes(tamanhoChave);
        atletasDoGrupo = distribuirEquipesEmLadosOpostos(atletasDoGrupo.slice(0, tamanhoChave), tamanhoChave, posicoes);

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
