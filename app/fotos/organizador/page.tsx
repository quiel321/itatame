"use client";

import Link from "next/link";
import FotosShell from "../_components/FotosShell";
import DiferenciaisFotos from "../_components/DiferenciaisFotos";
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
  { valor: "9,5%", rotulo: "Taxa Itatame em toda venda" },
  { valor: "Zero", rotulo: "Mensalidade" },
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
    itens: ["Galeria oficial e chancelada pelo evento", "Múltiplos fotógrafos credenciados", "Royalty calculado em cada venda", "Dashboard de vendas em tempo real"],
    destaque: true,
  },
];

const passos = [
  { titulo: "Cadastre o Evento", texto: "Crie a página oficial da galeria em segundos e defina a sua porcentagem de royalties.", icon: Trophy },
  { titulo: "Convide Fotógrafos", texto: "Credencie profissionais da sua confiança para cobrirem os tatames do campeonato.", icon: Camera },
  { titulo: "Venda Inteligente", texto: "Os atletas encontram as próprias fotos em segundos usando Reconhecimento Facial (IA).", icon: Zap },
  { titulo: "Acompanhe o Royalty", texto: "A cada venda paga, o seu percentual é calculado, registrado no painel e fica disponível para repasse após a liberação financeira.", icon: Wallet },
];

