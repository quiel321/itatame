const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let source=fs.readFileSync('app/staff/placar/[id]/page.tsx','utf8');
function extrair(inicio,fim){
 return source.slice(source.indexOf(inicio),source.indexOf(fim,source.indexOf(inicio)))
 .replace(/: number \| null \| undefined/g,'').replace(/: number/g,'').replace(/: string/g,'');
}
test('placar grava e corrige medalhas por RPC e informa falha do banco',async()=>{
 for(const [inicio,fim,nome] of [
 ['const updateEstatistica = async','if (!ignoraMedalha','updateEstatistica'],
 ['const ajustar = async','if (mudouVencedor)','ajustar']
 ]){
 const calls=[];let error=null;
 const helper=vm.runInNewContext(extrair(inicio,fim)+`;${nome}`,{supabase:{rpc:async(name,args)=>{calls.push({name,args});return {error};}}});
 await helper(101,'ouro',1);
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{name:'ajustar_medalha_staff',args:{p_atleta:101,p_coluna:'ouro',p_incremento:1}}]);
 await helper(null,'ouro',1);assert.equal(calls.length,1);
 error={message:'Posto sem autorização'};
 await assert.rejects(helper(101,'ouro',1),/Posto sem autorização/);
 }
});
test('correção no painel do mesário também usa RPC e interrompe quando o banco recusa',async()=>{
 source=fs.readFileSync('app/lib/corrigir-resultado.ts','utf8');
 let error=null;const calls=[];
 const helper=vm.runInNewContext(extrair('const ajustar = async','if (mudouVencedor)')+';ajustar',{supabase:{rpc:async(name,args)=>{calls.push({name,args});return {error};}}});
 await helper(102,'prata',-1);assert.equal(calls[0].name,'ajustar_medalha_staff');assert.equal(calls[0].args.p_incremento,-1);
 error={message:'Sessão expirada'};await assert.rejects(helper(102,'prata',-1),/Sessão expirada/);
});

