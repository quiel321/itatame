import { NextResponse } from 'next/server';
import { autenticarRequest } from '@/app/lib/api-auth';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { consumirLimiteAuth } from '@/app/lib/limite-auth';
import { MAX_UPLOAD_PUBLICO, type TipoMidiaPublica } from '@/app/lib/midia-publica';
import { salvarMidiaPublica } from '@/app/lib/midia-publica-servidor';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const responder = (dados: object, status = 200) => NextResponse.json(dados, { status, headers: { 'Cache-Control': 'private, no-store' } });
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return responder({ error: 'Entre para enviar um arquivo.' }, 401);
  if (!consumirLimiteAuth(`midia:${usuario.id}`, 60, 10 * 60_000)) return responder({ error: 'Muitos envios. Aguarde alguns minutos.' }, 429);
  if (Number(request.headers.get('content-length') || 0) > MAX_UPLOAD_PUBLICO + 65536) return responder({ error: 'O arquivo precisa ter até 4 MB.' }, 413);
  try {
    const form = await request.formData();
    const tipo = String(form.get('tipo'));
    const escopo = String(form.get('escopo') || 'itatame');
    const file = form.get('file');
    if (!['avatar', 'banner', 'capa', 'documento'].includes(tipo)) return responder({ error: 'Tipo de arquivo inválido.' }, 400);
    if (!['itatame', 'retratt'].includes(escopo)) return responder({ error: 'Destino inválido.' }, 400);
    if (!(file instanceof File) || !file.size || file.size > MAX_UPLOAD_PUBLICO) return responder({ error: 'Envie um arquivo de até 4 MB.' }, 400);
    if (tipo === 'banner' || tipo === 'documento') {
      const db = createSupabaseServerClient();
      const [{ data: org }, { data: atleta }] = await Promise.all([
        db.from('organizadores').select('id,status').eq('user_id', usuario.id).maybeSingle(),
        db.from('atletas').select('role').eq('user_id', usuario.id).maybeSingle(),
      ]);
      if (!['super-admin', 'organizador'].includes(atleta?.role || '') && (!org || !['aprovado', 'ativo', 'super-admin'].includes(org.status))) return responder({ error: 'Apenas organizadores aprovados podem enviar arquivos de campeonato.' }, 403);
    }
    const midia = await salvarMidiaPublica(Buffer.from(await file.arrayBuffer()), tipo as TipoMidiaPublica, escopo as 'itatame' | 'retratt');
    return responder({ publicUrl: midia.publicUrl, bytes: midia.bytes.length });
  } catch (error) {
    console.error('Falha no envio de mídia pública:', error instanceof Error ? error.message : 'erro');
    return responder({ error: 'Não foi possível enviar o arquivo. Confira o formato e tente novamente.' }, 400);
  }
}
