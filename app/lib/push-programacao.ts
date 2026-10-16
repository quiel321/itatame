import { fusoHorarioEvento } from './evento-datas';
import { hashPush,textoProgramacao } from './push-regras';
export async function todasLinhas(db:any,tabela:string,campos:string,evento:string) {const lista:any[]=[];for(let n=0;;n+=500){const {data,error}=await db.from(tabela).select(campos).eq('evento_id',evento).range(n,n+499);if(error)throw Error('Não foi possível conferir a programação.');lista.push(...(data||[]));if(!data||data.length<500)return lista;}}
export async function previaProgramacaoPush(db:any,evento:string) {
 const {data:e,error}=await db.from('eventos').select('id,nome,estado,status').eq('id',evento).single();if(error||!e||e.status==='ENCERRADO')throw Error('Evento indisponível para avisos.');
 const [ins,cats,lutas,pubs,postos]=await Promise.all([
 todasLinhas(db,'inscricoes','id,atleta,atleta_id,categoria_id,pagamento_ok,estorno_status',evento),todasLinhas(db,'categorias_evento','id,nome,faixa,inicio_lutas_previsto',evento),todasLinhas(db,'chaves','id,categoria_id,atleta_1_id,atleta_2_id,tatame,horario_estimado,status_luta',evento),todasLinhas(db,'chaves_publicacoes','categoria_id,publicada',evento),todasLinhas(db,'staff_eventos','funcao,identificacao',evento)]);
 const filas:any[]=[];let semProgramacao=0;const area=(s:any)=>String(s||'').trim().toLocaleUpperCase('pt-BR');const permitidas=new Set(postos.filter(p=>p.funcao==='mesario').map(p=>area(p.identificacao)));
 for(const i of ins.filter(i=>i.pagamento_ok&&i.estorno_status!=='estornado'&&i.atleta_id)){
  const c=cats.find(c=>c.id===i.categoria_id);if(!c||!pubs.some(p=>p.categoria_id===c.id&&p.publicada)){semProgramacao++;continue;}
  const ls=lutas.filter(l=>l.categoria_id===c.id&&l.status_luta!=='concluida'&&(l.atleta_1_id===i.atleta_id||l.atleta_2_id===i.atleta_id)&&permitidas.has(area(l.tatame))).sort((a,b)=>Date.parse(a.horario_estimado||'')-Date.parse(b.horario_estimado||''));
  const primeira=ls[0];const horario=c.inicio_lutas_previsto||lutas.filter(l=>l.categoria_id===c.id&&area(l.tatame)===area(primeira?.tatame)&&l.horario_estimado).map(l=>l.horario_estimado).sort()[0];
  if(!primeira||!horario||!Number.isFinite(Date.parse(horario))||Date.parse(horario)<=Date.now()){semProgramacao++;continue;}
  const chave='programacao:'+hashPush(JSON.stringify([evento,i.atleta_id,c.id,area(primeira.tatame),new Date(horario).toISOString()]));
  const item={evento_id:evento,atleta_id:i.atleta_id,chave,tipo:'programacao',titulo:'Horário e tatame da sua categoria',mensagem:textoProgramacao(i.atleta,`${c.nome}${c.faixa?' · '+c.faixa:''}`,primeira.tatame,horario,fusoHorarioEvento(e.estado)),url:`/evento/${evento}/ao-vivo`,expira_em:horario};
  if(!filas.some(x=>x.chave===chave))filas.push(item);
 }
 const existentes=await todasLinhas(db,'push_fila','chave,estado',evento);const repetidas=new Set(existentes.map(x=>x.chave));const novas=filas.filter(x=>!repetidas.has(x.chave));
 return {evento:e.nome,filas:novas,chavesAtuais:filas.map(f=>f.chave),total:novas.length,jaRegistrados:filas.length-novas.length,semProgramacao,versao:hashPush(JSON.stringify(filas.map(f=>f.chave).sort())),amostra:novas.slice(0,8).map(x=>x.mensagem)};
}
