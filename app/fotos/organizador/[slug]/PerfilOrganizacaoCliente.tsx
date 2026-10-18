'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import LinkGaleria from '@/app/fotos/_components/LinkGaleria';
import FotosShell from '../../_components/FotosShell';
import BuscaFacial from '../../_components/BuscaFacial';
import { ArrowDown, ArrowUpRight, CalendarDays, Camera, Check, Image as IconeImagem, MapPin, Search, Share2, ScanFace, SlidersHorizontal, X } from 'lucide-react';
import { categoriaDaGaleria, nomeCategoriaFotos } from '@/app/lib/fotos-categorias';
import { filtrarGaleriasPortfolio, type PortfolioOrganizador, type GaleriaPortfolio } from '@/app/lib/fotos-portfolio';
import { caminhoPortfolioOrganizador } from '@/app/lib/fotos-portfolio-url';
import { versaoDaCapa } from '@/app/lib/fotos-compartilhamento';

const data = (s: string | null) => s ? new Date(s.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
function Capa({ src, nome, className, prioridade = false }: { src: string | null; nome: string; className: string; prioridade?: boolean }) {
  const [falhou, setFalhou] = useState(false);
  return src && !falhou ? <Image src={src} alt={nome} fill unoptimized priority={prioridade} className={className} onError={() => setFalhou(true)} />
    : <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_top_right,rgba(255,90,31,0.22),transparent_65%),linear-gradient(135deg,#18181b,#09090b)]"><Camera size={48} className="text-white/10" /></div>;
}
function CartaoGaleria({ galeria: g }: { galeria: GaleriaPortfolio }) {
  const encerrada = Boolean(g.vendas_ate && new Date(g.vendas_ate) < new Date());
  return <LinkGaleria href={`/fotos/evento/${g.id}`} className="group relative flex min-h-72 flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-5 transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 sm:min-h-80">
    <Capa src={g.capa_url} nome={g.nome} className="object-cover transition-transform duration-700 group-hover:scale-105" />
    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
    <div className="absolute inset-x-4 top-4 flex flex-wrap justify-between gap-2 text-[10px]"><span className="rounded-full border border-white/15 bg-black/50 px-2.5 py-1.5 backdrop-blur-sm">{nomeCategoriaFotos(categoriaDaGaleria(g))}</span><span className="rounded-full bg-black/60 px-2.5 py-1.5 backdrop-blur-sm">{g.em_breve ? 'Em breve' : encerrada ? 'Vendas encerradas' : `${g.quantidade.toLocaleString('pt-BR')} mídias`}</span></div>
    <div className="relative"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-orange-200">{data(g.data_evento)}</p><h3 className="break-words text-base font-bold leading-snug text-white">{g.nome}</h3>{(g.cidade || g.local) && <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-zinc-300"><MapPin size={13} className="mt-1 shrink-0" /><span>{[g.cidade || g.local, g.estado].filter(Boolean).join(' · ')}</span></p>}<div className="mt-5 flex items-center justify-between border-t border-white/15 pt-3"><span className="text-xs font-bold">{g.em_breve ? 'Acompanhar galeria' : 'Encontrar minhas fotos'}</span><ArrowUpRight size={19} className="text-orange-300" /></div></div>
  </LinkGaleria>;
}

