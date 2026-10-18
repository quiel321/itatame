'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { FAIXAS_COMBO_IA } from '@/app/lib/fotos-combo-ia';
import { Gift, Loader2 } from 'lucide-react';

export default function ControleComboIaGaleria({ galeriaId }: { galeriaId: string }) {
  const [ativo, setAtivo] = useState(false), [podeEditar, setPodeEditar] = useState(false);
  const [carregando, setCarregando] = useState(false), [salvando, setSalvando] = useState(false), [aviso, setAviso] = useState('');
  const [aberto, setAberto] = useState(false), [carregado, setCarregado] = useState(false);
  async function requisitar(method: 'GET' | 'PATCH', valor?: boolean) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Entre novamente para configurar o combo.');
    const r = await fetch(`/api/fotos/combo-ia/configuracao${method === 'GET' ? `?galeriaId=${encodeURIComponent(galeriaId)}` : ''}`, {
      method, cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}`, ...(method === 'PATCH' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method === 'PATCH' ? { body: JSON.stringify({ galeriaId, ativo: valor }) } : {}),
    });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Não foi possível conferir o combo.'); return d;
  }
  useEffect(() => {
    if (!aberto || carregado) return;
    let atual = true;
    async function carregar() {
      setCarregando(true);
      try { const d = await requisitar('GET'); if (atual) { setAtivo(d.ativo); setPodeEditar(d.podeEditar); setCarregado(true); setAviso(''); } }
      catch (e) { if (atual) setAviso(e instanceof Error ? e.message : 'Não foi possível conferir o combo.'); }
      finally { if (atual) setCarregando(false); }
    }
    void carregar();
    return () => { atual = false; };
    // A sessão é consultada em cada ação; o carregamento pertence à galeria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galeriaId, aberto, carregado]);
  async function alterar() {
    setSalvando(true); setAviso('');
    try { const d = await requisitar('PATCH', !ativo); setAtivo(d.ativo); setAviso(d.ativo ? 'Combo ativado para novas ofertas de IA.' : 'Combo desativado.'); }
    catch (e) { setAviso(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setSalvando(false); }
  }
  return <details onToggle={e => setAberto(e.currentTarget.open)} className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
    <summary className="flex min-h-10 cursor-pointer items-center justify-between gap-3"><span className="flex items-center gap-2 font-bold text-white"><Gift size={15} />Pacote completo na IA</span><span className={ativo ? 'text-emerald-300' : 'text-zinc-500'}>{carregando ? 'Conferindo…' : !carregado ? 'Configurar' : ativo ? 'Ativo' : 'Desativado'}</span></summary>
    <p className="mt-3 text-[11px] leading-5 text-zinc-400">Ofereça desconto para comprar todas as fotos encontradas na mesma oferta de IA. Vídeos ficam fora do pacote.</p>
    <div className="my-3 flex flex-wrap gap-2">{FAIXAS_COMBO_IA.map(f => <span key={f.quantidade} className="rounded-lg bg-black/40 px-3 py-2 text-[10px] text-zinc-300">{f.quantidade}+ fotos · <strong className="text-orange-300">{f.percentual}% OFF</strong></span>)}</div>
    <p className="text-[10px] leading-4 text-zinc-500">Não acumula com o progressivo: vale o maior desconto. Apenas o responsável da galeria pode ativar. Compras já iniciadas mantêm seus valores.</p>
    {!carregando && podeEditar && <button type="button" onClick={() => void alterar()} disabled={salvando} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-orange-400/30 px-3 font-bold text-orange-300 disabled:opacity-50">{salvando && <Loader2 size={13} className="animate-spin" />}{ativo ? 'Desativar combo de IA' : 'Ativar combo de IA'}</button>}
    {!carregando && !podeEditar && !aviso && <p className="mt-3 text-[10px] text-zinc-400">Definido pelo organizador desta galeria.</p>}
    {aviso && <p role="status" className="mt-3 text-[11px] text-orange-200">{aviso}</p>}
  </details>;
}
