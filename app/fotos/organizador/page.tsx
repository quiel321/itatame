"use client";

import Link from "next/link";
import FotosShell from "../_components/FotosShell";
import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

const metricas = [
  { valor: "Royalties", rotulo: "Por cada foto vendida" },
  { valor: "Zero", rotulo: "Custo de plataforma" },
  { valor: "1 Painel", rotulo: "Para gerir todas as vendas" },
];

const comparativo = [
  {
    titulo: "Fotos soltas no WhatsApp",
    itens: ["Atleta não encontra a sua imagem", "Organizador não fatura nada", "Fotógrafo perde vendas", "Zero profissionalismo no pós-evento"],
    destaque: false,
  },
  {
    titulo: "Fotógrafo vendendo sozinho",
    itens: ["Não existe galeria oficial do evento", "Você não controla quem está a fotografar", "O dinheiro não passa pela organização", "Pós-evento desorganizado"],
    destaque: false,
  },
  {
    titulo: "Com iTatame Fotos",
    itens: ["Galeria oficial e chancelada pelo evento", "Múltiplos fotógrafos credenciados", "Split automático: dinheiro na sua conta", "Dashboard de vendas em tempo real"],
    destaque: true,
  },
];

const passos = [
  { titulo: "Cadastre o Evento", texto: "Crie a página oficial da galeria e defina a sua % de royalties.", icon: Trophy },
  { titulo: "Convide Fotógrafos", texto: "Credencie profissionais para cobrirem os tatames do campeonato.", icon: Camera },
  { titulo: "Venda no Automático", texto: "Os atletas compram usando Reconhecimento Facial.", icon: Zap },
  { titulo: "Receba o seu Split", texto: "A sua fatia do lucro cai diretamente na sua conta via Pix.", icon: Wallet },
];

