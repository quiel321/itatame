type LutaConversao = Record<string, any>;
/** Conversão de rascunho/planejamento: mantém IDs, confrontos iniciais, lados e programação. */
export function converterSeisPreservandoConfrontos<T extends LutaConversao>(lutas: T[]): T[] {
 const ids = ['1','2','3','4','101','102','999'];
 if(lutas.length!==7 || new Set(lutas.map(l=>String(l.id_visual))).size!==7 || !ids.every(id=>lutas.some(l=>String(l.id_visual)===id))) throw Error('Estrutura de seis atletas inválida.');
 if(new Set(lutas.map(l=>l.categoria_id)).size!==1 || new Set(lutas.map(l=>l.evento_id)).size!==1) throw Error('Converta uma categoria de um evento por vez.');
 if(lutas.some(l=>l.iniciada_em || l.vencedor || l.vencedor_id || l.finalizada_em || l.metodo_vitoria || l.status_luta!=='agendada' || [l.pontuacao_atleta_1,l.pontuacao_atleta_2].some(p=>Object.values(p||{}).some(v=>v!==0&&v!==false&&v!==null&&v!=='')))) throw Error('Categoria já em operação. Conversão bloqueada.');
 const real=(n:unknown)=>typeof n==='string'&&n.trim()&&!['TBD','BYE'].includes(n.trim().toUpperCase());
 const vis=(id:string)=>lutas.find(l=>String(l.id_visual)===id)!;
 if(!lutas.every(l=>String(l.fase).includes('Chave de 3')||String(l.fase).includes('Chave de 6')) || !['1','3'].every(id=>real(vis(id).atleta_1)&&real(vis(id).atleta_2)) || !['2','4'].every(id=>vis(id).atleta_1==='TBD'&&real(vis(id).atleta_2)) || !['101','102','999'].every(id=>vis(id).atleta_1==='TBD'&&vis(id).atleta_2==='TBD')) throw Error('Posições de origem incompatíveis.');
 const atletas=lutas.flatMap(l=>[1,2].filter(lado=>real(l['atleta_'+lado])).map(lado=>l['atleta_'+lado+'_id']||String(l['atleta_'+lado]).trim().toUpperCase()));
 if(atletas.length!==6||new Set(atletas).size!==6)throw Error('A categoria precisa de seis atletas distintos.');
 if(!['1','2','3','4'].every(id=>String(vis(id).proxima_luta)===(Number(id)<=2?'101':'102'))||!['101','102'].every(id=>String(vis(id).proxima_luta)==='999')||vis('999').proxima_luta!=null)throw Error('Destinos incompatíveis.');
 return lutas.map(l=>{
  const id=String(l.id_visual), copia={...l,fase:Number(id)<100?'Quartas':id==='999'?'Final':'Semifinal'};
  if(id==='2'||id==='4')Object.assign(copia,{atleta_1:l.atleta_2,atleta_1_id:l.atleta_2_id,equipe_1:l.equipe_2,numero_1:l.numero_2,atleta_2:'BYE',atleta_2_id:null,equipe_2:'',numero_2:''});
  return copia;
 });
}
