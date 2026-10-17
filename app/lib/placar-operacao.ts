export type LadoPlacar = 'azul' | 'vermelho';
export function liberadaParaMesario(luta: { status_luta?: string | null; iniciada_em?: string | null }) {
  return luta.status_luta === 'em_andamento' || (luta.status_luta === 'agendada' && Boolean(luta.iniciada_em));
}

export function vencedorPorPlacar(azul: { pontos: number; vantagens: number; punicoes: number }, vermelho: { pontos: number; vantagens: number; punicoes: number }): LadoPlacar | null {
  const diferenca = azul.pontos - vermelho.pontos || azul.vantagens - vermelho.vantagens || vermelho.punicoes - azul.punicoes;
  return diferenca > 0 ? 'azul' : diferenca < 0 ? 'vermelho' : null;
}
