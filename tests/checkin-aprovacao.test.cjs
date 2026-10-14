const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('aprovar sem confirmar kimono não grava nem desclassifica',async()=>{
 const fonte=fs.readFileSync('app/components/staff/RecepcaoOperacao.tsx','utf8');
 const inicio=fonte.indexOf('  const processarCheckin = async');
 const fim=fonte.indexOf('  const resetarTela =',inicio);
 assert.ok(inicio>=0&&fim>inicio);
 let aviso='';const naoGravar=()=>{throw Error('Não deve iniciar gravação de aprovação ou desclassificação');};
 const ctx={loading:false,controlePronto:true,scannedId:'QR',documentoConferido:true,kimonoAprovado:false,setErro:m=>{aviso=m;},setLoading:naoGravar,garantirVinculoStaff:naoGravar,supabase:{from:naoGravar}};
 vm.createContext(ctx);vm.runInContext(ts.transpile(fonte.slice(inicio,fim)+'\nglobalThis.executar=processarCheckin;'),ctx);
 await ctx.executar('aprovado');assert.match(aviso,/Confirme Kimono/);
});

