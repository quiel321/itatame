"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import type { AlunoSemVinculo, ProfessorVinculo } from '@/app/lib/alunos-sugeridos';

type Resultado = { professor: ProfessorVinculo; alunos: AlunoSemVinculo[] };

async function cabecalhos() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Entre novamente na sua conta.');
  return { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' };
}

async function buscar(termo: string): Promise<Resultado> {
  const resposta = await fetch(`/api/professor/alunos-sugeridos?busca=${encodeURIComponent(termo)}`, { headers: await cabecalhos(), cache: 'no-store' });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.error || 'Não foi possível buscar alunos.');
  return dados;
}

export default function AlunosSugeridos({ onVinculou }: { onVinculou: () => void }) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState<AlunoSemVinculo | null>(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ignorados, setIgnorados] = useState<number[]>([]);

  async function carregar(termo = '') {
    setCarregando(true); setErro(''); setMensagem(''); setConfirmando(null);
    try {
      const dados = await buscar(termo);
      setResultado(dados); setBuscaAplicada(termo); setIgnorados([]);
    } catch (error) {
      setResultado(null);
      setErro(error instanceof Error ? error.message : 'Não foi possível buscar alunos.');
    } finally { setCarregando(false); }
  }

  useEffect(() => {
    let ativo = true;
    void buscar('').then(dados => { if (ativo) setResultado(dados); })
      .catch(error => { if (ativo) setErro(error instanceof Error ? error.message : 'Não foi possível buscar alunos.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  async function confirmar() {
    if (!confirmando || !resultado || salvando) return;
    setSalvando(true); setErro(''); setMensagem('');
    try {
      const resposta = await fetch('/api/professor/alunos-sugeridos', {
        method: 'POST', headers: await cabecalhos(),
        body: JSON.stringify({ aluno: confirmando, professor: resultado.professor, busca: buscaAplicada, confirmado: true }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error || 'Não foi possível vincular o aluno.');
      setResultado({ ...resultado, alunos: resultado.alunos.filter(aluno => aluno.id !== confirmando.id) });
      setMensagem(`${confirmando.nome} foi vinculado à sua equipe e academia.`);
      setConfirmando(null);
      onVinculou();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível vincular o aluno.');
    } finally { setSalvando(false); }
  }

  const alunos = resultado?.alunos.filter(aluno => !ignorados.includes(aluno.id)) || [];
  if (carregando || !resultado || alunos.length === 0) return null;
  return (
    <section className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
      <h4 className="font-black text-yellow-400">Possíveis alunos de cadastros antigos</h4>
      <p className="mt-2 text-xs text-zinc-400">Encontramos alunos sem professor vinculado pelo nome informado ou pela mesma equipe e academia / CT. A equipe sozinha não é suficiente para misturar academias. Confira cada pessoa antes de confirmar. O vínculo atualiza o cadastro; as inscrições anteriores permanecem como foram feitas.</p>
      <form onSubmit={event => { event.preventDefault(); void carregar(busca.trim()); }} className="mt-3 flex flex-wrap gap-2">
        <label className="min-w-48 flex-1 text-xs text-zinc-400">Outra grafia do seu nome
          <input value={busca} onChange={event => setBusca(event.target.value)} maxLength={120} placeholder="Ex.: Ebarson (vazio usa seu nome cadastrado)" className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" />
        </label>
        <button disabled={carregando || salvando} className="self-end rounded-xl bg-yellow-600 px-4 py-2 text-xs font-bold text-black disabled:opacity-50">{carregando ? 'Buscando...' : 'Buscar alunos'}</button>
      </form>
      {erro && <p role="alert" className="mt-3 text-xs text-red-300">{erro}</p>}
      {mensagem && <p role="status" className="mt-3 text-xs text-green-300">{mensagem}</p>}
      {!carregando && alunos.map(aluno => (
        <div key={aluno.id} className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
          <p className="font-bold text-white">{aluno.nome}</p>
          <p className="mt-1 text-yellow-300">{aluno.motivo_sugestao === 'academia' ? 'Mesma equipe e academia / CT' : aluno.motivo_sugestao === 'professor-academia' ? 'Professor informado pertence ao mesmo CT. Academia do aluno ainda não informada.' : 'Nome do professor semelhante ao informado'}</p>
          <p className="mt-1 text-zinc-400">Professor informado: {aluno.professor || 'Não informado'}</p>
          <p className="text-zinc-400">Equipe: {aluno.equipe || 'Não informada'} · Academia: {aluno.academia || 'Não informada'}</p>
          {confirmando?.id === aluno.id ? (
            <div className="mt-3 rounded-lg border border-yellow-500/30 p-3">
              <p className="text-yellow-100">Você confirma que {aluno.nome} é seu aluno?</p>
              <p className="mt-1 text-zinc-300">O cadastro passará a usar professor {resultado!.professor.nome}, equipe {resultado!.professor.equipe} e academia {resultado!.professor.academia}.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={salvando} onClick={() => void confirmar()} className="rounded-lg bg-yellow-600 px-3 py-2 font-bold text-black disabled:opacity-50">{salvando ? 'Vinculando...' : 'Sim, confirmar vínculo'}</button>
                <button type="button" disabled={salvando} onClick={() => setConfirmando(null)} className="rounded-lg border border-white/20 px-3 py-2 text-white">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={salvando} onClick={() => setConfirmando(aluno)} className="rounded-lg bg-yellow-600 px-3 py-2 font-bold text-black">Reconheço este aluno</button>
              <button type="button" disabled={salvando} onClick={() => setIgnorados([...ignorados, aluno.id])} className="rounded-lg border border-white/20 px-3 py-2 text-zinc-300">Ignorar nesta busca</button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
