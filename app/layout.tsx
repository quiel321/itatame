import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iTatame - Seu Campeonato Online",
  description: "Plataforma moderna para inscrições e chaves de campeonatos de luta.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#050505] text-white">
        
        <Navbar />

        <main className="flex-1 pt-[60px] md:pt-[65px]">
          {children}
        </main>

        {/* FOOTER - AGORA BEM SEPARADO E COMPACTO */}
        <footer className="bg-[#0a0a0e] border-t-2 border-red-600/30 pt-10 pb-6 mt-16 relative z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              
              <div>
                <div className="flex items-center mb-3">
                  <div className="flex transform -skew-x-12 mr-1.5 h-3">
                    <div className="bg-red-600 w-2 h-full mr-0.5 rounded-sm"></div>
                    <div className="bg-white w-2 h-full rounded-sm"></div>
                  </div>
                  <div className="text-white font-black text-lg italic tracking-tighter leading-none"><span className="text-red-600">i</span>TATAME</div>
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed max-w-xs pr-4">
                  O sistema definitivo para gestão de campeonatos de lutas e transmissão PPV. Nascido no tatame, feito para o tatame.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase tracking-widest text-[10px] mb-3">Plataforma</h4>
                <ul className="space-y-2 text-xs text-zinc-400">
                  <li><a href="/" className="hover:text-red-500 transition-colors">Eventos Abertos</a></li>
                  <li><a href="/ppv" className="hover:text-red-500 transition-colors">Transmissão PPV</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase tracking-widest text-[10px] mb-3">Organize seu Campeonato</h4>
                <p className="text-zinc-400 text-xs mb-3">Nós cuidamos da tecnologia para você focar no show. Fale conosco.</p>
                <a href="https://wa.me/5565993059729" target="_blank" className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors">
                  <svg className="w-3.5 h-3.5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.015c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Falar com a Equipe
                </a>
              </div>
            </div>

            <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 pb-12 md:pb-0">
              <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">&copy; {new Date().getFullYear()} iTATAME.</p>
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                <a href="#" className="hover:text-zinc-400 transition-colors">Termos</a>
                <a href="#" className="hover:text-zinc-400 transition-colors">Privacidade</a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}