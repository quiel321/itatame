'use client';

import { lutasFormamChaveDeSeis, lutasFormamChaveDeTres, placeholderSlotChaveDeTres } from '@/app/lib/chave-de-tres';
import { idsPrimeiraFasePorLado } from '@/app/lib/chave-visual';

export type LutaArvore = {
  id?: string | number;
  id_visual?: string | number | null;
  fase?: string | null;
  atleta_1?: string | null;
  atleta_2?: string | null;
  atleta_1_id?: number | null;
  atleta_2_id?: number | null;
  equipe_1?: string | null;
  equipe_2?: string | null;
  numero_1?: string | null;
  numero_2?: string | null;
  proxima_luta?: string | number | null;
  vencedor?: string | null;
  vencedor_id?: number | null;
  status_luta?: string | null;
  horario_estimado?: string | null;
  tatame?: string | null;
};

type AtletaSlot = {
  nome: string;
  equipe: string;
  numero?: string | null;
  foto: string | null;
  horario?: string | null;
  status?: string | null;
  tatame?: string | null;
  venceu?: boolean;
  placeholder?: boolean;
  onAvancar?: ((...args: unknown[]) => void) | undefined;
  luta_id?: string | number | null;
  id_banco?: string | number;
};

function formatarHorario(isoString?: string | null) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fantasma(nome?: string | null) {
  const limpo = String(nome || '').trim().toUpperCase();
  return !limpo || limpo === 'BYE' || limpo === 'TBD' || limpo.includes('SEM OPONENTE');
}

