import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
export async function POST(request:Request) {
  const token=request.headers.get('authorization')?.replace(/^Bearer /i,'');
  if(!token)return NextResponse.json({error:'Faça login novamente.'},{status:401});
  const db=createSupabaseServerClient();const {data,error}=await db.auth.getUser(token);
  if(error||!data.user)return NextResponse.json({error:'Sessão inválida.'},{status:401});
  const body=await request.json().catch(()=>null);
  if(typeof body?.confirmado!=='boolean')return NextResponse.json({error:'Configuração inválida.'},{status:400});
  const {data:org,error:falha}=await db.from('organizadores').update({mp_parcelamento_comprador_confirmado:body.confirmado}).eq('user_id',data.user.id).not('mp_connected_at','is',null).select('user_id').maybeSingle();
  if(falha)return NextResponse.json({error:'Não foi possível salvar. Verifique se a atualização do banco foi instalada.'},{status:409});
  if(!org)return NextResponse.json({error:'Conecte a conta Mercado Pago antes de configurar o parcelamento.'},{status:409});
  return NextResponse.json({ok:true});
}
