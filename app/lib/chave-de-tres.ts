export function ehFaseChaveDeTres(fase?: string | null) {
  const texto = String(fase || '').toUpperCase();
  return texto.includes('CHAVE DE 3') || texto.includes('CHAVE DE 6');
}

export function lutasFormamChaveDeTres(lutas: Array<{ fase?: string | null; id_visual?: string | number | null }>) {
  return lutas.some(luta => ehFaseChaveDeTres(luta.fase));
}

export function lutasFormamChaveDeSeis(lutas: Array<{ fase?: string | null; id_visual?: string | number | null }>) {
  if (!lutasFormamChaveDeTres(lutas)) return false;
  const ids = new Set(lutas.map(luta => String(luta.id_visual)));
  return ids.has('101') && ids.has('102') && ids.has('3') && ids.has('4');
}

export function placeholderSlotChaveDeTres(
  luta: { id_visual?: string | number | null; fase?: string | null },
  lado: 1 | 2,
) {
  if (!ehFaseChaveDeTres(luta.fase)) return null;
  const id = String(luta.id_visual);
  const seis = String(luta.fase || '').toUpperCase().includes('CHAVE DE 6') || ['3', '4', '101', '102'].includes(id);
  if ((id === '2' || id === '4') && lado === 1) return id === '4' ? 'Perdedor da luta 1 direita' : 'Perdedor da luta 1';
  if (id === '101' && lado === 1) return 'Vencedor da luta 1';
  if (id === '101' && lado === 2) return 'Vencedor da luta 2';
  if (id === '102' && lado === 1) return 'Vencedor da luta 1 direita';
  if (id === '102' && lado === 2) return 'Vencedor da luta 2 direita';
  if (id === '999' && lado === 1) return seis ? 'Vencedor do lado esquerdo' : 'Vencedor da luta 1';
  if (id === '999' && lado === 2) return seis ? 'Vencedor do lado direito' : 'Vencedor da luta 2';
  return null;
}

function slotVazio(nome?: string | null) {
  const limpo = String(nome || '').trim().toUpperCase();
  return !limpo || limpo === 'BYE' || limpo === 'TBD' || limpo.includes('SEM OPONENTE');
}

export function textoAguardandoChaveDeTres(luta: {
  id_visual?: string | number | null;
  fase?: string | null;
  atleta_1?: string | null;
  atleta_2?: string | null;
}) {
  if (!ehFaseChaveDeTres(luta.fase)) return null;
  const id = String(luta.id_visual);
  const espera1 = slotVazio(luta.atleta_1);
  const espera2 = slotVazio(luta.atleta_2);
  if (id === '2') return espera1
    ? 'Na baia · espera o perdedor da luta 1 para ir à decisão'
    : 'Na baia · prontos quando a luta 1 terminar';
  if (id === '4') return espera1
    ? 'Na baia · espera o perdedor da luta 1 da direita para ir à decisão'
    : 'Na baia · prontos quando a luta 1 da direita terminar';
  if (id === '101' || id === '102') {
    if (!espera1 && espera2) return 'Aguardando o vencedor da baia';
    if (espera1 && !espera2) return 'Aguardando o vencedor da luta 1';
    return 'Aguardando os vencedores da luta 1 e da baia';
  }
  if (id === '999') {
    const seis = String(luta.fase || '').toUpperCase().includes('CHAVE DE 6');
    if (!espera1 && espera2) return seis ? 'Aguardando o vencedor do lado direito' : 'Aguardando o vencedor da baia';
    if (espera1 && !espera2) return seis ? 'Aguardando o vencedor do lado esquerdo' : 'Aguardando o vencedor da luta 1';
    return seis ? 'Aguardando os vencedores dos dois lados' : 'Aguardando os vencedores da luta 1 e da baia';
  }
  return null;
}

export function ordemOperacionalChaveTriangular(luta: { id_visual?: string | number | null; fase?: string | null }) {
  if (!ehFaseChaveDeTres(luta.fase)) return null;
  const id = String(luta.id_visual);
  if (id === '1') return 1;
  if (id === '2') return 2;
  if (id === '101') return 3;
  if (id === '3') return 4;
  if (id === '4') return 5;
  if (id === '102') return 6;
  if (id === '999') return 7;
  return 8;
}

export function idBaiaDaPrimeiraChaveDeTres(idVisual?: string | number | null, fase?: string | null) {
  if (!ehFaseChaveDeTres(fase)) return null;
  const id = String(idVisual);
  if (id === '1') return '2';
  if (id === '3') return '4';
  return null;
}

