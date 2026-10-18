'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

type Medidas = { largura: number; altura: number; janela: number };
type Ancora = { x: number; y: number; telaX: number; telaY: number };

export default function VisorArvoreMobile({ children, chave }: { children: ReactNode; chave: string }) {
  const visor = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const ancora = useRef<Ancora | null>(null);
  const [medidas, setMedidas] = useState<Medidas>({ largura: 0, altura: 0, janela: 0 });
  const [zoomManual, setZoomManual] = useState<number | null>(null);
  const ajuste = medidas.largura > 0 ? Math.min(1, Math.max(1, medidas.janela - 16) / medidas.largura) : 1;
  const zoom = zoomManual === null ? ajuste : Math.max(ajuste, Math.min(3, zoomManual));
  const larguraPalco = Math.max(medidas.janela, medidas.largura * zoom + 16);
  const margem = (larguraPalco - medidas.largura * zoom) / 2;
  const estado = useRef({ zoom, ajuste, margem });
  estado.current = { zoom, ajuste, margem };

  useLayoutEffect(() => {
    const elemento = visor.current;
    const desenho = conteudo.current;
    if (!elemento || !desenho) return;
    const medir = () => {
      const proxima = { largura: desenho.offsetWidth, altura: desenho.offsetHeight, janela: elemento.clientWidth };
      if (!proxima.janela || !proxima.largura) return;
      setMedidas(atual => atual.largura === proxima.largura && atual.altura === proxima.altura && atual.janela === proxima.janela ? atual : proxima);
    };
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    observador.observe(desenho);
    medir();
    return () => observador.disconnect();
  }, []);

  useLayoutEffect(() => {
    setZoomManual(null);
    ancora.current = null;
    visor.current?.scrollTo({ left: 0, top: 0 });
  }, [chave]);

  useLayoutEffect(() => {
    const elemento = visor.current;
    const ponto = ancora.current;
    if (!elemento || !ponto) return;
    elemento.scrollLeft = ponto.x * zoom + margem - ponto.telaX;
    elemento.scrollTop = ponto.y * zoom + 8 - ponto.telaY;
    ancora.current = null;
  }, [zoom, margem]);

  useEffect(() => {
    const elemento = visor.current;
    if (!elemento) return;
    let gesto: { distancia: number; zoom: number; x: number; y: number } | null = null;
    const pontos = (toques: TouchList) => {
      const a = toques[0], b = toques[1];
      const caixa = elemento.getBoundingClientRect();
      return { distancia: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), telaX: (a.clientX + b.clientX) / 2 - caixa.left, telaY: (a.clientY + b.clientY) / 2 - caixa.top };
    };
    const iniciar = (evento: TouchEvent) => {
      if (evento.touches.length !== 2) return;
      evento.preventDefault();
      const p = pontos(evento.touches), atual = estado.current;
      gesto = { distancia: Math.max(1, p.distancia), zoom: atual.zoom, x: (elemento.scrollLeft + p.telaX - atual.margem) / atual.zoom, y: (elemento.scrollTop + p.telaY - 8) / atual.zoom };
    };
    const mover = (evento: TouchEvent) => {
      if (!gesto || evento.touches.length !== 2) return;
      evento.preventDefault();
      const p = pontos(evento.touches);
      ancora.current = { x: gesto.x, y: gesto.y, telaX: p.telaX, telaY: p.telaY };
      setZoomManual(Math.max(estado.current.ajuste, Math.min(3, gesto.zoom * p.distancia / gesto.distancia)));
    };
    const terminar = () => { gesto = null; };
    elemento.addEventListener('touchstart', iniciar, { passive: false });
    elemento.addEventListener('touchmove', mover, { passive: false });
    elemento.addEventListener('touchend', terminar);
    elemento.addEventListener('touchcancel', terminar);
    return () => {
      elemento.removeEventListener('touchstart', iniciar);
      elemento.removeEventListener('touchmove', mover);
      elemento.removeEventListener('touchend', terminar);
      elemento.removeEventListener('touchcancel', terminar);
    };
  }, []);

  function alterarZoom(fator: number) {
    const elemento = visor.current;
    if (!elemento) return;
    const telaX = elemento.clientWidth / 2, telaY = elemento.clientHeight / 2;
    ancora.current = { x: (elemento.scrollLeft + telaX - margem) / zoom, y: (elemento.scrollTop + telaY - 8) / zoom, telaX, telaY };
    setZoomManual(Math.max(ajuste, Math.min(3, zoom * fator)));
  }

  function enquadrar() {
    ancora.current = null;
    setZoomManual(null);
    visor.current?.scrollTo({ left: 0, top: 0 });
  }

  return <section aria-label="Árvore da chave no celular" className="w-full min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#050816] shadow-xl md:hidden">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Árvore da chave</p>
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1">
        <button type="button" aria-label="Diminuir zoom da chave" onClick={() => alterarZoom(1 / 1.35)} className="h-10 w-10 rounded-full text-xl font-bold text-white">−</button>
        <button type="button" aria-label="Enquadrar chave inteira" onClick={enquadrar} className="min-h-10 rounded-full px-2 text-center text-white"><strong className="block text-[11px]">{medidas.largura ? Math.round(zoom * 100) + '%' : '…'}</strong><span className="block text-[8px] uppercase tracking-wider text-cyan-300">Enquadrar</span></button>
        <button type="button" aria-label="Aumentar zoom da chave" onClick={() => alterarZoom(1.35)} className="h-10 w-10 rounded-full text-xl font-bold text-white">+</button>
      </div>
    </div>
    <p className="px-3 pt-2 text-[10px] leading-relaxed text-zinc-400">Amplie com dois dedos e arraste para acompanhar a chave.</p>
    <div ref={visor} tabIndex={0} aria-label="Chave ampliável; arraste para navegar" className="relative w-full overflow-auto overscroll-contain" style={{ height: Math.max(220, Math.min(560, medidas.altura * ajuste + 16)), maxHeight: '65svh', touchAction: 'pan-x pan-y' }}>
      <div className="relative" style={{ width: larguraPalco, height: medidas.altura * zoom + 16 }}>
        <div ref={conteudo} className="absolute left-0 top-0 flex w-max flex-col items-center px-2 py-4" style={{ transform: `translate(${margem}px, 8px) scale(${zoom})`, transformOrigin: 'top left', visibility: medidas.largura ? 'visible' : 'hidden' }}>{children}</div>
      </div>
    </div>
  </section>;
}
