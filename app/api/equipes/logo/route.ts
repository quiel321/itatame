import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { autenticarRequest } from '@/app/lib/api-auth';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';

export const runtime = 'nodejs';

const MAX_ENTRADA = 5 * 1024 * 1024;
const MAX_SAIDA = 40 * 1024;

async function comprimirLogoLeve(bytes: Buffer) {
  let qualidade = 68;
  let webp = await sharp(bytes)
    .rotate()
    .resize(256, 256, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: qualidade, effort: 6 })
    .toBuffer();
  while (webp.length > MAX_SAIDA && qualidade > 40) {
    qualidade -= 10;
    webp = await sharp(bytes)
      .rotate()
      .resize(256, 256, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: qualidade, effort: 6 })
      .toBuffer();
  }
  return webp;
}

async function autorizarLogo(eventoId: string, equipeId: string, usuarioId: string, academiaId: string) {
  const db = createSupabaseServerClient();
  const { data: evento } = await db.from('eventos').select('id,organizador_id').eq('id', eventoId).maybeSingle();
  if (!evento) return null;
  if (evento.organizador_id === usuarioId) return db;
  const consulta = db
    .from('solicitacoes_equipe_evento')
    .select('id')
    .eq('evento_id', eventoId)
    .eq('equipe_id', equipeId)
    .eq('professor_user_id', usuarioId)
    .eq('status', 'aprovada');
  const { data: vinculo } = academiaId && !academiaId.startsWith('equipe-')
    ? await consulta.eq('id', academiaId).maybeSingle()
    : await consulta.maybeSingle();
  return vinculo ? db : null;
}

export async function POST(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: 'Entre para enviar a logo.' }, { status: 401 });

  const form = await request.formData();
  const eventoId = String(form.get('eventoId') || '').trim();
  const equipeId = String(form.get('equipeId') || '').trim();
  const academiaId = String(form.get('academiaId') || '').trim();
  const tipo = String(form.get('tipo') || 'equipe').trim() === 'academia' ? 'academia' : 'equipe';
  const arquivo = form.get('logo');
  if (!eventoId || !equipeId || !(arquivo instanceof File) || arquivo.size < 1) {
    return NextResponse.json({ error: 'Envie a logo em PNG, JPG ou WEBP.' }, { status: 400 });
  }
  if (arquivo.size > MAX_ENTRADA) {
    return NextResponse.json({ error: 'A imagem original precisa ter menos de 5 MB. O sistema converte para WebP leve depois.' }, { status: 400 });
  }

  const db = await autorizarLogo(eventoId, equipeId, usuario.id, academiaId);
  if (!db) return NextResponse.json({ error: 'Você não pode alterar esta logo.' }, { status: 403 });

  const { data: equipe } = await db.from('equipes_evento').select('id').eq('id', equipeId).eq('evento_id', eventoId).maybeSingle();
  if (!equipe) return NextResponse.json({ error: 'Equipe não encontrada.' }, { status: 404 });

  try {
    const webp = await comprimirLogoLeve(Buffer.from(await arquivo.arrayBuffer()));
    const destino = tipo === 'academia'
      ? `equipes/${eventoId}/academia-${academiaId || equipeId}.webp`
      : `equipes/${eventoId}/${equipeId}.webp`;
    const { error: uploadError } = await db.storage.from('avatars').upload(destino, webp, { contentType: 'image/webp', upsert: true });
    if (uploadError) return NextResponse.json({ error: 'Não foi possível enviar a logo.' }, { status: 500 });
    const logoUrl = `${db.storage.from('avatars').getPublicUrl(destino).data.publicUrl}?v=${Date.now()}`;

    if (tipo === 'academia' && academiaId && !academiaId.startsWith('equipe-')) {
      const { error } = await db.from('solicitacoes_equipe_evento').update({ logo_url: logoUrl }).eq('id', academiaId).eq('evento_id', eventoId).eq('equipe_id', equipeId);
      if (error) return NextResponse.json({ error: 'Rode supabase/equipes_logo.sql para liberar a logo da academia.' }, { status: 409 });
    } else if (tipo === 'academia') {
      const { error } = await db.from('equipes_evento').update({ academia_logo_url: logoUrl }).eq('id', equipeId).eq('evento_id', eventoId);
      if (error) return NextResponse.json({ error: 'Rode supabase/equipes_logo.sql para liberar a logo da academia.' }, { status: 409 });
    } else {
      const { error } = await db.from('equipes_evento').update({ logo_url: logoUrl }).eq('id', equipeId).eq('evento_id', eventoId);
      if (error) return NextResponse.json({ error: 'Rode supabase/equipes_logo.sql para liberar a logo da equipe.' }, { status: 409 });
    }

    return NextResponse.json({ success: true, logo_url: logoUrl, kb: Math.round(webp.length / 1024) });
  } catch {
    return NextResponse.json({ error: 'Não foi possível converter esta imagem para WebP.' }, { status: 400 });
  }
}
