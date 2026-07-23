"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Cookie, Download, Share, ShieldCheck, Smartphone, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CONSENT_KEY = "itatame_cookie_consent";
const INSTALL_DISMISSED_KEY = "itatame_install_dismissed_at";
const INSTALL_DELAY_DAYS = 14;

function registrarConsentimento(valor: "all" | "necessary") {
  localStorage.setItem(CONSENT_KEY, valor);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_KEY}=${valor}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
}

function estaInstalado() {
  const standaloneIOS = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return standaloneIOS || window.matchMedia("(display-mode: standalone)").matches;
}

export default function SiteConsentAndInstall() {
  const pathname = usePathname();
  const [mostrarCookies, setMostrarCookies] = useState(false);
  const [consentimentoDefinido, setConsentimentoDefinido] = useState(false);
  const [instalacao, setInstalacao] = useState<InstallPromptEvent | null>(null);
  const [mostrarInstalacao, setMostrarInstalacao] = useState(false);
  const [ehIOS, setEhIOS] = useState(false);
  const [ehSafari, setEhSafari] = useState(false);
  const [instalando, setInstalando] = useState(false);

  const rotaOperacional = useMemo(() => {
    return ["/admin", "/staff", "/super-admin", "/fotos", "/placar"].some((prefixo) => pathname?.startsWith(prefixo));
  }, [pathname]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const consentimento = localStorage.getItem(CONSENT_KEY);
    setConsentimentoDefinido(Boolean(consentimento));
    if (!consentimento) {
      const timer = window.setTimeout(() => setMostrarCookies(true), 700);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safari = /Safari/i.test(userAgent) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS/i.test(userAgent);
    setEhIOS(ios);
    setEhSafari(safari);

    const receberPrompt = (event: Event) => {
      event.preventDefault();
      setInstalacao(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", receberPrompt);
    return () => window.removeEventListener("beforeinstallprompt", receberPrompt);
  }, []);

  useEffect(() => {
    if (!consentimentoDefinido || rotaOperacional || estaInstalado()) return;
    const dispensadoEm = Number(localStorage.getItem(INSTALL_DISMISSED_KEY) || 0);
    const aindaDispensado = Date.now() - dispensadoEm < INSTALL_DELAY_DAYS * 24 * 60 * 60 * 1000;
    if (aindaDispensado) return;
    if (!instalacao && !ehIOS && !ehSafari) return;
    const timer = window.setTimeout(() => setMostrarInstalacao(true), 1800);
    return () => window.clearTimeout(timer);
  }, [consentimentoDefinido, ehIOS, ehSafari, instalacao, rotaOperacional]);

  useEffect(() => {
    if (!mostrarInstalacao || instalando) return;
    const timer = window.setTimeout(() => setMostrarInstalacao(false), 5000);
    return () => window.clearTimeout(timer);
  }, [instalando, mostrarInstalacao]);

  const concluirCookies = (valor: "all" | "necessary") => {
    registrarConsentimento(valor);
    setMostrarCookies(false);
    setConsentimentoDefinido(true);
  };

  const dispensarInstalacao = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    setMostrarInstalacao(false);
  };

  const instalar = async () => {
    if (!instalacao) return;
    setInstalando(true);
    await instalacao.prompt();
    const escolha = await instalacao.userChoice;
    if (escolha.outcome === "accepted") setMostrarInstalacao(false);
    else dispensarInstalacao();
    setInstalacao(null);
    setInstalando(false);
  };

  return (
    <>
      {mostrarCookies && (
        <aside className="fixed inset-x-3 bottom-3 z-[150] mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#0b0b0f]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.75)] backdrop-blur-xl md:bottom-6 md:p-5" role="dialog" aria-label="Preferências de cookies">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400"><Cookie size={19} /></div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black uppercase tracking-wide text-white">Cookies e sua experiência</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400 md:text-xs">Usamos cookies essenciais para manter login, segurança e preferências. Com sua autorização, também podemos guardar escolhas que tornam sua navegação mais simples.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button onClick={() => concluirCookies("necessary")} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition hover:bg-white/10">Somente essenciais</button>
                <button onClick={() => concluirCookies("all")} className="rounded-xl bg-red-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-red-500">Aceitar cookies</button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {mostrarInstalacao && !mostrarCookies && (
        <aside className="fixed right-3 top-20 z-[145] w-[calc(100vw-1.5rem)] max-w-[360px] sm:right-5 sm:top-24" role="dialog" aria-label="Instalar aplicativo iTatame">
          <div className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#0b0b10]/95 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.72)] backdrop-blur-xl">
            <button onClick={dispensarInstalacao} aria-label="Fechar" className="absolute right-3 top-3 rounded-full border border-white/10 bg-white/5 p-1.5 text-zinc-500 transition hover:text-white"><X size={14} /></button>
            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-300"><Smartphone size={20} /></div>
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.22em] text-cyan-400">Experiência mobile</p>
                <h2 className="mt-1 text-base font-black uppercase leading-tight text-white">Leve o iTatame com você</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Instale na tela inicial para abrir mais rápido e usar como aplicativo.</p>
              </div>
            </div>

            {instalacao ? (
              <button onClick={instalar} disabled={instalando} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-cyan-400 disabled:opacity-60">
                <Download size={15} /> {instalando ? "Abrindo instalador..." : "Instalar aplicativo"}
              </button>
            ) : (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex gap-2.5">
                  <Share size={16} className="mt-0.5 shrink-0 text-cyan-400" />
                  <div>
                    <strong className="block text-[10px] font-black uppercase text-white">{ehIOS ? "No Safari do iPhone ou iPad" : "No Safari"}</strong>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-400">{ehIOS ? "Compartilhar → Adicionar à Tela de Início." : "Arquivo → Adicionar ao Dock."}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-2.5 flex items-center justify-between gap-2 text-[8px] font-bold uppercase tracking-wider text-zinc-600">
              <span className="flex items-center gap-1.5"><ShieldCheck size={11} /> Instalação segura</span>
              <span>Fecha em 5s</span>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
