import { encontrarEquipeSemelhante, nomesEquipeIguais } from "@/app/lib/equipes-nome";

export type EquipeOficial = { id: string; nome: string; academia?: string | null; professor?: string | null };
export type UnidadeOficial = { equipeId: string; academia: string; professor?: string | null };

export const MENSAGEM_PEDIR_VINCULO = "Olá! A equipe desta inscrição não coincide com a equipe do seu cadastro ou não está cadastrada neste campeonato. Confira sua equipe no perfil e fale com a organização antes da montagem das chaves.";

export type SituacaoVinculo = "vinculado" | "sem-equipe" | "equipe-divergente";

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

  const equipePerfil = String(dados.equipePerfil || "").trim();
  if (equipePerfil && !nomesEquipeIguais(equipe.nome, equipePerfil)) {
    return {
      situacao: "equipe-divergente",
      equipe: equipe.nome,
      academia: String(dados.academiaPerfil || "").trim() || null,
      professor,
      escrito: equipePerfil,
    };
  }

  return {
    situacao: "vinculado",
    equipe: equipe.nome,
    academia: String(dados.academiaPerfil || "").trim() || null,
    professor,
    escrito: "",
  };
}
