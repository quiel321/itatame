import test from 'node:test';
import assert from 'node:assert/strict';
import { planejarHorariosCategorias, resumirProgramacao, type LutaProgramacao } from '../app/lib/programacao-categorias';
import { dataHoraLocalParaIso } from '../app/lib/evento-datas';
import { montarChaves } from '../app/lib/gerar-chaves';
import { compararLutasDaCategoria } from '../app/lib/sequencia-tatames';
const h = (hora: string, dia = '2026-10-17', estado = 'MT') => dataHoraLocalParaIso(`${dia}T${hora}`, estado)!;
const l = (id: number, categoria_id = 'mirim', extra: Partial<LutaProgramacao> = {}): LutaProgramacao => ({ id, categoria: categoria_id, categoria_id, faixa: 'Branca', tatame: 'Tatame 1', ordem_tatame: id, status_luta: 'agendada', atleta_1: 'TESTE A', atleta_2: 'TESTE B', tempo_minutos: 3, ...extra });

test('mantém blocos, duração da categoria, transição e futuras fases sem alterar confrontos', () => {
  const lutas = [l(1), l(2, 'mirim', { atleta_1: 'TBD', atleta_2: 'TBD' }), l(3, 'infantil', { tempo_minutos: 4 })];
  const copia = structuredClone(lutas);
  const plano = planejarHorariosCategorias(lutas, h('14:00'), 1, [{ categoria_id: 'infantil', inicio_previsto: h('14:40') }]);
  assert.deepEqual(plano.updates.map(l => l.horario_estimado), [h('14:00'), h('14:04'), h('14:40')]);
  assert.equal(plano.categorias[1].fim, h('14:44')); assert.deepEqual(lutas, copia);
  assert.equal(plano.avisos.length, 0);
});
test('insuficiência de intervalo avisa e atrasa a estimativa sem perder o horário anunciado', () => {
  const inicios = [{ categoria_id: 'infantil', inicio_previsto: h('14:05') }];
  const plano = planejarHorariosCategorias([l(1), l(2), l(3, 'infantil')], h('14:00'), 1, inicios);
  assert.equal(plano.updates[2].horario_estimado, h('14:08'));
  assert.equal(plano.avisos[0].previsto, h('14:05')); assert.equal(plano.avisos[0].atrasoMinutos, 3);
  assert.equal(inicios[0].inicio_previsto, h('14:05'));
});
test('respeita início do tatame quando categoria foi anunciada antes e calcula cada tatame separado', () => {
  assert.equal(planejarHorariosCategorias([l(1)], h('14:10'), 0, [{ categoria_id: 'mirim', inicio_previsto: h('14:00') }]).avisos[0].atrasoMinutos, 10);
  assert.equal(planejarHorariosCategorias([l(1, 'mirim', { tatame: 'Tatame 2' })], h('14:00'), 0, []).updates[0].horario_estimado, h('14:00'));
  assert.throws(() => planejarHorariosCategorias([l(1), l(2, 'infantil', { tatame: 'Tatame 2' })], h('14:00'), 0, []), /um tatame/);
});
test('não agenda avanços sem luta, canceladas ou concluídas; não muda os dados operacionais', () => {
  const lutas = [l(1, 'mirim', { atleta_2: 'BYE' }), l(2, 'mirim', { status_luta: 'concluida', vencedor: 'TESTE A' }), l(3, 'mirim', { status_luta: 'cancelada' }), l(4)];
  assert.deepEqual(planejarHorariosCategorias(lutas, h('14:00'), 0, []).updates.map(x => x.id), [4]);
});
test('impede fila inválida, duração nula, categorias intercaladas e horários inválidos', () => {
  assert.throws(() => planejarHorariosCategorias([l(1, 'mirim', { ordem_tatame: null })], h('14:00'), 0, []), /Salve a sequência/);
  assert.throws(() => planejarHorariosCategorias([l(1), l(1)], h('14:00'), 0, []), /repetidas/);
  assert.throws(() => planejarHorariosCategorias([l(1, 'mirim', { tempo_minutos: 0 })], h('14:00'), 0, []), /Duração/);
  assert.throws(() => planejarHorariosCategorias([l(1), l(2, 'infantil'), l(3)], h('14:00'), 0, []), /juntas/);
  assert.throws(() => planejarHorariosCategorias([], 'ruim', 0, []));
  assert.throws(() => planejarHorariosCategorias([], h('14:00'), 11, []));
});
test('funciona em outro evento, ano e fuso, sem datas do Spartan fixas', () => {
  const inicio = h('09:30', '2027-05-20', 'SP');
  assert.equal(planejarHorariosCategorias([l(1)], inicio, 2, []).updates[0].horario_estimado, '2027-05-20T12:30:00.000Z');
});
test('recepção e chamador distinguem previsão anunciada, fila estimada, operação e conclusão', () => {
  const categorias = [{ id: 'mirim', nome: 'Mirim', inicio_lutas_previsto: h('14:00') }, { id: 'infantil', nome: 'Infantil', inicio_lutas_previsto: h('14:40') }];
  let resumo = resumirProgramacao([l(1, 'mirim', { horario_estimado: h('14:05') }), l(2, 'infantil', { horario_estimado: h('14:40'), tatame: 'Tatame 2' })], categorias, new Date(h('14:02')));
  assert.equal(resumo[0].horarioUltrapassado, true); assert.equal(resumo[0].previsto, h('14:00')); assert.equal(resumo[0].estimado, h('14:05'));
  assert.equal(resumo[1].horarioUltrapassado, false);
  resumo = resumirProgramacao([l(1, 'mirim', { iniciada_em: h('14:00') })], categorias, new Date(h('14:02')));
  assert.equal(resumo[0].horarioUltrapassado, false); assert.equal(resumo[0].emOperacao, true);
  resumo = resumirProgramacao([l(1, 'mirim', { status_luta: 'concluida', vencedor: 'TESTE A' })], categorias);
  assert.equal(resumo[0].concluida, true);
});

