import Link from 'next/link';

const etapas = [
  {
    numero: '01', titulo: 'Criar o campeonato', href: '/admin/novo-evento', acao: 'Abrir cadastro do evento',
    texto: 'Informe nome, data, local, limite de vagas, lotes, valores, prazos de inscrição, pagamento e checagem. Revise a página pública antes de divulgar.',
    pronto: 'O evento aparece no painel e a página pública mostra datas e valores corretos.',
  },
  {
    numero: '02', titulo: 'Montar as categorias', href: '/admin/categorias', acao: 'Configurar categorias',
    texto: 'Escolha um modelo inicial editável, copie uma tabela de outro campeonato ou cadastre categorias manualmente. Confira sexo, idade, faixa, peso e tempo de luta.',
    pronto: 'Um atleta de teste enxerga somente a categoria compatível com seu perfil.',
  },
  {
    numero: '03', titulo: 'Cadastrar equipes e professores', href: '/admin/equipes', acao: 'Gerenciar equipes',
    texto: 'O organizador pode cadastrar diretamente. O professor pode abrir a página pública do evento, tocar em Professor / Equipe e cadastrar sua equipe gratuitamente, sem esperar aprovação.',
    pronto: 'A equipe cadastrada aparece no seletor da inscrição.',
  },
  {
    numero: '04', titulo: 'Conferir o recebimento', href: '/admin/financeiro', acao: 'Abrir Financeiro',
    texto: 'Confirme a conta Mercado Pago conectada, o parcelamento cliente e o plano. Faça uma inscrição de teste e confira pagamento, comissão e valor do organizador.',
    pronto: 'O pagamento aprovado libera a inscrição e aparece no resumo financeiro.',
  },
  {
    numero: '05', titulo: 'Abrir e acompanhar inscrições', href: '/admin', acao: 'Voltar ao painel',
    texto: 'Copie o link pelo cartão Campeonato em foco. Acompanhe inscritos em Lista ou Detalhado e filtre pagos e pendentes. Evite aprovar manualmente um pagamento sem comprovante. Dúvidas dos atletas chegam no chat interno do campeonato.',
    pronto: 'O professor recebeu o link e consegue orientar um atleta do início ao fim.',
  },
  {
    numero: '06', titulo: 'Fechar, conferir e gerar chaves', href: '/admin/chaves', acao: 'Preparar chaves',
    texto: 'Deixe um intervalo entre o fim da checagem e a divulgação das chaves. Nesse tempo o atleta ainda corrige a inscrição. Na hora marcada, o sistema gera as chaves sozinho. O botão manual continua disponível para conferir ou refazer.',
    pronto: 'Todos os atletas aptos aparecem uma única vez e nenhuma divisão foi misturada.',
  },
  {
    numero: '07', titulo: 'Preparar a operação', href: '/admin/tatames', acao: 'Organizar tatames',
    texto: 'Distribua as lutas, crie os acessos da equipe de operação e teste check-in, chamador, mesário, placar e painel ao vivo antes do evento.',
    pronto: 'Cada operador possui seu PIN e sabe qual tela utilizar.',
  },
] as const;

export default function GuiaOrganizadorPage() {
  return <main className="min-h-screen bg-[#050505] px-4 py-12 text-white"><div className="mx-auto max-w-5xl">
    <Link href="/admin" className="text-sm text-zinc-400">← Painel do organizador</Link>
    <p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-red-400">Primeiro campeonato</p>
    <h1 className="mt-2 text-3xl font-black md:text-4xl">Guia rápido do organizador</h1>
    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">Siga esta ordem antes de divulgar as inscrições. Cada etapa possui uma confirmação simples para você saber quando pode avançar.</p>
    <section className="mt-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5 text-sm text-yellow-100"><strong className="block mb-1">Antes de abrir as inscrições</strong>Faça uma inscrição completa de teste: conta do atleta, equipe, categoria, pagamento e confirmação. Corrija qualquer diferença antes de enviar o link ao público.</section>
    <div className="mt-6 space-y-4">{etapas.map(etapa => <article key={etapa.numero} className="grid gap-4 rounded-2xl border border-white/10 bg-black/40 p-5 md:grid-cols-[70px_1fr_auto] md:items-center"><div className="text-2xl font-black text-red-500">{etapa.numero}</div><div><h2 className="font-black">{etapa.titulo}</h2><p className="mt-2 text-sm leading-relaxed text-zinc-400">{etapa.texto}</p><p className="mt-3 text-xs text-emerald-400"><strong>Está pronto quando:</strong> {etapa.pronto}</p></div><Link href={etapa.href} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest hover:border-red-500/40 hover:bg-red-500/10">{etapa.acao}</Link></article>)}</div>
    <section className="mt-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5"><h2 className="font-black">Roteiro para ensinar ao professor</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300"><li>Mostre a página pública e o botão Professor / Equipe.</li><li>Peça que ele entre ou crie uma conta do tipo Professor.</li><li>Cadastre a equipe gratuitamente; confira se ela já aparece na inscrição.</li><li>Faça uma inscrição de atleta junto com ele.</li><li>Mostre onde acompanhar inscritos, pagamentos e categorias.</li></ol></section>
  </div></main>;
}
