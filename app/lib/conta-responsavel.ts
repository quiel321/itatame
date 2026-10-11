export type TipoContaCadastro = 'atleta' | 'professor' | 'responsavel';

export const TIPOS_CONTA_CADASTRO: { valor: TipoContaCadastro; rotulo: string; descricao: string }[] = [
  { valor: 'atleta', rotulo: 'Atleta', descricao: 'Vai competir? Você também pode inscrever seus filhos.' },
  { valor: 'professor', rotulo: 'Professor', descricao: 'Acompanhe os alunos do seu CT. Você também pode inscrever seus filhos.' },
  { valor: 'responsavel', rotulo: 'Responsável', descricao: 'Vai apenas inscrever um menor? Crie a conta com seus dados.' },
];

// Preferência de uso da conta, sem criar um novo papel de autorização.
// Os vínculos dos dependentes continuam usando responsavel_id.
export function contaSomenteResponsavel(role: string | null | undefined, metadata?: Record<string, unknown> | null) {
  return role === 'atleta' && metadata?.somente_responsavel === true;
}

export function competidoresDaConta<T>(titular: T | null, dependentes: T[], somenteResponsavel: boolean) {
  return [...(titular && !somenteResponsavel ? [titular] : []), ...dependentes];
}
