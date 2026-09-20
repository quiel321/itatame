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

export function chaveEquipeFlexivel(nome?: string | null) {
  return chaveRankingEquipe(nome).replace(/[\s-]+/g, '');
}

export function nomesEquipeIguais(a?: string | null, b?: string | null) {
  const esquerda = chaveRankingEquipe(a);
  const direita = chaveRankingEquipe(b);
  if (esquerda && direita && esquerda === direita) return true;
  const flexEsquerda = chaveEquipeFlexivel(a);
  const flexDireita = chaveEquipeFlexivel(b);
  return Boolean(flexEsquerda && flexDireita && flexEsquerda === flexDireita);
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

export function nomeEquipeChecagem(
  insc: { equipe?: string | null; equipe_id?: string | null },
  equipes: Array<{ id: string; nome: string }>,
  equipePerfil?: string | null,
) {
  const porId = insc.equipe_id ? equipes.find(equipe => equipe.id === insc.equipe_id) : undefined;
  if (porId?.nome) return porId.nome;
  const semelhante = encontrarEquipeSemelhante(equipes, insc.equipe) || encontrarEquipeSemelhante(equipes, equipePerfil);
  if (semelhante?.nome) return semelhante.nome;
  const nome = String(insc.equipe || equipePerfil || '').trim();
  if (nome && chaveRankingEquipe(nome)) return nome;
  return 'SEM EQUIPE OFICIAL';
}
