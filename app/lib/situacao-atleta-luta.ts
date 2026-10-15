type Luta = {
  status_luta?: string | null; metodo_vitoria?: string | null; vencedor_id?: number | null;
  atleta_1_id?: number | null; atleta_2_id?: number | null;
  checkin_1?: string | null; checkin_2?: string | null;
  pontuacao_atleta_1?: Record<string, unknown> | null; pontuacao_atleta_2?: Record<string, unknown> | null;
};
export function situacaoAtletaLuta(luta: Luta, lado: 1 | 2) {
  const status = (lado === 1 ? luta.checkin_1 : luta.checkin_2) || '';
  if (status === 'desclassificado_peso') return 'Desclassificado na pesagem';
  if (status === 'desclassificado_kimono') return 'Desclassificado · kimono/faixa';
  if (status.startsWith('desclassificado_')) return 'Desclassificado';
  if (status === 'ausente') return 'Ausente';
  const id = lado === 1 ? luta.atleta_1_id : luta.atleta_2_id;
  const dados = lado === 1 ? luta.pontuacao_atleta_1 : luta.pontuacao_atleta_2;
  if (id && luta.status_luta === 'concluida' && dados?.recepcao_wo && id !== luta.vencedor_id) return 'Ausente / desclassificado';
  return '';
}
export function lutaComAtletaImpedido(luta: Luta) {
  return Boolean(situacaoAtletaLuta(luta,1) || situacaoAtletaLuta(luta,2));
}
