import { academiaPreenchida, equipePreenchida } from './alunos-sugeridos';

type IdentidadeCT = { equipe?: string | null; academia?: string | null };
type Professor = IdentidadeCT & { user_id: string };
type Aluno = IdentidadeCT & { user_id: string; professor_id?: string | null; role?: string | null };

// Leitura compartilhada exige o nome completo dos dois campos. Não usa
// aproximações, prefixos ou equivalências do ranking para juntar filiais.
export function normalizarIdentidadeCT(valor?: string | null) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

export function mesmoCT(a: IdentidadeCT, b: IdentidadeCT) {
  return equipePreenchida(a.equipe) && equipePreenchida(b.equipe)
    && academiaPreenchida(a.academia) && academiaPreenchida(b.academia)
    && normalizarIdentidadeCT(a.equipe) === normalizarIdentidadeCT(b.equipe)
    && normalizarIdentidadeCT(a.academia) === normalizarIdentidadeCT(b.academia);
}

export function podeVerAlunoDoCT(aluno: Aluno, professor: Professor) {
  if (aluno.role !== 'atleta' || !aluno.user_id || aluno.user_id === professor.user_id) return false;
  // Preserva o acesso ao próprio aluno, inclusive em cadastros antigos incompletos.
  return aluno.professor_id === professor.user_id || mesmoCT(aluno, professor);
}
