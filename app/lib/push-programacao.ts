import { fusoHorarioEvento } from './evento-datas';
import { hashPush,textoProgramacao } from './push-regras';
import { grupoInscricao, type CategoriaCompeticao, type InscricaoCompeticao } from './categorias-competicao';
// Usa o mesmo enquadramento da geração das chaves, inclusive absoluto sem categoria_id.
export function categoriasPushDaInscricao(i:InscricaoCompeticao,cats:CategoriaCompeticao[]) {
 const ids=new Set<string>();
 if(i.categoria_id)ids.add(i.categoria_id);
 for(const tipo of ['peso','absoluto'] as const){
  if(tipo==='absoluto'&&!i.absoluto)continue;
  if(tipo==='peso'&&i.categoria_id)continue;
  try{const c=grupoInscricao(i,tipo,cats);if(c.categoria_id)ids.add(c.categoria_id);}catch{/* Sem categoria cadastrada compatível. */}
 }
 return [...ids];
}
export async function todasLinhas(db:any,tabela:string,campos:string,evento:string) {const lista:any[]=[];for(let n=0;;n+=500){const {data,error}=await db.from(tabela).select(campos).eq('evento_id',evento).range(n,n+499);if(error)throw Error('Não foi possível conferir a programação.');lista.push(...(data||[]));if(!data||data.length<500)return lista;}}
// O reenvio guarda outra intenção; a chave original permite invalidar horários antigos.
export function chaveOriginalProgramacao(chave:string) {
 return /^reenvio:(programacao:[a-f0-9]{64}):[a-f0-9]{64}$/.exec(chave)?.[1]||chave;
}
export async function previaProgramacaoPush(db:any,evento:string,modo:'novos'|'reenvio'='novos') {
 const {data:e,error}=await db.from('eventos').select('id,nome,estado,status').eq('id',evento).single();if(error||!e||e.status==='ENCERRADO')throw Error('Evento indisponível para avisos.');
 const [ins,cats,lutas,pubs,postos]=await Promise.all([
 todasLinhas(db,'inscricoes','id,atleta,atleta_id,categoria_id,categoria,faixa,sexo,idade,peso,modalidade,absoluto,pagamento_ok,estorno_status',evento),todasLinhas(db,'categorias_evento','*',evento),todasLinhas(db,'chaves','id,categoria_id,atleta_1_id,atleta_2_id,tatame,horario_estimado,status_luta',evento),todasLinhas(db,'chaves_publicacoes','categoria_id,publicada',evento),todasLinhas(db,'staff_eventos','funcao,identificacao',evento)]);
 const filas:any[]=[];let semProgramacao=0;const area=(s:any)=>String(s||'').trim().toLocaleUpperCase('pt-BR');const permitidas=new Set(postos.filter(p=>p.funcao==='mesario').map(p=>area(p.identificacao)));
 for(const i of ins.filter(i=>i.pagamento_ok&&i.estorno_status!=='estornado'&&i.atleta_id)){
  const ids=categoriasPushDaInscricao(i,cats);if(!ids.length){semProgramacao++;continue;}
  for(const id of ids){
  const c=cats.find(c=>c.id===id);if(!c||!pubs.some(p=>p.categoria_id===c.id&&p.publicada)){semProgramacao++;continue;}
  const ls=lutas.filter(l=>l.categoria_id===c.id&&l.status_luta!=='concluida'&&(l.atleta_1_id===i.atleta_id||l.atleta_2_id===i.atleta_id)&&permitidas.has(area(l.tatame))).sort((a,b)=>Date.parse(a.horario_estimado||'')-Date.parse(b.horario_estimado||''));
  const primeira=ls[0];const horario=c.inicio_lutas_previsto||lutas.filter(l=>l.categoria_id===c.id&&area(l.tatame)===area(primeira?.tatame)&&l.horario_estimado).map(l=>l.horario_estimado).sort()[0];
  if(!primeira||!horario||!Number.isFinite(Date.parse(horario))||Date.parse(horario)<=Date.now()){semProgramacao++;continue;}
  const chave='programacao:'+hashPush(JSON.stringify([evento,i.atleta_id,c.id,area(primeira.tatame),new Date(horario).toISOString()]));
  const item={evento_id:evento,atleta_id:i.atleta_id,chave,tipo:'programacao',titulo:'Horário e tatame da sua categoria',mensagem:textoProgramacao(i.atleta,`${c.nome}${c.faixa?' · '+c.faixa:''}`,primeira.tatame,horario,fusoHorarioEvento(e.estado)),url:`/evento/${evento}/ao-vivo`,expira_em:horario};
  if(!filas.some(x=>x.chave===chave))filas.push(item);
  }
 }
 const existentes=await todasLinhas(db,'push_fila','chave,estado,criada_em',evento);const repetidas=new Set(existentes.map(x=>x.chave));const novas=filas.filter(x=>!repetidas.has(x.chave));
 const atuais=new Set(filas.map(f=>f.chave));
 const historico=existentes.filter(x=>atuais.has(chaveOriginalProgramacao(x.chave)));
 const pendentes=new Set(historico.filter(x=>['pendente','processando'].includes(x.estado)).map(x=>chaveOriginalProgramacao(x.chave)));
 const ultimoReenvio=Math.max(0,...existentes.filter(x=>x.chave.startsWith('reenvio:programacao:')).map(x=>Date.parse(x.criada_em)||0));
 const bloqueadoAte=modo==='reenvio'&&ultimoReenvio+300000>Date.now()?new Date(ultimoReenvio+300000).toISOString():null;
 // A mesma prévia usa o mesmo lote, inclusive em duas abas ou após repetir a requisição.
 const lote=hashPush(JSON.stringify([filas.map(f=>f.chave).sort(),historico.map(x=>x.chave).sort()]));
 const selecionadas=modo==='reenvio'?filas.filter(x=>repetidas.has(x.chave)&&!pendentes.has(x.chave)).map(x=>({...x,chave:`reenvio:${x.chave}:${lote}`})):novas;
 return {evento:e.nome,modo,filas:selecionadas,chavesAtuais:[...atuais],total:selecionadas.length,jaRegistrados:filas.length-novas.length,aguardando:pendentes.size,bloqueadoAte,semProgramacao,versao:modo==='reenvio'?hashPush(JSON.stringify([lote,selecionadas.map(f=>f.chave).sort()])):hashPush(JSON.stringify(filas.map(f=>f.chave).sort())),amostra:selecionadas.slice(0,8).map(x=>x.mensagem)};
}
