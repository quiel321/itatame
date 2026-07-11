"use client";

import Link from "next/link";
import FotosShell from "../_components/FotosShell";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  CloudUpload,
  CreditCard,
  Images,
  Search,
  ShieldCheck,
  Zap,
  ScanFace,
  Wallet,
  Users
} from "lucide-react";

const metricas = [
  { valor: "6%", rotulo: "taxas a partir de" },
  { valor: "✓", rotulo: "Upload Ilimitado" },
  { valor: "Pix", rotulo: "Recebimento Rápido" },
];

const comparativo = [
  {
    titulo: "Venda por Conta Própria",
    itens: ["Links espalhados pelo WhatsApp", "Cobrança manual (Pix a Pix)", "Risco de prints não pagos", "Processo lento para o atleta"],
    destaque: false,
  },
  {
    titulo: "Plataformas Antigas",
    itens: ["Upload lento e travado", "Taxas abusivas e repasse lento", "Difícil conectar com o evento", "Sem pesquisa facial ativa"],
    destaque: false,
  },
  {
    titulo: "Com iTatame Fotos",
    itens: ["Pesquisa por IA (Reconhecimento Facial)", "Marca d'água na nuvem (Anti-print)", "Pagamento instantâneo via Pix", "Compra junto com a inscrição do evento"],
    destaque: true,
  },
];

const passos = [
  { titulo: "Fotografe a Ação", texto: "Capture as lutas, pódios, bastidores e momentos de glória.", icon: Camera },
  { titulo: "Upload Turbo R2", texto: "Arraste tudo para o painel. Nós aplicamos a marca d'água na nuvem.", icon: CloudUpload },
  { titulo: "IA Trabalha por você", texto: "O atleta tira uma selfie e o sistema encontra ele em todas as fotos.", icon: ScanFace },
  { titulo: "Venda no Automático", texto: "O atleta paga via Pix e o seu dinheiro cai direto no Split de Pagamento.", icon: Wallet },
];