export function textoOuroAposChecagem(atletasReaisNaChave: number) {
  return atletasReaisNaChave <= 1
    ? 'Aguardando checagem · ouro só após a presença'
    : 'Na baia · aguardando oponente da primeira luta';
}

function nomeVisivel(nome?: string | null) {
  const limpo = String(nome || '').trim();
  const upper = limpo.toUpperCase();
  if (!limpo || upper === 'BYE' || upper === 'TBD' || upper.includes('SEM OPONENTE')) return '';
  return limpo;
}

function acharPorId<T extends { id_visual?: string | number | null }>(lutas: T[], id: string) {
  return lutas.find(luta => String(luta.id_visual) === id);
}

export function resumoHumanoChave(lutas: Array<{
  id_visual?: string | number | null;
  fase?: string | null;
  atleta_1?: string | null;
  atleta_2?: string | null;
  vencedor?: string | null;
  status_luta?: string | null;
  proxima_luta?: string | number | null;
}>) {
  if (!lutas.length) return 'Esta categoria ainda não tem chave montada.';

  const andamento = lutas.find(luta => luta.status_luta === 'em_andamento');
  if (andamento) {
    const a = nomeVisivel(andamento.atleta_1) || 'Um atleta';
    const b = nomeVisivel(andamento.atleta_2) || 'o adversário';
    return `${a} e ${b} estão lutando agora.`;
  }

  const final = acharPorId(lutas, '999') || lutas.find(luta => !luta.proxima_luta);
  const campeao = nomeVisivel(final?.vencedor);
  if (campeao) return `${campeao} levou o ouro nesta chave.`;

  if (lutasFormamChaveDeSeis(lutas)) {
    const esquerda = acharPorId(lutas, '101');
    const direita = acharPorId(lutas, '102');
    const vEsq = nomeVisivel(esquerda?.vencedor);
    const vDir = nomeVisivel(direita?.vencedor);
    if (vEsq && vDir) return `${vEsq} e ${vDir} fazem a final.`;
    if (vEsq && !vDir) return `${vEsq} já está na final. O lado direito ainda define o outro finalista.`;
    if (!vEsq && vDir) return `${vDir} já está na final. O lado esquerdo ainda define o outro finalista.`;
    return 'Seis atletas: uma chave de 3 em cada lado. A baia espera o perdedor da primeira luta daquele lado.';
  }

  if (lutasFormamChaveDeTres(lutas)) {
    const luta1 = acharPorId(lutas, '1');
    const baia = acharPorId(lutas, '2');
    const a = nomeVisivel(luta1?.atleta_1);
    const b = nomeVisivel(luta1?.atleta_2);
    const terceiro = nomeVisivel(baia?.atleta_2) || nomeVisivel(baia?.atleta_1);
    if (!nomeVisivel(luta1?.vencedor)) {
      if (a && b && terceiro) return `${a} enfrenta ${b} primeiro. Quem perder vai à baia contra ${terceiro}. Quem ganhar a baia completa a final.`;
      return 'Nesta chave de 3, a primeira luta define quem vai à final e quem enfrenta a baia.';
    }
    const vencedor = nomeVisivel(luta1?.vencedor);
    const perdedor = [a, b].find(nome => nome && nome.toUpperCase() !== vencedor.toUpperCase()) || '';
    const oponenteBaia = [nomeVisivel(baia?.atleta_1), nomeVisivel(baia?.atleta_2)].find(nome => nome && nome.toUpperCase() !== perdedor.toUpperCase()) || terceiro;
    if (nomeVisivel(baia?.vencedor) && vencedor) {
      return `${vencedor} e ${nomeVisivel(baia?.vencedor)} fazem a final.`;
    }
    if (vencedor && perdedor && oponenteBaia) {
      return `${vencedor} já está na final. ${perdedor} enfrenta ${oponenteBaia} na baia. Quem vencer luta com ${vencedor} pelo ouro.`;
    }
    if (vencedor) return `${vencedor} já está na final, esperando o vencedor da baia.`;
  }

  const proxima = lutas.find(luta => nomeVisivel(luta.atleta_1) && nomeVisivel(luta.atleta_2) && luta.status_luta !== 'concluida');
  if (proxima) return `Próximo confronto: ${nomeVisivel(proxima.atleta_1)} vs ${nomeVisivel(proxima.atleta_2)}.`;
  return 'Acompanhe quem avança em cada lado da chave.';
}
