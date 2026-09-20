export type LutaComRotulo = {
  id_visual?: string | number | null;
  fase?: string | null;
  ordem?: number | null;
  proxima_luta?: string | number | null;
};

function faseNormalizada(luta: LutaComRotulo) {
  if (String(luta.id_visual) === "999" || String(luta.fase || "").toLowerCase().startsWith("final")) return "Final";
  const fase = String(luta.fase || "Fase eliminatória").trim();
  if (/quartas/i.test(fase)) return "Quartas de final";
  if (/oitavas/i.test(fase)) return "Oitavas de final";
  if (/32.?avos/i.test(fase)) return "32 avos de final";
  if (/16.?avos/i.test(fase)) return "16 avos de final";
  if (/semifinal/i.test(fase)) return fase.replace(/semifinal/i, "Semifinal");
  return fase;
}

export function rotuloLuta(luta: LutaComRotulo) {
  const id = String(luta.id_visual || "");
  if (String(luta.fase || "").toUpperCase().includes("CHAVE DE 3") || String(luta.fase || "").toUpperCase().includes("CHAVE DE 6")) {
    if (id === "1") return String(luta.fase || "").toLowerCase().includes("esquerda") ? "Luta 1 · esquerda" : "Luta 1 · chave de 3";
    if (id === "2") return String(luta.fase || "").toLowerCase().includes("esquerda") ? "Baia · esquerda" : "Luta 2 · baia";
    if (id === "3") return "Luta 1 · direita";
    if (id === "4") return "Baia · direita";
    if (id === "101") return "Decisão · esquerda";
    if (id === "102") return "Decisão · direita";
    if (id === "999" || faseNormalizada(luta) === "Final") {
      return String(luta.fase || "").toUpperCase().includes("CHAVE DE 6") ? "Final" : "Final · chave de 3";
    }
  }
  const fase = faseNormalizada(luta);
  if (fase === "Final") return "Final";
  if (/\d/.test(fase)) return fase;
  const ordem = Number(luta.ordem || 0);
  return ordem > 0 ? `${fase} ${ordem}` : fase;
}

export function rotuloLutaCurto(luta: LutaComRotulo) {
  const rotulo = rotuloLuta(luta);
  return rotulo
    .replace(/de final/gi, "")
    .replace(/\s+/g, " ")
    .trim() || rotulo;
}