function Atleta({
  nome,
  equipe,
  numero,
  foto,
  reverso = false,
  centralizado = false,
  ocultarLinha = false,
  larguraClass = 'w-[100px] md:w-[140px]',
  campeao = false,
  horario,
  status,
  tatame,
  venceu = false,
  placeholder = false,
  destaque = false,
  onAvancar,
  luta_id,
  id_banco,
}: AtletaSlot & {
  reverso?: boolean;
  centralizado?: boolean;
  ocultarLinha?: boolean;
  larguraClass?: string;
  campeao?: boolean;
  destaque?: boolean;
}) {
  const podeClicar = Boolean(onAvancar && nome && !placeholder);
  const anel = destaque ? 'ring-2 ring-yellow-400/80' : '';

  if (campeao) {
    return (
      <div
        onClick={() => podeClicar && onAvancar?.(id_banco, luta_id, nome, equipe)}
        className={`relative flex w-full flex-col items-center justify-center gap-1.5 py-2 ${podeClicar ? 'cursor-pointer hover:scale-105' : ''}`}
      >
        <div className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-yellow-500 bg-black shadow-[0_0_20px_rgba(234,179,8,0.5)] md:h-[70px] md:w-[70px] ${anel}`}>
          {foto && !placeholder ? <img src={foto} alt={nome} className="h-full w-full object-cover" /> : (
            <svg className="h-6 w-6 text-yellow-600 md:h-10 md:w-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
          )}
        </div>
        <span className="w-full truncate px-1 text-center text-[10px] font-black uppercase text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.6)] md:text-[12px]">
          {nome || 'A definir'}
        </span>
        <span className="w-full truncate px-1 text-center text-[9px] font-bold uppercase text-yellow-600/80 md:text-[11px]">{equipe}</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => podeClicar && onAvancar?.(id_banco, luta_id, nome, equipe)}
      className={`group relative h-[60px] flex-shrink-0 ${larguraClass} ${podeClicar ? 'z-20 cursor-pointer hover:scale-105' : ''}`}
    >
      {!centralizado && (
        <div className={`absolute top-[12px] z-10 hidden h-[36px] w-[36px] items-center justify-center overflow-hidden rounded-full border bg-[#0a0a0e] transition-transform group-hover:scale-110 md:flex ${venceu ? 'border-green-400' : placeholder ? 'border-cyan-500/40' : 'border-zinc-700 group-hover:border-cyan-500/50'} ${reverso ? 'right-0' : 'left-0'} ${anel}`}>
          {foto && !placeholder ? <img src={foto} className="h-full w-full object-cover" alt="" /> : (
            <svg className="h-5 w-5 text-zinc-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
          )}
        </div>
      )}
      <div className={`absolute top-[4px] flex items-center md:top-[2px] ${centralizado ? 'left-0 right-0 justify-center' : reverso ? 'left-0 right-0 flex-row-reverse md:left-0 md:right-[48px]' : 'left-0 right-0 flex-row md:left-[48px] md:right-0'}`}>
        {numero && !placeholder && <span className={`text-[9px] font-black text-zinc-600 md:text-[10px] ${reverso ? 'ml-1.5' : 'mr-1.5'}`}>{numero}</span>}
        <span className={`flex-1 truncate text-[10px] font-bold tracking-tight md:text-[13px] ${venceu ? 'text-green-400' : placeholder ? 'text-cyan-300/80 italic' : 'text-[#57d8ff] group-hover:text-white'} ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>
          {nome}
        </span>
      </div>
      {!ocultarLinha && <div className={`absolute top-[30px] border-t transition-colors ${venceu ? 'border-green-500/50' : placeholder ? 'border-dashed border-cyan-500/30' : 'border-zinc-600/70 group-hover:border-[#57d8ff]/50'} ${centralizado ? 'left-0 right-0' : reverso ? 'left-0 right-0 md:left-auto md:right-[48px]' : 'left-0 right-0 md:right-auto md:left-[48px]'}`} />}
      <div className={`absolute top-[34px] flex items-center ${centralizado ? 'left-0 right-0 justify-center' : reverso ? 'left-0 right-0 flex-row-reverse md:left-0 md:right-[48px]' : 'left-0 right-0 flex-row md:left-[48px] md:right-0'}`}>
        <span className={`flex-1 truncate text-[8px] font-medium uppercase md:text-[9.5px] ${placeholder ? 'text-cyan-700' : 'text-zinc-500'} ${centralizado ? 'text-center' : reverso ? 'text-right' : 'text-left'}`}>
          {equipe}
        </span>
      </div>
      {!placeholder && horario && status !== 'concluida' && status !== 'em_andamento' && (
        <div className={`absolute top-[48px] flex items-center ${centralizado ? 'left-0 right-0 justify-center' : reverso ? 'left-0 right-0 flex-row-reverse md:left-0 md:right-[48px]' : 'left-0 right-0 flex-row md:left-[48px] md:right-0'}`}>
          <span className="z-20 flex items-center gap-1 whitespace-nowrap rounded border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-px text-[7px] font-black uppercase tracking-widest text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.1)] md:text-[8px]">
            {formatarHorario(horario)} {tatame && `| ${tatame}`}
          </span>
        </div>
      )}
      {!placeholder && status === 'em_andamento' && (
        <div className={`absolute top-[48px] flex items-center ${centralizado ? 'left-0 right-0 justify-center' : reverso ? 'left-0 right-0 flex-row-reverse md:left-0 md:right-[48px]' : 'left-0 right-0 flex-row md:left-[48px] md:right-0'}`}>
          <span className="z-20 flex animate-pulse cursor-default items-center gap-1 whitespace-nowrap rounded border border-red-500/20 bg-red-500/10 px-1.5 py-px text-[7px] font-black uppercase tracking-widest text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)] md:text-[8px]">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-red-500" /> Lutando agora
          </span>
        </div>
      )}
    </div>
  );
}

function ConectorPequeno({ reverso = false }: { reverso?: boolean }) {
  return (
    <div className="relative h-[80px] w-[12px] flex-shrink-0 md:w-[30px]">
      <div className={`absolute top-0 h-[81px] w-[6px] border-y border-zinc-500 md:w-[15px] ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} />
      <div className={`absolute top-[40px] w-[6px] border-t border-zinc-500 md:w-[15px] ${reverso ? 'left-0' : 'right-0'}`} />
    </div>
  );
}