export default function FotosOrganizadorPage() {
  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30 overflow-x-hidden w-full">
        
        {/* 🚀 HERO SECTION (LATERALIZADA COM FOTO DE FUNDO) */}
        <section className="relative w-full min-h-[85vh] flex items-center pt-20 pb-12 md:pt-24 md:pb-16 overflow-hidden border-b border-white/5 bg-black">
          
          {/* BACKGROUND FOTO & GRADIENTES */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {/* 🔥 CORREÇÃO MOBILE: bg-[30%_center] puxa o centro da imagem para a direita no celular */}
            <div className="absolute inset-y-0 right-0 w-full md:w-[70%] bg-[url('https://loremflickr.com/1920/1080/jiujitsu,championship?lock=88')] bg-cover bg-[30%_center] sm:bg-[40%_center] md:bg-center opacity-[0.35] md:opacity-[0.45] mix-blend-luminosity"></div>
            
            {/* Máscara de Gradiente: Escuro na esquerda sumindo para a direita */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/95 md:via-[#050505]/80 to-transparent z-10"></div>
            
            {/* Gradiente de baixo para cima */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/50 z-10"></div>
            
            {/* Brilho Dourado/Amber sutil focado na esquerda */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-amber-600/15 blur-[100px] md:blur-[150px] rounded-full z-10"></div>
          </div>

          <div className="relative z-30 w-full max-w-7xl mx-auto px-4 md:px-8">
            {/* CONTEÚDO ALINHADO À ESQUERDA E PUXADO PARA CIMA */}
            <div className="max-w-xl text-left -mt-8 md:-mt-16">
              
              <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] mb-4 md:mb-5 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                <Trophy size={12} /> Para Organizadores de Campeonatos
              </span>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-black uppercase tracking-tighter leading-[1.1] md:leading-[1.05] drop-shadow-2xl mb-4 md:mb-5">
                Seu evento já rende fotos épicas.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">Transforme isso em lucro.</span>
              </h1>

              <p className="text-zinc-400 text-[11px] sm:text-xs md:text-sm font-medium leading-relaxed mb-6 md:mb-8 max-w-md pr-2 md:pr-0">
                Crie a galeria oficial do campeonato, credencie fotógrafos e defina um royalty de até 15%. O Itatame cobra 9,5% em toda venda, registra a distribuição e entrega as fotos com Inteligência Artificial.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full sm:w-auto mb-8 md:mb-10">
                <Link href="/fotos/login?perfil=organizador&next=/fotos/admin" className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-6 py-3.5 md:px-7 md:py-3.5 rounded-xl text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:scale-105">
                  Ativar Fotos no Evento <ArrowRight size={14} className="md:w-4 md:h-4" />
                </Link>
                <Link href="/fotos/fotografo" className="flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3.5 md:px-7 md:py-3.5 rounded-xl text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-colors backdrop-blur-md">
                  Ver lado do fotógrafo
                </Link>
              </div>
              
              {/* METRICS */}
              <div className="grid grid-cols-3 gap-2 md:gap-6 text-left border-t border-white/10 pt-5 md:pt-6 w-full max-w-lg">
                {metricas.map((item) => (
                  <div key={item.rotulo}>
                    <p className="text-base sm:text-lg md:text-2xl font-black text-white mb-0.5 md:mb-1">{item.valor}</p>
                    <p className="text-[6px] sm:text-[7px] md:text-[8px] uppercase tracking-widest text-zinc-500 font-bold">{item.rotulo}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ⚙️ COMO FUNCIONA (O FLUXO iTATAME) */}
        <section id="como-funciona" className="relative z-20 max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-28">
          <div className="text-center mb-10 md:mb-16">
             <span className="text-red-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">Operação Inteligente</span>
            <h2 className="text-xl sm:text-2xl md:text-4xl font-black uppercase tracking-tight mb-3 md:mb-4">Você controla o evento.<br/><span className="text-zinc-500">O fotógrafo cuida da lente.</span></h2>
            <p className="text-zinc-400 text-xs md:text-sm max-w-xl mx-auto font-medium px-2">Deixe a infraestrutura de pagamento e entrega de imagens connosco. Acompanhe apenas o lucro entrando.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {passos.map(({ titulo, texto, icon: Icon }, index) => (
              <div key={titulo} className="bg-[#0a0a0e] border border-white/5 p-5 md:p-8 rounded-2xl md:rounded-3xl hover:border-amber-500/30 hover:bg-amber-500/5 transition-all duration-300 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-amber-500/5 blur-3xl rounded-full transition-all group-hover:bg-amber-500/15"></div>
                
                <div className="flex items-center justify-between mb-4 md:mb-6 relative z-10">
                  <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 border border-amber-500/20">
                    <Icon size={18} className="md:w-5 md:h-5" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black text-zinc-700">PASSO {index + 1}</span>
                </div>
                
                <h3 className="text-sm md:text-base font-black uppercase tracking-tight mb-2 md:mb-3 relative z-10 leading-tight">{titulo}</h3>
                <p className="text-zinc-400 text-[11px] md:text-xs leading-relaxed font-medium relative z-10">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 📊 ESTRUTURA PARA ORGANIZADORES (MOCKUP DASHBOARD) */}
        <section className="py-16 md:py-28 px-4 md:px-6 border-y border-white/5 bg-[#0a0a0e] relative overflow-hidden w-full">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
          <div className="absolute inset-0 bg-amber-500/5 blur-[120px] pointer-events-none"></div>

          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-10 md:gap-20 relative z-10">
            
            <div className="flex-1 text-center md:text-left order-2 md:order-1">
              <span className="inline-flex items-center gap-1.5 text-amber-500 font-black text-[8px] md:text-[9px] uppercase tracking-[0.2em] mb-3 md:mb-4">
                Transparência Total
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter leading-tight mb-4 md:mb-5">
                Um painel central para<br className="hidden md:block"/> acompanhar <span className="text-zinc-500">o faturamento.</span>
              </h2>
              <p className="text-zinc-400 text-[11px] md:text-sm font-medium leading-relaxed mb-6 md:mb-8 max-w-lg mx-auto md:mx-0 px-2 md:px-0">
                Esqueça as planilhas e a cobrança manual aos fotógrafos. A venda é processada na conta conectada do fotógrafo; os 9,5% do Itatame e o seu royalty são calculados separadamente. O royalty fica registrado para repasse após a liberação financeira.
              </p>
              
              <ul className="space-y-3 md:space-y-4 mb-8 text-left max-w-md mx-auto md:mx-0 px-2 md:px-0">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-amber-500 shrink-0" />
                    <span className="text-zinc-300 text-[10px] md:text-[11px] font-bold uppercase tracking-wide">Visão global de vendas do campeonato</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-amber-500 shrink-0" />
                    <span className="text-zinc-300 text-[10px] md:text-[11px] font-bold uppercase tracking-wide">Ranking de vendas por fotógrafo</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-amber-500 shrink-0" />
                    <span className="text-zinc-300 text-[10px] md:text-[11px] font-bold uppercase tracking-wide">Relatórios automáticos em tempo real</span>
                  </li>
              </ul>

              <Link href="/fotos/login?perfil=organizador&next=/fotos/admin" className="inline-flex w-full sm:w-auto justify-center bg-amber-500 hover:bg-amber-400 text-black px-8 py-3.5 md:py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                Acessar Dashboard
              </Link>
            </div>

            {/* MOCKUP DO DASHBOARD (Visual Abstrato Dourado) */}
            <div className="flex-1 relative w-full order-1 md:order-2">
               <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-red-500/10 blur-3xl rounded-full"></div>
               <div className="relative bg-[#111] border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-2xl overflow-hidden">
                  
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5 md:mb-6">
                    <div className="flex gap-1.5 md:gap-2">
                      <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-500/50"></div>
                      <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-yellow-500/50"></div>
                      <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-emerald-500/50"></div>
                    </div>
                    <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2"><BarChart3 size={12}/> Admin Evento</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:gap-4 mb-5 md:mb-6">
                    <div className="bg-white/5 rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/5 flex flex-col justify-center">
                      <p className="text-[8px] md:text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1 truncate">Fotos Vendidas</p>
                      <p className="text-xl md:text-2xl font-black text-white">4.892</p>
                    </div>
                    <div className="bg-amber-500/10 rounded-xl md:rounded-2xl p-3 md:p-4 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)] flex flex-col justify-center">
                      <p className="text-[8px] md:text-[9px] text-amber-500 font-bold uppercase tracking-wider mb-1 truncate">Royalties Livres</p>
                      <p className="text-xl md:text-2xl font-black text-amber-400">R$ 8.560</p>
                    </div>
                  </div>

                  <div className="space-y-2 md:space-y-3">
                    <p className="text-[7px] md:text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-2">Top Fotógrafos (Comissionados)</p>
                    {[
                       { nome: 'João Silva (Tatame 1)', vendas: 1240 }, 
                       { nome: 'Maria Souza (Pódio)', vendas: 890 }, 
                       { nome: 'Pedro Álvares (Tatame 2)', vendas: 650 }
                    ].map((fotografo, i) => (
                      <div key={i} className="flex items-center justify-between bg-black/60 p-2.5 md:p-3 rounded-xl border border-white/5">
                        <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                          <div className={`w-7 h-7 md:w-8 md:h-8 shrink-0 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-black ${i === 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-zinc-900 text-zinc-500 border border-white/5'}`}>
                              {i + 1}º
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] md:text-[10px] font-bold text-white uppercase tracking-wider truncate">{fotografo.nome}</p>
                            <p className="text-[7px] md:text-[8px] text-zinc-500 uppercase tracking-widest mt-0.5 truncate">{fotografo.vendas} fotos</p>
                          </div>
                        </div>
                        <Users size={14} className="text-zinc-600 shrink-0 ml-2" />
                      </div>
                    ))}
                  </div>

               </div>
            </div>
          </div>
        </section>

        {/* 🥊 COMPARATIVO (O PORQUÊ DE ESCOLHER A GENTE) */}
        <section className="py-16 md:py-28 relative overflow-hidden w-full">
           <div className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
            <div className="text-center mb-10 md:mb-16">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight mb-2 md:mb-3">Sem improviso no pós-evento</h2>
              <p className="text-zinc-400 text-[11px] md:text-sm max-w-lg mx-auto font-medium px-2">As fotos do seu campeonato deixam de depender de grupos de WhatsApp, links soltos e conversas perdidas.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 md:gap-6">
              {comparativo.map((card) => (
                <div key={card.titulo} className={`rounded-2xl md:rounded-3xl border p-5 md:p-8 flex flex-col ${card.destaque ? "border-amber-500/50 bg-amber-500/10 shadow-[0_20px_50px_rgba(245,158,11,0.15)] transform md:-translate-y-4 relative" : "border-white/5 bg-[#111] opacity-70 hover:opacity-100 transition-opacity"}`}>
                  
                  {card.destaque && (
                     <div className="mb-5 md:mb-6 flex">
                        <span className="inline-flex items-center gap-1.5 bg-amber-500 text-black px-3 py-1 rounded text-[8px] md:text-[9px] font-black uppercase tracking-widest shadow-md">
                           <CheckCircle2 size={12} /> Padrão Ouro
                        </span>
                     </div>
                  )}
                  
                  <h3 className={`text-base md:text-lg font-black uppercase tracking-tight mb-5 md:mb-6 ${card.destaque ? 'text-white' : 'text-zinc-300'}`}>{card.titulo}</h3>
                  
                  <div className="space-y-3 md:space-y-4 mb-6 md:mb-8 flex-1">
                    {card.itens.map((item) => (
                      <p key={item} className="flex items-start gap-2.5 md:gap-3 text-[11px] md:text-xs leading-relaxed text-zinc-300 font-medium">
                        <CheckCircle2 size={14} className={`shrink-0 mt-0.5 md:w-4 md:h-4 ${card.destaque ? "text-amber-400" : "text-zinc-600"}`} /> {item}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <DiferenciaisFotos publico="organizador" />

        {/* CTA FINAL */}
        <section className="py-16 md:py-32 px-4 text-center border-t border-white/5 bg-gradient-to-t from-[#0a0a0e] to-[#050505]">
          <ShieldCheck size={32} className="mx-auto text-amber-500 mb-4 md:mb-6 opacity-80 md:w-10 md:h-10" />
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tight mb-4 md:mb-6">Pronto para rentabilizar?</h2>
          <p className="text-zinc-400 text-[11px] md:text-sm mb-8 md:mb-10 max-w-lg mx-auto font-medium px-4 leading-relaxed">Crie a sua galeria em 2 minutos, partilhe o link com os fotógrafos e comece a faturar no próximo fim de semana.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4">
             <Link href="/fotos/login?perfil=organizador&next=/fotos/admin" className="inline-flex items-center justify-center bg-amber-500 text-black px-8 py-3.5 md:px-10 md:py-4 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-transform hover:scale-105 shadow-[0_0_30px_rgba(245,158,11,0.3)] w-full sm:w-auto">
               Criar Galeria do Campeonato
             </Link>
          </div>
        </section>

      </main>
    </FotosShell>
  );
}
