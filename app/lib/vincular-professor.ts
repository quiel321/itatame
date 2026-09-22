export type ContaParaProfessor = {
  role?: string | null;
} | null;

export type OrganizadorParaProfessor = {
  status?: string | null;
} | null;

export type DecisaoVinculoProfessor = "criar" | "ja-professor" | "recusar";

export function decidirVinculoProfessor(atleta: ContaParaProfessor, organizador: OrganizadorParaProfessor): DecisaoVinculoProfessor {
  if (atleta?.role === "professor") return "ja-professor";
  if (atleta) return "recusar";
  if (!organizador || organizador.status === "super-admin") return "recusar";
  return "criar";
}
