import {cache} from 'react';
import {createSupabaseServerClient} from './supabase-server';

// Compartilha a leitura entre metadata e página somente durante a requisição.
// Não mantém galerias privadas nem tokens em um cache global.
export const carregarEventoFotos=cache(async(id:string)=>createSupabaseServerClient().from('foto_eventos')
 .select('id, nome, slug, descricao, local, cidade, estado, data_evento, capa_url, status, vendas_ate, desconto_combo_qtd, desconto_combo_percentual, descontos_progressivos, em_breve, organizador_user_id, created_by, acesso_por_link, acesso_token, permite_download_gratis')
 .eq('id',id).maybeSingle());

export async function carregarAutorFotos(evento:{organizador_user_id?:string|null;created_by?:string|null}){
 const db=createSupabaseServerClient();
 const autor={autor_nome:'Organizador',autor_slug:'',autor_id:'',autor_telefone:'',tipo_autor:'organizador'};
 if(evento.organizador_user_id){
  const {data}=await db.from('foto_organizadores').select('nome, slug').eq('id',evento.organizador_user_id).maybeSingle();
  if(data){autor.autor_nome=data.nome||autor.autor_nome;autor.autor_slug=data.slug||'';}
 }else if(evento.created_by){
  const {data}=await db.from('fotografos').select('id, nome, telefone').eq('user_id',evento.created_by).maybeSingle();
  if(data){autor.autor_nome=data.nome||'Fotógrafo Parceiro';autor.autor_id=data.id;autor.autor_telefone=data.telefone||'';autor.tipo_autor='fotografo';}
 }
 return autor;
}
