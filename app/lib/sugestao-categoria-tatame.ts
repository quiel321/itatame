export type LutaCronograma = {
  categoria: string;
  faixa?: string | null;
  tatame?: string | null;
  ordem_tatame?: number | null;
  ordem?: number | null;
  horario_estimado?: string | null;
  status_luta?: string | null;
  iniciada_em?: string | null;
};

// A sugestão só lê o cronograma salvo pelo organizador; não redistribui lutas.
export function sugestoesCategoriaPorTatame<T extends LutaCronograma>(lutas: T[], agora = new Date()) {
  const grupos = new Map<string, T[]>();
  for (const luta of lutas) {
    if (!luta.tatame?.trim() || luta.status_luta === 'concluida') continue;
    const tatame = luta.tatame.trim();
    grupos.set(tatame, [...(grupos.get(tatame) || []), luta]);
  }
  return [...grupos].sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true })).map(([tatame, fila]) => {
    fila.sort((a, b) => {
      const ordemA = a.ordem_tatame ?? a.ordem ?? Number.MAX_SAFE_INTEGER;
      const ordemB = b.ordem_tatame ?? b.ordem ?? Number.MAX_SAFE_INTEGER;
      if (ordemA !== ordemB) return ordemA - ordemB;
      return (a.horario_estimado || '').localeCompare(b.horario_estimado || '');
    });
    const proxima = fila[0];
    const inicio = proxima.horario_estimado ? new Date(proxima.horario_estimado) : null;
    const aguardarHorario = Boolean(inicio && Number.isFinite(inicio.getTime()) && inicio > agora);
    return { tatame, proxima, aguardarHorario, pendentes: fila.length };
  });
}