function ConectorMedio({ reverso = false }: { reverso?: boolean }) {
  return (
    <div className="relative h-[160px] w-[12px] flex-shrink-0 md:w-[30px]">
      <div className={`absolute top-0 h-[161px] w-[6px] border-y border-zinc-500 md:w-[15px] ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} />
      <div className={`absolute top-[80px] w-[6px] border-t border-zinc-500 md:w-[15px] ${reverso ? 'left-0' : 'right-0'}`} />
    </div>
  );
}

function ConectorGrande({ reverso = false }: { reverso?: boolean }) {
  return (
    <div className="relative h-[320px] w-[12px] flex-shrink-0 md:w-[30px]">
      <div className={`absolute top-0 h-[321px] w-[6px] border-y border-zinc-500 md:w-[15px] ${reverso ? 'right-0 border-l' : 'left-0 border-r'}`} />
      <div className={`absolute top-[160px] w-[6px] border-t border-zinc-500 md:w-[15px] ${reverso ? 'left-0' : 'right-0'}`} />
    </div>
  );
}

function achar(lutas: LutaArvore[], id: string) {
  return lutas.find(luta => String(luta.id_visual) === id);
}

function slot(
  luta: LutaArvore | undefined,
  lado: 1 | 2,
  buscarFoto: (id?: number | null) => string | null,
  destaque: string,
  onAvancar?: (...args: unknown[]) => void,
): AtletaSlot {
  if (!luta) return { nome: '', equipe: '', foto: null };
  const bruto = lado === 1 ? luta.atleta_1 : luta.atleta_2;
  const id = lado === 1 ? luta.atleta_1_id : luta.atleta_2_id;
  const real = !fantasma(bruto);
  const nome = real ? String(bruto) : (placeholderSlotChaveDeTres(luta, lado) || '');
  const venceu = real && Boolean(luta.vencedor) && String(luta.vencedor).trim().toUpperCase() === String(bruto).trim().toUpperCase();
  return {
    nome,
    equipe: real ? String((lado === 1 ? luta.equipe_1 : luta.equipe_2) || '') : (nome ? 'Aguardando resultado' : ''),
    numero: real ? (lado === 1 ? luta.numero_1 : luta.numero_2) : '',
    foto: real ? buscarFoto(id) : null,
    horario: luta.horario_estimado,
    status: luta.status_luta,
    tatame: luta.tatame,
    venceu,
    placeholder: !real && Boolean(nome),
    onAvancar,
    luta_id: luta.id_visual,
    id_banco: luta.id,
  };
}

function marcaDestaque(slotAtleta: AtletaSlot, destaque: string) {
  if (!destaque || !slotAtleta.nome) return false;
  return slotAtleta.nome.toUpperCase().includes(destaque.trim().toUpperCase());
}

function CentroFinal({
  final,
  campeao,
  buscarFoto,
  destaque,
  onAvancar,
}: {
  final?: LutaArvore;
  campeao: AtletaSlot;
  buscarFoto: (id?: number | null) => string | null;
  destaque: string;
  onAvancar?: (...args: unknown[]) => void;
}) {
  const a = slot(final, 1, buscarFoto, destaque, onAvancar);
  const b = slot(final, 2, buscarFoto, destaque, onAvancar);
  return (
    <div className="relative mx-0 flex min-h-[480px] w-[160px] shrink-0 flex-col items-center md:w-[170px]">
      <div className="absolute left-[-10px] right-[-10px] top-[310px] z-0 border-t border-zinc-500" />
      <div className="absolute top-[260px] z-10 flex w-full flex-col gap-[10px] rounded-xl border border-zinc-800 bg-[#050816] px-2 py-4 shadow-2xl">
        <span className="mb-1 text-center text-[10px] font-black uppercase tracking-widest text-red-600 md:text-[11px]">Luta final</span>
        <Atleta {...a} larguraClass="w-full" centralizado destaque={marcaDestaque(a, destaque)} />
        <Atleta {...b} larguraClass="w-full" centralizado destaque={marcaDestaque(b, destaque)} />
      </div>
      <div className="absolute top-[75px] z-10 flex w-full flex-col items-center md:top-[80px]">
        <span className="mb-2 text-[12px] font-black tracking-widest text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)] md:text-lg">Campeão</span>
        <div className="flex w-full flex-col items-center rounded-xl border border-yellow-500/50 bg-gradient-to-t from-yellow-500/10 to-black/80 px-2 py-2 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
          <Atleta {...campeao} larguraClass="w-full" centralizado ocultarLinha campeao destaque={marcaDestaque(campeao, destaque)} />
        </div>
      </div>
    </div>
  );
}

function LadoCompacto({
  luta1,
  baia,
  reverso,
  buscarFoto,
  destaque,
  onAvancar,
}: {
  luta1?: LutaArvore;
  baia?: LutaArvore;
  reverso?: boolean;
  buscarFoto: (id?: number | null) => string | null;
  destaque: string;
  onAvancar?: (...args: unknown[]) => void;
}) {
  const slots = [
    slot(luta1, 1, buscarFoto, destaque, onAvancar),
    slot(luta1, 2, buscarFoto, destaque, onAvancar),
    slot(baia, 1, buscarFoto, destaque, onAvancar),
    slot(baia, 2, buscarFoto, destaque, onAvancar),
  ];
  return (
    <div className="flex">
      {!reverso && (
        <>
          <div className="flex flex-col gap-[20px]">
            {slots.map((item, index) => <Atleta key={`e-${index}`} {...item} destaque={marcaDestaque(item, destaque)} />)}
          </div>
          <div className="flex flex-col gap-[80px] pt-[30px]"><ConectorPequeno /><ConectorPequeno /></div>
        </>
      )}
      {reverso && (
        <>
          <div className="flex flex-col gap-[80px] pt-[30px]"><ConectorPequeno reverso /><ConectorPequeno reverso /></div>
          <div className="flex flex-col gap-[20px]">
            {slots.map((item, index) => <Atleta key={`d-${index}`} {...item} reverso destaque={marcaDestaque(item, destaque)} />)}
          </div>
        </>
      )}
    </div>
  );
}

export default function ArvoreChaveDesktop({
  lutas,
  abaAtual = 1,
  totalAbas = 1,
  buscarFoto,
  destaque = '',
  onAvancar,
}: {
  lutas: LutaArvore[];
  abaAtual?: number;
  totalAbas?: number;
  buscarFoto: (id?: number | null) => string | null;
  destaque?: string;
  onAvancar?: (...args: unknown[]) => void;
}) {
  const triangular = lutasFormamChaveDeTres(lutas);
  const seis = lutasFormamChaveDeSeis(lutas);
  const final = achar(lutas, '999') || lutas.find(luta => !luta.proxima_luta);
  const campeaoNome = final?.vencedor && !fantasma(final.vencedor) ? String(final.vencedor) : '';
  const campeao: AtletaSlot = {
    nome: campeaoNome,
    equipe: '',
    foto: buscarFoto(final?.vencedor_id),
    onAvancar,
    luta_id: final?.id_visual,
    id_banco: final?.id,
  };

  if (triangular) {
    return (
      <div className="relative hidden w-full min-w-0 flex-col items-center overflow-x-auto bg-[#050816] py-6 shadow-2xl scrollbar-hide md:flex md:rounded-3xl md:border md:border-white/10 md:p-10">
        <div className="flex w-max justify-center px-2 pt-6 opacity-90 md:w-full md:px-0 md:pt-0 md:pb-8">
          <LadoCompacto luta1={achar(lutas, '1')} baia={achar(lutas, '2')} buscarFoto={buscarFoto} destaque={destaque} onAvancar={onAvancar} />
          {seis ? (
            <div className="flex flex-col gap-[100px] pt-[40px]">
              {([1, 2] as const).map(lado => {
                const item = slot(achar(lutas, '101'), lado, buscarFoto, destaque, onAvancar);
                return <Atleta key={`101-${lado}`} larguraClass="w-[16px] md:w-[140px]" {...item} destaque={marcaDestaque(item, destaque)} />;
              })}
            </div>
          ) : (
            <div className="flex flex-col pt-[70px]"><ConectorMedio /></div>
          )}
          {seis && <div className="flex flex-col pt-[70px]"><ConectorMedio /></div>}
          <CentroFinal final={final} campeao={campeao} buscarFoto={buscarFoto} destaque={destaque} onAvancar={onAvancar} />
          {seis && <div className="flex flex-col pt-[70px]"><ConectorMedio reverso /></div>}
          {seis && (
            <div className="flex flex-col gap-[100px] pt-[40px]">
              {([1, 2] as const).map(lado => {
                const item = slot(achar(lutas, '102'), lado, buscarFoto, destaque, onAvancar);
                return <Atleta key={`102-${lado}`} larguraClass="w-[16px] md:w-[140px]" {...item} reverso destaque={marcaDestaque(item, destaque)} />;
              })}
            </div>
          )}
          {seis
            ? <LadoCompacto luta1={achar(lutas, '3')} baia={achar(lutas, '4')} reverso buscarFoto={buscarFoto} destaque={destaque} onAvancar={onAvancar} />
            : <div className="w-[12px] md:w-[30px]" />}
        </div>
      </div>
    );
  }

  const idsPrimeiraFase = idsPrimeiraFasePorLado(lutas, abaAtual);
  const primeira = (posicao: number, slotLado: 1 | 2, lado: 'esquerda' | 'direita') => {
    const id = idsPrimeiraFase[lado](posicao);
    const luta = lutas.find(item => String(item.id_visual) === String(id));
    return slot(luta, slotLado, buscarFoto, destaque, onAvancar);
  };
  const meio = (idBase: number, multiplicador: number, slotDelta: number, slotLado: 1 | 2) => {
    const id = idBase + (abaAtual - 1) * multiplicador + slotDelta;
    const luta = lutas.find(item => String(item.id_visual) === String(id));
    return slot(luta, slotLado, buscarFoto, destaque, onAvancar);
  };

  return (
    <div className="relative hidden w-full min-w-0 flex-col items-center overflow-x-auto bg-[#050816] py-6 shadow-2xl scrollbar-hide md:flex md:rounded-3xl md:border md:border-white/10 md:p-10">
      {totalAbas > 1 && <p className="absolute left-4 top-4 text-sm font-bold uppercase tracking-widest text-zinc-500">Chave {abaAtual}/{totalAbas}</p>}
      <div className="flex w-max justify-center px-2 pt-6 pb-8 opacity-90 transition-all md:w-full md:px-0 md:pt-0">
        <div className="flex">
          <div className="flex flex-col gap-[20px]">
            {([1, 2, 3, 4] as const).flatMap(posicao => ([1, 2] as const).map(lado => {
              const item = primeira(posicao, lado, 'esquerda');
              return <Atleta key={`e-${posicao}-${lado}`} {...item} destaque={marcaDestaque(item, destaque)} />;
            }))}
          </div>
          <div className="flex flex-col gap-[80px] pt-[30px]"><ConectorPequeno /><ConectorPequeno /><ConectorPequeno /><ConectorPequeno /></div>
          <div className="flex flex-col gap-[100px] pt-[40px]">
            {([[1, 1], [1, 2], [2, 1], [2, 2]] as const).map(([delta, lado]) => {
              const item = meio(100, 2, delta, lado);
              return <Atleta key={`m1-${delta}-${lado}`} larguraClass="w-[16px] md:w-[140px]" {...item} destaque={marcaDestaque(item, destaque)} />;
            })}
          </div>
          <div className="flex flex-col gap-[160px] pt-[70px]"><ConectorMedio /><ConectorMedio /></div>
          <div className="flex flex-col gap-[260px] pt-[120px]">
            {([1, 2] as const).map(lado => {
              const item = meio(200, 1, 1, lado);
              return <Atleta key={`m2-${lado}`} larguraClass="w-[16px] md:w-[140px]" {...item} destaque={marcaDestaque(item, destaque)} />;
            })}
          </div>
          <div className="flex flex-col pt-[150px]"><ConectorGrande /></div>
        </div>

        <CentroFinal final={final} campeao={campeao} buscarFoto={buscarFoto} destaque={destaque} onAvancar={onAvancar} />

        <div className="flex">
          <div className="flex flex-col pt-[150px]"><ConectorGrande reverso /></div>
          <div className="flex flex-col gap-[260px] pt-[120px]">
            {([1, 2] as const).map(lado => {
              const item = meio(200, 1, 2, lado);
              return <Atleta key={`m2d-${lado}`} larguraClass="w-[16px] md:w-[140px]" {...item} reverso destaque={marcaDestaque(item, destaque)} />;
            })}
          </div>
          <div className="flex flex-col gap-[160px] pt-[70px]"><ConectorMedio reverso /><ConectorMedio reverso /></div>
          <div className="flex flex-col gap-[100px] pt-[40px]">
            {([[3, 1], [3, 2], [4, 1], [4, 2]] as const).map(([delta, lado]) => {
              const item = meio(100, 2, delta, lado);
              return <Atleta key={`m1d-${delta}-${lado}`} larguraClass="w-[16px] md:w-[140px]" {...item} reverso destaque={marcaDestaque(item, destaque)} />;
            })}
          </div>
          <div className="flex flex-col gap-[80px] pt-[30px]"><ConectorPequeno reverso /><ConectorPequeno reverso /><ConectorPequeno reverso /><ConectorPequeno reverso /></div>
          <div className="flex flex-col gap-[20px]">
            {([1, 2, 3, 4] as const).flatMap(posicao => ([1, 2] as const).map(lado => {
              const item = primeira(posicao, lado, 'direita');
              return <Atleta key={`d-${posicao}-${lado}`} {...item} reverso destaque={marcaDestaque(item, destaque)} />;
            }))}
          </div>
        </div>
      </div>
    </div>
  );
}
