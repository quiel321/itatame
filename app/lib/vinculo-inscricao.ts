import { encontrarEquipeSemelhante, nomesEquipeIguais } from "@/app/lib/equipes-nome";

export type EquipeOficial = { id: string; nome: string; academia?: string | null; professor?: string | null };
export type UnidadeOficial = { equipeId: string; academia: string; professor?: string | null };

export const MENSAGEM_PEDIR_VINCULO = "Olá! Sua inscrição ainda não está ligada a uma equipe e academia oficiais deste campeonato. Abra seu perfil no iTatame e selecione o professor responsável. Assim a pontuação da equipe e da academia fica correta.";

export type SituacaoVinculo = "vinculado" | "sem-equipe" | "sem-academia";

export type VinculoInscricao = {
  situacao: SituacaoVinculo;
  equipe: string | null;
  academia: string | null;
  professor: string | null;
  escrito: string;
};

export function classificarVinculoInscricao(dados: {
  equipeId?: string | null;
  equipeInscricao?: string | null;
  equipePerfil?: string | null;
  academiaPerfil?: string | null;
  professorPerfil?: string | null;
  equipes: EquipeOficial[];
  unidades: UnidadeOficial[];
}): VinculoInscricao {
  const professor = String(dados.professorPerfil || "").trim() || null;
  const equipe = dados.equipes.find((item) => dados.equipeId && item.id === dados.equipeId)
    || encontrarEquipeSemelhante(dados.equipes, dados.equipeInscricao)
    || encontrarEquipeSemelhante(dados.equipes, dados.equipePerfil);

  if (!equipe) {
    return {
      situacao: "sem-equipe",
      equipe: null,
      academia: null,
      professor,
      escrito: String(dados.equipeInscricao || dados.equipePerfil || "").trim(),
    };
  }

  const academiaEscrita = String(dados.academiaPerfil || "").trim();
  const unidade = dados.unidades.find((item) => item.equipeId === equipe.id && (
    nomesEquipeIguais(item.academia, academiaEscrita) || nomesEquipeIguais(item.academia, dados.equipeInscricao)
  ));

  if (!unidade) {
    return {
      situacao: "sem-academia",
      equipe: equipe.nome,
      academia: null,
      professor,
      escrito: academiaEscrita || String(dados.equipeInscricao || "").trim(),
    };
  }

  return {
    situacao: "vinculado",
    equipe: equipe.nome,
    academia: unidade.academia,
    professor: professor || String(unidade.professor || "").trim() || null,
    escrito: "",
  };
}
