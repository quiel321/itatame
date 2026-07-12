"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { podeAcessarPerfilFotos } from "@/app/lib/fotos-acesso";
import FotosShell from "../_components/FotosShell";
import { Camera, Images, ShieldCheck, Users, Lock, Mail, ArrowRight, type LucideIcon } from "lucide-react";

type Perfil = "comprador" | "fotografo" | "organizador";

const perfis = {
  comprador: {
    titulo: "Atleta / Comprador",
    texto: "Ver compras, baixar fotos e acompanhar pedidos.",
    destino: "/fotos/comprador",
    textoCadastro: "Criar Conta de Atleta",
    icon: Images,
  },
  fotografo: {
    titulo: "Fotógrafo Parceiro",
    texto: "Enviar fotos, gerir álbuns e repasses Pix.",
    destino: "/fotos/fotografo/dashboard",
    textoCadastro: "Criar Conta de Fotógrafo",
    icon: Camera,
  },
  organizador: {
    titulo: "Organizador",
    texto: "Criar galerias e acompanhar royalties.",
    destino: "/fotos/admin",
    textoCadastro: "Criar Conta de Organizador",
    icon: Users,
  },
} satisfies Record<Perfil, { titulo: string; texto: string; destino: string; textoCadastro: string; icon: LucideIcon }>;

// 🔥 TEMAS DINÂMICOS
const temas = {
  comprador: {
    badge: "bg-red-500/10 border-red-500/20 text-red-500",
    activeCard: "border-red-500/50 bg-red-500/10",
    activeIcon: "text-red-500",
    glow: "bg-red-600/10",
    button: "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]",
    focus: "focus:border-red-500/50 focus:ring-red-500/50",
    hoverLink: "hover:text-red-400 border-white/5 hover:border-red-500/30 hover:bg-red-500/5 text-zinc-300",
    iconeBtn: <ArrowRight size={16} />
  },
  fotografo: {
    badge: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
    activeCard: "border-cyan-500/50 bg-cyan-500/10",
    activeIcon: "text-cyan-400",
    glow: "bg-cyan-600/10",
    button: "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.2)]",
    focus: "focus:border-cyan-500/50 focus:ring-cyan-500/50",
    hoverLink: "hover:text-cyan-400 border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 text-zinc-300",
    iconeBtn: <Camera size={16} />
  },
  organizador: {
    badge: "bg-amber-500/10 border-amber-500/20 text-amber-500",
    activeCard: "border-amber-500/50 bg-amber-500/10",
    activeIcon: "text-amber-400",
    glow: "bg-amber-600/10",
    button: "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.2)]",
    focus: "focus:border-amber-500/50 focus:ring-amber-500/50",
    hoverLink: "hover:text-amber-400 border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 text-zinc-300",
    iconeBtn: <Users size={16} />
  }
};

