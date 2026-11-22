// Más > Alarma y Más > Config > Ajustes de la TV: se configuran en la app (misma pantalla que la Pro) y la TV los guarda
// por Bluetooth, así funcionan sin el celular. La canción de la alarma viaja a la TV y queda protegida de la caché.
import { abrir, cerrar, informe } from './banco-lite.mjs';

const { pagina, errores, tv } = await abrir();
const abrirMas = async (opcion) => {
  await pagina.click('#grupoTipo button[data-valor="galeria"]');
  await pagina.waitForTimeout(200);
  await pagina.click(`#grupoMas button[data-mas="${opcion}"]`);
  await pagina.waitForTimeout(500);
};
const texto = (sel) => pagina.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);

// ---- Alarma ----
await abrirMas('alarma');
await pagina.waitForSelector('#botonGuardarAlarma:not([disabled])', { timeout: 10000 }); // la Pro bloquea Guardar hasta leer la alarma de la TV (H-29)
const tonos = await pagina.$$eval('#alarmaTono option', (o) => o.map((x) => ({ v: x.value, t: x.textContent })));
informe('la lista de tonos trae el sonido simple y las canciones de la app', tonos.length > 50 && tonos[0].v === '', String(tonos.length));

await pagina.fill('#alarmaHora', '06:30');
await pagina.check('#alarmaActiva');
await pagina.click('#grupoAlarmaDias button[data-dia="6"]'); // + sábado
const tono = tonos[5].v;
await pagina.selectOption('#alarmaTono', tono);
await pagina.click('#botonGuardarAlarma');
await pagina.waitForFunction(() => /Alarma guardada/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 20000 });
let e = await tv();
const a = e.alarmas;
informe('la TV guardó la alarma 1: 06:30 activa, lunes a sábado', a && a.alarmas[0].activa && a.alarmas[0].hora === 6 && a.alarmas[0].minuto === 30 && a.alarmas[0].dias === 126, JSON.stringify(a));
informe('las otras dos alarmas quedan apagadas', a && !a.alarmas[1].activa && !a.alarmas[2].activa);
informe('la canción de la alarma está en la TV y la alarma apunta a ella', a && a.tonoId > 0 && e.biblioteca.includes(a.tonoId), JSON.stringify({ tonoId: a && a.tonoId, bib: e.biblioteca }));

// La caché NO puede borrar la canción de la alarma aunque falte espacio.
// Se deja a la TV con espacio para ~25 KB de canciones además de la de la alarma, y se le mandan 12 canciones chicas
// (de menos de 9 KB): tiene que ir borrando las más viejas, y la de la alarma no puede ser una de ellas.
const chicas = await pagina.evaluate(async (tonoId) => {
  const lista = await (await fetch('canciones/indice.json')).json();
  return lista.filter((c) => c.bytes < 9000 && c.id !== tonoId).slice(0, 12).map((c) => c.clave);
}, e.alarmas.tonoId);
await pagina.evaluate(() => { const t = window.__tv; let u = 0; for (const v of t.biblioteca.values()) u += v.bytes.length; t.capacidad = 16384 + u + 25000; });
await pagina.click('#grupoTipo button[data-valor="cancion"]');
await pagina.waitForFunction(() => document.querySelectorAll('#seleccionCancion option').length > 1, null, { timeout: 15000 });
for (const clave of chicas) {
  await pagina.selectOption('#seleccionCancion', clave);
  await pagina.waitForTimeout(500);
  await pagina.click('#enviar');
  await pagina.waitForFunction(() => /camino|En la TV|✅/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 15000 });
}
e = await tv();
informe('la TV tuvo que borrar canciones para hacer espacio', e.biblioteca.length < chicas.length + 1, `${e.biblioteca.length} guardadas de ${chicas.length + 1}`);
informe('con poco espacio la TV borra canciones pero NO la de la alarma', e.biblioteca.includes(e.alarmas.tonoId), JSON.stringify(e.biblioteca));

// ---- Se vuelve a ver al reabrir ----
await pagina.reload();
await pagina.waitForFunction(() => document.getElementById('estadoTexto') && !/Cargando/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 15000 });
await abrirMas('alarma');
informe('al reabrir, la app recuerda la alarma (06:30 y activa)', (await pagina.inputValue('#alarmaHora')) === '06:30' && (await pagina.isChecked('#alarmaActiva')));

// ---- Ajustes de la TV ----
await pagina.click('#botonMasVolver');
await pagina.click('#grupoMas button[data-mas="config"]');
await pagina.click('#grupoConfig button[data-config="tv"]');
await pagina.waitForSelector('#botonGuardarAjustes:not([disabled])', { timeout: 10000 });
await pagina.click('#grupoBrillo button[data-valor="2"]');
await pagina.click('#grupoVolumen button[data-valor="1"]');
await pagina.selectOption('#ajusteZona', '-360');
await pagina.click('#botonGuardarAjustes');
await pagina.waitForFunction(() => /guardad/i.test(document.getElementById('estadoTexto').textContent), null, { timeout: 20000 });
e = await tv();
informe('la TV guardó los ajustes: brillo Medio, volumen Bajo, zona -360', e.ajustes && e.ajustes.brillo === 2 && e.ajustes.volumen === 1 && e.ajustes.zona === -360, JSON.stringify(e.ajustes));

// ---- Menú Más/Config: lo que la Lite no tiene no aparece ----
await pagina.click('#botonMasVolver');
const filas = await pagina.$$eval('#grupoConfig .fila-mas', (b) => b.filter((x) => getComputedStyle(x).display !== 'none').map((x) => x.dataset.config || ''));
informe('Config solo muestra Ajustes de la TV, Ayuda y Legal', filas.join(',') === 'tv,ayuda,legal', filas.join(','));

informe('sin errores en la consola', errores.length === 0, errores.join(' | '));
cerrar();
