import Link from 'next/link';
import s from './gestao.module.css';

type GaleriaResumo = { id: string; nome: string; cidade?: string | null; estado?: string | null; data_evento?: string | null; modelo_recebimento?: string };
export default function VisaoGeralFotografo({ totais, proprias, convidadas, perfilPendente, mercadoPagoConectado }: { totais: { fotos: number; albuns: number; vendas: number }; proprias: GaleriaResumo[]; convidadas: GaleriaResumo[]; perfilPendente: boolean; mercadoPagoConectado: boolean }) {
  return <>
    {perfilPendente && <p className={s.aviso}>Seu cadastro precisa ser completado para publicar nas galerias oficiais. <Link href="/fotos/fotografo/perfil">Completar perfil</Link></p>}
    <dl className={s.linhaResumo}>
      <div><dt>Mídias enviadas</dt><dd>{totais.fotos.toLocaleString('pt-BR')}</dd><small>Fotos e vídeos do seu acervo</small></div>
      <div><dt>Galerias</dt><dd>{proprias.length + convidadas.length}</dd><small>{proprias.length} própria(s) · {convidadas.length} como convidado</small></div>
      <div><dt>Álbuns criados</dt><dd>{totais.albuns}</dd><small>Pastas para organizar suas mídias</small></div>
      <div><dt>Pedidos com recebimento direto</dt><dd>{totais.vendas}</dd><small>Somente pedidos pagos · <Link href="/fotos/fotografo/financeiro" className={s.link}>Conferir valores</Link></small></div>
    </dl>
    <div className={s.linhaInfo}><span>Mercado Pago: {mercadoPagoConectado ? 'conectado' : 'não conectado'} · <Link href="/fotos/fotografo/perfil#recebimentos">Gerenciar conexão</Link></span><span>As vendas recebidas pelo organizador estão detalhadas abaixo.</span></div>
    <section className={s.secao}><header className={s.secaoCabecalho}><div><h2>Seus trabalhos</h2><p>Galerias próprias e eventos em que você está credenciado.</p></div><Link href="/fotos/fotografo/galerias">Gerenciar galerias →</Link></header>
      {!proprias.length && !convidadas.length ? <p className={s.vazio}>Você ainda não tem galerias. Crie uma galeria ou aguarde o credenciamento de um organizador.</p> : <div className={s.rolagem} tabIndex={0} role="region" aria-label="Galerias do fotógrafo"><table className={s.tabela}><thead><tr><th>Galeria</th><th>Participação</th><th>Recebimento</th><th /></tr></thead><tbody>{[...proprias.map(g => ({ ...g, propria: true })), ...convidadas.map(g => ({ ...g, propria: false }))].map(g => <tr key={g.id}><td><strong>{g.nome}</strong><small>{[g.cidade, g.estado].filter(Boolean).join(' / ')}{g.data_evento ? ` · ${g.data_evento.slice(0,10).split('-').reverse().join('/')}` : ''}</small></td><td>{g.propria ? 'Criador da galeria' : 'Fotógrafo convidado'}</td><td>{g.modelo_recebimento === 'diaria_organizador' ? 'Pelo organizador · diária' : 'Direto pelo Mercado Pago'}</td><td><Link href={`/fotos/fotografo/galerias#galeria-${g.id}`}>Abrir galeria →</Link></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
