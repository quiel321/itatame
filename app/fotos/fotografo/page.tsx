"use client";

import Link from "next/link";
import FotosShell from "../_components/FotosShell";
import DiferenciaisFotos from "../_components/DiferenciaisFotos";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  CloudUpload,
  ScanFace,
  Wallet,
  Users,
  Store,
  ShieldCheck,
  CreditCard,
  ImagePlus
} from "lucide-react";

const metricas = [
  { valor: "9,5%", rotulo: "Taxa Itatame por venda" },
  { valor: "IA", rotulo: "Busca Facial Ativa" },
  { valor: "Zero", rotulo: "Mensalidade" },
];

const funcionalidadesDashboard = [
  { 
    titulo: "Galerias Freelancer", 
    texto: "Não dependa de ninguém. Crie eventos avulsos, defina a capa, o preço padrão por foto e configure descontos exclusivos de combo.", 
    icon: Store 
  },
  { 
    titulo: "Eventos Oficiais", 
    texto: "Credencie-se em competições oficiais de organizadores parceiros. Suas fotos entram na loja oficial do evento e o lucro é dividido automaticamente.", 
    icon: ShieldCheck 
  },
  { 
    titulo: "Upload Inteligente", 
    texto: "Arraste tudo em lote. O sistema reduz o tamanho para a vitrine web, aplica a sua marca d'água e guarda o arquivo original em HD com segurança.", 
    icon: CloudUpload 
  },
  { 
    titulo: "Repasse Automatizado", 
    texto: "Conecte sua conta de recebimento. Quando o atleta paga, o sistema separa a taxa do Itatame e direciona automaticamente a sua parte para a sua conta.", 
    icon: CreditCard 
  },
];

const comparativo = [
  {
    titulo: "Venda por WhatsApp",
    itens: ["Links perdidos em conversas", "Cobrança manual e desgastante", "Risco de prints não pagos", "Processo lento para o atleta"],
    destaque: false,
  },
  {
    titulo: "Plataformas Antigas",
    itens: ["Upload lento e travado", "Taxas abusivas e repasse demorado", "Difícil conectar com o evento oficial", "Sem pesquisa facial ativa"],
    destaque: false,
  },
  {
    titulo: "Com iTatame Fotos",
    itens: ["Pesquisa por IA (Reconhecimento Facial)", "Marca d'água na nuvem (Anti-print)", "Repasse automático pela conta conectada", "Galerias freelancers ou oficiais"],
    destaque: true,
  },
];

