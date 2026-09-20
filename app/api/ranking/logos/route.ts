import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LogoEquipe = { nome: string; academia: string | null; logo_url: string | null; academia_logo_url: string | null };
type LogoAcademia = { nome: string; logo_url: string | null };

export async function GET(request: Request) {
  const eventoId = new URL(request.url).searchParams.get('evento')?.trim() || '';
  const db = createSupabaseServerClient();

  let equipes: LogoEquipe[] = [];
  const comLogo = eventoId && eventoId !== 'Geral'
    ? db.from('equipes_evento').select('nome,academia,logo_url,academia_logo_url').eq('evento_id', eventoId)
    : db.from('equipes_evento').select('nome,academia,logo_url,academia_logo_url');
  const equipesResposta = await comLogo;
  if (equipesResposta.error) {
    const semLogo = eventoId && eventoId !== 'Geral'
      ? await db.from('equipes_evento').select('nome,academia').eq('evento_id', eventoId)
      : await db.from('equipes_evento').select('nome,academia');
    equipes = (semLogo.data || []).map((equipe) => ({
      nome: String(equipe.nome || ''),
      academia: equipe.academia || null,
      logo_url: null,
      academia_logo_url: null,
    }));
  } else {
    equipes = (equipesResposta.data || []).map((equipe) => ({
      nome: String(equipe.nome || ''),
      academia: equipe.academia || null,
      logo_url: equipe.logo_url || null,
      academia_logo_url: equipe.academia_logo_url || null,
    }));
  }

  let academias: LogoAcademia[] = [];
  const academiasQuery = eventoId && eventoId !== 'Geral'
    ? db.from('solicitacoes_equipe_evento').select('academia,logo_url,status').eq('status', 'aprovada').eq('evento_id', eventoId)
    : db.from('solicitacoes_equipe_evento').select('academia,logo_url,status').eq('status', 'aprovada');
  const academiasResposta = await academiasQuery;
  if (!academiasResposta.error) {
    academias = (academiasResposta.data || [])
      .filter((item) => item.logo_url)
      .map((item) => ({ nome: String(item.academia || ''), logo_url: item.logo_url }));
  }

  return NextResponse.json({ equipes, academias });
}
