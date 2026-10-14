import test from 'node:test';
import assert from 'node:assert/strict';
import { idadeCompetitiva, categoriaCompativelSemPeso, type CategoriaCompeticao } from '../app/lib/categorias-competicao';
import { validarNascimentoTitular } from '../app/lib/idade-cadastro';

test('aniversário de 16 após o campeonato já permite categoria 16 no jiu-jitsu', () => {
 const idade=idadeCompetitiva('2010-12-20','2026-10-17','Jiu-Jitsu');
 assert.equal(idade,16);
 const base={ativa:true,modalidade:'Jiu-Jitsu',sexo:'Feminino',faixa:'Branca'} as CategoriaCompeticao;
 const atleta={idade,sexo:'Feminino',faixa:'Branca',modalidade:'Jiu-Jitsu'};
 assert.equal(categoriaCompativelSemPeso({...base,idade_min:14,idade_max:15},atleta),false);
 assert.equal(categoriaCompativelSemPeso({...base,idade_min:16,idade_max:100},atleta),true);
});
test('cálculo usa o ano do evento e permanece igual antes/depois do aniversário', () => {
 assert.equal(idadeCompetitiva('2010-12-20','2026-01-01'),16);
 assert.equal(idadeCompetitiva('2010-12-20','2026-12-31'),16);
 assert.equal(idadeCompetitiva('2010-12-20','2027-01-01'),17);
 assert.equal(idadeCompetitiva('2012-02-29','2026-10-17','No-Gi'),14);
});
test('outras modalidades mantêm idade civil e nascimento ausente exige preenchimento', () => {
 assert.equal(idadeCompetitiva('2010-12-20','2026-10-17','Boxe'),15);
 assert.ok(Number.isNaN(idadeCompetitiva(null,'2026-10-17')));
});
test('idade competitiva não libera conta adulta antes de completar 18 anos', () => {
 assert.equal(idadeCompetitiva('2008-12-20','2026-10-17'),18);
 assert.equal(validarNascimentoTitular('2008-12-20',new Date('2026-10-17T12:00:00Z')).ok,false);
});