export default function FotografoMarketingPage() {
  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30 overflow-x-hidden w-full">
        
        {/* 🚀 HERO SECTION (LATERALIZADA COM FOTO DE FUNDO) */}
        <section className="relative w-full min-h-[85vh] flex items-center pt-20 pb-12 md:pt-24 md:pb-16 overflow-hidden border-b border-white/5 bg-black">
          
          {/* BACKGROUND FOTO & GRADIENTES */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {/* Foto do Fotógrafo (Fixada na metade direita da tela) */}
            <div className="absolute inset-y-0 right-0 w-full md:w-[70%] bg-[url('https://images.pexels.com/photos/1264210/pexels-photo-1264210.jpeg?auto=compress&cs=tinysrgb&w=1920')] bg-cover bg-[30%_center] sm:bg-[40%_center] md:bg-[left_center] opacity-[0.35] md:opacity-[0.45] mix-blend-luminosity"></div>
            
            {/* Máscara de Gradiente: Escuro na esquerda (onde vai o texto) sumindo para a direita */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/95 md:via-[#050505]/80 to-transparent z-10"></div>
            
            {/* Gradiente de baixo para cima para fundir com o resto da página */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/50 z-10"></div>
            
            {/* Brilho Cyan sutil focado na esquerda */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-cyan-600/15 blur-[100px] md:blur-[150px] rounded-full z-10"></div>
          </div>

          <div className="relative z-30 w-full max-w-7xl mx-auto px-4 md:px-8">
            {/* CONTEÚDO ALINHADO À ESQUERDA E PUXADO PARA CIMA (-mt-16) */}
            <div className="max-w-xl text-left -mt-8 md:-mt-16">
              
              <span className="inline-flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] mb-4 md:mb-5 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <Camera size={12} /> Fotografia Esportiva
              </span>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-black uppercase tracking-tighter leading-[1.1] md:leading-[1.05] drop-shadow-2xl mb-4 md:mb-5">
                Foque no clique perfeito.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-700">Deixe as vendas no automático.</span>
              </h1>

              <p className="text-zinc-400 text-[11px] sm:text-xs md:text-sm font-medium leading-relaxed mb-6 md:mb-8 max-w-md pr-2 md:pr-0">
                Junte-se à plataforma definitiva para fotógrafos de artes marciais. Crie galerias freelancers, conecte-se a eventos oficiais, venda por reconhecimento facial e receba via Pix na hora.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full sm:w-auto mb-8 md:mb-10">
                <Link href="/fotos/cadastro?perfil=fotografo" className="flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black px-6 py-3.5 md:px-7 md:py-3.5 rounded-xl text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:scale-105">
                  Criar Conta Grátis <ArrowRight size={14} className="md:w-4 md:h-4" />
                </Link>
                <Link href="/fotos/login?perfil=fotografo&next=/fotos/fotografo/dashboard" className="flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3.5 md:px-7 md:py-3.5 rounded-xl text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-colors backdrop-blur-md">
                  Acessar Dashboard
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

        {/* ⚙️ COMO FUNCIONA (O FLUXO iTATAME FOTÓGRAFO) */}
        <section id="funcionalidades" className="relative z-20 max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-28">
          <div className="text-center mb-10 md:mb-16">
             <span className="text-cyan-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">O seu novo espaço de trabalho</span>
            <h2 className="text-xl sm:text-2xl md:text-4xl font-black uppercase tracking-tight mb-3 md:mb-4">Ferramentas de Elite.<br/><span className="text-zinc-500">Feitas para você focar no clique.</span></h2>
            <p className="text-zinc-400 text-xs md:text-sm max-w-xl mx-auto font-medium px-2">Você tem acesso gratuito a um Dashboard completo para gerenciar galerias, definir preços e acompanhar suas vendas em tempo real.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
            {funcionalidadesDashboard.map(({ titulo, texto, icon: Icon }, index) => (
              <div key={titulo} className="bg-[#0a0a0e] border border-white/5 p-5 md:p-8 rounded-2xl md:rounded-3xl hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all duration-300 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-cyan-500/5 blur-3xl rounded-full transition-all group-hover:bg-cyan-500/15"></div>
                
                <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-5 relative z-10">
                  <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                    <Icon size={18} className="md:w-5 md:h-5" />
                  </div>
                  <h3 className="text-sm md:text-base font-black uppercase tracking-tight text-white leading-tight">{titulo}</h3>
                </div>
                
                <p className="text-zinc-400 text-[11px] md:text-xs leading-relaxed font-medium relative z-10">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 🥊 COMPARATIVO (O PORQUÊ DE ESCOLHER A GENTE) */}
        <section className="bg-[#0a0a0e] border-y border-white/5 py-16 md:py-28 relative overflow-hidden w-full">
           <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"></div>
           
           <div className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
            <div className="text-center mb-10 md:mb-16">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight mb-2 md:mb-3">Vender fotos online<br className="sm:hidden"/> não precisa ser difícil</h2>
              <p className="text-zinc-400 text-[11px] md:text-sm max-w-lg mx-auto font-medium px-2">Pare de perder vendas em grupos de WhatsApp ou ser taxado abusivamente por plataformas velhas.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 md:gap-6">
              {comparativo.map((card) => (
                <div key={card.titulo} className={`rounded-2xl md:rounded-3xl border p-5 md:p-8 flex flex-col ${card.destaque ? "border-cyan-500/50 bg-cyan-500/10 shadow-[0_20px_50px_rgba(6,182,212,0.15)] transform md:-translate-y-4 relative" : "border-white/5 bg-[#111] opacity-70 hover:opacity-100 transition-opacity"}`}>
                  
                  {card.destaque && (
                     <div className="mb-5 md:mb-6 flex">
                        <span className="inline-flex items-center gap-1.5 bg-cyan-500 text-black px-3 py-1 rounded text-[8px] md:text-[9px] font-black uppercase tracking-widest shadow-md">
                           <CheckCircle2 size={12} /> A Plataforma Ideal
                        </span>
                     </div>
                  )}
                  
                  <h3 className={`text-base md:text-lg font-black uppercase tracking-tight mb-5 md:mb-6 ${card.destaque ? 'text-white' : 'text-zinc-300'}`}>{card.titulo}</h3>
                  
                  <div className="space-y-3 md:space-y-4 mb-6 md:mb-8 flex-1">
                    {card.itens.map((item) => (
                      <p key={item} className="flex items-start gap-2.5 md:gap-3 text-[11px] md:text-xs leading-relaxed text-zinc-300 font-medium">
                        <CheckCircle2 size={14} className={`shrink-0 mt-0.5 md:w-4 md:h-4 ${card.destaque ? "text-cyan-400" : "text-zinc-600"}`} /> {item}
                      </p>
                    ))}
                  </div>

                  {card.destaque && (
                     <Link href="/fotos/cadastro?perfil=fotografo" className="mt-auto w-full py-3.5 md:py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-[9px] md:text-[10px] font-black uppercase tracking-widest text-center transition-colors shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                        Quero vender assim
                     </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 📊 ESTRUTURA PARA ORGANIZADORES (CROSS-SELL) */}
        <section className="py-16 md:py-28 px-4 md:px-6 w-full overflow-hidden">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-10 md:gap-20">
            <div className="flex-1 relative w-full">
               <div className="absolute inset-0 bg-red-500/10 blur-[60px] md:blur-[100px] rounded-full"></div>
               <div className="relative bg-[#111] border border-white/10 rounded-2xl md:rounded-3xl p-5 sm:p-8 overflow-hidden shadow-2xl">
                  <div className="flex items-center gap-3 mb-6 md:mb-8 border-b border-white/5 pb-5 md:pb-6">
                     <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 border border-red-500/20">
                        <Users size={18} className="md:w-5 md:h-5" />
                     </div>
                     <div className="min-w-0">
                        <h3 className="text-white font-black uppercase tracking-tight text-[11px] sm:text-sm truncate">Dashboard Organizador</h3>
                        <p className="text-[7px] sm:text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5 sm:mt-1 truncate">Ganhe royalties das fotos</p>
                     </div>
                  </div>
                  <div className="space-y-3 md:space-y-4">
                     <div className="bg-black/50 border border-white/5 p-3.5 md:p-4 rounded-xl md:rounded-2xl flex flex-row justify-between items-center gap-2">
                        <span className="text-[8px] md:text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Fotos Vendidas no Evento</span>
                        <span className="text-base md:text-lg font-black text-white">3.450</span>
                     </div>
                     <div className="bg-cyan-500/10 border border-cyan-500/20 p-3.5 md:p-4 rounded-xl md:rounded-2xl flex flex-row justify-between items-center gap-2">
                        <span className="text-[8px] md:text-[10px] text-cyan-500 font-bold uppercase tracking-wider">Lucro do Evento (Royalty)</span>
                        <span className="text-base md:text-lg font-black text-cyan-400">R$ 5.175,00</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <span className="inline-flex items-center gap-1.5 text-red-500 font-black text-[8px] md:text-[9px] uppercase tracking-[0.2em] mb-3 md:mb-4">
                Organiza Eventos?
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter leading-tight mb-4 md:mb-5">
                Ganhe dinheiro com<br className="hidden md:block"/> as fotos do <span className="text-zinc-500">seu campeonato.</span>
              </h2>
              <p className="text-zinc-400 text-[11px] md:text-sm font-medium leading-relaxed mb-6 md:mb-8 max-w-lg mx-auto md:mx-0 px-2 md:px-0">
                Cadastre a sua organização, conecte o evento e credencie os fotógrafos da sua confiança. Você define uma % de royalty e ganha uma fatia automática sobre cada foto vendida.
              </p>
              <Link href="/fotos/organizador" className="inline-flex w-full sm:w-auto items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3.5 md:px-8 md:py-4 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-colors">
                Área de Organizador
              </Link>
            </div>
          </div>
        </section>

        <DiferenciaisFotos publico="fotografo" />

        {/* CTA FINAL */}
        <section className="py-16 md:py-32 px-4 text-center border-t border-white/5 bg-gradient-to-t from-[#0a0a0e] to-[#050505]">
          <ImagePlus size={32} className="mx-auto text-cyan-500 mb-4 md:mb-6 opacity-80 md:w-10 md:h-10" />
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tight mb-4 md:mb-6">Pronto para o próximo nível?</h2>
          <p className="text-zinc-400 text-[11px] md:text-sm mb-8 md:mb-10 max-w-lg mx-auto font-medium leading-relaxed px-4">Sua câmera faz a magia, nosso sistema faz a venda e o repasse. Crie sua conta gratuitamente agora mesmo.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4">
             <Link href="/fotos/cadastro?perfil=fotografo" className="inline-flex items-center justify-center bg-cyan-500 text-black px-8 py-3.5 md:px-10 md:py-4 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-transform hover:scale-105 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
               Criar meu Perfil
             </Link>
          </div>
        </section>

      </main>
    </FotosShell>
  );
}
