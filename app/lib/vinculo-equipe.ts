import { chaveEquipeFlexivel, chaveRankingEquipe, encontrarEquipeSemelhante, nomeExibicaoEquipe } from "@/app/lib/equipes-nome";

export type VinculoEquipe = {
  equipe?: string | null;
  academia?: string | null;
};

function nomesUnicos(valores: string[]) {
  const oficiais = new Map<string, string>();
  for (const valor of valores) {
    const nome = String(valor || "").trim();
    const chave = chaveRankingEquipe(nome);
    if (!chave) continue;
    oficiais.set(chave, nomeExibicaoEquipe(oficiais.get(chave) || "", nome));
  }
  return [...oficiais.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function equipesOficiais(vinculos: VinculoEquipe[]) {
  return nomesUnicos(vinculos.map((item) => String(item.equipe || "")));
}

export function academiasDaEquipe(equipe: string, vinculos: VinculoEquipe[]) {
  const chaveEquipe = chaveRankingEquipe(equipe);
  if (!chaveEquipe) return [];
  return nomesUnicos(
    vinculos
      .filter((item) => chaveRankingEquipe(item.equipe) === chaveEquipe)
      .map((item) => String(item.academia || "")),
  );
}

export function nomeOficial(digitado: string, existentes: string[]) {
  const nome = String(digitado || "").trim();
  if (!nome) return "";
  const semelhante = encontrarEquipeSemelhante(
    existentes.map((item, index) => ({ id: String(index), nome: item })),
    nome,
  );
  return semelhante?.nome || nome;
}

export function filtrarNomes(termo: string, existentes: string[]) {
  const chave = chaveEquipeFlexivel(termo);
  if (!chave) return existentes.slice(0, 6);
  return existentes.filter((nome) => chaveEquipeFlexivel(nome).includes(chave)).slice(0, 8);
}
