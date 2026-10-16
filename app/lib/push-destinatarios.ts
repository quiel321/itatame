import { assinaturasUnicas,destinosPush } from './push-regras';

async function linhasPorIds(db:any,tabela:string,campos:string,coluna:string,ids:any[]) {
 const linhas:any[]=[];
 for(let i=0;i<ids.length;i+=200){
  for(let n=0;;n+=500){
   const {data,error}=await db.from(tabela).select(campos).in(coluna,ids.slice(i,i+200)).range(n,n+499);
   if(error)throw Error('Não foi possível conferir os destinatários.');
   linhas.push(...(data||[]));if(!data||data.length<500)break;
  }
 }
 return linhas;
}

// A prévia só conta cadastros. Chaves e endereços dos aparelhos nunca saem da API.
export async function resumoDestinatariosPush(db:any,filas:{atleta_id:number}[]) {
 const atletas=await linhasPorIds(db,'atletas','id,user_id,responsavel_id','id',[...new Set(filas.map(x=>x.atleta_id))]);
 const ids=[...new Set(atletas.flatMap(destinosPush))];
 const [legadas,novas]=await Promise.all([
  linhasPorIds(db,'assinaturas_push','user_id,subscription','user_id',ids),
  linhasPorIds(db,'push_dispositivos','user_id,subscription','user_id',ids),
 ]);
 const porConta=new Map(ids.map(id=>[id,assinaturasUnicas([...legadas,...novas].filter(x=>x.user_id===id))]));
 const comAparelho=(id:string)=>Boolean(porConta.get(id)?.length);
 const contasAtletas=new Set(atletas.map(x=>x.user_id).filter(comAparelho));
 const contasResponsaveis=new Set(atletas.map(x=>x.responsavel_id).filter(comAparelho));
 const avisosComAparelho=filas.filter(f=>destinosPush(atletas.find(a=>a.id===f.atleta_id)||{}).some(comAparelho)).length;
 return {atletas:contasAtletas.size,responsaveis:contasResponsaveis.size,contas:new Set([...contasAtletas,...contasResponsaveis]).size,aparelhos:assinaturasUnicas([...legadas,...novas]).length,avisosComAparelho,avisosSemAparelho:filas.length-avisosComAparelho};
}
