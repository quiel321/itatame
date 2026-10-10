import { supabase } from './supabase';
import type { IdentidadeInscricao } from './inscricao-identificacao';

// A API valida o perfil de super-admin antes de consultar os dados privados dos adultos.
export async function carregarResponsaveisInscricoes<T extends IdentidadeInscricao & { id: string | number }>(inscricoes: T[]) {
  if (!inscricoes.length) return [];
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Entre novamente para consultar os responsáveis.');
  const identificacoes = new Map<string, IdentidadeInscricao>();
  const ids = [...new Set(inscricoes.map(item => String(item.id)))];
  for (let i = 0; i < ids.length; i += 200) {
    const resposta = await fetch('/api/super-admin/inscricoes-identificacao', {
      method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inscricaoIds: ids.slice(i, i + 200) }), cache: 'no-store',
    });
    const resultado = await resposta.json();
    if (!resposta.ok) throw new Error(resultado.error || 'Não foi possível carregar os responsáveis.');
    for (const item of resultado.inscricoes as (IdentidadeInscricao & { id: string | number })[]) identificacoes.set(String(item.id), item);
  }
  return inscricoes.map(item => ({ ...item, ...identificacoes.get(String(item.id)) }));
}
