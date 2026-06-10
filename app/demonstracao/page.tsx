"use client";

import Link from "next/link";
import { BellRing, CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck, Clock, CreditCard, FileText, Medal, MonitorDot, Radio, ShieldCheck, Smartphone, Swords, Trophy, Users, WalletCards } from "lucide-react";

const whatsappLink = "https://wa.me/5565993059729?text=Olá!%20Quero%20agendar%20uma%20demonstração%20do%20sistema%20iTatame.";

export default function DemonstracaoPage() {
  return (
    <main className="min-h-screen bg-[#020202] text-white selection:bg-red-500/30 overflow-x-hidden font-sans">
      
      {/* 🚀 HERO SECTION ENXUTA */}
      <section className="relative px-4 pt-16 pb-12 md:px-6 md:pt-24 md:pb-16 flex flex-col items-center justify-center border-b border-white/5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-red-600/10 blur-[120px] rounded-full"></div>
          <img src="/arena.png" alt="Arena" className="h-full w-full object-cover object-top opacity-[0.05]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020202]/60 via-[#020202]/90 to-[#020202]" />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-red-400 backdrop-blur-md mb-5 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></span>
            A Nova Geração de Campeonatos
          </span>
          
          <h1 className="text-3xl sm:text-4xl md:text-[52px] font-extrabold uppercase tracking-tighter leading-[0.95] max-w-3xl drop-shadow-xl">
            DA INSCRIÇÃO AO PÓDIO.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-800">TUDO CONECTADO.</span>
          </h1>
          
          <p className="mt-5 max-w-xl text-xs md:text-sm leading-relaxed text-zinc-400 font-medium">
            Esqueça as planilhas isoladas e a confusão. O iTatame centraliza inscrição, chaves oficiais, operação de arena e painéis ao vivo em uma só solução Cloud.
          </p>
          
          <div className="mt-6">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="group relative inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all hover:bg-red-500 hover:-translate-y-0.5">
              Falar com um Consultor <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>

        {/* MÉTRICAS FLUTUANTES (COMPACTAS) */}
        <div className="relative z-10 mt-10 grid grid-cols-2 md:grid-cols-4 gap-2.5 w-full max-w-6xl mx-auto px-4">
          <Metric value="Cloud" label="Gestão 100% Online" tone="red" />
          <Metric value="Pix/Boleto/Cartão" label="Baixa Automática" tone="yellow" />
          <Metric value="Auto" label="Gerador de Chaves" tone="cyan" />
          <Metric value="Live" label="Resultados na Arena" tone="green" />
        </div>
      </section>

      {/* 🛡️ FEATURES */}
      <section className="relative px-4 py-10 md:px-6 md:py-16 border-b border-white/5 bg-[#050505]">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-5xl mx-auto relative z-10">
          <Header eyebrow="Visão Geral" title="Operação à Prova de Falhas" text="Elimine a margem de erro manual. Centralizamos a gestão financeira e desportiva num ambiente seguro e intuitivo." />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Feature icon={<WalletCards size={16} />} title="Vendas & Financeiro" items={["Pagamento Inteligente", "Lotes Automáticos", "Repasses Financeiros"]} />
            <Feature icon={<Swords size={16} />} title="Chaveamento Ninja" items={["Algoritmo Anti-Equipe", "Chaves diversas", "Checagem Pública"]} highlight />
            <Feature icon={<Radio size={16} />} title="Experiência de Arena" items={["Mesário Mobile", "Placar Sincronizado", "Avisos no Celular"]} />
          </div>
        </div>
      </section>

      {/* 📋 STEP-BY-STEP */}
      <section className="px-4 py-10 md:px-6 md:py-16 bg-[#020202]">
        <div className="max-w-5xl mx-auto">
          <Header eyebrow="Implantação Express" title="Ao Pódio em 5 Etapas" text="Simples para quem organiza e claro para quem compete. Zero treinamento complexo." />
          <div className="mt-8 grid gap-3 lg:grid-cols-5 relative">
            <div className="hidden lg:block absolute top-6 left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-red-600/0 via-red-600/30 to-red-600/0"></div>
            <Step number="01" icon={<FileText size={14} />} title="Setup" text="Lotes, regras e regulamento." />
            <Step number="02" icon={<CreditCard size={14} />} title="Inscrições" text="Pix e Passaporte Digital." />
            <Step number="03" icon={<ClipboardCheck size={14} />} title="Checagem" text="Correções públicas de peso." />
            <Step number="04" icon={<Trophy size={14} />} title="Chaves" text="Sorteio oficial automatizado." />
            <Step number="05" icon={<MonitorDot size={14} />} title="Ginásio" text="Mesários, placar e chamadas." />
          </div>
        </div>
      </section>

      {/* 📱 MOCKS COMPACTADOS */}
      <section className="relative px-4 py-10 md:px-6 md:py-16 border-t border-white/5 bg-[#050505] overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10">
          <Header eyebrow="Telas Principais" title="Controle na Palma da Mão" text="Ambientes focados. O Organizador gere, o Mesário opera e o Atleta compete." />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Preview title="Admin Organizador" tag="Gestão Total" accent="red"><OrganizerMock /></Preview>
            <Preview title="Mesa do Mesário" tag="Tatame Mobile" accent="cyan"><StaffMock /></Preview>
            <Preview title="Painel Ao Vivo" tag="Display p/ TVs" accent="blue"><LiveMock /></Preview>
            <Preview title="Perfil Atleta" tag="Alertas & QR Code" accent="green"><AthleteMock /></Preview>
          </div>
        </div>
      </section>

      {/* 🚀 CTA FINAL */}
      <section className="relative px-4 py-12 md:px-6 md:py-20 overflow-hidden border-t border-white/5 bg-[#020202]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[200px] bg-red-600/10 blur-[100px] pointer-events-none rounded-t-full"></div>
        <div className="max-w-2xl mx-auto text-center relative z-10 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-4">
            <Trophy size={20} className="text-red-500" />
          </div>
          <h2 className="text-2xl md:text-4xl font-extrabold text-white uppercase tracking-tighter leading-tight mb-4">
            A sua Arena mais Inteligente Começa Aqui.
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm font-medium mb-8 max-w-lg">
            O iTatame é a solução líder para profissionalizar competições e acabar com o retrabalho.
          </p>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all hover:bg-red-500 hover:-translate-y-0.5">
            Falar com um Consultor <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </section>

          </main>
  );
}

