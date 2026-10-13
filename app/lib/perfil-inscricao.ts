import { academiaPreenchida, equipePreenchida } from './alunos-sugeridos';

export function camposPerfilInscricao(pessoa: {
  id?: number | null; nome?: string | null; equipe?: string | null;
  academia?: string | null; professor?: string | null; faixa?: string | null; role?: string | null;
}) {
  const campos: string[] = [];
  if (!pessoa.nome?.trim()) campos.push('nome');
  if (!equipePreenchida(pessoa.equipe)) campos.push('equipe');
  if (!academiaPreenchida(pessoa.academia)) campos.push('academia');
  if (pessoa.role !== 'professor' && !pessoa.professor?.trim()) campos.push('professor');
  if (!pessoa.faixa?.trim()) campos.push('faixa');
  if (!pessoa.id) campos.push('cadastro do atleta');
  return campos;
}
