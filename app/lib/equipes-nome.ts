import { normalizarCompeticao } from './categorias-competicao';

const SUFIXO_EQUIPE = /\s+\b(TEAM|EQUIPE|ACADEMIA|ASSOC(?:IACAO)?|CT|JIU(?:[\s-]?JITSU)?|BJJ|FIGHT)\b$/;

export function chaveRankingEquipe(nome?: string | null) {
  let chave = normalizarCompeticao(nome);
  if (!chave || chave === 'SEM EQUIPE') return '';
  for (let i = 0; i < 4; i++) {
    const proximo = chave.replace(SUFIXO_EQUIPE, '').trim();
    if (proximo === chave) break;
    chave = proximo;
  }
  return chave;
}

export function nomesEquipeIguais(a?: string | null, b?: string | null) {
  const esquerda = chaveRankingEquipe(a);
  const direita = chaveRankingEquipe(b);
  return Boolean(esquerda && direita && esquerda === direita);
}

export function encontrarEquipeSemelhante<T extends { id: string; nome: string }>(equipes: T[], nome?: string | null) {
  const chave = chaveRankingEquipe(nome);
  if (!chave) return null;
  return equipes.find((equipe) => chaveRankingEquipe(equipe.nome) === chave) || null;
}

export function nomeExibicaoEquipe(atual: string, candidato?: string | null) {
  const nome = String(candidato || '').trim();
  if (!nome) return atual;
  if (!atual) return nome;
  return nome.length > atual.length ? nome : atual;
}
