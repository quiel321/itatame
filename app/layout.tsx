import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import SiteConsentAndInstall from "./components/SiteConsentAndInstall";
import Link from "next/link";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br"),
  title: "iTatame - Sistema de Campeonatos",
  description: "A melhor plataforma para gestão, chaves e transmissões ao vivo de campeonatos de lutas.",
  applicationName: "iTatame",
  openGraph: {
    title: "iTatame - Sistema de Campeonatos",
    description: "Crie eventos, gerencie inscrições, monte chaves e transmita ao vivo. Leve o iTatame para o seu evento!",
    url: "/",
    siteName: "iTatame - Sistema de Campeonatos",
    locale: "pt_BR",
    type: "website",
    images: ['/capa-compartilhamento.jpg'], 
  },
  twitter: {
    card: "summary_large_image",
    title: "iTatame - Sistema de Campeonatos",
    description: "Campeonatos, inscrições, chaves, ranking e acompanhamento em tempo real.",
    images: ["/capa-compartilhamento.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#050505] text-white">
        
        <Navbar />
        <SiteConsentAndInstall />

       {/* 🛡️ PROTEÇÃO RESTAURADA: Mantém o Login, Ranking e outras páginas abaixo da Navbar */}
        <main className="flex-1 flex flex-col pt-[60px] md:pt-[65px]">
          {children}
        </main>

        {/* FOOTER PREMIUM SAAS - 4 COLUNAS (MAIS COMPACTO) */}
        <footer className="bg-[#050505] border-t border-white/5 relative overflow-hidden pt-12 pb-24 md:pb-6 mt-16 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
          
          {/* Efeito de Glow Sutil no Fundo */}
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-red-600/5 blur-[150px] rounded-full pointer-events-none"></div>

          <div className="max-w-7xl mx-auto px-6 relative z-10">
            
            {/* GRID DE COLUNAS COM ESPAÇAMENTOS MENORES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 mb-10">
              
              {/* COLUNA 1: A MARCA */}
              <div className="flex flex-col gap-4 lg:pr-6">
                <Link href="/" className="inline-block">
                  <div className="flex items-center mb-1">
                    <div className="flex transform -skew-x-12 mr-1.5 h-3">
                      <div className="bg-red-600 w-2 h-full mr-0.5 rounded-sm"></div>
                      <div className="bg-white w-2 h-full rounded-sm"></div>
                    </div>
                    <div className="text-white font-black text-2xl md:text-3xl italic tracking-tighter leading-none">
                      <span className="text-red-600">i</span>TATAME
                    </div>
                  </div>
                </Link>
                <p className="text-zinc-500 text-xs leading-relaxed font-medium pr-4">
                  O ecossistema definitivo para gestão de campeonatos de lutas. Nascido no tatame, feito com tecnologia de ponta para elevar o nível do esporte.
                </p>
              </div>

              {/* COLUNA 2: ATLETAS */}
              <div>
                <h4 className="text-white text-[10px] font-black uppercase tracking-widest mb-4">Área do Competidor</h4>
                <ul className="flex flex-col gap-3">
                  <li><Link href="/" className="text-zinc-400 hover:text-red-400 text-xs font-bold transition-colors">Eventos Abertos</Link></li>
                  <li><Link href="/ranking" className="text-zinc-400 hover:text-red-400 text-xs font-bold transition-colors">Ranking Global</Link></li>
                  <li><Link href="/login" className="text-zinc-400 hover:text-red-400 text-xs font-bold transition-colors">Painel do Atleta / Login</Link></li>
                  <li><Link href="#" className="text-zinc-400 hover:text-red-400 text-xs font-bold transition-colors">Filtro de Checagem</Link></li>
                </ul>
              </div>

              {/* COLUNA 3: PLATAFORMA */}
              <div>
                <h4 className="text-white text-[10px] font-black uppercase tracking-widest mb-4">Plataforma</h4>
                <ul className="flex flex-col gap-3">
                  <li>
                    <Link href="/placar" className="flex items-center gap-2 text-zinc-400 hover:text-yellow-500 text-xs font-bold transition-colors">
                      Placar Digital
                      <span className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Free</span>
                    </Link>
                  </li>
                  {/* LINK DO ITATAME FOTOS ADICIONADO AQUI 👇 */}
                  <li>
                    <Link href={process.env.NEXT_PUBLIC_FOTOS_URL || "https://fotos.itatame.com.br"} className="flex items-center gap-2 text-zinc-400 hover:text-blue-400 text-xs font-bold transition-colors">
                      iTatame Fotos
                      <span className="bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Novo</span>
                    </Link>
                  </li>
                  <li><Link href="/ppv" className="text-zinc-400 hover:text-white text-xs font-bold transition-colors">Transmissão PPV</Link></li>
                  <li><Link href="#" className="text-zinc-400 hover:text-white text-xs font-bold transition-colors">Gerador de Chaves</Link></li>
                  <li><Link href="#" className="text-zinc-400 hover:text-white text-xs font-bold transition-colors">Central de Ajuda</Link></li>
                </ul>
              </div>

              {/* COLUNA 4: BOX ESPECIAL PARA ORGANIZADORES */}
              <div className="bg-[#0a0a0e]/60 border border-white/5 p-5 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <h4 className="text-white text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Para Organizadores
                </h4>
                <p className="text-zinc-500 text-[10px] leading-relaxed mb-4 font-medium">
                  Gestão de ponta a ponta para seu evento. Chaves, pesagem e recebimentos automatizados.
                </p>
                
                <div className="flex flex-col gap-2.5">
                  <a href="https://wa.me/5565993059729" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.015c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Falar com a Equipe
                  </a>
                  
                  <Link href="/login-organizador" className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">
                    Portal do Organizador
                  </Link>
                </div>
              </div>

            </div>

            {/* BARRA INFERIOR - COM LINK DE STAFF */}
            <div className="border-t border-white/5 pt-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white text-[12px] font-black shadow-inner italic shrink-0">
                <span className="text-red-600">i</span>
                </span>
                <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest text-center md:text-left">
                  &copy; {new Date().getFullYear()} iTATAME. Todos os direitos reservados.
                </p>
              </div>
              
              <div className="flex items-center gap-4 md:gap-6 flex-wrap justify-center">
                {/* LINK DISCRETO DO STAFF AQUI */}
                <Link href="/staff/login" className="flex items-center gap-1.5 text-zinc-700 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Portal Staff
                </Link>
                
                <span className="text-zinc-800 hidden sm:inline">|</span>

                <Link href="#" className="text-zinc-600 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">
                  Termos de Uso
                </Link>
                <Link href="#" className="text-zinc-600 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">
                  Privacidade
                </Link>
              </div>
            </div>

          </div>
        </footer>
      </body>
    </html>
  );
}
