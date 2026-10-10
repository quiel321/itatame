export type ProfessorVinculo = { user_id: string; nome: string; equipe: string; academia: string };
export type AlunoSemVinculo = {
  id: number; user_id: string; nome: string; professor: string | null;
  professor_id: string | null; equipe: string | null; academia: string | null; role?: string | null;
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

export function podeSugerirAluno(aluno: AlunoSemVinculo, professor: ProfessorVinculo, busca = '') {
  return aluno.role === 'atleta' && Boolean(aluno.nome?.trim()) && aluno.user_id !== professor.user_id
    && !aluno.professor_id
    && nomesProfessoresSemelhantes(aluno.professor || '', busca.trim() || professor.nome);
}
