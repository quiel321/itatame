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
  if (!ehFaseChaveDeTres(luta.fase) && String(luta.id_visual) !== '999') return null;
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

export function textoAguardandoChaveDeTres(luta: { id_visual?: string | number | null; fase?: string | null }) {
  if (!ehFaseChaveDeTres(luta.fase) && String(luta.id_visual) !== '999') return null;
  const id = String(luta.id_visual);
  if (id === '2') return 'Na baia · espera o perdedor da luta 1 para ir à decisão';
  if (id === '4') return 'Na baia · espera o perdedor da luta 1 da direita para ir à decisão';
  if (id === '101' || id === '102') return 'Aguardando os vencedores da luta 1 e da baia';
  if (id === '999') return String(luta.fase || '').toUpperCase().includes('CHAVE DE 6')
    ? 'Aguardando os vencedores dos dois lados'
    : 'Aguardando os vencedores da luta 1 e da baia';
  return null;
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
