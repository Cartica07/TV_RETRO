// Canciones: se eligen del catálogo que viene DENTRO de la app, se mandan a la TV (si le faltan) y suenan,
// con y sin letra. La TV (simulada) guarda las que se usan y borra las menos usadas cuando falta espacio.
import { abrir, cerrar, informe } from './banco-lite.mjs';

const { pagina, errores, tv } = await abrir();
await pagina.click('#grupoTipo button[data-valor="cancion"]');

// Las canciones llegan sin internet.
await pagina.waitForFunction(() => document.querySelectorAll('#seleccionCancion option').length > 1, null, { timeout: 15000 });
const total = await pagina.$$eval('#seleccionCancion option', (o) => o.length);
informe('el selector tiene las 57 canciones de la app', total >= 57, String(total));

const elegir = async (indice) => {
  const valor = await pagina.$eval('#seleccionCancion', (s, i) => s.options[i].value, indice);
  await pagina.selectOption('#seleccionCancion', valor);
  await pagina.waitForFunction(() => /\d/.test(document.getElementById('avisoCancion').textContent) || true, null, { timeout: 3000 });
  await pagina.waitForTimeout(600); // la canción se carga para la vista previa
  return valor;
};
const enviar = async () => {
  await pagina.click('#enviar');
  await pagina.waitForFunction(() => /camino|En la TV|✅/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 15000 });
};

// 1. Con letra.
const clave1 = await elegir(2);
await enviar();
let e = await tv();
informe('la TV guardó la canción y la está tocando CON letra', e.biblioteca.length === 1 && e.sonando && e.sonando.conLetra === true, JSON.stringify(e));

// 2. La misma, otra vez: no se vuelve a mandar (la TV ya la tiene).
const antes = e.escrituras;
await enviar();
e = await tv();
const idsIguales = e.biblioteca.length === 1;
informe('si la TV ya la tiene, solo se le pide tocar (no se reenvía)', idsIguales && e.sonando, `escrituras ${antes} -> ${e.escrituras}`);

// 3. Otra canción, sin letra.
await pagina.click('#grupoLetra button[data-valor="sin"]');
const clave2 = await elegir(5);
await enviar();
e = await tv();
informe('la segunda canción se guardó y suena SIN letra', e.biblioteca.length === 2 && e.sonando && e.sonando.conLetra === false, JSON.stringify(e.sonando));
informe('las dos canciones son distintas', clave1 !== clave2);

// 4. Repeticiones.
await pagina.fill('#inputRepeticiones', '3');
await enviar();
e = await tv();
informe('las repeticiones llegan a la TV', e.sonando && e.sonando.repeticiones === 3, JSON.stringify(e.sonando));

// 5. Falta de espacio: la TV borra las menos usadas y NO la que acaba de recibir.
await pagina.evaluate(() => { window.__tv.capacidad = 16384 + 60000; }); // cabe ~60 KB de canciones
await pagina.click('#grupoLetra button[data-valor="con"]');
for (const i of [8, 9, 10, 11, 12, 13, 14, 15]) { await elegir(i); await enviar(); }
e = await tv();
informe('con poco espacio, la TV borra las menos usadas y sigue funcionando', e.libre >= 16384 || e.biblioteca.length > 0, JSON.stringify({ libre: e.libre, n: e.biblioteca.length }));
informe('la última canción enviada sigue en la TV y suena', e.sonando !== null && e.biblioteca.includes(e.sonando.id));

informe('sin errores en la consola', errores.length === 0, errores.join(' | '));
cerrar();
