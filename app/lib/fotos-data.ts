export function dataGaleriaValida(valor:string){
 if(!valor)return true;
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);if(!m)return false;
 const [,a,mes,d]=m,ano=Number(a),mm=Number(mes),dia=Number(d);
 const bissexto=ano%4===0&&(ano%100!==0||ano%400===0);
 return ano>=1000&&mm>=1&&mm<=12&&dia>=1&&dia<=[31,bissexto?29:28,31,30,31,30,31,31,30,31,30,31][mm-1];
}
export function exibirDataGaleria(valor:string){
 if(/^\d{4}-\d{2}-\d{2}$/.test(valor))return valor.split('-').reverse().join('/');
 const digits=valor.replace(/\D/g,'').slice(0,8);
 return digits.slice(0,2)+(digits.length>2?'/'+digits.slice(2,4):'')+(digits.length>4?'/'+digits.slice(4):'');
}
export function lerDataGaleria(valor:string){
 if(/^\d{4}-\d{2}-\d{2}$/.test(valor)&&dataGaleriaValida(valor))return valor;
 const texto=exibirDataGaleria(valor);
 const iso=texto.split('/').reverse().join('-');
 return texto.length===10&&dataGaleriaValida(iso)?iso:texto;
}
