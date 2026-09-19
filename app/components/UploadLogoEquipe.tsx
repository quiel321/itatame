'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { comprimirLogo } from '@/app/lib/comprimir-avatar';

export function UploadLogoEquipe({
  eventoId,
  equipeId,
  academiaId,
  tipo = 'equipe',
  logoUrl,
  nome,
  onAtualizou,
}: {
  eventoId: string;
  equipeId: string;
  academiaId?: string;
  tipo?: 'equipe' | 'academia';
  logoUrl?: string | null;
  nome: string;
  onAtualizou: (url: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [peso, setPeso] = useState('');
  const rotulo = tipo === 'academia' ? 'academia' : 'equipe';

  async function enviar(arquivo: File) {
    setEnviando(true);
    setErro('');
    setPeso('');
    try {
      const leve = await comprimirLogo(arquivo);
      const { data: { session } } = await supabase.auth.getSession();
      const form = new FormData();
      form.set('eventoId', eventoId);
      form.set('equipeId', equipeId);
      form.set('tipo', tipo);
      if (academiaId) form.set('academiaId', academiaId);
      form.set('logo', leve);
      const resposta = await fetch('/api/equipes/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
        body: form,
      });
      const resultado = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(resultado.error || 'Não foi possível enviar a logo.');
      onAtualizou(resultado.logo_url);
      setPeso(resultado.kb ? `Salva em ${resultado.kb} KB (WebP)` : 'Salva em WebP leve');
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-black/30 p-3 hover:border-yellow-500/40">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover" />
      ) : (
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/15 text-[9px] font-black uppercase tracking-widest text-zinc-500">Logo</span>
      )}
      <span className="min-w-0 text-xs">
        <strong className="block font-black uppercase tracking-wide text-white">{enviando ? 'Convertendo para WebP...' : `Enviar logo da ${rotulo}`}</strong>
        <span className="mt-1 block font-medium text-zinc-400">{nome}</span>
        {erro
          ? <span className="mt-1 block text-[11px] text-red-300">{erro}</span>
          : <span className="mt-1 block text-[11px] text-zinc-500">{peso || 'O servidor reduz para 256×256 WebP, cerca de 20–40 KB.'}</span>}
      </span>
      <input type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/heif" className="hidden" disabled={enviando} onChange={(event) => {
        const arquivo = event.target.files?.[0];
        event.target.value = '';
        if (arquivo) void enviar(arquivo);
      }} />
    </label>
  );
}
