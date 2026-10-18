import { normalizarTextoLocalidade, type Localidade } from './localidades';

export const ESTADOS_BRASIL = [
  { sigla: 'AC', nome: 'Acre' }, { sigla: 'AL', nome: 'Alagoas' }, { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' }, { sigla: 'BA', nome: 'Bahia' }, { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' }, { sigla: 'ES', nome: 'Espírito Santo' }, { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' }, { sigla: 'MT', nome: 'Mato Grosso' }, { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' }, { sigla: 'PA', nome: 'Pará' }, { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' }, { sigla: 'PE', nome: 'Pernambuco' }, { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' }, { sigla: 'RN', nome: 'Rio Grande do Norte' }, { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' }, { sigla: 'RR', nome: 'Roraima' }, { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' }, { sigla: 'SE', nome: 'Sergipe' }, { sigla: 'TO', nome: 'Tocantins' },
] as const;

export function filtrarEstados(termo: string) {
  const busca = normalizarTextoLocalidade(termo);
  const siglaExata = ESTADOS_BRASIL.find(e => e.sigla.toLowerCase() === busca);
  if (siglaExata) return [siglaExata];
  return ESTADOS_BRASIL.filter(e => normalizarTextoLocalidade(e.nome).includes(busca) || e.sigla.toLowerCase().includes(busca));
}
export function cidadesDoEstado(localidades: Localidade[], estado: string, termo = '') {
  const uf = estado.trim().toUpperCase(), busca = normalizarTextoLocalidade(termo);
  if (!ESTADOS_BRASIL.some(e => e.sigla === uf)) return [];
  return localidades.filter(l => l.estado === uf && normalizarTextoLocalidade(l.cidade).startsWith(busca));
}
export function cidadeExataNoEstado(localidades: Localidade[], estado: string, termo: string) {
  const busca = normalizarTextoLocalidade(termo);
  return cidadesDoEstado(localidades, estado, termo).find(l => normalizarTextoLocalidade(l.cidade) === busca) || null;
}
