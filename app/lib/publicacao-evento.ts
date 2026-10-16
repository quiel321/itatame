import type { ResumoPublicacaoChaves } from './evento-etapas';
type Cliente = { from: (tabela: string) => any };
/** Somente SELECT. Rascunhos contam no total, mas nenhum confronto é consultado. */
export async function consultarResumoPublicacoesChaves(db:Cliente,eventos:string[]):Promise<Record<string,ResumoPublicacaoChaves>> {
 const ids=[...new Set(eventos.filter(Boolean))];
 const resumos=Object.fromEntries(ids.map(id=>[id,{total:0,publicadas:0}]));
 if(!ids.length)return resumos;
 const vistos=new Set<string>();
 for(let inicio=0;;inicio+=500){
  const {data,error}=await db.from('chaves_publicacoes').select('evento_id,categoria_id,publicada').in('evento_id',ids).order('categoria_id').range(inicio,inicio+499);
  if(error)throw new Error('Não foi possível conferir a publicação.');
  for(const p of data||[]){if(!resumos[p.evento_id]||!p.categoria_id||vistos.has(p.categoria_id))continue;vistos.add(p.categoria_id);resumos[p.evento_id].total++;if(p.publicada===true)resumos[p.evento_id].publicadas++;}
  if((data?.length||0)<500)break;
 }
 return resumos;
}
