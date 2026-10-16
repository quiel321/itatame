import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { assinaturasUnicas, hashPush } from '@/app/lib/push-regras';

export const runtime = 'nodejs';
export const maxDuration = 15;
// Limite adicional por instância. O teste só pode atingir um aparelho da própria conta.
const recentes = new Map<string, number>();

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
    if (!token) return NextResponse.json({ error: 'Entre na sua conta para testar.' }, { status: 401 });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Origem não autorizada.' }, { status: 403 });
    const raw = await request.text();
    if (raw.length > 3000) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    const body = JSON.parse(raw);
    if (body.confirmado !== true || typeof body.endpoint !== 'string' || body.endpoint.length > 2048) return NextResponse.json({ error: 'Confirme o teste neste aparelho.' }, { status: 400 });
    const db = createSupabaseServerClient();
    const { data: auth, error: ae } = await db.auth.getUser(token);
    if (ae || !auth.user) return NextResponse.json({ error: 'Sessão inválida. Entre novamente.' }, { status: 401 });
    if (auth.user.is_anonymous) return NextResponse.json({ error: 'Entre na sua conta para testar.' }, { status: 403 });
    const [legadas, novas] = await Promise.all([
      db.from('assinaturas_push').select('subscription').eq('user_id', auth.user.id),
      db.from('push_dispositivos').select('subscription').eq('user_id', auth.user.id).eq('endpoint', body.endpoint),
    ]);
    if (legadas.error || novas.error) throw new Error('Consulta indisponível');
    const assinatura = assinaturasUnicas([...(legadas.data || []), ...(novas.data || [])]).find(s => s.endpoint === body.endpoint);
    if (!assinatura) return NextResponse.json({ error: 'Ative os avisos neste navegador antes de testar.' }, { status: 409 });
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return NextResponse.json({ error: 'O serviço de avisos está indisponível agora.' }, { status: 503 });
    const agora = Date.now();
    for (const [k, ate] of recentes) if (ate <= agora) recentes.delete(k);
    const chave = hashPush(auth.user.id + ':' + assinatura.endpoint);
    if ((recentes.get(chave) || 0) > agora) return NextResponse.json({ error: 'Aguarde 30 segundos antes de outro teste.' }, { status: 429, headers: { 'Retry-After': '30' } });
    recentes.set(chave, agora + 30000);
    if (recentes.size > 1000) recentes.delete(recentes.keys().next().value!);
    const id = randomUUID();
    webpush.setVapidDetails('mailto:suporte@itatame.com.br', pub, priv);
    await webpush.sendNotification(assinatura, JSON.stringify({
      title: 'Teste de avisos do iTatame',
      body: 'Se você está vendo este aviso, o push chegou a este navegador. Este teste foi solicitado por você.',
      icon: '/apple-icon', url: '/perfil', tag: `itatame-teste-${id}`,
    }), { TTL: 120, urgency: 'high', timeout: 8000, topic: hashPush(id).slice(0, 32) });
    return NextResponse.json({ success: true, aceito: true });
  } catch (error) {
    const status = Number((error as { statusCode?: number })?.statusCode);
    if (status === 404 || status === 410) return NextResponse.json({ error: 'A ativação deste aparelho expirou. Reative os avisos e teste novamente.', codigo: 'ASSINATURA_EXPIRADA' }, { status: 409 });
    return NextResponse.json({ error: 'O teste não foi confirmado. Confira sua conexão e tente novamente.' }, { status: 503 });
  }
}
