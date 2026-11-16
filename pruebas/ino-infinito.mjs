import { grabarIno } from '../js/inoMusical.js';
const casos = {
  'while(1){} sin nada': 'void setup(){} void loop(){ while(1){} }',
  'while(1){delay(1);}': 'void setup(){} void loop(){ while(1){ delay(1); } }',
  'for gigante': 'void setup(){} void loop(){ for(long i=0;i<4000000000;i++){ } tone(4,440); delay(100); }',
  'recursión infinita': 'void f(){ f(); } void setup(){} void loop(){ f(); }',
  'tone sin parar': 'void setup(){} void loop(){ while(1){ tone(4,440); delay(1); noTone(4); delay(1);} }'
};
for (const [n, s] of Object.entries(casos)) {
  const t = Date.now();
  let r; try { const g = grabarIno(s); r = `grabó ${g.notas.length} notas, dur ${g.duracion}`; } catch (e) { r = 'error: ' + e.message.slice(0, 70); }
  console.log(`${n}: ${Date.now() - t} ms — ${r}`);
}
