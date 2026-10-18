import type { SupabaseClient } from '@supabase/supabase-js';
import { fotografoPodePublicarNoEvento, obterFotografoDoUsuario } from './fotos-auth';

// A consulta prévia e a emissão de URLs usam a mesma autorização.
// A autoria de cada mídia continua sendo a do fotógrafo autenticado.
export async function conferirDestinoUpload(db: SupabaseClient, userId: string, eventoId: string, albumId: string) {
  const negar = (status: number, error: string) => ({ ok: false as const, status, error });
  if (!eventoId || !albumId) return negar(400, 'Selecione evento e álbum.');
  const fotografo = await obterFotografoDoUsuario(db, userId);
  if (!fotografo || fotografo.status !== 'ativo') return negar(403, 'Perfil de fotógrafo não encontrado ou inativo.');
  const { data: evento, error: eventoError } = await db.from('foto_eventos')
    .select('id, status, created_by, organizador_user_id, preco_padrao_centavos, preco_video_centavos, preco_bloqueado').eq('id', eventoId).maybeSingle();
  if (eventoError) throw new Error('Não foi possível conferir a galeria. Tente novamente.');
  if (!evento || evento.status !== 'publicado') return negar(404, 'Galeria indisponível para receber mídias.');
  if (!(await fotografoPodePublicarNoEvento(db, eventoId, fotografo.id))) return negar(403, 'Fotógrafo não credenciado para este evento.');
  const { data: album, error: albumError } = await db.from('foto_albuns')
    .select('id, fotografo_id, status').eq('id', albumId).eq('evento_id', eventoId).maybeSingle();
  if (albumError) throw new Error('Não foi possível conferir o álbum. Tente novamente.');
  if (!album || album.status !== 'publicado') return negar(404, 'Álbum indisponível para receber mídias.');
  if (album.fotografo_id && album.fotografo_id !== fotografo.id) {
    if (evento.organizador_user_id || !evento.created_by) return negar(403, 'Este álbum não está liberado para seu envio. Escolha o álbum compartilhado ou fale com o organizador.');
    const { data: dono, error } = await db.from('fotografos').select('id').eq('user_id', evento.created_by).eq('id', album.fotografo_id).maybeSingle();
    if (error) throw new Error('Não foi possível conferir o compartilhamento. Tente novamente.');
    if (!dono) return negar(403, 'Este álbum não está liberado para seu envio. Escolha outro álbum ou fale com o organizador.');
  }
  return { ok: true as const, fotografo, evento };
}