export default function FotografoMarketingPage() {
  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30">
        
        {/* 🚀 HERO SECTION (LATERALIZADA COM FOTO DE FUNDO) */}
        <section className="relative w-full min-h-[85vh] flex items-center pt-24 pb-16 overflow-hidden border-b border-white/5 bg-black">
          
          {/* BACKGROUND FOTO & GRADIENTES */}
          <div className="absolute inset-0 z-0 pointer-events-none">
           {/* Foto do Fotógrafo (Fixada na metade direita da tela) */}
            <div className="absolute inset-y-0 right-0 w-full md:w-[65%] bg-[url('https://images.pexels.com/photos/1264210/pexels-photo-1264210.jpeg?auto=compress&cs=tinysrgb&w=1920')] bg-cover bg-center md:bg-[left_center] opacity-[0.45] mix-blend-luminosity"></div>
            
            {/* Máscara de Gradiente: Escuro na esquerda (onde vai o texto) sumindo para a direita */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/95 to-transparent z-10"></div>
            
            {/* Gradiente de baixo para cima para fundir com o resto da página */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/50 z-10"></div>
            
            {/* Brilho Cyan sutil focado na esquerda */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/10 blur-[150px] rounded-full z-10"></div>
          </div>

          <div className="relative z-30 w-full max-w-7xl mx-auto px-4 md:px-8">
            {/* CONTEÚDO ALINHADO À ESQUERDA E PUXADO PARA CIMA (-mt-16) */}
            <div className="max-w-xl text-left -mt-10 md:-mt-16">
              
              <span className="inline-flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-5 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <Camera size={12} /> Para Fotógrafos Esportivos
              </span>

              {/* Fontes reduzidas em aprox 15% */}
              <h1 className="text-3xl md:text-4xl lg:text-[50px] font-black uppercase tracking-tighter leading-[1.05] drop-shadow-2xl mb-5">
                Suas fotos já são profissionais.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-700">Sua venda também pode ser.</span>
              </h1>

              <p className="text-zinc-400 text-xs md:text-sm font-medium leading-relaxed mb-8 max-w-md">
                Junte-se à plataforma mais moderna de fotografia esportiva. Upload ilimitado, pesquisa por Reconhecimento Facial (IA) e dinheiro caindo direto na sua conta via Pix.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-10">
                <Link href="/fotos/login/" className="flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black px-7 py-3.5 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:scale-105">
                  Começar a Vender <ArrowRight size={16} />
                </Link>
                <Link href="/fotos/login/" className="flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/10 px-7 py-3.5 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-colors backdrop-blur-md">
                  Acessar meu painel
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
             <span className="text-red-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">Workflow Automático</span>
            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight mb-4">Esqueça a burocracia.<br/><span className="text-zinc-500">Foque no clique.</span></h2>
            <p className="text-zinc-400 text-sm max-w-xl mx-auto font-medium">Do momento que você aperta o botão da câmera até o dinheiro cair na conta, nós tratamos de tudo.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {passos.map(({ titulo, texto, icon: Icon }, index) => (
              <div key={titulo} className="bg-[#0a0a0e] border border-white/5 p-6 md:p-8 rounded-3xl hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all duration-300 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-2xl rounded-full transition-all group-hover:bg-cyan-500/10"></div>
                
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-400 border border-cyan-500/20">
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

        {/* 🥊 COMPARATIVO (O PORQUÊ DE ESCOLHER A GENTE) */}
        <section className="bg-[#0a0a0e] border-y border-white/5 py-20 md:py-28 relative overflow-hidden">
           <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"></div>
           
           <div className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-3">Nem todo jeito de vender fotos online é igual</h2>
              <p className="text-zinc-400 text-sm max-w-lg mx-auto font-medium">Você pode perder tempo com links manuais, pagar taxas absurdas, ou usar a plataforma focada no seu lucro.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {comparativo.map((card) => (
                <div key={card.titulo} className={`rounded-3xl border p-6 md:p-8 flex flex-col ${card.destaque ? "border-cyan-500/50 bg-cyan-500/10 shadow-[0_20px_50px_rgba(6,182,212,0.15)] transform md:-translate-y-4" : "border-white/5 bg-[#111] opacity-70 hover:opacity-100 transition-opacity"}`}>
                  
                  {card.destaque && (
                     <div className="mb-6 flex">
                        <span className="inline-flex items-center gap-1.5 bg-cyan-500 text-black px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest shadow-md">
                           <CheckCircle2 size={12} /> A Melhor Escolha
                        </span>
                     </div>
                  )}
                  
                  <h3 className={`text-lg font-black uppercase tracking-tight mb-6 ${card.destaque ? 'text-white' : 'text-zinc-300'}`}>{card.titulo}</h3>
                  
                  <div className="space-y-4 mb-8 flex-1">
                    {card.itens.map((item) => (
                      <p key={item} className="flex items-start gap-3 text-xs leading-relaxed text-zinc-300 font-medium">
                        <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${card.destaque ? "text-cyan-400" : "text-zinc-600"}`} /> {item}
                      </p>
                    ))}
                  </div>

                  {card.destaque && (
                     <Link href="/fotos/login/" className="mt-auto w-full py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-[10px] font-black uppercase tracking-widest text-center transition-colors">
                        Quero vender assim
                     </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 📊 ESTRUTURA PARA ORGANIZADORES */}
        <section className="py-20 md:py-28 px-4 md:px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-20">
            <div className="flex-1 relative">
               <div className="absolute inset-0 bg-red-500/10 blur-[100px] rounded-full"></div>
               <div className="relative bg-[#111] border border-white/10 rounded-3xl p-8 overflow-hidden shadow-2xl">
                  <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-6">
                     <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 border border-red-500/20">
                        <Users size={20} />
                     </div>
                     <div>
                        <h3 className="text-white font-black uppercase tracking-tight text-sm">Dashboard Organizador</h3>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Split Automático de Royalties</p>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <div className="bg-black/50 border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Fotos Vendidas no Evento</span>
                        <span className="text-lg font-black text-white">3.450</span>
                     </div>
                     <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-2xl flex justify-between items-center">
                        <span className="text-[10px] text-cyan-500 font-bold uppercase tracking-wider">Seu Lucro (Royalty)</span>
                        <span className="text-lg font-black text-cyan-400">R$ 5.175,00</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <span className="inline-flex items-center gap-1.5 text-red-500 font-black text-[9px] uppercase tracking-[0.2em] mb-4">
                Organiza Eventos?
              </span>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-tight mb-5">
                Ganhe dinheiro com<br className="hidden md:block"/> as fotos do <span className="text-zinc-500">seu campeonato.</span>
              </h2>
              <p className="text-zinc-400 text-xs md:text-sm font-medium leading-relaxed mb-8 max-w-lg mx-auto md:mx-0">
                Cadastre a sua organização, conecte o evento e convide fotógrafos. Você define uma % de royalty e ganha uma fatia automática sobre cada foto vendida pelos profissionais.
              </p>
              <Link href="/fotos/login/" className="inline-flex bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
                Sou Organizador
              </Link>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="py-20 md:py-32 px-4 text-center border-t border-white/5 bg-gradient-to-t from-[#0a0a0e] to-[#050505]">
          <Camera size={40} className="mx-auto text-cyan-500 mb-6 opacity-80" />
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-6">Pronto para o próximo nível?</h2>
          <p className="text-zinc-400 text-sm mb-10 max-w-lg mx-auto font-medium">Sua câmera faz a magia, nós fazemos a venda. Crie sua conta grátis agora mesmo.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
             <Link href="/fotos/login/" className="inline-flex items-center justify-center bg-cyan-500 text-black px-10 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-transform hover:scale-105 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
               Criar conta gratuita
             </Link>
          </div>
        </section>

      </main>
    </FotosShell>
  );
}