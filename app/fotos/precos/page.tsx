import Link from "next/link";
import FotosShell from "../_components/FotosShell";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Camera,
  Check,
  Cloud,
  CreditCard,
  Database,
  HelpCircle,
  Images,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";

const inclusos = [
  "Criação de galerias freelancer e participação em eventos oficiais",
  "Upload em lote e compressão automática das imagens",
  "Miniaturas protegidas com marca-d’água",
  "Armazenamento distribuído do arquivo original em alta resolução",
  "Busca facial inteligente por selfie",
  "Seleção em lote dos resultados da IA para o carrinho",
  "Checkout, confirmação de pedido e entrega automática",
  "Painéis de vendas, arquivos vendidos e downloads do comprador",
];

const tecnologia = [
  { icon: BrainCircuit, titulo: "Inteligência facial de alta precisão", texto: "Indexação facial em prévias otimizadas para acelerar a busca por selfie sem enviar o arquivo original de venda para análise." },
  { icon: Cloud, titulo: "Armazenamento distribuído", texto: "Originais e prévias ficam separados em uma infraestrutura escalável, com entrega controlada e sem expor o arquivo de alta resolução na vitrine." },
  { icon: Database, titulo: "Dados e acessos protegidos", texto: "Autenticação, relacionamentos, pedidos e permissões garantem que cada perfil acesse somente os dados e arquivos autorizados." },
  { icon: WalletCards, titulo: "Pagamentos integrados", texto: "O checkout processa os meios habilitados e separa automaticamente a comissão da plataforma na conta conectada do fotógrafo." },
  { icon: LockKeyhole, titulo: "Proteção em camadas", texto: "Marca-d’água, prévia separada, proteção de visualização e bloqueio de exclusão para fotos vinculadas a pedidos." },
  { icon: Zap, titulo: "Fluxo automatizado", texto: "Upload, miniatura, IA, carrinho, pagamento e liberação do download fazem parte do mesmo caminho de venda." },
];

const perguntas = [
  {
    pergunta: "O Itatame recebe 9,5% em qualquer tipo de galeria?",
    resposta: "Sim. A comissão de 9,5% é aplicada a toda venda futura, tanto em galerias freelancer quanto em galerias oficiais de organizadores.",
  },
  {
    pergunta: "O royalty do organizador substitui a taxa do Itatame?",
    resposta: "Não. O royalty é adicional e pode variar de 0% a 15% por fotógrafo credenciado. A comissão de 9,5% do Itatame é preservada em todas as vendas.",
  },
  {
    pergunta: "Existe mensalidade ou cobrança por upload?",
    resposta: "No modelo atual não há mensalidade nem cobrança individual por upload. Armazenamento e processamento seguem uma política de uso justo e viabilidade da galeria.",
  },
  {
    pergunta: "A tarifa do meio de pagamento está dentro dos 9,5%?",
    resposta: "Não. Os 9,5% correspondem ao serviço do Itatame Fotos. Tarifas financeiras podem ser descontadas separadamente conforme o método escolhido e o prazo de recebimento disponibilizado pela instituição de pagamento.",
  },
  {
    pergunta: "Quando o organizador recebe o royalty?",
    resposta: "O royalty é calculado e registrado quando a venda é paga. Como o split atual é processado na conta conectada do fotógrafo, o valor do organizador fica registrado para repasse após a liberação financeira.",
  },
  {
    pergunta: "Quem define o preço das fotos?",
    resposta: "O responsável pela galeria define o preço padrão e os descontos de combo. Em evento oficial, essas regras devem estar claras para os fotógrafos credenciados.",
  },
];

function Dinheiro({ children }: { children: React.ReactNode }) {
  return <span className="font-black text-white">{children}</span>;
}

