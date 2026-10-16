import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dataGaleriaValida,exibirDataGaleria,lerDataGaleria} from '../app/lib/fotos-data';
import {destinoGaleriaRetratt} from '../app/lib/fotos-navegacao';
test('digitação, calendário e colagem chegam ao mesmo valor ISO sem alterar o dia',()=>{
 assert.equal(lerDataGaleria('17102026'),'2026-10-17');assert.equal(lerDataGaleria('17/10/2026'),'2026-10-17');
 assert.equal(lerDataGaleria('2026-10-17'),'2026-10-17');assert.equal(exibirDataGaleria('2026-10-17'),'17/10/2026');
 assert.equal(lerDataGaleria('1710'),'17/10');assert.equal(dataGaleriaValida(lerDataGaleria('1710')),false);assert.equal(lerDataGaleria(''),'');
 assert.equal(dataGaleriaValida(''),true);assert.equal(dataGaleriaValida('2024-02-29'),true);
 for(const data of ['2026-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','2100-02-29','17/10/2026'])assert.equal(dataGaleriaValida(data),false,data);
 assert.equal(dataGaleriaValida('2000-02-29'),true);
});
test('link elimina redirecionamento no Retratt e preserva acesso privado, álbum e navegação local',()=>{
 const href='/fotos/evento/galeria?album=album&acesso=token#foto';
 for(const host of ['retratt.com','www.retratt.com','retratt.localhost'])assert.equal(destinoGaleriaRetratt(href,host),'/evento/galeria?album=album&acesso=token#foto');
 for(const host of ['','localhost','itatame.com.br','outro.com'])assert.equal(destinoGaleriaRetratt(href,host),href);
 assert.equal(destinoGaleriaRetratt('/fotos/carrinho','retratt.com'),'/fotos/carrinho');
});