export default function FotosLoginPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil>("comprador");
  const [destinoManual, setDestinoManual] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const perfilParam = params.get("perfil") as Perfil | null;
    queueMicrotask(() => {
      if (perfilParam && perfilParam in perfis) setPerfil(perfilParam);
      setDestinoManual(params.get("next"));
    });
    if (params.get("trocar") === "1") void supabase.auth.signOut();
  }, []);

  const destino = useMemo(() => destinoManual || perfis[perfil].destino, [destinoManual, perfil]);
  const perfilAtual = perfis[perfil];
  const temaAtual = temas[perfil];

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setCarregando(false);
      setErro("E-mail ou senha inválidos. Tente novamente.");
      return;
    }
    const autorizado = data.user ? await podeAcessarPerfilFotos(supabase, data.user, perfil) : false;
    if (!autorizado) {
      await supabase.auth.signOut();
      setCarregando(false);
      setErro(`Esta conta não possui acesso como ${perfilAtual.titulo.toLowerCase()}. Entre com a conta correta.`);
      return;
    }
    setCarregando(false);
    router.push(destino);
  }

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white flex items-center py-12 relative overflow-hidden font-sans">
        
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[800px] h-[600px] md:h-[800px] blur-[150px] rounded-full transition-colors duration-700 pointer-events-none ${temaAtual.glow}`}></div>

        <section className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-8 grid gap-10 md:gap-16 md:grid-cols-[1fr_420px] items-center">
          
          <div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-6 transition-colors duration-500 ${temaAtual.badge}`}>
              <ShieldCheck size={12} /> Acesso Unificado iTatame
            </span>
            
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-[1.05] drop-shadow-2xl mb-5">
              Uma conta para comprar,<br className="hidden md:block" /> vender e organizar fotos.
            </h1>
            
            <p className="text-zinc-400 text-xs md:text-sm font-medium leading-relaxed mb-10 max-w-lg">
              Selecione abaixo como deseja acessar a plataforma. O painel e as ferramentas mudam automaticamente com base no seu perfil.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {(Object.keys(perfis) as Perfil[]).map((key) => {
                const item = perfis[key];
                const Icon = item.icon;
                const ativo = perfil === key;
                const temaBotao = temas[key];

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setPerfil(key); setDestinoManual(null); }}
                    className={`cursor-pointer rounded-3xl border p-5 text-left transition-all duration-300 transform ${ativo ? `${temaBotao.activeCard} md:-translate-y-2 shadow-xl` : "border-white/5 bg-[#111] hover:bg-white/5"}`}
                  >
                    <Icon size={24} className={ativo ? temaBotao.activeIcon : "text-zinc-600"} />
                    <p className={`mt-4 text-[11px] font-black uppercase tracking-wider ${ativo ? "text-white" : "text-zinc-300"}`}>{item.titulo}</p>
                    <p className={`mt-2 text-[10px] leading-relaxed font-medium ${ativo ? "text-white/80" : "text-zinc-500"}`}>{item.texto}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={entrar} className="relative rounded-3xl border border-white/10 bg-[#0a0a0e]/80 backdrop-blur-xl p-6 md:p-8 shadow-2xl flex flex-col">
            <div className="text-center mb-8">
               <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-4 transition-colors duration-500 ${temaAtual.activeCard} ${temaAtual.activeIcon}`}>
                  <Lock size={20} />
               </div>
               <h2 className="text-xl font-black uppercase tracking-tight text-white">Login {perfilAtual.titulo.split(' ')[0]}</h2>
               <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Acesso Seguro</p>
            </div>

            <div className="space-y-4">
               <div>
                 <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1 mb-1.5">E-mail</label>
                 <div className="relative">
                   <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                   <input 
                     value={email} 
                     onChange={(e) => setEmail(e.target.value)} 
                     type="email" 
                     required 
                     placeholder="seu@email.com"
                     className={`cursor-text h-14 w-full rounded-2xl border border-white/5 bg-[#050505] pl-11 pr-4 text-xs font-bold text-white outline-none transition-all placeholder:text-zinc-700 focus:ring-1 ${temaAtual.focus}`} 
                   />
                 </div>
               </div>

               <div>
                 <div className="flex items-center justify-between ml-1 mb-1.5">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Senha</label>
                    <Link href="/recuperar-senha" className="cursor-pointer text-[9px] font-bold text-zinc-500 hover:text-white transition-colors">Esqueceu?</Link>
                 </div>
                 <div className="relative">
                   <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                   <input 
                     value={senha} 
                     onChange={(e) => setSenha(e.target.value)} 
                     type="password" 
                     required 
                     placeholder="••••••••"
                     className={`cursor-text h-14 w-full rounded-2xl border border-white/5 bg-[#050505] pl-11 pr-4 text-xs font-bold text-white outline-none transition-all placeholder:text-zinc-700 focus:ring-1 ${temaAtual.focus}`} 
                   />
                 </div>
               </div>
            </div>

            {erro && (
               <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[11px] font-bold text-red-400 text-center flex items-center justify-center gap-2">
                  {erro}
               </div>
            )}

            <button 
               disabled={carregando} 
               className={`cursor-pointer mt-8 h-14 w-full rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${temaAtual.button}`}
            >
               {carregando ? "Acessando sistema..." : `Entrar como ${perfilAtual.titulo.split(' / ')[0]}`}
               {!carregando && temaAtual.iconeBtn}
            </button>

            {/* 🔥 LINK DE CADASTRO DINÂMICO ÚNICO COM MÃOZINHA! */}
            <div className="mt-8 pt-6 border-t border-white/5">
               <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 text-center mb-4">Ainda não tem conta?</p>
               <Link 
                 href={`/fotos/cadastro?perfil=${perfil}`} 
                 className={`cursor-pointer h-14 flex items-center justify-center rounded-2xl border bg-[#050505] text-[10px] font-black uppercase tracking-widest transition-all ${temaAtual.hoverLink}`}
               >
                 {perfilAtual.textoCadastro}
               </Link>
            </div>

          </form>
        </section>
      </main>
    </FotosShell>
  );
}
