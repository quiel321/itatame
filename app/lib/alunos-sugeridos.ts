import { nomesEquipeIguais } from './equipes-nome';
export type ProfessorVinculo = { user_id: string; nome: string; equipe: string; academia: string };
export type AlunoSemVinculo = {
  id: number; user_id: string; nome: string; professor: string | null;
  professor_id: string | null; equipe: string | null; academia: string | null; role?: string | null; motivo_sugestao?: MotivoSugestao;
};

export function normalizarNomeProfessor(nome: string) {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(professor|professora|prof|mestre)\b\.?/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function equipePreenchida(equipe: string | null | undefined) {
  const nome = String(equipe || '').trim();
  return Boolean(nome) && normalizarNomeProfessor(nome) !== 'independente';
}

function distancia(a: string, b: string) {
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    anterior = atual;
  }
  return anterior[b.length];
}

// Semelhança só sugere; a confirmação do professor é sempre necessária.
export function nomesProfessoresSemelhantes(informado: string, cadastrado: string) {
  const a = normalizarNomeProfessor(informado);
  const b = normalizarNomeProfessor(cadastrado);
  if (!a || !b) return false;
  if (a === b) return true;
  const primeiroA = a.split(' ')[0];
  const primeiroB = b.split(' ')[0];
  if (primeiroA.length < 4 || primeiroB.length < 4) return false;
  if (primeiroA === primeiroB) return true;
  // Inclui abreviações e grafias como Eber, Ebar e Ebarson.
  const tamanho = Math.min(primeiroA.length, primeiroB.length);
  return distancia(primeiroA.slice(0, tamanho), primeiroB.slice(0, tamanho)) <= 1;
}

export type MotivoSugestao = 'nome' | 'academia' | 'professor-academia';

export function academiaPreenchida(academia: string | null | undefined) {
  return equipePreenchida(academia);
}

export function mesmaAcademia(a: string | null | undefined, b: string | null | undefined) {
  return academiaPreenchida(a) && academiaPreenchida(b) && nomesEquipeIguais(a, b);
}

export function motivoSugestaoAluno(aluno: AlunoSemVinculo, professor: ProfessorVinculo, busca = '', professores: ProfessorVinculo[] = []): MotivoSugestao | null {
  if (aluno.role !== 'atleta' || !aluno.nome?.trim() || aluno.user_id === professor.user_id || aluno.professor_id) return null;
  // Um CT informado e diferente impede misturar filiais da mesma equipe.
  if (academiaPreenchida(aluno.academia) && !mesmaAcademia(aluno.academia, professor.academia)) return null;
  if (nomesProfessoresSemelhantes(aluno.professor || '', busca.trim() || professor.nome)) return 'nome';
  if (!equipePreenchida(aluno.equipe) || !nomesEquipeIguais(aluno.equipe, professor.equipe)) return null;
  if (mesmaAcademia(aluno.academia, professor.academia)) return 'academia';
  const correspondentes = professores.filter(item => nomesProfessoresSemelhantes(aluno.professor || '', item.nome));
  if (correspondentes.length && correspondentes.every(item => nomesEquipeIguais(item.equipe, professor.equipe) && mesmaAcademia(item.academia, professor.academia))) return 'professor-academia';
  return null;
}

export function podeSugerirAluno(aluno: AlunoSemVinculo, professor: ProfessorVinculo, busca = '', professores: ProfessorVinculo[] = []) {
  return motivoSugestaoAluno(aluno, professor, busca, professores) !== null;
}
