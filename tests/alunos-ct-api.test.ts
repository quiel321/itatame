import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from '../app/api/professor/alunos/route';
const professor = { user_id: 'murilo', role: 'professor', equipe: 'AAMEP', academia: 'AAMEP SAPEZAL' };
const aluno = { id: 1, user_id: 'aluno', role: 'atleta', nome: 'Aluno do Eberson', professor_id: 'eberson', professor: 'Eberson', equipe: 'AAMEP', academia: 'AAMEP SAPEZAL' };
async function simular(opcoes: { perfil?: typeof professor | null; anonimo?: boolean; paginar?: boolean; erro?: boolean }, verificar: (consultas: URL[]) => Promise<void>) {
  const originalFetch=globalThis.fetch;
  const originalUrl=process.env.NEXT_PUBLIC_SUPABASE_URL, originalKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://supabase.test';process.env.SUPABASE_SERVICE_ROLE_KEY='teste';
  const consultas: URL[]=[];
  globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    assert.equal(url.origin,'https://supabase.test');assert.ok(!init?.method||init.method==='GET','Nenhuma alteração no banco é permitida');
    if(url.pathname==='/auth/v1/user') return Response.json({id:'murilo',is_anonymous:Boolean(opcoes.anonimo)});
    assert.equal(url.pathname,'/rest/v1/atletas','Não altera inscrições, ranking ou outras tabelas');consultas.push(url);
    if(url.searchParams.has('user_id'))return Response.json(opcoes.perfil===null?[]:[opcoes.perfil||professor]);
    assert.equal(url.searchParams.get('role'),'eq.atleta');
    assert.ok(!/cpf|telefone|email|responsavel/.test(url.searchParams.get('select')||''));
    if(opcoes.erro)return Response.json({message:'Erro simulado'},{status:500});
    if(opcoes.paginar&&url.searchParams.get('offset')==='0')return Response.json(Array.from({length:500},(_,i)=>({...aluno,id:i+10,user_id:`fora-${i}`,academia:'Outra filial'})));
    return Response.json([aluno,{...aluno,id:2,user_id:'outra-filial',academia:'AAMEP TANGARA'}, {...aluno,id:3,user_id:'outra-equipe',equipe:'Legado'}, {...aluno,id:4,user_id:'meu-antigo',equipe:'',academia:'',professor_id:'murilo'}, {...aluno,id:5,user_id:'sem-ct',academia:''}]);
  };
  try{await verificar(consultas)}finally{globalThis.fetch=originalFetch;if(originalUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=originalUrl;if(originalKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=originalKey;}
}
const req=()=>new Request('http://localhost/api/professor/alunos?equipe=Legado&academia=Outro&user_id=eberson',{headers:{Authorization:'Bearer teste'}});
test('API exige sessão real e perfil professor',async()=>{
  assert.equal((await GET(new Request('http://localhost/api/professor/alunos'))).status,401);
  await simular({anonimo:true},async()=>assert.equal((await GET(req())).status,401));
  for(const perfil of [null,{...professor,role:'atleta'},{...professor,role:'organizador'}])await simular({perfil},async()=>assert.equal((await GET(req())).status,403));
});
test('API usa o CT salvo do usuário autenticado e mantém vínculo e campos públicos',async()=>{
  await simular({},async()=>{const resposta=await GET(req());assert.equal(resposta.status,200);assert.equal(resposta.headers.get('Cache-Control'),'no-store');const alunos=(await resposta.json()).alunos;assert.deepEqual(alunos.map((a: typeof aluno)=>a.user_id),['aluno','meu-antigo']);assert.equal(alunos[0].professor_id,'eberson');});
});
test('API pagina os alunos e não compartilha por dados incompletos do professor',async()=>{
  await simular({paginar:true},async consultas=>{assert.equal((await (await GET(req())).json()).alunos.length,2);assert.ok(consultas.some(url=>url.searchParams.get('offset')==='500'));});
  await simular({perfil:{...professor,academia:''}},async()=>assert.deepEqual((await (await GET(req())).json()).alunos.map((a: typeof aluno)=>a.user_id),['meu-antigo']));
});
test('API falha sem devolver lista parcial quando a consulta falha',async()=>{
  await simular({erro:true},async()=>{const resposta=await GET(req());assert.equal(resposta.status,500);assert.equal((await resposta.json()).alunos,undefined);});
});
