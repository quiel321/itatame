export const CATEGORIAS_FOTOS = [
  { id: "jiu-jitsu", nome: "Jiu-jitsu" },
  { id: "corrida", nome: "Corrida" },
  { id: "ciclismo", nome: "Ciclismo" },
  { id: "futebol", nome: "Futebol" },
  { id: "automobilismo", nome: "Automobilismo" },
  { id: "outros-esportes", nome: "Outros esportes" },
  { id: "casamento", nome: "Casamento" },
  { id: "formatura", nome: "Formatura" },
  { id: "show", nome: "Show e festival" },
  { id: "corporativo", nome: "Corporativo" },
  { id: "outros-eventos", nome: "Outros eventos" },
] as const;

export type CategoriaFotos = (typeof CATEGORIAS_FOTOS)[number]["id"];

export function categoriaFotosValida(valor: unknown): valor is CategoriaFotos {
  return typeof valor === "string" && CATEGORIAS_FOTOS.some((categoria) => categoria.id === valor);
}

export function nomeCategoriaFotos(valor: string | null | undefined) {
  return CATEGORIAS_FOTOS.find((categoria) => categoria.id === valor)?.nome || "Outros eventos";
}

export function categoriaDaGaleria(galeria: { categoria?: string | null; nome: string }) {
  if (categoriaFotosValida(galeria.categoria)) return galeria.categoria;
  const nome = galeria.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/jiu.?jitsu|tatame|campeonato.*spartan/.test(nome)) return "jiu-jitsu";
  if (/corrida|maratona|\brun\b/.test(nome)) return "corrida";
  if (/ciclismo|pedal|bike/.test(nome)) return "ciclismo";
  if (/futebol|society|futsal/.test(nome)) return "futebol";
  if (/automobilismo|kart|motocross|rally/.test(nome)) return "automobilismo";
  return "outros-eventos";
}
