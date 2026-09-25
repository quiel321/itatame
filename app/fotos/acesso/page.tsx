"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import FotosShell from "../_components/FotosShell";

function destinoSeguro(valor: string | null) {
  return valor && valor.startsWith("/fotos/") && !valor.startsWith("//") ? valor : "/fotos/minhas-compras";
}

export default function FotosAcessoPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<"validando" | "email" | "codigo">("validando");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [destino, setDestino] = useState("/fotos/minhas-compras");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function iniciar() {
      const parametros = new URLSearchParams(window.location.search);
      const proximo = destinoSeguro(parametros.get("next"));
      const tokenHash = parametros.get("token_hash");
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
        if (!error) {
          router.replace(proximo);
          return;
        }
        setErro("Este link expirou ou já foi usado. Peça um código novo abaixo.");
      } else {
        await supabase.auth.getSession();
      }
      setDestino(proximo);
      setEmail(parametros.get("email") || "");
      setEtapa("email");
    }
    void iniciar();
  }, [router]);

  async function pedirCodigo(event: React.FormEvent) {
    event.preventDefault();
    setCarregando(true);
    setErro("");
    setMensagem("");
    const response = await fetch("/api/fotos/acesso-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next: destino }),
    });
    const resultado = await response.json().catch(() => null);
    setCarregando(false);
    if (!response.ok) {
      setErro(resultado?.error || "Não foi possível enviar o código.");
      return;
    }
    setMensagem(resultado?.message || "Código enviado.");
    setEtapa("codigo");
  }

  async function confirmarCodigo(event: React.FormEvent) {
    event.preventDefault();
    setCarregando(true);
    setErro("");
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: codigo.trim(), type: "email" });
    if (error) {
      setCarregando(false);
      setErro("Código inválido ou expirado. Confira o e-mail ou peça outro código.");
      return;
    }
    router.replace(destino);
  }

  const campo = "cursor-text h-14 w-full rounded-2xl border border-white/5 bg-[#050505] pl-11 pr-4 text-xs font-bold text-white outline-none transition-all placeholder:text-zinc-700 focus:ring-1 focus:ring-retratt/50 focus:border-retratt/50";

  return (
    <FotosShell>
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 py-16 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a0a0e]/80 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-retratt/30 bg-retratt/10 text-retratt">
              <ShieldCheck size={20} />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tight">Acessar minhas compras</h1>
            <p className="mt-2 text-[11px] font-medium leading-relaxed text-zinc-400">
              Sem senha: enviamos um código para o e-mail usado na compra.
            </p>
          </div>

          {etapa === "validando" ? (
            <div className="flex flex-col items-center gap-3 py-8 text-[10px] font-black uppercase tracking-widest text-zinc-400">
              <Loader2 size={28} className="animate-spin text-retratt" /> Validando seu acesso...
            </div>
          ) : etapa === "email" ? (
            <form onSubmit={pedirCodigo} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="E-mail usado na compra" className={campo} />
              </div>
              <button disabled={carregando} className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-retratt text-[10px] font-black uppercase tracking-widest text-white transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
                {carregando ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Receber código
              </button>
            </form>
          ) : (
            <form onSubmit={confirmarCodigo} className="space-y-4">
              <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center text-[11px] font-bold text-emerald-300">{mensagem}</p>
              <div className="relative">
                <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  placeholder="Código recebido no e-mail"
                  className={`${campo} tracking-[0.4em]`}
                />
              </div>
              <button disabled={carregando || codigo.length < 6} className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-retratt text-[10px] font-black uppercase tracking-widest text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
                {carregando ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Entrar
              </button>
              <button type="button" onClick={() => { setEtapa("email"); setCodigo(""); setMensagem(""); }} className="w-full cursor-pointer text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white">
                Usar outro e-mail ou reenviar
              </button>
            </form>
          )}

          {erro && <p className="mt-5 rounded-xl border border-retratt/30 bg-retratt/10 p-3 text-center text-[11px] font-bold text-retratt">{erro}</p>}

          <p className="mt-8 border-t border-white/5 pt-6 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Tem senha? <Link href="/fotos/login?perfil=comprador" className="text-white hover:text-retratt">Entrar com senha</Link>
          </p>
        </div>
      </main>
    </FotosShell>
  );
}
