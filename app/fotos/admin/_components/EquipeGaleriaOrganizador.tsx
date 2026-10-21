'use client';

import { ChevronDown, UserPlus } from 'lucide-react';
import { useState } from 'react';
import g from '@/app/fotos/fotografo/_components/gestao.module.css';
import s from './organizador.module.css';

type Fotografo = { id: string; nome: string | null; email: string | null; foto_url: string | null; comissao_organizador_percentual: number; modelo_recebimento: 'royalty' | 'diaria_organizador' };
type Modelo = 'royalty' | 'diaria_organizador';
function FotoPerfil({ url, nome }: { url: string | null; nome: string | null }) {
  const [falhou, setFalhou] = useState(false);
  const iniciais = (nome || 'Fotógrafo').trim().split(/\s+/).filter(n => /[A-Za-zÀ-ÿ]/.test(n)).slice(0, 2).map(n => n[0]).join('').toUpperCase();
  return <span title={url && !falhou ? 'Foto do perfil do fotógrafo' : 'Fotógrafo sem foto de perfil'}>{url && !falhou ? <img src={url} alt={`Perfil de ${nome || 'fotógrafo'}`} onError={() => setFalhou(true)} /> : iniciais}</span>;
}
export default function EquipeGaleriaOrganizador({ eventoId, fotografos, modelos, royalties, avisos, salvando, removendo, email, credenciando, onModelo, onRoyalty, onSalvar, onRemover, onEmail, onCredenciar }: {
  eventoId: string; fotografos: Fotografo[]; modelos: Record<string, Modelo>; royalties: Record<string, string>; avisos: Record<string, { erro: boolean; texto: string }>; salvando: string | null; removendo: string | null; email: string; credenciando: boolean;
  onModelo: (chave: string, modelo: Modelo) => void; onRoyalty: (chave: string, valor: string) => void; onSalvar: (id: string) => void; onRemover: (f: Fotografo) => void; onEmail: (email: string) => void; onCredenciar: () => void;
}) {
  return <><div className={s.equipeResumo}>{fotografos.length} fotógrafo(s) credenciado(s)</div>
    {!fotografos.length && <p className={g.vazio}>Esta galeria ainda não tem fotógrafos. Credencie um profissional pelo e-mail abaixo.</p>}
    {fotografos.map(f => {
      const chave = `${eventoId}:${f.id}`, modelo = modelos[chave] ?? f.modelo_recebimento ?? 'royalty';
      const alterado = modelo !== (f.modelo_recebimento || 'royalty') || (modelo === 'royalty' && Number(String(royalties[chave] ?? f.comissao_organizador_percentual ?? 0).replace(',', '.')) !== Number(f.comissao_organizador_percentual || 0));
      return <article key={f.id} className={s.pessoa}>
        <div className={s.pessoaIdentidade}><FotoPerfil key={f.foto_url || f.id} url={f.foto_url} nome={f.nome} /><div><h2>{f.nome || 'Fotógrafo'}</h2><p>{f.email || 'E-mail não informado'}</p>{!f.foto_url && <p>Sem foto de perfil</p>}<button type="button" disabled={removendo === chave} onClick={() => onRemover(f)}>{removendo === chave ? 'Removendo…' : 'Remover credenciamento'}</button></div></div>
        <div className={s.acordo}><label>Modelo de recebimento<select aria-label={`Modelo de recebimento de ${f.nome || 'fotógrafo'}`} value={modelo} onChange={e => onModelo(chave, e.target.value as Modelo)}><option value="royalty">Royalty · fotógrafo recebe a venda</option><option value="diaria_organizador">Diária · organizador recebe a venda</option></select></label>{modelo === 'royalty' && <label className={s.royalty}>Seu royalty<input aria-label={`Royalty do fotógrafo ${f.nome || 'credenciado'}`} type="number" min="0" max="50" step="0.1" inputMode="decimal" value={royalties[chave] ?? String(f.comissao_organizador_percentual || 0)} onChange={e => onRoyalty(chave, e.target.value)} /><span>%</span></label>}<p>{modelo === 'diaria_organizador' ? 'Você recebe as vendas e combina o pagamento da diária com o fotógrafo.' : 'O fotógrafo recebe as vendas. Seu royalty fica registrado para repasse.'}</p></div>
        <div className={s.salvarAcordo}><button type="button" disabled={salvando === chave} onClick={() => onSalvar(f.id)} className={g.primario}>{salvando === chave ? 'Salvando…' : 'Salvar acordo'}</button>{alterado && <p className="text-amber-200">Alterações não salvas</p>}</div>
        {avisos[chave] && (avisos[chave].erro || !alterado) && <p role={avisos[chave].erro ? 'alert' : 'status'} className={`${s.avisoAcordo} ${avisos[chave].erro ? 'text-orange-200' : 'text-emerald-300'}`}>{avisos[chave].texto}</p>}
        <details className={s.detalhesAcordo}><summary>Detalhes deste acordo <ChevronDown size={13} /></summary><p>{modelo === 'diaria_organizador' ? 'O organizador recebe 95% antes da tarifa do Mercado Pago. A diária do fotógrafo é combinada e paga fora da Retratt. Para o cliente comprar arquivos de vários fotógrafos em um único pagamento, todos os envolvidos devem estar configurados como diária nesta galeria; salve cada alteração.' : 'A Retratt retém 5%. O fotógrafo recebe o restante menos seu royalty e a tarifa do Mercado Pago. Seu percentual pode variar de 0% a 50% e vale para as próximas compras.'}</p></details>
      </article>;
    })}
    <div className={s.convite}><span><UserPlus size={21} /></span><label>Credenciar fotógrafo pelo e-mail<input type="email" value={email} onChange={e => onEmail(e.target.value)} placeholder="fotografo@exemplo.com" /></label><button type="button" disabled={credenciando} onClick={onCredenciar} className={g.botao}>{credenciando ? 'Credenciando…' : 'Credenciar fotógrafo'}</button></div>
  </>;
}
