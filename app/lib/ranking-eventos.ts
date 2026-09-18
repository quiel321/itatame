import { chaveRankingEquipe, nomeExibicaoEquipe } from './equipes-nome';
import { idBaiaDaPrimeiraChaveDeTres } from './chave-de-tres';

export function lutaEhAbsoluto(luta: { categoria?: string | null }) {
  return String(luta.categoria || '').toLowerCase().includes('absoluto');
}

export function calcularResultadosChaves(lutas: any[], regrasPorEvento?: Record<string, any>, tipo: 'todos' | 'peso' | 'absoluto' = 'todos') {
    const rankingEquipes: Record<string, { nome: string, ouro: number, prata: number, bronze: number, pts: number }> = {};
    const rankingAtletas: Record<string, { ouro: number, prata: number, bronze: number, vitorias: number, lutas: number, vitorias_wo: number, pts: number, nome: string, equipe: string }> = {};

    function registrarEquipe(nomeBruto?: string | null) {
      const chave = chaveRankingEquipe(nomeBruto);
      if (!chave) return '';
      if (!rankingEquipes[chave]) rankingEquipes[chave] = { nome: String(nomeBruto || '').trim(), ouro: 0, prata: 0, bronze: 0, pts: 0 };
      else rankingEquipes[chave].nome = nomeExibicaoEquipe(rankingEquipes[chave].nome, nomeBruto);
      return chave;
    }

    lutas.forEach(luta => {
      if (luta.status_luta !== 'concluida') return;

      const vId = String(luta.vencedor_id || luta.vencedor);
      if (!vId || vId === "null" || vId === "") return;

      const isAtleta1Vencedor = String(luta.atleta_1_id) === vId || luta.atleta_1 === luta.vencedor;
      const isAtleta2Vencedor = String(luta.atleta_2_id) === vId || luta.atleta_2 === luta.vencedor;
      
      const nomeVencedor = isAtleta1Vencedor ? luta.atleta_1 : isAtleta2Vencedor ? luta.atleta_2 : luta.vencedor;
      const equipeVencedor = isAtleta1Vencedor ? luta.equipe_1 : isAtleta2Vencedor ? luta.equipe_2 : null;
      if (!isCompetidorReal(nomeVencedor)) return;
      
      const perdedorId = isAtleta1Vencedor ? String(luta.atleta_2_id || luta.atleta_2) : String(luta.atleta_1_id || luta.atleta_1);
      const nomePerdedor = isAtleta1Vencedor ? luta.atleta_2 : luta.atleta_1;
      const equipePerdedora = isAtleta1Vencedor ? luta.equipe_2 : luta.equipe_1;

      let regras: any = null;
      if (regrasPorEvento && luta.evento_id) {
        try {
          regras = typeof regrasPorEvento[String(luta.evento_id)] === 'string' 
                    ? JSON.parse(regrasPorEvento[String(luta.evento_id)]) 
                    : regrasPorEvento[String(luta.evento_id)];
        } catch(e) {}
      }

      const ptsOuro = regras?.ouro !== undefined ? Number(regras.ouro) : 9;
      const ptsPrata = regras?.prata !== undefined ? Number(regras.prata) : 3;
      const ptsBronze = regras?.bronze !== undefined ? Number(regras.bronze) : 1;
      const ptsVitoriaNormal = regras?.vitoria !== undefined ? Number(regras.vitoria) : 0;
      const fase = String(luta.fase || '').toLowerCase();
      const ehFinal = fase.startsWith('final') || String(luta.id_visual) === '999';
      const ehPrimeiraSemifinalDeTres = Boolean(idBaiaDaPrimeiraChaveDeTres(luta.id_visual, luta.fase));
      const ehSemifinal = !ehFinal && !ehPrimeiraSemifinalDeTres && (fase.includes('semi') || fase.includes('3º lugar') || String(luta.proxima_luta) === '999');
      
      const metodo = String(luta.metodo_vitoria || '').toLowerCase();
      const perdedorEhCompetidorReal = isCompetidorReal(nomePerdedor);
      const isWO = metodo === 'wo' || perdedorId === 'BYE' || !perdedorId || perdedorId === 'null' || !perdedorEhCompetidorReal;

      // Ausência de adversário real e W.O. operacional não pontuam. Bye sem oponente, após checagem, pontua.
      if ((metodo === 'wo' || metodo === 'ausencia') && perdedorEhCompetidorReal) return;

      const woPontua = regras?.wo_pontua !== undefined ? regras.wo_pontua : true; 
      const devePontuar = !(isWO && !woPontua);
      const lutaAbsoluto = lutaEhAbsoluto(luta);
      if (tipo === 'peso' && lutaAbsoluto) return;
      if (tipo === 'absoluto' && !lutaAbsoluto) return;
      if (lutaAbsoluto && regras?.absoluto_pontua === false) return;

      if (!rankingAtletas[vId]) rankingAtletas[vId] = { ouro: 0, prata: 0, bronze: 0, vitorias: 0, lutas: 0, vitorias_wo: 0, pts: 0, nome: nomeVencedor, equipe: equipeVencedor || "Sem Equipe" };
      rankingAtletas[vId].lutas += 1;
      rankingAtletas[vId].vitorias += 1;

      if (perdedorEhCompetidorReal && perdedorId && perdedorId !== "null") {
          if (!rankingAtletas[perdedorId]) rankingAtletas[perdedorId] = { ouro: 0, prata: 0, bronze: 0, vitorias: 0, lutas: 0, vitorias_wo: 0, pts: 0, nome: nomePerdedor, equipe: equipePerdedora || "Sem Equipe" };
          rankingAtletas[perdedorId].lutas += 1;
      }

      if (isWO) rankingAtletas[vId].vitorias_wo += 1;

      const chaveEquipeVencedor = registrarEquipe(equipeVencedor);
      const chaveEquipePerdedora = perdedorEhCompetidorReal ? registrarEquipe(equipePerdedora) : '';

      if (ehFinal) {
        rankingAtletas[vId].ouro += 1;
        if(devePontuar) rankingAtletas[vId].pts += ptsOuro;
        
        if (chaveEquipeVencedor) {
          rankingEquipes[chaveEquipeVencedor].ouro += 1;
          if(devePontuar) rankingEquipes[chaveEquipeVencedor].pts += ptsOuro;
        }
        
        if (perdedorEhCompetidorReal) {
            rankingAtletas[perdedorId].prata += 1;
            rankingAtletas[perdedorId].pts += ptsPrata; 
            if (chaveEquipePerdedora) {
              rankingEquipes[chaveEquipePerdedora].prata += 1;
              rankingEquipes[chaveEquipePerdedora].pts += ptsPrata;
            }
          }
      } 
      else if (ehSemifinal) {
          if(devePontuar) rankingAtletas[vId].pts += ptsVitoriaNormal;
          if (chaveEquipeVencedor && devePontuar) rankingEquipes[chaveEquipeVencedor].pts += ptsVitoriaNormal;

          if (perdedorEhCompetidorReal) {
              rankingAtletas[perdedorId].bronze += 1;
              rankingAtletas[perdedorId].pts += ptsBronze;
              if (chaveEquipePerdedora) {
                rankingEquipes[chaveEquipePerdedora].bronze += 1;
                rankingEquipes[chaveEquipePerdedora].pts += ptsBronze;
              }
          }
      } else {
          if(devePontuar) rankingAtletas[vId].pts += ptsVitoriaNormal;
          if (chaveEquipeVencedor && devePontuar) rankingEquipes[chaveEquipeVencedor].pts += ptsVitoriaNormal;
      }
    });

    return {
      equipes: Object.values(rankingEquipes),
      atletas: Object.entries(rankingAtletas).map(([atleta_id, dados]) => ({ atleta_id, ...dados }))
    };
  }

  export type RegrasPontuacaoEvento = {
    ouro?: number;
    prata?: number;
    bronze?: number;
    vitoria?: number;
    wo_pontua?: boolean;
    absoluto_pontua?: boolean;
    ranking_publicado?: boolean;
    ranking_aplicado?: boolean;
  };

  export function lerRegrasPontuacao(valor: unknown): RegrasPontuacaoEvento {
    if (!valor) return {};
    if (typeof valor === 'string') {
      try {
        const lido = JSON.parse(valor);
        return lido && typeof lido === 'object' ? lido as RegrasPontuacaoEvento : {};
      } catch {
        return {};
      }
    }
    return typeof valor === 'object' ? valor as RegrasPontuacaoEvento : {};
  }

  export function isCompetidorReal(nome: string | null | undefined): boolean {
    if (!nome) return false;
    const cleanName = nome.trim().toUpperCase();
    return !(
      cleanName === '' ||
      cleanName === 'BYE' ||
      cleanName === 'TBD' ||
      cleanName === 'A DEFINIR' ||
      cleanName.includes('SEM OPONENTE') ||
      cleanName.includes('SEM ADVERSÁRIO') ||
      cleanName.includes('SEM ADVERSARIO')
    );
  }
