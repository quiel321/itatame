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
  const fase = faseNormalizada(luta);
  if (fase === "Final") return "Final";
  if (/\d/.test(fase)) return fase;
  const ordem = Number(luta.ordem || 0);
  return ordem > 0 ? `${fase} ${ordem}` : fase;
}

export function rotuloLutaCurto(luta: LutaComRotulo) {
  const rotulo = rotuloLuta(luta);
  return rotulo === "Final" ? "Final" : rotulo;
}
