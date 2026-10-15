import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { FILTRO_INSCRICOES_ATIVAS } from '@/app/lib/inscricao-ativa';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, contexto: { params: Promise<{ id: string }> }) {
  const {id} = await contexto.params;
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) return NextResponse.json({error:'Evento inválido.'},{status:400});
  const db=createSupabaseServerClient();
  const publicadas=await db.from('chaves_publicacoes').select('categoria_id').eq('evento_id',id).eq('publicada',true);
  if(publicadas.error) return NextResponse.json({error:'Não foi possível conferir as categorias publicadas.'},{status:503});
  const categorias=(publicadas.data||[]).map(c=>c.categoria_id);
  if(!categorias.length) return NextResponse.json({situacoes:[]});
  const situacoes: {categoria_id:string;atleta_id:number;situacao:string}[]=[];
  const idsAusentes=new Set<number>();
  for(let inicio=0;;inicio+=500){
    const ausentes=await db.from('recepcao_inscricoes').select('inscricao_id').eq('evento_id',id).eq('ausente',true).in('categoria_id',categorias).order('inscricao_id').range(inicio,inicio+499);
    if(ausentes.error) return NextResponse.json({error:'Não foi possível conferir as ausências.'},{status:503});
    for(const a of ausentes.data||[]) idsAusentes.add(a.inscricao_id);
    if((ausentes.data?.length||0)<500) break;
  }
  for(let inicio=0;;inicio+=500){
    const inscricoes=await db.from('inscricoes').select('id,categoria_id,atleta_id,status_checkin').eq('evento_id',id).eq('pagamento_ok',true).or(FILTRO_INSCRICOES_ATIVAS).in('categoria_id',categorias).order('id').range(inicio,inicio+499);
    if(inscricoes.error) return NextResponse.json({error:'Não foi possível conferir a situação dos atletas.'},{status:503});
    // Só identificadores esportivos e decisão pública; não expõe documentos, contato ou pesagem aferida.
    for(const i of inscricoes.data||[]) if(i.atleta_id && (i.status_checkin?.startsWith('desclassificado_') || idsAusentes.has(i.id)))
      situacoes.push({categoria_id:i.categoria_id,atleta_id:i.atleta_id,situacao:i.status_checkin?.startsWith('desclassificado_')?i.status_checkin:'ausente'});
    if((inscricoes.data?.length||0)<500) break;
  }
  return NextResponse.json({situacoes});
}