export default function PerfilOrganizacaoCliente({ dados }: { dados: PortfolioOrganizador }) {
  const { organizador: org, galerias } = dados;
  const [busca, setBusca] = useState(''), [cidade, setCidade] = useState(''), [categoria, setCategoria] = useState(''), [ano, setAno] = useState('');
  const [copiado, setCopiado] = useState(false), [aviso, setAviso] = useState(''), [pagina, setPagina] = useState(1);
  const cidades = useMemo(() => [...new Set(galerias.map(g => g.cidade).filter((s): s is string => Boolean(s)))].sort(), [galerias]);
  const categorias = useMemo(() => [...new Set(galerias.map(categoriaDaGaleria))], [galerias]);
  const anos = useMemo(() => [...new Set(galerias.map(g => g.data_evento?.slice(0, 4)).filter((s): s is string => Boolean(s)))].sort().reverse(), [galerias]);
  const filtradas = useMemo(() => filtrarGaleriasPortfolio(galerias, { busca, cidade, categoria, ano }), [galerias, busca, cidade, categoria, ano]);
  const ultima = galerias.find(g => !g.em_breve) || galerias[0];
  async function compartilhar() {
    const url = new URL(caminhoPortfolioOrganizador(org.slug), window.location.origin).toString();
    const linkCompartilhado = new URL(url);
    if (org.avatar_url) linkCompartilhado.searchParams.set('perfil', versaoDaCapa(org.avatar_url));
    try {
      if (navigator.share) await navigator.share({ title: org.nome, url: linkCompartilhado.toString() });
      else { await navigator.clipboard.writeText(linkCompartilhado.toString()); setCopiado(true); }
      setAviso('');
    } catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setAviso(`Copie o endereço da página para compartilhar: ${linkCompartilhado}`); }
  }
  return <FotosShell marca={{ nome: org.nome, avatarUrl: org.avatar_url, href: `/fotos${caminhoPortfolioOrganizador(org.slug)}` }}>
    <main className="min-h-screen bg-[#080809] pb-16 text-white">
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div className="absolute inset-0"><Capa src={org.capa_url || ultima?.capa_url || null} nome={`Capa de ${org.nome}`} prioridade className="object-cover opacity-55" /><div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/15" /><div className="absolute inset-0 bg-gradient-to-t from-[#080809] via-transparent to-transparent" /></div>
        <div className="relative mx-auto grid max-w-7xl gap-8 px-5 pb-12 pt-12 sm:px-8 sm:py-14 lg:grid-cols-[1fr_320px] lg:items-end">
          <div className="max-w-3xl"><p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] backdrop-blur-sm"><span className="h-1.5 w-1.5 rounded-full bg-orange-400" />Galerias de {org.nome}</p><h1 className="break-words text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">{org.nome}</h1><p className="mt-5 max-w-lg text-sm leading-6 text-zinc-300">Encontre o seu evento, descubra suas fotos e leve cada momento com você.</p><div className="mt-7 flex flex-wrap gap-3"><a href="#galerias" className="inline-flex min-h-12 items-center gap-3 rounded-xl bg-orange-500 px-5 text-xs font-bold text-black hover:bg-orange-400">Explorar galerias <ArrowDown size={16} /></a><button type="button" onClick={() => void compartilhar()} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 text-xs font-bold backdrop-blur-sm hover:bg-white/10">{copiado ? <Check size={15} /> : <Share2 size={15} />}{copiado ? 'Link copiado' : 'Compartilhar site'}</button></div>{aviso && <p role="status" className="mt-3 break-all text-xs text-orange-200">{aviso}</p>}</div>
          <aside className="hidden rounded-2xl border border-white/15 bg-black/40 p-5 backdrop-blur-md lg:block"><p className="text-[10px] font-bold uppercase tracking-widest text-orange-200">Galerias disponíveis</p><p className="mt-3 text-3xl font-black">{galerias.length}<span className="ml-2 text-sm font-normal text-zinc-300">{galerias.length === 1 ? 'galeria para explorar' : 'galerias para explorar'}</span></p>{org.localizacao && <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-zinc-400"><MapPin size={14} className="mt-1 shrink-0" /><span>{org.localizacao}</span></p>}<p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-zinc-300">Fotos originais em alta resolução. Acesso às compras e suporte pela Retratt.</p></aside>
        </div>
      </section>
      <section id="galerias" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-orange-300">O seu momento está aqui</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">Explore nossas galerias</h2></div><span className="text-xs text-zinc-500">{filtradas.length} {filtradas.length === 1 ? 'resultado' : 'resultados'}</span></div>
        <div className="mb-5 flex flex-col justify-between gap-4 rounded-2xl border border-orange-400/20 bg-orange-500/5 p-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><span className="rounded-xl bg-orange-500/10 p-2.5 text-orange-300"><ScanFace size={22} /></span><div><h3 className="text-sm font-bold">Encontre suas fotos e vídeos com uma selfie</h3><p className="mt-1 text-xs leading-5 text-zinc-400">Busque de uma vez nas galerias públicas de {org.nome}.</p><p className="mt-1 text-[10px] text-zinc-500">A selfie é usada apenas na busca e não é armazenada.</p></div></div><BuscaFacial organizadorId={org.id} organizadorNome={org.nome} triggerLabel="Buscar com selfie" triggerClassName="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-xs font-bold text-black hover:bg-orange-400" /></div>
        <div className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]">
          <label className="flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3"><Search size={17} className="shrink-0 text-zinc-500" /><input aria-label="Buscar galeria ou local" placeholder="Qual evento você procura?" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>
          {([['Categoria', categoria, categorias.map(id => ({ id, nome: nomeCategoriaFotos(id) })), setCategoria], ['Cidade', cidade, cidades.map(id => ({ id, nome: id })), setCidade], ['Ano', ano, anos.map(id => ({ id, nome: id })), setAno]] as const).map(([rotulo, valor, opcoes, alterar]) => <select key={rotulo} aria-label={rotulo} value={valor} onChange={e => { alterar(e.target.value); setPagina(1); }} className="min-h-12 min-w-0 rounded-xl border border-white/10 bg-[#101012] px-3 text-xs"><option value="">{rotulo === 'Ano' ? 'Todas as datas' : `Todas as ${rotulo.toLowerCase()}s`}</option>{opcoes.map(o => <option value={o.id} key={o.id}>{o.nome}</option>)}</select>)}
        </div>
        {(busca || cidade || categoria || ano) && <button type="button" className="mb-5 inline-flex min-h-10 items-center gap-2 text-xs text-orange-200" onClick={() => { setBusca(''); setCidade(''); setCategoria(''); setAno(''); setPagina(1); }}><X size={13} />Limpar filtros</button>}
        {filtradas.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtradas.slice(0, pagina * 12).map(g => <CartaoGaleria key={g.id} galeria={g} />)}</div> : <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center"><span className="mb-3 inline-flex text-zinc-600"><IconeImagem size={30} /></span><p className="text-sm text-zinc-400">{galerias.length ? 'Nenhuma galeria encontrada. Tente outro filtro.' : 'Novas galerias serão publicadas por aqui. Guarde este endereço.'}</p></div>}
        {filtradas.length > pagina * 12 && <div className="mt-7 text-center"><button type="button" onClick={() => setPagina(p => p + 1)} className="min-h-12 rounded-xl border border-white/15 px-6 text-xs font-bold hover:bg-white/5">Ver mais galerias</button></div>}
        <div className="mt-7 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-5 text-zinc-400"><span className="mt-1 shrink-0 text-orange-300"><SlidersHorizontal size={17} /></span><p>Encontrou o evento? Abra a galeria para buscar suas fotos por nome ou referência. Nas galerias com busca facial disponível, você também pode usar uma selfie.</p></div>
      </section>
      <section id="sobre" className="mx-auto max-w-7xl scroll-mt-24 px-5 sm:px-8"><div className="grid gap-6 rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8 md:grid-cols-[1fr_1fr]"><div><p className="text-[10px] font-bold uppercase tracking-widest text-orange-300">Nossa página, seus momentos</p><h2 className="mt-3 break-words text-2xl font-bold">{org.nome}</h2>{org.localizacao && <p className="mt-2 text-sm text-zinc-400">{org.localizacao}</p>}<p className="mt-4 max-w-lg text-sm leading-6 text-zinc-300">Este é o nosso endereço para reunir as galerias dos eventos. Salve o link e volte sempre para encontrar novas fotos.</p></div><div className="grid gap-3 text-xs text-zinc-400"><p className="flex items-center gap-3 rounded-xl bg-black/30 p-3"><CalendarDays size={17} className="shrink-0 text-orange-300" /><span>Encontre as galerias por data, categoria ou cidade.</span></p><p className="flex items-center gap-3 rounded-xl bg-black/30 p-3"><Camera size={17} className="shrink-0 text-orange-300" /><span>Veja prévias protegidas antes de escolher suas fotos.</span></p><p className="flex items-center gap-3 rounded-xl bg-black/30 p-3"><Check size={17} className="shrink-0 text-orange-300" /><span>Após a aprovação do pagamento, acesse os arquivos originais.</span></p></div></div></section>
    </main>
  </FotosShell>;
}
