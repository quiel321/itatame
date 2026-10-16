import type { SupabaseClient } from '@supabase/supabase-js';

export type FotoAtletaPublica = { id: number; nome: string; foto_url: string | null };
const normalizar = (nome: string) => nome.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase();

export function fotoAtletaPorIdentidade(atletas: FotoAtletaPublica[], id?: number | null, nome?: string | null) {
  const porId = id ? atletas.find(a => Number(a.id) === Number(id)) : undefined;
  if (porId) return porId.foto_url || null;
  if (!nome) return null;
  const exatos = atletas.filter(a => normalizar(a.nome) === normalizar(nome));
  // Não emprestar a imagem de outro atleta com nome parecido ou de um homônimo.
  return exatos.length === 1 ? exatos[0].foto_url || null : null;
}

export async function carregarFotosDaChave(db: SupabaseClient, lutas: { atleta_1_id?: number | null; atleta_2_id?: number | null; vencedor_id?: number | null }[]) {
  const ids = [...new Set(lutas.flatMap(l => [l.atleta_1_id, l.atleta_2_id, l.vencedor_id]).filter((id): id is number => typeof id === 'number' && id > 0))];
  const fotos: FotoAtletaPublica[] = [];
  for (let inicio = 0; inicio < ids.length; inicio += 200) {
    const { data, error } = await db.from('atletas_publico').select('id,nome,foto_url').in('id', ids.slice(inicio, inicio + 200));
    if (error) throw error;
    fotos.push(...(data || []));
  }
  return fotos;
}