test('simula os 12 grupos do documento com 56 atletas fictícios e identifica o bloco apertado', () => {
  const blocos: [string, number, number, string, number][] = [
    ['Mirim M',7,3,'14:00',1],['Mirim F',2,3,'14:00',2],
    ['Infantil I leve M',6,3,'14:40',1],['Infantil I pesado M',4,3,'14:40',2],
    ['Infantil II leve M',6,3,'15:15',1],['Infantil II pesado M',2,3,'15:15',2],['Infantil II pesado F',3,3,'15:15',2],
    ['Infantojuvenil F',5,4,'15:45',1],['Infantojuvenil M',3,4,'15:45',2],
    ['Feminino leve',2,5,'16:20',1],['Feminino pesado',3,5,'16:20',2],['Absoluto',13,6,'17:00',1],
  ];
  let atleta = 0;
  const preparados: Parameters<typeof montarChaves>[1] = { grupos: {}, metadados: {} };
  for (const [nome,total,tempo] of blocos) {
    preparados.grupos[nome] = Array.from({length:total},()=>({atleta_id:++atleta,atleta:`FICTÍCIO ${atleta}`,faixa:'Branca',equipe_atleta:'TESTE',equipe_chave:`EQUIPE ${atleta}`}));
    preparados.metadados[nome] = {categoria:nome,categoria_id:nome,faixa:'Branca',tempo_minutos:tempo};
  }
  assert.equal(atleta,56);
  const geradas = montarChaves('EVENTO SINTÉTICO', preparados);
  const inicios = blocos.map(([nome,,,hora])=>({categoria_id:nome,inicio_previsto:h(hora)}));
  const fila = (area:number) => blocos.filter(b=>b[4]===area).flatMap(([nome])=>geradas.filter(l=>l.categoria_id===nome).map((l,i)=>({...l,id:`${nome}-${i}`} as LutaProgramacao & {fase?:string})).sort(compararLutasDaCategoria)).map((l,i)=>({...l,tatame:`Tatame ${area}`,ordem_tatame:i+1}));
  const plano = planejarHorariosCategorias(fila(1),h('14:00'),2,inicios);
  assert.ok(!plano.avisos.some(a=>a.categoria==='Infantojuvenil F')); // seis atletas agora têm cinco combates.
  assert.equal(planejarHorariosCategorias(fila(1),h('14:00'),1,inicios).avisos.length,0);
  // Duas categorias no mesmo horário e tatame devem produzir aviso de sequência.
  assert.ok(planejarHorariosCategorias(fila(2),h('14:00'),1,inicios).avisos.some(a=>a.categoria==='Infantil II pesado F'));
});
