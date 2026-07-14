import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Cloud,
  CreditCard,
  Images,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";

const conteudo = {
  fotografo: {
    etiqueta: "Tecnologia para vender mais",
    titulo: "Da câmera ao pagamento, sem atrito.",
    texto: "Uma operação completa para o fotógrafo publicar, proteger, localizar, vender e entregar imagens sem depender de várias ferramentas.",
    destaque: "cyan",
    itens: [
      { icon: BrainCircuit, titulo: "Busca facial inteligente", texto: "Prévias otimizadas são indexadas por inteligência facial para o atleta localizar suas fotos por selfie em segundos." },
      { icon: Cloud, titulo: "Originais em infraestrutura protegida", texto: "O arquivo de venda fica separado da prévia pública, com armazenamento distribuído e entrega do original somente após o pagamento." },
      { icon: Zap, titulo: "Upload inteligente", texto: "Compressão automática, envio em lote, criação de miniaturas e preparação da vitrine sem interromper o fluxo do fotógrafo." },
      { icon: LockKeyhole, titulo: "Venda protegida", texto: "Marca-d’água nas prévias, proteção de visualização e bloqueio de exclusão para arquivos já vinculados a pedidos." },
      { icon: WalletCards, titulo: "Checkout conectado", texto: "Pagamento, confirmação do pedido e liberação do download trabalham juntos, com histórico de vendas no painel." },
      { icon: Images, titulo: "Freelancer ou evento oficial", texto: "Crie a própria galeria ou publique somente suas fotos dentro de um evento que credenciou vários profissionais." },
    ],
  },
  organizador: {
    etiqueta: "Operação oficial do evento",
    titulo: "Controle, escala e receita no mesmo painel.",
    texto: "A galeria nasce conectada ao evento e organiza fotógrafos, royalties, vendas e experiência do atleta em uma única operação.",
    destaque: "amber",
    itens: [
      { icon: Trophy, titulo: "Evento integrado ao iTatame", texto: "Organizadores já cadastrados podem transformar campeonatos do sistema de gestão em galerias oficiais de fotos." },
      { icon: Users, titulo: "Equipe credenciada", texto: "Cada fotógrafo publica e administra somente os próprios arquivos, preservando o trabalho dos demais profissionais." },
      { icon: CreditCard, titulo: "Royalty por fotógrafo", texto: "Defina de 0% a 15% para cada credenciado. O percentual fica registrado em cada nova venda, separado da taxa do Itatame." },
      { icon: ShieldCheck, titulo: "Rastreabilidade financeira", texto: "Pedidos, fotos vendidas e royalties são registrados para acompanhamento e repasse após a liberação financeira." },
      { icon: BrainCircuit, titulo: "IA que reduz a procura", texto: "O atleta usa uma selfie, recebe resultados ordenados por semelhança e pode selecionar várias fotos direto para o carrinho." },
      { icon: Sparkles, titulo: "Página pública profissional", texto: "Capa, perfil, eventos publicados e compartilhamento em uma apresentação limpa, rápida e focada em conversão." },
    ],
  },
} as const;

export default function DiferenciaisFotos({ publico }: { publico: keyof typeof conteudo }) {
  const dados = conteudo[publico];
  const amber = dados.destaque === "amber";
  const corTexto = amber ? "text-amber-400" : "text-cyan-400";
  const corBorda = amber ? "hover:border-amber-500/30" : "hover:border-cyan-500/30";
  const corFundo = amber ? "bg-amber-500/10 border-amber-500/20" : "bg-cyan-500/10 border-cyan-500/20";
  const corBotao = amber ? "bg-amber-500 hover:bg-amber-400" : "bg-cyan-500 hover:bg-cyan-400";

  return (
    <section className="border-y border-white/5 bg-[#08080b] px-4 py-16 md:px-6 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-16">
          <span className={`text-[9px] font-black uppercase tracking-[0.24em] md:text-[10px] ${corTexto}`}>{dados.etiqueta}</span>
          <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl md:text-5xl">{dados.titulo}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-xs font-medium leading-relaxed text-zinc-400 md:text-sm">{dados.texto}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dados.itens.map(({ icon: Icon, titulo, texto }) => (
            <article key={titulo} className={`rounded-2xl border border-white/5 bg-black/60 p-5 transition-all md:p-7 ${corBorda}`}>
              <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl border ${corFundo} ${corTexto}`}>
                <Icon size={20} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-tight text-white md:text-base">{titulo}</h3>
              <p className="mt-3 text-[11px] font-medium leading-relaxed text-zinc-400 md:text-xs">{texto}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center sm:flex-row sm:text-left md:p-7">
          <div>
            <p className="text-sm font-black uppercase text-white md:text-base">Tecnologia de ponta com cobrança transparente.</p>
            <p className="mt-1 text-[10px] font-medium text-zinc-500 md:text-xs">9,5% por venda, sem mensalidade. Consulte as condições e exemplos de distribuição.</p>
          </div>
          <Link href="/fotos/precos" className={`inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-6 text-[9px] font-black uppercase tracking-widest text-black transition-colors sm:w-auto ${corBotao}`}>
            Ver preços e condições <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