export default function FotosPrecosPage() {
  return (
    <FotosShell>
      <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
        <section className="relative overflow-hidden border-b border-white/5 px-4 py-20 md:px-6 md:py-28">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-red-600/10 blur-[140px]" />
          <div className="relative mx-auto max-w-5xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.24em] text-red-400">
              <ReceiptText size={13} /> Preços claros, sem letras miúdas
            </span>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-black uppercase tracking-tighter sm:text-5xl md:text-7xl">
              Você só paga quando <span className="text-red-500">vende.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-xs font-medium leading-relaxed text-zinc-400 md:text-base">
              Um único modelo para começar: 9,5% sobre cada venda, sem mensalidade. Busca facial, proteção, armazenamento, checkout e entrega já fazem parte da operação.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/fotos/cadastro?perfil=fotografo" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-7 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-red-500">
                Começar como fotógrafo <ArrowRight size={15} />
              </Link>
              <Link href="/fotos/organizador" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white/10">
                Sou organizador <Trophy size={15} />
              </Link>
            </div>

            <div className="mt-12 grid overflow-hidden rounded-2xl border border-white/10 bg-black/50 sm:grid-cols-3">
              {[
                ["9,5%", "por venda"],
                ["R$ 0", "de mensalidade"],
                ["R$ 0", "por upload no modelo atual"],
              ].map(([valor, rotulo], index) => (
                <div key={rotulo} className={`p-5 md:p-7 ${index ? "border-t border-white/10 sm:border-l sm:border-t-0" : ""}`}>
                  <p className="text-2xl font-black text-white md:text-3xl">{valor}</p>
                  <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-zinc-500 md:text-[9px]">{rotulo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="fotografo" className="px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-3xl border border-cyan-500/20 bg-cyan-500/[0.04] p-6 md:p-9">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-400">Fotógrafo freelancer</span>
                  <h2 className="mt-2 text-2xl font-black uppercase tracking-tight md:text-4xl">Modelo Venda Simples</h2>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400"><Camera size={22} /></div>
              </div>
              <div className="mt-8 flex items-end gap-2">
                <span className="text-6xl font-black tracking-tighter text-cyan-400 md:text-7xl">9,5%</span>
                <span className="mb-2 text-[9px] font-black uppercase tracking-widest text-zinc-500">por venda</span>
              </div>
              <p className="mt-5 text-xs font-medium leading-relaxed text-zinc-400 md:text-sm">Crie a sua galeria, escolha o preço e publique. Se não houver venda, não existe comissão do Itatame.</p>

              <div className="mt-7 rounded-2xl border border-white/10 bg-black/60 p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Exemplo — R$ 100 em vendas</p>
                <div className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between gap-3 text-zinc-400"><span>Itatame Fotos (9,5%)</span><Dinheiro>R$ 9,50</Dinheiro></div>
                  <div className="flex justify-between gap-3 text-zinc-400"><span>Fotógrafo, antes da tarifa de pagamento</span><Dinheiro>R$ 90,50</Dinheiro></div>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-[#0a0a0e] p-6 md:p-9">
              <div className="flex items-center gap-3">
                <BadgeCheck className="text-emerald-400" size={22} />
                <h2 className="text-lg font-black uppercase tracking-tight md:text-2xl">Tudo isso já está incluído</h2>
              </div>
              <ul className="mt-7 grid gap-3">
                {inclusos.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[11px] font-medium leading-relaxed text-zinc-300 md:text-xs">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400"><Check size={12} strokeWidth={3} /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section id="organizador" className="border-y border-white/5 bg-[#0a0a0e] px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-400">Eventos oficiais e equipes credenciadas</span>
              <h2 className="mt-3 text-2xl font-black uppercase tracking-tight md:text-5xl">O organizador ganha sem esconder o custo do fotógrafo.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-xs font-medium leading-relaxed text-zinc-400 md:text-sm">A comissão do Itatame permanece em 9,5%. O organizador pode definir um royalty adicional de 0% a 15% para cada fotógrafo credenciado.</p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              <article className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.04] p-6 md:p-8">
                <div className="flex items-center gap-3"><Users className="text-amber-400" size={22} /><h3 className="text-lg font-black uppercase md:text-2xl">Como é distribuído</h3></div>
                <div className="mt-6 space-y-4">
                  {[
                    ["Itatame Fotos", "9,5% fixos"],
                    ["Organizador", "0% a 15%"],
                    ["Fotógrafo", "90,5% menos o royalty"],
                  ].map(([nome, valor]) => (
                    <div key={nome} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-black/50 p-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{nome}</span>
                      <span className="text-sm font-black text-white">{valor}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl border border-white/10 bg-black/60 p-6 md:p-8">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Exemplo — R$ 100 em vendas e royalty de 5%</p>
                <div className="mt-6 space-y-4 text-xs">
                  <div className="flex justify-between gap-3 text-zinc-400"><span>Itatame Fotos</span><Dinheiro>R$ 9,50</Dinheiro></div>
                  <div className="flex justify-between gap-3 text-zinc-400"><span>Royalty do organizador</span><Dinheiro>R$ 5,00</Dinheiro></div>
                  <div className="h-px bg-white/10" />
                  <div className="flex justify-between gap-3 text-zinc-300"><span>Fotógrafo, antes da tarifa de pagamento</span><span className="text-lg font-black text-emerald-400">R$ 85,50</span></div>
                </div>
                <p className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-[10px] font-medium leading-relaxed text-amber-100/70">O royalty é registrado quando a venda é paga e fica disponível para repasse após a liberação financeira. Ele não é prometido como depósito instantâneo em uma terceira conta.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <span className="text-[9px] font-black uppercase tracking-[0.22em] text-red-400">Infraestrutura de ponta</span>
              <h2 className="mt-3 text-2xl font-black uppercase tracking-tight md:text-5xl">Não é apenas uma galeria. É uma operação de venda completa.</h2>
              <p className="mt-4 text-xs font-medium leading-relaxed text-zinc-400 md:text-sm">Cada serviço foi escolhido para resolver uma parte crítica da experiência: velocidade, precisão, segurança, organização e conversão.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tecnologia.map(({ icon: Icon, titulo, texto }) => (
                <article key={titulo} className="rounded-2xl border border-white/5 bg-[#0a0a0e] p-5 transition-colors hover:border-red-500/25 md:p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400"><Icon size={20} /></div>
                  <h3 className="mt-5 text-sm font-black uppercase text-white md:text-base">{titulo}</h3>
                  <p className="mt-3 text-[11px] font-medium leading-relaxed text-zinc-400 md:text-xs">{texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/5 bg-[#0a0a0e] px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <span className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">Condições de cobrança</span>
              <h2 className="mt-3 text-2xl font-black uppercase tracking-tight md:text-4xl">O que você precisa saber antes de vender</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {[
                { icon: CreditCard, titulo: "Meio de pagamento", texto: "Pix, cartão, boleto e demais opções dependem da disponibilidade e das regras da conta conectada à instituição de pagamento. As tarifas financeiras são separadas dos 9,5%." },
                { icon: ReceiptText, titulo: "Responsabilidade fiscal", texto: "Fotógrafos e organizadores continuam responsáveis por suas obrigações fiscais, documentos e emissão de notas conforme o enquadramento de cada operação." },
                { icon: ShieldCheck, titulo: "Pedidos e estornos", texto: "Fotos vinculadas a pedidos ficam protegidas contra exclusão. Cancelamentos, contestações e estornos podem ajustar os valores das partes envolvidas." },
                { icon: Images, titulo: "Uso justo", texto: "O upload não tem cobrança individual no modelo atual. Galerias podem ser revisadas quando armazenamento e processamento forem incompatíveis com sua atividade comercial." },
              ].map(({ icon: Icon, titulo, texto }) => (
                <article key={titulo} className="rounded-2xl border border-white/5 bg-black/50 p-5 md:p-6">
                  <div className="flex items-center gap-3"><Icon size={18} className="text-zinc-500" /><h3 className="text-xs font-black uppercase text-white">{titulo}</h3></div>
                  <p className="mt-3 text-[10px] font-medium leading-relaxed text-zinc-400 md:text-[11px]">{texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto max-w-4xl">
            <div className="text-center"><HelpCircle className="mx-auto text-red-500" size={28} /><h2 className="mt-4 text-2xl font-black uppercase md:text-4xl">Perguntas frequentes</h2></div>
            <div className="mt-9 space-y-3">
              {perguntas.map(({ pergunta, resposta }) => (
                <details key={pergunta} className="group rounded-2xl border border-white/5 bg-[#0a0a0e] p-5 open:border-red-500/20">
                  <summary className="cursor-pointer list-none pr-5 text-xs font-black uppercase tracking-wide text-white md:text-sm">{pergunta}</summary>
                  <p className="mt-4 border-t border-white/5 pt-4 text-[11px] font-medium leading-relaxed text-zinc-400 md:text-xs">{resposta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/5 bg-gradient-to-t from-red-950/20 to-[#050505] px-4 py-20 text-center md:py-28">
          <Sparkles className="mx-auto text-red-500" size={30} />
          <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-black uppercase tracking-tight md:text-5xl">Venda com tecnologia. Cresça com transparência.</h2>
          <p className="mx-auto mt-4 max-w-xl text-xs font-medium leading-relaxed text-zinc-400 md:text-sm">Abra sua primeira galeria sem mensalidade ou conecte a operação oficial do seu campeonato.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/fotos/fotografo" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-7 text-[10px] font-black uppercase tracking-widest text-black hover:bg-cyan-400">Para fotógrafos <ArrowRight size={15} /></Link>
            <Link href="/fotos/organizador" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-7 text-[10px] font-black uppercase tracking-widest text-black hover:bg-amber-400">Para organizadores <ArrowRight size={15} /></Link>
          </div>
        </section>
      </main>
    </FotosShell>
  );
}
