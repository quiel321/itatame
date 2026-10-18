import { categoriaDaGaleria } from './fotos-categorias';
export type GaleriaPortfolio = { id: string; nome: string; data_evento: string | null; local: string | null; cidade: string | null; estado: string | null; capa_url: string | null; categoria: string | null; em_breve: boolean | null; vendas_ate: string | null; quantidade: number };
export type PortfolioOrganizador = { organizador: { id: string; nome: string; slug: string; localizacao: string | null; avatar_url: string | null; capa_url: string | null; sigla: string | null }; galerias: GaleriaPortfolio[] };
export const normalizarBuscaPortfolio = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function filtrarGaleriasPortfolio(galerias: GaleriaPortfolio[], filtros: { busca: string; cidade: string; categoria: string; ano: string }) {
  const termo = normalizarBuscaPortfolio(filtros.busca);
  return galerias.filter(g => (!termo || normalizarBuscaPortfolio([g.nome, g.local, g.cidade, g.estado].filter(Boolean).join(' ')).includes(termo))
    && (!filtros.cidade || g.cidade === filtros.cidade) && (!filtros.categoria || categoriaDaGaleria(g) === filtros.categoria)
    && (!filtros.ano || g.data_evento?.slice(0, 4) === filtros.ano));
}
