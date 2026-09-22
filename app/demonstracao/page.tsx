"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

const whatsappLink = "https://wa.me/5565993059729?text=Olá!%20Quero%20montar%20meu%20campeonato%20no%20iTatame.";
const chavePublica = "https://www.itatame.com.br";

const paradas = [
  { id: "aviso", nome: "Aviso", detalhe: "Chega no celular", hora: "Antes da chamada" },
  { id: "pesagem", nome: "Pesagem", detalhe: "Quem entra na chave", hora: "Manhã" },
  { id: "chave", nome: "Chave", detalhe: "Os dois lados até a final", hora: "Antes de chamar" },
  { id: "tatame", nome: "Tatame", detalhe: "Chamada e placar", hora: "A luta" },
  { id: "telao", nome: "Telão", detalhe: "Lutas ao vivo na TV", hora: "Na arena" },
  { id: "podio", nome: "Pódio", detalhe: "Ranking no mesmo dia", hora: "Antes de ir embora" },
] as const;

type ParadaId = (typeof paradas)[number]["id"];

export default function DemonstracaoPage() {
  const [ativa, setAtiva] = useState<ParadaId>("inscricao");

  useEffect(() => {
    const alvos = paradas
      .map((parada) => document.getElementById(parada.id))
      .filter((nodo): nodo is HTMLElement => Boolean(nodo));
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas
          .filter((entrada) => entrada.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visivel?.target.id as ParadaId | undefined;
        if (id) setAtiva(id);
      },
      { rootMargin: "-28% 0px -48% 0px", threshold: [0.25, 0.5, 0.75] },
    );
    alvos.forEach((nodo) => observador.observe(nodo));
    return () => observador.disconnect();
  }, []);

  function irPara(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const indiceAtivo = Math.max(0, paradas.findIndex((parada) => parada.id === ativa));

  return (
    <div className="relative overflow-x-hidden bg-[#07080b] text-white [font-family:var(--font-geist-sans),Arial,sans-serif]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.16),transparent_58%)]" />

      <header className="relative mx-auto grid max-w-6xl items-end gap-10 px-5 pb-8 pt-8 md:px-8 md:pt-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            <span className="inline-flex -skew-x-12">
              <span className="h-3 w-1.5 bg-red-600" />
              <span className="ml-0.5 h-3 w-1.5 bg-white" />
            </span>
            Para quem organiza o campeonato
          </div>
          <h1 className="mt-5 max-w-xl text-[2.6rem] font-black leading-[0.92] tracking-tight md:text-6xl">
            O celular avisa a luta. A TV mostra o placar.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-zinc-300 md:text-lg">
            Quando a luta se aproxima, o atleta recebe a mensagem com o adversário e o tatame. Na arena, o telão acompanha os placares ao vivo. Você vê quem pesou, quem está lutando e quem somou ponto para a equipe.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center rounded-full bg-red-600 px-6 text-sm font-bold text-white transition hover:bg-red-500">
              Montar o meu evento
            </a>
            <button type="button" onClick={() => irPara("aviso")} className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-zinc-200 transition hover:border-white/40">
              Ver como o dia anda
            </button>
          </div>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-zinc-500">
            Jiu-jitsu, no-gi e judô. Um tatame ou vários. A mesma mesa, do primeiro lote ao último ouro.
          </p>
        </div>

        <MonitorArena />
      </header>

      <div className="sticky top-[60px] z-30 border-y border-white/10 bg-[#07080b]/90 backdrop-blur-md md:top-[65px] xl:hidden">
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {paradas.map((parada, indice) => (
            <button
              key={parada.id}
              type="button"
              onClick={() => irPara(parada.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${ativa === parada.id ? "border-red-500 bg-red-600 text-white" : "border-white/10 text-zinc-400"}`}
            >
              0{indice + 1} {parada.nome}
            </button>
          ))}
        </div>
        <div className="h-px bg-white/10">
          <div className="h-px bg-red-500 transition-all duration-500" style={{ width: `${((indiceAtivo + 1) / paradas.length) * 100}%` }} />
        </div>
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-8 px-5 pb-24 md:px-8 xl:grid-cols-[210px_1fr] xl:gap-12">
        <nav aria-label="O dia do campeonato" className="sticky top-24 hidden h-fit xl:block">
          <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">O dia</p>
          <ol className="relative space-y-1 border-l border-white/10">
            {paradas.map((parada, indice) => {
              const ligada = ativa === parada.id;
              const passou = indice < indiceAtivo;
              return (
                <li key={parada.id}>
                  <button type="button" onClick={() => irPara(parada.id)} className="group relative block w-full py-2.5 pl-5 text-left">
                    <span className={`absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full border ${ligada ? "border-red-400 bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.85)]" : passou ? "border-red-900 bg-red-800" : "border-zinc-700 bg-[#07080b]"}`} />
                    <span className={`font-mono text-[10px] font-bold tracking-[0.16em] ${ligada ? "text-red-400" : "text-zinc-600"}`}>{parada.hora}</span>
                    <span className={`mt-0.5 block text-sm font-bold ${ligada ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"}`}>{parada.nome}</span>
                    <span className="block text-xs text-zinc-600">{parada.detalhe}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="space-y-16 pt-8 xl:pt-12">
          <Cena id="aviso" kicker="O aviso" titulo="O celular avisa antes de chamarem o nome no microfone.">
            <p>
              A mesa chama e a mensagem chega na hora: o nome do atleta, o adversário e o tatame. Antes disso, outro aviso diz quantas lutas faltam e o horário previsto. O chamador manda a chamada da categoria. A pessoa levanta da cadeira sem ficar perguntando na mesa.
            </p>
            <AvisosNoCelular />
          </Cena>

          <Cena id="pesagem" kicker="A balança" titulo="Quem não passou na checagem não aparece na chave." invertida>
            <p>
              Peso, kimono e presença ficam na mesma lista, com a equipe do lado do nome. A chave nasce depois disso. Desclassificado não vira luta fantasma no tatame, nem W.O. que você não pediu.
            </p>
            <ListaChecagem />
          </Cena>

          <Cena id="chave" kicker="A árvore" titulo="Os dois lados caminham até o centro.">
            <p>
              Atleta da mesma equipe cai em lados opostos. Chave de três tem baia de verdade. Até 32, a árvore fica inteira na tela. De 33 a 64, abre em 1/4, 2/4, 3/4 e 4/4. Passou de 64, viram Chave 1 e Chave 2. Ninguém fica de fora, no peso e no absoluto.
            </p>
            <ArvoreExemplo />
          </Cena>

          <Cena id="tatame" kicker="A mesa" titulo="Cada mesário só vê o tatame que é dele." invertida>
            <p>
              O acesso da mesa é o nome da área. Se a luta está no Tatame 1, a identificação é Tatame 1. Com chamador na arena, a luta espera a chamada. Na hora de chamar, o aviso sai para o celular dos dois atletas e para quem está na fila.
            </p>
            <Mesas />
          </Cena>

          <Cena id="telao" kicker="O telão" titulo="A arquibancada vê a luta sem levantar da cadeira.">
            <p>
              A TV da arena mostra os tatames juntos, com o placar subindo na hora. A faixa de cima chama quem precisa se apresentar. Quando a luta acaba, o resultado entra na tela. Se o tatame para, o QR das chaves fica para a arquibancada apontar o celular.
            </p>
            <TelaoArena />
          </Cena>

          <Cena id="podio" kicker="O ouro" titulo="A equipe já sabe a pontuação antes de desmontar a arena.">
            <p>
              Ranking de atleta e de equipe, com a logo. Peso e absoluto ficam separados quando o edital não pontua o absoluto. O resultado continua no ar depois que a luz apaga.
            </p>
            <Podio />
          </Cena>

          <section className="grid gap-px overflow-hidden rounded-[28px] border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Atleta", "Recebe o aviso no celular, sobe no tatame e acompanha a chave."],
              ["Professor", "Vê a equipe inteira e o caminho de cada aluno até a final."],
              ["Organizador", "Controla vaga, lote, categoria, absoluto e o dia da arena."],
              ["Mesa", "Chama, anota o placar e fecha o resultado na hora."],
            ].map(([papel, frase]) => (
              <div key={papel} className="bg-[#0c0e13] px-5 py-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">{papel}</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{frase}</p>
              </div>
            ))}
          </section>

          <section className="relative overflow-hidden rounded-[28px] border border-red-500/25 bg-[#12090c] px-6 py-10 md:px-10">
            <div className="pointer-events-none absolute -right-8 top-0 h-40 w-16 -skew-x-12 bg-red-600/20" />
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-red-300">Próximo campeonato</p>
            <h2 className="mt-3 max-w-xl text-3xl font-black leading-[1.02] tracking-tight md:text-5xl">Me conta o tamanho do evento. Eu te devolvo como o dia fica.</h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-zinc-300">
              Quantos atletas, quantos tatames, se tem absoluto. A gente olha categoria, pesagem e a ordem das lutas com você.
            </p>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-black transition hover:bg-zinc-200">
              Chamar no WhatsApp
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}

function Cena({ id, kicker, titulo, invertida = false, children }: { id: string; kicker: string; titulo: string; invertida?: boolean; children: React.ReactNode }) {
  const [texto, painel] = Array.isArray(children) ? children : [children, null];
  return (
    <section id={id} className="scroll-mt-32">
      <div className={`grid items-center gap-8 lg:grid-cols-2 ${invertida ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-red-400">{kicker}</p>
          <h2 className="mt-2 text-3xl font-black leading-[1.02] tracking-tight md:text-4xl">{titulo}</h2>
          <div className="mt-4 max-w-md text-sm leading-relaxed text-zinc-300 md:text-base">{texto}</div>
        </div>
        <Moldura>{painel}</Moldura>
      </div>
    </section>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-[28px] border border-white/10 bg-[#0c0e13] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <span className="pointer-events-none absolute left-3 top-3 h-3 w-3 border-l border-t border-white/30" />
      <span className="pointer-events-none absolute right-3 top-3 h-3 w-3 border-r border-t border-white/30" />
      <span className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 border-b border-l border-white/30" />
      <span className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 border-b border-r border-white/30" />
      {children}
    </div>
  );
}

function MonitorArena() {
  return (
    <aside className="rounded-[28px] border border-white/10 bg-[#0c0e13] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Tela da arena</p>
        <p className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
          <RelogioArena />
        </p>
      </div>
      <div className="rounded-2xl bg-black px-4 py-4">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
          <span>Tatame 1</span>
          <span>Semifinal · Leve</span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
          <div>
            <p className="text-lg font-black leading-none">Helena Souza</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Spartan</p>
          </div>
          <p className="font-mono text-4xl font-black leading-none text-white">2</p>
        </div>
        <div className="my-3 h-px bg-white/10" />
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <div>
            <p className="text-lg font-black leading-none text-zinc-300">Lara Mendes</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-zinc-600">Alliance</p>
          </div>
          <p className="font-mono text-4xl font-black leading-none text-zinc-500">0</p>
        </div>
      </div>
      <p className="px-1 pt-3 text-xs leading-relaxed text-zinc-500">Exemplo. No seu evento, os nomes são os atletas que se inscreveram.</p>
    </aside>
  );
}

function RelogioArena() {
  const [texto, setTexto] = useState("--:--");
  useEffect(() => {
    const marcar = () => setTexto(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    marcar();
    const id = window.setInterval(marcar, 10000);
    return () => window.clearInterval(id);
  }, []);
  return <span>{texto}</span>;
}

function AvisosNoCelular() {
  const avisos = [
    {
      hora: "agora",
      titulo: "Sua luta foi chamada",
      texto: "Helena, sua luta contra Lara Mendes foi chamada. Compareça agora ao Tatame 1.",
      tom: "chamada",
    },
    {
      hora: "há 6 min",
      titulo: "Prepare-se para lutar",
      texto: "Helena, você é a próxima luta no Tatame 1. Tempo aproximado: 8 minutos. Previsão: 10:42.",
      tom: "fila",
    },
    {
      hora: "há 12 min",
      titulo: "1ª chamada da categoria",
      texto: "Helena, apresente-se ao chamador para Leve · faixa verde.",
      tom: "categoria",
    },
  ] as const;
  return (
    <div className="rounded-[24px] bg-black px-4 py-5">
      <div className="mb-4 flex items-center justify-between px-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Celular da Helena</p>
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600">Spartan Open</p>
      </div>
      <ul className="space-y-2">
        {avisos.map((aviso) => (
          <li key={aviso.titulo} className="rounded-2xl border border-white/10 bg-[#101218] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${aviso.tom === "chamada" ? "text-red-300" : aviso.tom === "fila" ? "text-yellow-200" : "text-zinc-400"}`}>{aviso.titulo}</p>
              <span className="shrink-0 font-mono text-[10px] text-zinc-600">{aviso.hora}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">{aviso.texto}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListaChecagem() {
  const linhas = [
    ["Helena Souza", "Spartan", "Pesou", "ok"],
    ["Pedro Lima", "Alliance", "Acima do peso", "fora"],
    ["Ana Cruz", "CheckMat", "Kimono", "fora"],
    ["Lucas Prado", "Gracie", "Aguardando", "espera"],
  ] as const;
  return (
    <div className="overflow-hidden rounded-2xl bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <p className="text-sm font-bold">Checagem · Leve</p>
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">Antes da chave</p>
      </div>
      <ul>
        {linhas.map(([nome, equipe, estado, tipo]) => (
          <li key={nome} className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-3 last:border-0">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${tipo === "ok" ? "bg-emerald-500/15 text-emerald-300" : tipo === "fora" ? "bg-red-500/15 text-red-300" : "bg-white/5 text-zinc-400"}`}>
                {equipe.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{nome}</p>
                <p className="text-xs text-zinc-500">{equipe}</p>
              </div>
            </div>
            <span className={`shrink-0 text-[11px] font-bold ${tipo === "ok" ? "text-emerald-300" : tipo === "fora" ? "text-red-300" : "text-zinc-500"}`}>{estado}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArvoreExemplo() {
  return (
    <div className="rounded-2xl bg-[#07080b] p-4">
      <div className="mb-4 flex items-center justify-between px-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Leve · faixa verde</p>
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">Árvore inteira</p>
      </div>
      <div className="grid grid-cols-[1fr_88px_1fr] items-center gap-2">
        <Lado lutas={[["Helena", "Duda"], ["Lara", "Bia"]]} avancos={["Helena", "Lara"]} rotulo="Quartas" />
        <div className="rounded-2xl border border-red-500/40 bg-black px-2 py-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Final</p>
          <p className="mt-2 text-xs font-black text-emerald-300">Helena</p>
          <p className="my-1 text-[10px] text-zinc-600">vs</p>
          <p className="text-xs font-bold text-zinc-300">Lara</p>
        </div>
        <Lado reverso lutas={[["Caio", "Igor"], ["Enzo", "Raul"]]} avancos={["Caio", "Enzo"]} rotulo="Quartas" />
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        <span className="rounded-full border border-white/10 px-2 py-1">Até 32 · tela inteira</span>
        <span className="rounded-full border border-white/10 px-2 py-1">33–64 · 1/4 a 4/4</span>
        <span className="rounded-full border border-white/10 px-2 py-1">+64 · Chave 1 e 2</span>
      </div>
    </div>
  );
}

function Lado({ lutas, avancos, reverso = false, rotulo }: { lutas: [string, string][]; avancos: string[]; reverso?: boolean; rotulo: string }) {
  return (
    <div className={reverso ? "text-right" : ""}>
      <p className="mb-2 px-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">{rotulo}</p>
      <div className="space-y-2">
        {lutas.map(([a, b]) => (
          <div key={a} className="rounded-xl border border-white/10 bg-black/80 px-2.5 py-2">
            <p className={`text-[11px] font-bold ${avancos.includes(a) ? "text-emerald-300" : "text-zinc-500"}`}>{a}</p>
            <p className={`text-[11px] font-bold ${avancos.includes(b) ? "text-emerald-300" : "text-zinc-500"}`}>{b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelaoArena() {
  return (
    <div className="overflow-hidden rounded-2xl bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">Ao vivo</span>
        <p className="truncate px-3 text-sm font-black tracking-tight">Spartan Open</p>
        <RelogioArena />
      </div>
      <div className="flex items-center gap-2 border-b border-yellow-500/20 bg-yellow-500/10 px-4 py-2">
        <span className="shrink-0 rounded bg-yellow-400 px-1.5 py-0.5 text-[10px] font-black uppercase text-black">Chamada</span>
        <p className="truncate text-xs font-bold text-yellow-100">Helena Souza e Lara Mendes · Tatame 1</p>
      </div>
      <div className="grid gap-px bg-white/10 sm:grid-cols-2">
        <PlacarTelao tatame="Tatame 1" categoria="Semifinal · Leve" a="Helena Souza" equipeA="Spartan" pontosA="2" b="Lara Mendes" equipeB="Alliance" pontosB="0" ativo />
        <PlacarTelao tatame="Tatame 2" categoria="Quartas · Médio" a="Caio Nunes" equipeA="Gracie" pontosA="0" b="Enzo Ribeiro" equipeB="CheckMat" pontosB="1" />
      </div>
    </div>
  );
}

function PlacarTelao({ tatame, categoria, a, equipeA, pontosA, b, equipeB, pontosB, ativo = false }: { tatame: string; categoria: string; a: string; equipeA: string; pontosA: string; b: string; equipeB: string; pontosB: string; ativo?: boolean }) {
  return (
    <article className="bg-black px-4 py-4">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        <span className={ativo ? "text-red-300" : ""}>{tatame}</span>
        <span>{categoria}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{a}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{equipeA}</p>
        </div>
        <p className="font-mono text-3xl font-black leading-none">{pontosA}</p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-zinc-300">{b}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{equipeB}</p>
        </div>
        <p className="font-mono text-3xl font-black leading-none text-zinc-400">{pontosB}</p>
      </div>
    </article>
  );
}

function Mesas() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <article className="rounded-2xl bg-black p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-red-400">Tatame 1</p>
          <span className="text-[11px] font-bold text-red-300">Lutando</span>
        </div>
        <p className="mt-4 text-sm font-black">Helena Souza</p>
        <p className="text-[11px] uppercase tracking-widest text-zinc-500">Spartan</p>
        <p className="my-3 text-center font-mono text-3xl font-black tracking-tight">2 <span className="text-zinc-600">×</span> 0</p>
        <p className="text-sm font-black">Lara Mendes</p>
        <p className="text-[11px] uppercase tracking-widest text-zinc-500">Alliance</p>
        <p className="mt-4 text-xs text-zinc-500">Chamador liberou. A mesa está anotando.</p>
      </article>
      <article className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black px-4 py-5 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Tatame 2 · parado</p>
        <div className="mt-4 rounded-xl bg-white p-2">
          <QRCode value={chavePublica} size={84} bgColor="#ffffff" fgColor="#111111" />
        </div>
        <p className="mt-3 text-sm font-bold">QR das chaves na TV</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">A arquibancada aponta o celular e acha o atleta.</p>
      </article>
    </div>
  );
}

function Podio() {
  const lugares = [
    ["1", "Helena Souza", "Spartan", "ouro"],
    ["2", "Lara Mendes", "Alliance", "prata"],
    ["3", "Caio Nunes", "Gracie", "bronze"],
  ] as const;
  return (
    <div className="rounded-2xl bg-black p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Leve · faixa verde</p>
      <ul className="mt-4 space-y-2">
        {lugares.map(([lugar, nome, equipe, medalha]) => (
          <li key={lugar} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm font-black ${medalha === "ouro" ? "bg-yellow-400 text-black" : "bg-white/10 text-zinc-300"}`}>{lugar}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{nome}</p>
              <p className="text-[11px] uppercase tracking-widest text-zinc-500">{equipe}</p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{medalha}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Equipes</p>
          <p className="text-sm font-black">Spartan · 18 pts</p>
        </div>
        <p className="text-xs text-zinc-400">Alliance 11 · Gracie 7</p>
      </div>
    </div>
  );
}

