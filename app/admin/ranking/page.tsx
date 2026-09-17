'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/lib/supabase';
import { CompeticaoShell, useEventoCompeticao } from '../_components/CompeticaoShell';
import { calcularResultadosChaves, lerRegrasPontuacao } from '@/app/lib/ranking-eventos';

export default function RankingOrganizadorPage() {
  const contexto = useEventoCompeticao();
  return (
    <CompeticaoShell
      titulo="Resultados e ranking"
      descricao="O pódio fica nas chaves. Aqui você confere quem pontuou e publica o campeonato no ranking oficial."
      contexto={contexto}
    >
      <Editor key={contexto.eventoId} eventoId={contexto.eventoId} />
    </CompeticaoShell>
  );
}

function Editor({ eventoId }: { eventoId: string }) {
  const [carregando, setCarregando] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [lutasConcluidas, setLutasConcluidas] = useState(0);
  const [publicado, setPublicado] = useState(false);
  const [atletas, setAtletas] = useState<Array<{ atleta_id: string; nome: string; equipe: string; ouro: number; prata: number; bronze: number; pts: number }>>([]);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      setErro('');
      const [{ data: evento }, { data: lutas }] = await Promise.all([
        supabase.from('eventos').select('id, regras_pontuacao_equipes').eq('id', eventoId).maybeSingle(),
        supabase.from('chaves').select('*').eq('evento_id', eventoId).eq('status_luta', 'concluida'),
      ]);
      if (!ativo) return;
      const regras = lerRegrasPontuacao(evento?.regras_pontuacao_equipes);
      const resultado = calcularResultadosChaves(lutas || [], { [eventoId]: regras });
      setLutasConcluidas((lutas || []).length);
      setPublicado(regras.ranking_publicado === true);
      setAtletas(resultado.atletas.sort((a, b) => b.pts - a.pts || b.ouro - a.ouro));
      setCarregando(false);
    }
    void carregar();
    return () => { ativo = false; };
  }, [eventoId]);

  async function publicar() {
    setPublicando(true);
    setErro('');
    setMensagem('');
    const { data: sessao } = await supabase.auth.getSession();
    const resposta = await fetch('/api/organizador/ranking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessao.session?.access_token || ''}`,
      },
      body: JSON.stringify({ eventoId }),
    });
    const dados = await resposta.json();
    setPublicando(false);
    if (!resposta.ok) {
      setErro(dados.error || 'Não foi possível publicar o ranking.');
      return;
    }
    setPublicado(true);
    setMensagem(dados.pontuaram
      ? `Ranking publicado. ${dados.pontuaram} atleta(s) pontuaram neste campeonato.`
      : 'Campeonato encerrado. Nenhuma luta pontuou no ranking (W.O. contra adversário real não conta). O pódio continua nas chaves.');
  }

  if (carregando) return <p className="text-zinc-500 text-sm">Calculando pódio...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Link href={`/evento/${eventoId}/publico`} className="rounded-xl bg-yellow-500 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black">
          Ver pódio e chaves
        </Link>
        <Link href={`/ranking?evento=${eventoId}`} className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white">
          Ver ranking público
        </Link>
      </div>

      <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{lutasConcluidas} luta(s) concluída(s)</p>
        <h2 className="mt-1 text-xl font-black">{publicado ? 'Ranking publicado' : 'Publicar no ranking oficial'}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Quem vê a página do evento abre as chaves para o pódio. O ranking junta medalhas e pontos deste campeonato. W.O. contra adversário real não pontua; bye após o check-in pontua.
        </p>
        <button
          onClick={() => void publicar()}
          disabled={publicando}
          className="mt-4 rounded-xl bg-red-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
        >
          {publicando ? 'Publicando...' : publicado ? 'Publicar de novo / encerrar' : 'Publicar ranking e encerrar'}
        </button>
      </section>

      {atletas.length === 0 ? (
        <p className="rounded-xl border border-white/10 p-4 text-sm text-zinc-400">
          Ninguém pontuou ainda neste cálculo. Confira o pódio nas chaves. Se as lutas foram W.O. contra quem estava na chave, elas não entram no ranking.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-12 gap-2 bg-black/40 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            <span className="col-span-5">Atleta</span>
            <span className="col-span-3">Equipe</span>
            <span className="col-span-1 text-center">Ouro</span>
            <span className="col-span-1 text-center">Prata</span>
            <span className="col-span-1 text-center">Bronze</span>
            <span className="col-span-1 text-right">Pts</span>
          </div>
          {atletas.map((atleta) => (
            <div key={atleta.atleta_id} className="grid grid-cols-12 gap-2 border-t border-white/5 px-4 py-3 text-sm">
              <span className="col-span-5 font-bold text-white">{atleta.nome}</span>
              <span className="col-span-3 truncate text-zinc-400">{atleta.equipe}</span>
              <span className="col-span-1 text-center text-yellow-400">{atleta.ouro}</span>
              <span className="col-span-1 text-center text-zinc-300">{atleta.prata}</span>
              <span className="col-span-1 text-center text-orange-400">{atleta.bronze}</span>
              <span className="col-span-1 text-right font-bold">{atleta.pts}</span>
            </div>
          ))}
        </div>
      )}

      {mensagem && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{mensagem}</p>}
      {erro && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{erro}</p>}
    </div>
  );
}