export default function FotosOrganizadorPage() {
  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30">
        
        {/* 🚀 HERO SECTION (LATERALIZADA COM FOTO DE FUNDO) */}
        <section className="relative w-full min-h-[85vh] flex items-center pt-24 pb-16 overflow-hidden border-b border-white/5 bg-black">
          
          {/* BACKGROUND FOTO & GRADIENTES */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {/* Foto de um grande evento de artes marciais (Alinhada à direita) */}
            <div className="absolute inset-y-0 right-0 w-full md:w-[65%] bg-[url('https://loremflickr.com/1920/1080/jiujitsu,championship?lock=88')] bg-cover bg-center opacity-[0.35] mix-blend-luminosity"></div>
            
            {/* Máscara de Gradiente: Escuro na esquerda sumindo para a direita */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/95 to-transparent z-10"></div>
            
            {/* Gradiente de baixo para cima */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/50 z-10"></div>
            
            {/* Brilho Dourado/Amber sutil focado na esquerda */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[600px] h-[600px] bg-amber-600/10 blur-[150px] rounded-full z-10"></div>
          </div>

          <div className="relative z-30 w-full max-w-7xl mx-auto px-4 md:px-8">
            {/* CONTEÚDO ALINHADO À ESQUERDA E PUXADO PARA CIMA */}
            <div className="max-w-xl text-left -mt-10 md:-mt-16">
              
              <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-5 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                <Trophy size={12} /> Para Organizadores de Campeonatos
              </span>

              {/* Fontes padrão premium iTatame Fotos */}
              <h1 className="text-3xl md:text-4xl lg:text-[50px] font-black uppercase tracking-tighter leading-[1.05] drop-shadow-2xl mb-5">
                O seu evento já gera imagens.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">Agora vai gerar receita.</span>
              </h1>

              <p className="text-zinc-400 text-xs md:text-sm font-medium leading-relaxed mb-8 max-w-md">
                Crie a galeria oficial do campeonato, credencie fotógrafos e defina uma taxa de royalties. Cada foto vendida por eles gera lucro direto para a sua organização.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-10">
                <Link href="/fotos/login?perfil=organizador&next=/fotos/admin" className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-7 py-3.5 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:scale-105">
                  Ativar Fotos no Evento <ArrowRight size={16} />
                </Link>
                <Link href="/fotos/fotografo" className="flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/10 px-7 py-3.5 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-colors backdrop-blur-md">
                  Ver lado do fotógrafo
                </Link>
              </div>
              
              {/* METRICS */}
              <div className="grid grid-cols-3 gap-4 md:gap-6 text-left border-t border-white/10 pt-6 w-full max-w-lg">
                {metricas.map((item) => (
                  <div key={item.rotulo}>
                    <p className="text-xl md:text-2xl font-black text-white mb-1">{item.valor}</p>
                    <p className="text-[7px] md:text-[8px] uppercase tracking-widest text-zinc-500 font-bold">{item.rotulo}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ⚙️ COMO FUNCIONA (O FLUXO iTATAME) */}
        <section id="como-funciona" className="relative z-20 max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28">
          <div className="text-center mb-16">
             <span className="text-red-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">Operação Inteligente</span>
            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight mb-4">Você controla o evento.<br/><span className="text-zinc-500">O fotógrafo cuida da lente.</span></h2>
            <p className="text-zinc-400 text-sm max-w-xl mx-auto font-medium">Deixe a infraestrutura de pagamento e entrega de imagens connosco. Acompanhe apenas o lucro.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {passos.map(({ titulo, texto, icon: Icon }, index) => (
              <div key={titulo} className="bg-[#0a0a0e] border border-white/5 p-6 md:p-8 rounded-3xl hover:border-amber-500/30 hover:bg-amber-500/5 transition-all duration-300 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-2xl rounded-full transition-all group-hover:bg-amber-500/10"></div>
                
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 border border-amber-500/20">
                    <Icon size={20} />
                  </div>
                  <span className="text-[10px] font-black text-zinc-700">PASSO {index + 1}</span>
                </div>
                
                <h3 className="text-sm md:text-base font-black uppercase tracking-tight mb-3 relative z-10">{titulo}</h3>
                <p className="text-zinc-400 text-[11px] leading-relaxed font-medium relative z-10">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 📊 ESTRUTURA PARA ORGANIZADORES (MOCKUP DASHBOARD) */}
        <section className="py-20 md:py-28 px-4 md:px-6 border-y border-white/5 bg-[#0a0a0e] relative overflow-hidden">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
          <div className="absolute inset-0 bg-amber-500/5 blur-[120px] pointer-events-none"></div>

          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-20 relative z-10">
            
            <div className="flex-1 text-center md:text-left order-2 md:order-1">
              <span className="inline-flex items-center gap-1.5 text-amber-500 font-black text-[9px] uppercase tracking-[0.2em] mb-4">
                Transparência Total
              </span>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-tight mb-5">
                Um painel central para<br className="hidden md:block"/> acompanhar <span className="text-zinc-500">o seu faturamento.</span>
              </h2>
              <p className="text-zinc-400 text-xs md:text-sm font-medium leading-relaxed mb-8 max-w-lg mx-auto md:mx-0">
                Esqueça as planilhas e a cobrança chata aos fotógrafos. O nosso sistema faz o *Split de Pagamento* instantâneo. A cada Pix pago pelo atleta, a sua comissão vai direta para a sua conta e a do fotógrafo para a dele.
              </p>
              
              <ul className="space-y-4 mb-8 text-left max-w-md mx-auto md:mx-0">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-amber-500 shrink-0" />
                    <span className="text-zinc-300 text-[11px] font-bold uppercase tracking-wide">Visão global de vendas do campeonato</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-amber-500 shrink-0" />
                    <span className="text-zinc-300 text-[11px] font-bold uppercase tracking-wide">Ranking de vendas por fotógrafo</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-amber-500 shrink-0" />
                    <span className="text-zinc-300 text-[11px] font-bold uppercase tracking-wide">Relatórios em tempo real</span>
                  </li>
              </ul>

              <Link href="/fotos/login?perfil=organizador&next=/fotos/admin" className="inline-flex bg-amber-500 hover:bg-amber-400 text-black px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                Acessar Dashboard
              </Link>
            </div>

            {/* MOCKUP DO DASHBOARD (Visual Abstrato Dourado) */}
            <div className="flex-1 relative w-full order-1 md:order-2">
               <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-red-500/10 blur-3xl rounded-full"></div>
               <div className="relative bg-[#111] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden">
                  
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2"><BarChart3 size={12}/> Admin Evento</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Fotos Vendidas</p>
                      <p className="text-2xl font-black text-white">4.892</p>
                    </div>
                    <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                      <p className="text-[9px] text-amber-500 font-bold uppercase tracking-wider mb-1">Royalties (Lucro)</p>
                      <p className="text-2xl font-black text-amber-400">R$ 8.560</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-2">Top Fotógrafos (Comissionados)</p>
                    {[
                       { nome: 'João Silva (Tatame 1)', vendas: 1240 }, 
                       { nome: 'Maria Souza (Pódio)', vendas: 890 }, 
                       { nome: 'Pedro Álvares (Tatame 2)', vendas: 650 }
                    ].map((fotografo, i) => (
                      <div key={i} className="flex items-center justify-between bg-black/60 p-3 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-zinc-900 text-zinc-500 border border-white/5'}`}>
                             {i + 1}º
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-white uppercase tracking-wider">{fotografo.nome}</p>
                            <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-0.5">{fotografo.vendas} fotos</p>
                          </div>
                        </div>
                        <Users size={14} className="text-zinc-600" />
                      </div>
                    ))}
                  </div>

               </div>
            </div>
          </div>
        </section>

        {/* 🥊 COMPARATIVO (O PORQUÊ DE ESCOLHER A GENTE) */}
        <section className="py-20 md:py-28 relative overflow-hidden">
           <div className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-3">Sem improviso no pós-evento</h2>
              <p className="text-zinc-400 text-sm max-w-lg mx-auto font-medium">As fotos do seu campeonato deixam de depender de grupos de WhatsApp, links soltos e conversas perdidas.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {comparativo.map((card) => (
                <div key={card.titulo} className={`rounded-3xl border p-6 md:p-8 flex flex-col ${card.destaque ? "border-amber-500/50 bg-amber-500/10 shadow-[0_20px_50px_rgba(245,158,11,0.15)] transform md:-translate-y-4" : "border-white/5 bg-[#111] opacity-70 hover:opacity-100 transition-opacity"}`}>
                  
                  {card.destaque && (
                     <div className="mb-6 flex">
                        <span className="inline-flex items-center gap-1.5 bg-amber-500 text-black px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest shadow-md">
                           <CheckCircle2 size={12} /> Padrão Ouro
                        </span>
                     </div>
                  )}
                  
                  <h3 className={`text-lg font-black uppercase tracking-tight mb-6 ${card.destaque ? 'text-white' : 'text-zinc-300'}`}>{card.titulo}</h3>
                  
                  <div className="space-y-4 mb-8 flex-1">
                    {card.itens.map((item) => (
                      <p key={item} className="flex items-start gap-3 text-xs leading-relaxed text-zinc-300 font-medium">
                        <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${card.destaque ? "text-amber-400" : "text-zinc-600"}`} /> {item}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="py-20 md:py-32 px-4 text-center border-t border-white/5 bg-gradient-to-t from-[#0a0a0e] to-[#050505]">
          <ShieldCheck size={40} className="mx-auto text-amber-500 mb-6 opacity-80" />
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-6">Pronto para rentabilizar?</h2>
          <p className="text-zinc-400 text-sm mb-10 max-w-lg mx-auto font-medium">Crie a sua galeria em 2 minutos, partilhe o link com os fotógrafos e comece a faturar no próximo fim de semana.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
             <Link href="/fotos/login?perfil=organizador&next=/fotos/admin" className="inline-flex items-center justify-center bg-amber-500 text-black px-10 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-transform hover:scale-105 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
               Criar Galeria do Campeonato
             </Link>
          </div>
        </section>

      </main>
    </FotosShell>
  );
}