function Header({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-xl">
      <p className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-red-500 flex items-center gap-1.5">
        <span className="w-2 h-[1px] bg-red-500 block"></span> {eyebrow}
      </p>
      <h2 className="text-xl font-extrabold uppercase leading-tight tracking-tight text-white md:text-3xl">{title}</h2>
      <p className="mt-2.5 text-xs leading-relaxed text-zinc-400 font-medium">{text}</p>
    </div>
  );
}

function Metric({ value, label, tone }: { value: string; label: string; tone: "red" | "yellow" | "cyan" | "green" }) {
  const toneClass = tone === "red" ? "text-red-400 border-red-500/20 bg-red-500/5" : tone === "yellow" ? "text-yellow-400 border-yellow-500/20 bg-yellow-500/5" : tone === "cyan" ? "text-cyan-400 border-cyan-500/20 bg-cyan-500/5" : "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
  return (
    <div className={"rounded-xl border p-3 flex flex-col items-center justify-center text-center backdrop-blur-sm " + toneClass}>
      <p className="text-lg md:text-xl font-extrabold uppercase text-white">{value}</p>
      <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.1em] opacity-80">{label}</p>
    </div>
  );
}

function Feature({ icon, title, items, highlight = false }: { icon: React.ReactNode; title: string; items: string[]; highlight?: boolean }) {
  return (
    <div className={(highlight ? "border-red-500/30 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.1)]" : "border-white/5 bg-white/[0.01]") + " rounded-2xl border p-5 backdrop-blur-sm group hover:border-white/10 transition-colors"}>
      <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-lg ${highlight ? 'bg-red-500 text-white' : 'bg-[#1a1a1f] text-zinc-300 border border-white/5 group-hover:scale-110 transition-transform'}`}>
        {icon}
      </div>
      <h3 className="text-sm font-extrabold uppercase tracking-tight text-white mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[11px] text-zinc-400 font-medium">
            <CheckCircle2 size={12} className={highlight ? 'text-red-400' : 'text-zinc-600'} /> {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Step({ number, icon, title, text }: { number: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="relative text-center flex flex-col items-center z-10 group">
      <div className="w-10 h-10 rounded-xl bg-[#0a0a0e] border border-white/10 flex items-center justify-center text-zinc-400 mb-3 relative group-hover:border-red-500/50 transition-colors shadow-sm">
        {icon}
        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 border-[2px] border-[#020202] flex items-center justify-center text-white font-black text-[7px]">{number}</div>
      </div>
      <h4 className="text-xs font-extrabold uppercase text-white mb-1">{title}</h4>
      <p className="text-[10px] text-zinc-500 leading-relaxed font-medium px-2">{text}</p>
    </div>
  );
}

function Preview({ title, tag, accent, children }: { title: string; tag: string; accent: "red" | "yellow" | "cyan" | "green" | "blue"; children: React.ReactNode }) {
  const accentClass = accent === "yellow" ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" : accent === "cyan" ? "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" : accent === "green" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : accent === "blue" ? "text-blue-400 border-blue-500/30 bg-blue-500/10" : "text-red-400 border-red-500/30 bg-red-500/10";
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-3 md:p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold uppercase tracking-tight text-white">{title}</h3>
        <span className={"rounded-md border px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.1em] " + accentClass}>{tag}</span>
      </div>
      {children}
    </div>
  );
}

// MOCKS EXTREMAMENTE COMPACTOS
function OrganizerMock() {
  return (
    <div className="rounded-xl border border-white/5 bg-[#050505] p-3 shadow-inner">
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        <MockMetric label="Inscritos" value="381" />
        <MockMetric label="Pagas" value="315" tone="green" />
        <MockMetric label="Renda" value="R$ 31k" tone="yellow" />
      </div>
      <div className="space-y-1.5">
        {["Mundial No-Gi", "Open Regional"].map((name, i) => (
          <div key={name} className="flex items-center justify-between rounded-lg bg-white/5 p-2 border border-white/5">
            <div><p className="text-[11px] font-extrabold text-white uppercase">{name}</p><p className="text-[8px] text-zinc-600 font-bold uppercase mt-0.5">{i === 0 ? "Abertas" : "Checagem"}</p></div>
            <span className="rounded bg-red-500 text-[8px] font-extrabold uppercase text-white px-2 py-1">Gerir</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffMock() {
  return (
    <div className="rounded-xl border border-white/5 bg-[#050505] p-3 shadow-inner">
      <div className="mb-2.5 flex items-center justify-between border-b border-white/5 pb-2">
        <p className="text-[9px] font-extrabold uppercase tracking-widest text-cyan-300">Tatame 1</p>
        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[7px] font-extrabold uppercase text-emerald-300 border border-emerald-500/30 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span> Online</span>
      </div>
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
        <p className="text-[8px] font-extrabold uppercase text-cyan-400 mb-1 pl-1">Semifinal</p>
        <div className="flex items-center justify-between bg-black/40 p-2 rounded border border-white/5">
          <strong className="text-[10px] font-extrabold uppercase text-white truncate">A. Costa</strong>
          <span className="text-[8px] text-zinc-600 font-black">VS</span>
          <strong className="text-[10px] font-extrabold uppercase text-white truncate">J. Vitor</strong>
        </div>
      </div>
    </div>
  );
}

function LiveMock() {
  return (
    <div className="rounded-xl border border-white/5 bg-[#050505] p-3 shadow-inner">
      <div className="mb-2.5 flex items-center justify-between border-b border-white/5 pb-2">
        <p className="text-[9px] font-extrabold uppercase text-white flex items-center gap-1.5"><Radio size={10} className="text-red-500"/> Transmissão</p>
        <span className="rounded bg-red-500 px-2 py-0.5 text-[7px] font-extrabold text-white uppercase tracking-widest">Tatame 2</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg bg-white/5 p-2 text-center border border-white/5">
        <div><p className="text-[11px] font-extrabold uppercase text-blue-400">André</p></div>
        <div className="bg-black/80 px-2.5 py-1 rounded border border-white/10 shadow-inner"><p className="text-sm font-black text-white">2 x 0</p></div>
        <div><p className="text-[11px] font-extrabold uppercase text-red-400">Felipe</p></div>
      </div>
      <div className="mt-2 rounded border border-zinc-800 bg-black p-1.5 text-[8px] font-bold text-zinc-500 uppercase text-center flex items-center justify-center gap-1.5">
        <Clock size={10}/> D. Matias x A. Rocha
      </div>
    </div>
  );
}

function AthleteMock() {
  return (
    <div className="rounded-xl border border-white/5 bg-[#050505] p-3 shadow-inner">
      <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/20 text-sm font-black text-blue-200 border border-blue-500/30">C</div><div><p className="text-xs font-extrabold uppercase text-white">Cauã Martins</p><p className="text-[8px] uppercase font-bold text-zinc-600 tracking-widest mt-0.5">Azul • Médio</p></div></div>
      <div className="mt-3 grid grid-cols-2 gap-1.5"><MockMetric label="Alertas" value="ativo" tone="cyan" /><MockMetric label="Acesso" value="QR" tone="green" /></div>
    </div>
  );
}

function MockMetric({ label, value, tone = "red" }: { label: string; value: string; tone?: "red" | "green" | "yellow" | "cyan" }) {
  const color = tone === "green" ? "text-emerald-400" : tone === "yellow" ? "text-yellow-400" : tone === "cyan" ? "text-cyan-400" : "text-white";
  return (
    <div className="rounded-lg border border-white/5 bg-black p-2 flex flex-col items-center justify-center text-center">
      <p className={"text-xs font-extrabold uppercase " + color}>{value}</p>
      <p className="mt-0.5 text-[7px] font-extrabold uppercase tracking-widest text-zinc-600">{label}</p>
    </div>
  );
}