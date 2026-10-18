import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { conferirAssinaturasComboIa, validarComboIaNoCheckout } from '@/app/lib/fotos-combo-ia-servidor';
import { calcularCompraComCombosIa, MAX_ITENS_COMBO_IA } from '@/app/lib/fotos-combo-ia';
import { faixasDoEvento } from '@/app/lib/fotos-descontos';
type EventoCombo = { id: string; nome: string; status: string; em_breve: boolean | null; acesso_por_link: boolean | null; permite_download_gratis: boolean | null; combo_ia_ativo: boolean; descontos_progressivos: unknown; desconto_combo_qtd: number | null; desconto_combo_percentual: number | null };
type FotoCombo = { id: string; evento_id: string; mime_type: string | null; preco_centavos: number; foto_eventos: EventoCombo | EventoCombo[] };

export async function POST(request: Request) {
  const resposta = (d: unknown, status = 200) => NextResponse.json(d, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    const body = await request.json(), combos = conferirAssinaturasComboIa(body.tokens);
    const ids = [...new Set((Array.isArray(body.fotoIds) ? body.fotoIds : []).map(String))];
    if (!combos.length || !ids.length || ids.length > MAX_ITENS_COMBO_IA) return resposta({ error: 'Pacote de IA inválido.' }, 400);
    const db = createSupabaseServerClient(), fotos: FotoCombo[] = [];
    for (let n = 0; n < ids.length; n += 100) {
      const { data, error } = await db.from('foto_arquivos').select('id,evento_id,mime_type,preco_centavos,foto_eventos(id,nome,status,em_breve,acesso_por_link,permite_download_gratis,combo_ia_ativo,descontos_progressivos,desconto_combo_qtd,desconto_combo_percentual)').in('id', ids.slice(n, n + 100)).eq('status', 'publicada');
      if (error) throw new Error('Não foi possível conferir os preços agora. Tente novamente.');
      fotos.push(...((data || []) as unknown as FotoCombo[]));
    }
    if (fotos.length !== ids.length) throw new Error('Uma das fotos não está disponível. Refaça a busca de IA.');
    const evento = Array.isArray(fotos[0].foto_eventos) ? fotos[0].foto_eventos[0] : fotos[0].foto_eventos;
    if (!evento || evento.status !== 'publicado' || evento.acesso_por_link || evento.em_breve || evento.permite_download_gratis || fotos.some(f => f.evento_id !== evento.id)) throw new Error('Finalize os pacotes de cada galeria separadamente.');
    validarComboIaNoCheckout(combos, fotos, evento);
    const itens = fotos.map(f => ({ id: f.id, precoCentavos: Number(f.preco_centavos), mimeType: f.mime_type }));
    const valores = calcularCompraComCombosIa(itens, faixasDoEvento(evento), combos);
    const pacotes = combos.map((c, n) => {
      const indices = fotos.flatMap((f, i) => c.fotoIds.includes(f.id) ? [i] : []);
      const subtotalCentavos = indices.reduce((s, i) => s + itens[i].precoCentavos, 0);
      const descontoCentavos = indices.reduce((s, i) => s + valores.descontoPorItem[i], 0);
      return { token: body.tokens[n], eventoId: c.eventoId, eventoNome: evento.nome, fotoIds: c.fotoIds, quantidade: c.fotoIds.length, percentual: c.percentual, subtotalCentavos, descontoCentavos, totalCentavos: subtotalCentavos - descontoCentavos, expira: c.expira };
    });
    return resposta({ ...valores, pacotes });
  } catch (e) { return resposta({ error: e instanceof Error ? e.message : 'Não foi possível conferir o pacote.' }, 409); }
}
