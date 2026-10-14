// Páginas públicas devem mostrar somente publicadas, inclusive com o organizador logado.
// O banco mantém a permissão do organizador para a revisão administrativa.
type Cliente = { from: (tabela: string) => any };
export async function consultarChavesPublicadas(db: Cliente, evento: string, colunas: string, categoria?: string, faixa?: string): Promise<{ data: any[] | null; error: { message: string } | null }> {
 const publicacoes = await db.from('chaves_publicacoes').select('categoria_id').eq('evento_id', evento).eq('publicada', true);
 if (publicacoes.error) return { data: [], error: publicacoes.error };
 const ids = (publicacoes.data || []).map((p: { categoria_id: string }) => p.categoria_id);
 if (!ids.length) return { data: [], error: null };
 let consulta = db.from('chaves').select(colunas).eq('evento_id', evento).in('categoria_id', ids);
 if (categoria !== undefined) consulta = consulta.eq('categoria', categoria);
 if (faixa !== undefined) consulta = consulta.eq('faixa', faixa);
 return consulta;
}

