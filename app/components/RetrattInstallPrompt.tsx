"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Download, Share, ShieldCheck, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "retratt_install_dismissed_at";
const DELAY_DAYS = 14;

function estaInstalado() {
  const ios = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return ios || window.matchMedia("(display-mode: standalone)").matches;
}

export default function RetrattInstallPrompt({ consentimentoDefinido, mostrarCookies }: {
  consentimentoDefinido: boolean;
  mostrarCookies: boolean;
}) {
  const [instalacao, setInstalacao] = useState<InstallPromptEvent | null>(null);
  const [mostrar, setMostrar] = useState(false);
  const [instalando, setInstalando] = useState(false);
  const agente = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const ehIOS = /iPad|iPhone|iPod/.test(agente) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const ehSafari = /Safari/i.test(agente) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS/i.test(agente);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const receberPrompt = (event: Event) => {
      event.preventDefault();
      setInstalacao(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", receberPrompt);
    return () => window.removeEventListener("beforeinstallprompt", receberPrompt);
  }, []);

  useEffect(() => {
    if (!consentimentoDefinido || estaInstalado()) return;
    const dispensadoEm = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    if (Date.now() - dispensadoEm < DELAY_DAYS * 24 * 60 * 60 * 1000) return;
    if (!instalacao && !ehIOS && !ehSafari) return;
    const timer = window.setTimeout(() => setMostrar(true), 1800);
    return () => window.clearTimeout(timer);
  }, [consentimentoDefinido, ehIOS, ehSafari, instalacao]);

  useEffect(() => {
    if (!mostrar || instalando) return;
    const timer = window.setTimeout(() => setMostrar(false), 10000);
    return () => window.clearTimeout(timer);
  }, [instalando, mostrar]);

  function dispensar() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setMostrar(false);
  }

  async function instalar() {
    if (!instalacao) return;
    setInstalando(true);
    try {
      await instalacao.prompt();
      const escolha = await instalacao.userChoice;
      if (escolha.outcome === "accepted") setMostrar(false);
      else dispensar();
    } finally {
      setInstalacao(null);
      setInstalando(false);
    }
  }

  if (!mostrar || mostrarCookies) return null;

  return (
    <aside className="fixed right-3 top-20 z-[145] w-[calc(100vw-1.5rem)] max-w-[360px] sm:right-5 sm:top-24" role="dialog" aria-label="Instalar aplicativo Retratt">
      <div className="relative overflow-hidden rounded-2xl border border-orange-500/30 bg-[#0b0b0d]/95 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.72)] backdrop-blur-xl">
        <button type="button" onClick={dispensar} aria-label="Fechar" className="absolute right-3 top-3 rounded-full border border-white/10 bg-white/5 p-1.5 text-zinc-500 transition hover:text-white"><X size={14} /></button>
        <div className="flex items-start gap-3 pr-8">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-orange-500/25 bg-orange-500/10">
            <Image src="/retratt/icon-512.png" alt="" width={36} height={36} className="rounded-lg" />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.22em] text-orange-400">Suas fotos sempre por perto</p>
            <h2 className="mt-1 text-base font-black leading-tight text-white">Instale o Retratt</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Encontre eventos, compre fotos e acesse seus momentos direto da tela inicial.</p>
          </div>
        </div>

        {instalacao ? (
          <button type="button" onClick={() => void instalar()} disabled={instalando} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-orange-400 disabled:opacity-60">
            <Download size={15} /> {instalando ? "Abrindo instalador..." : "Instalar Retratt"}
          </button>
        ) : (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex gap-2.5">
              <Share size={16} className="mt-0.5 shrink-0 text-orange-400" />
              <div>
                <strong className="block text-[10px] font-black text-white">{ehIOS ? "No Safari do iPhone ou iPad" : "No Safari"}</strong>
                <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-400">{ehIOS ? "Compartilhar → Adicionar à Tela de Início." : "Arquivo → Adicionar ao Dock."}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between gap-2 text-[8px] font-bold uppercase tracking-wider text-zinc-600">
          <span className="flex items-center gap-1.5"><ShieldCheck size={11} /> Instalação segura</span>
          <span>Fecha em 10s</span>
        </div>
      </div>
    </aside>
  );
}
