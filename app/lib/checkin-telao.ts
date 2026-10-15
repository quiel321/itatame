type InscricaoTelao = { id: number; atleta_id?: number | null; categoria_id?: string | null; atleta: string; status_checkin?: string | null; checkin_realizado_em?: string | null };
export function resumoCheckinTelao(inscricoes: InscricaoTelao[], ausentes: Set<string>) {
 const pessoas = new Map<string, InscricaoTelao[]>();
 for (const i of inscricoes) {
  const chave = i.atleta_id ? String(i.atleta_id) : i.atleta;
  pessoas.set(chave, [...(pessoas.get(chave) || []), i]);
 }
 const aprovados = [...pessoas.values()].filter(itens => itens.some(i => i.status_checkin === 'aprovado'));
 const aguardando = [...pessoas.values()].filter(itens => itens.some(i => (!i.status_checkin || i.status_checkin === 'pendente') && !ausentes.has(`${i.categoria_id}:${i.atleta_id}`)));
 return { aprovados: aprovados.length, aguardando: aguardando.length,
  recentes: aprovados.flatMap(itens => itens.filter(i => i.status_checkin === 'aprovado' && i.checkin_realizado_em))
   .sort((a,b) => String(b.checkin_realizado_em).localeCompare(String(a.checkin_realizado_em)))
   .filter((i,n,itens) => itens.findIndex(x => (x.atleta_id || x.atleta) === (i.atleta_id || i.atleta)) === n).slice(0,4).map(i=>i.atleta) };
}
