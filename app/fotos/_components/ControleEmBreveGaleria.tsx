"use client";
import { useRef, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Clock3, Loader2 } from 'lucide-react';

export default function ControleEmBreveGaleria({ galeriaId, ativo, onConfirmado }: { galeriaId: string; ativo: boolean; onConfirmado: (ativo: boolean) => void }) {
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const ocupado = useRef(false);
  async function alterar() {
    if (ocupado.current) return;
    ocupado.current = true; setSalvando(true); setAviso(null);
    const desejado = !ativo;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw Error('Sessão expirada. Entre novamente.');
      const auth = { Authorization: `Bearer ${session.access_token}` };
      let confirmado = false;
      let mensagem = 'Não foi possível confirmar a alteração. Atualize a galeria para conferir antes de tentar novamente.';
      try {
        const response = await fetch('/api/fotos/galeria/em-breve', { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ galeriaId, emBreve: desejado }), signal: AbortSignal.timeout(20000) });
        const dados = await response.json().catch(() => null);
        confirmado = response.ok && dados?.galeria?.id === galeriaId && dados.galeria.em_breve === desejado;
        if (dados?.error) mensagem = dados.error;
      } catch { /* A gravação pode ter ocorrido. Confere sem repetir a alteração. */ }
      if (!confirmado) {
        try {
          const response = await fetch(`/api/fotos/galeria/em-breve?galeriaId=${encodeURIComponent(galeriaId)}`, { headers: auth, cache: 'no-store', signal: AbortSignal.timeout(15000) });
          const dados = await response.json();
          confirmado = response.ok && dados?.galeria?.id === galeriaId && dados.galeria.em_breve === desejado;
        } catch { /* Mantém a incerteza visível; não declara que a operação falhou. */ }
      }
      if (!confirmado) throw Error(mensagem);
      onConfirmado(desejado);
      setAviso({ erro: false, texto: desejado ? 'Aviso Em breve ativado.' : 'Aviso Em breve desativado. Galeria atualizada.' });
    } catch (e) { setAviso({ erro: true, texto: e instanceof Error ? e.message : 'Não foi possível conferir a alteração.' }); }
    finally { setSalvando(false); ocupado.current = false; }
  }
  return <div className={`mt-4 rounded-xl border p-3 sm:p-4 ${ativo ? 'border-amber-400/40 bg-amber-400/10' : 'border-white/15 bg-white/[0.03]'}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="shrink-0"><Clock3 size={18} className={ativo ? 'text-amber-300' : 'text-zinc-400'} /></span><div><p className={`text-sm font-bold ${ativo ? 'text-amber-200' : 'text-white'}`}>Em breve {ativo ? 'ativado' : 'desativado'}</p><p className="mt-1 text-xs text-zinc-400">{ativo ? 'A galeria mostra o aviso de fotos em preparação.' : 'O aviso de preparação está desativado.'}</p></div></div>
      <button type="button" onClick={() => void alterar()} disabled={salvando} aria-pressed={ativo} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-xs font-bold disabled:opacity-50 ${ativo ? 'bg-retratt text-white' : 'border border-white/20 text-zinc-200 hover:bg-white/10'}`}>{salvando ? <><Loader2 size={14} className="animate-spin" /> Salvando…</> : ativo ? 'Desativar Em breve' : 'Ativar Em breve'}</button>
    </div>
    {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={`mt-3 text-xs leading-relaxed ${aviso.erro ? 'text-orange-200' : 'text-emerald-300'}`}>{aviso.texto}</p>}
  </div>;
}
