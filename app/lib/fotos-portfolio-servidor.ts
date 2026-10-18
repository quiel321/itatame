import { cache } from 'react';
import { createSupabaseServerClient } from './supabase-server';
import type { PortfolioOrganizador } from './fotos-portfolio';

// Somente identidade pública e galerias publicadas de acesso público.
export const carregarPortfolioOrganizador = cache(async (slug: string): Promise<PortfolioOrganizador | null> => {
  if (!/^[a-z0-9-]{1,120}$/i.test(slug)) return null;
  const db = createSupabaseServerClient();
  const { data: organizador, error } = await db.from('foto_organizadores').select('id,nome,slug,localizacao,avatar_url,capa_url,sigla').eq('slug', slug).maybeSingle();
  if (error) throw new Error('Não foi possível carregar a página do organizador.');
  if (!organizador) return null;
  const { data, error: erroGalerias } = await db.from('foto_eventos')
    .select('id,nome,data_evento,local,cidade,estado,capa_url,categoria,em_breve,vendas_ate,foto_arquivos(count)')
    .eq('organizador_user_id', organizador.id).eq('status', 'publicado')
    .or('acesso_por_link.eq.false,acesso_por_link.is.null').eq('foto_arquivos.status', 'publicada')
    .order('data_evento', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  if (erroGalerias) throw new Error('Não foi possível carregar as galerias públicas.');
  return { organizador, galerias: (data || []).map(({ foto_arquivos, ...g }) => ({ ...g, quantidade: Number(foto_arquivos?.[0]?.count || 0) })) };
});
