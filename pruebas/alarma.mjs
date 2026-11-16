// Más > Alarma: hasta 3 alarmas, hora, días, interruptor y tono; guarda en dispositivos/{id}/alarma
// y manda la orden tipo "alarma" a la TV. Firebase falso.
import { abrir, cerrarServidor, informe } from './banco.mjs';
const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } };
const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };
const semilla = (extra = {}) => ({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 5, contadorVersion: 5, pantalla: pant }, ...extra } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
  musicales: { indice: { tv_nave: { nombre: 'La nave del olvido' }, tv_arroz: { nombre: 'Arroz con leche' } } }
});
async function abrirApp({ app = false, extra = {} } = {}) {
  const r = await abrir(semilla(extra), { ruta: '/index.html', esperar: false, antes: async (p) => {
    await p.addInitScript((s) => {
      globalThis.__semillaAuth = s.auth; globalThis.__persistirDb = true;
      if (s.app) globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { App: { addListener: (ev, cb) => { globalThis.__atras = cb; return Promise.resolve({}); }, exitApp: () => { globalThis.__salio = (globalThis.__salio || 0) + 1; } } } };
    }, { auth: { usuarios: USUARIOS, actual: 'ana@correo.com' }, app });
  } });
  await r.pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });
  return r;
}
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'; }, sel);
const txt = (p, sel) => p.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);
const abrirAlarma = async (p) => { await p.click('#grupoTipo button[data-valor="galeria"]'); await p.waitForTimeout(200); await p.click('#grupoMas button[data-mas="alarma"]'); await p.waitForTimeout(500); };
const poner = (p, hhmm) => p.fill('#alarmaHora', hhmm);
const hora = (p) => p.inputValue('#alarmaHora');
const db = (p) => p.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1);
const dias = (p) => p.$$eval('#grupoAlarmaDias button', (bs) => bs.map((b) => b.getAttribute('aria-pressed') === 'true' ? b.dataset.dia : '').join(''));
const puntos = (p) => p.$$eval('#grupoAlarmaNumero button', (bs) => bs.map((b) => b.classList.contains('alarma-activa') ? 1 : 0).join(''));

const escenarios = {
  async 'abre con los valores por defecto (nada guardado aún)'() {
    const { navegador, pagina } = await abrirApp(); await abrirAlarma(pagina);
    const titulo = await txt(pagina, '#tituloMas'), horaVista = await hora(pagina), activa = await pagina.isChecked('#alarmaActiva');
    const d = await dias(pagina), tonos = await pagina.$$eval('#alarmaTono option', (o) => o.map((x) => x.textContent));
    const enviar = await vis(pagina, '.barra-accion'), menu = await vis(pagina, '#seccionMasSelector');
    await navegador.close();
    return informe('Alarma: título, 07:00, apagada, lunes a viernes, tonos del catálogo, sin Enviar general ni menú', titulo === 'Alarma' && horaVista === '07:00' && !activa && d === '12345' && tonos.length === 3 && tonos[0] === 'Sonido simple de la TV' && !enviar && !menu, JSON.stringify({ titulo, horaVista, activa, d, tonos, enviar, menu }));
  },
  async 'guardar: escribe la alarma y manda la orden a la TV'() {
    const { navegador, pagina } = await abrirApp(); await abrirAlarma(pagina);
    await poner(pagina, '06:30');
    await pagina.check('#alarmaActiva');
    await pagina.click('#grupoAlarmaDias button[data-dia="6"]'); // + sábado
    await pagina.selectOption('#alarmaTono', 'tv_nave');
    const antes = (await db(pagina)).oled_remota.version;
    await pagina.click('#botonGuardarAlarma'); await pagina.waitForTimeout(800);
    const d = await db(pagina); const estado = await txt(pagina, '#estadoTexto');
    await navegador.close();
    const a0 = d.alarma && d.alarma.alarmas && d.alarma.alarmas['0'];
    return informe('Guardar: alarma 06:30 activa L-S con su tono, orden tipo "alarma", versión nueva y "Alarma guardada"',
      d.alarma && d.alarma.tono === 'tv_nave' && a0 && a0.activa === true && a0.hora === 6 && a0.minuto === 30 && a0.dias === 126 && d.alarma.alarmas['1'].activa === false && d.alarma.alarmas['2'] && d.oled_remota.pantalla.tipo === 'alarma' && d.oled_remota.version > antes && d.oled_remota.archivo == null && /Alarma guardada/.test(estado),
      JSON.stringify({ alarma: d.alarma, tipo: d.oled_remota.pantalla.tipo, v0: antes, v1: d.oled_remota.version, estado }));
  },
  async 'lo guardado se vuelve a ver al reabrir (también las alarmas 2 y 3)'() {
    const { navegador, pagina } = await abrirApp(); await abrirAlarma(pagina);
    await poner(pagina, '06:30'); await pagina.check('#alarmaActiva');
    await pagina.click('#grupoAlarmaNumero button[data-alarma="2"]');
    await poner(pagina, '22:15'); await pagina.check('#alarmaActiva');
    await pagina.click('#grupoAlarmaDias button[data-dia="1"]'); // quita el lunes
    await pagina.click('#botonGuardarAlarma'); await pagina.waitForTimeout(800);
    await pagina.reload(); await pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });
    await abrirAlarma(pagina);
    const h0 = await hora(pagina), p = await puntos(pagina);
    await pagina.click('#grupoAlarmaNumero button[data-alarma="2"]');
    const h2 = await hora(pagina), a2 = await pagina.isChecked('#alarmaActiva'), d2 = await dias(pagina);
    await pagina.click('#grupoAlarmaNumero button[data-alarma="1"]');
    const a1 = await pagina.isChecked('#alarmaActiva');
    await navegador.close();
    return informe('al reabrir: alarma 1 06:30, alarma 2 apagada, alarma 3 22:15 martes-viernes; puntos en las activas', h0 === '06:30' && h2 === '22:15' && a2 && d2 === '2345' && !a1 && p === '101', JSON.stringify({ h0, h2, a2, d2, a1, p }));
  },
  async 'cambiar de alarma no pierde lo que se estaba editando'() {
    const { navegador, pagina } = await abrirApp(); await abrirAlarma(pagina);
    await poner(pagina, '05:45');
    await pagina.click('#grupoAlarmaNumero button[data-alarma="1"]');
    await poner(pagina, '08:00');
    await pagina.click('#grupoAlarmaNumero button[data-alarma="0"]');
    const h = await hora(pagina);
    await navegador.close();
    return informe('editar la 1, pasar a la 2 y volver: la 1 conserva 05:45', h === '05:45', h);
  },
  async 'lee una alarma ya existente (y corrige datos raros)'() {
    const extra = { alarma: { tono: 'tv_arroz', alarmas: { 0: { activa: true, hora: 9, minuto: 5, dias: 65 }, 1: { activa: 'si', hora: 99, minuto: -3, dias: 1000 } } } };
    const { navegador, pagina } = await abrirApp({ extra }); await abrirAlarma(pagina);
    const h0 = await hora(pagina), a0 = await pagina.isChecked('#alarmaActiva'), d0 = await dias(pagina), tono = await pagina.inputValue('#alarmaTono');
    await pagina.click('#grupoAlarmaNumero button[data-alarma="1"]');
    const h1 = await hora(pagina), a1 = await pagina.isChecked('#alarmaActiva'), d1 = await dias(pagina);
    await navegador.close();
    return informe('alarma 1 = 09:05 sábado y domingo con su tono; datos inválidos de la 2 vuelven a los valores por defecto', h0 === '09:05' && a0 && d0 === '60' && tono === 'tv_arroz' && h1 === '07:00' && !a1 && d1 === '12345', JSON.stringify({ h0, a0, d0, tono, h1, a1, d1 }));
  },
  async 'alarma activa sin ningún día: avisa y no guarda'() {
    const { navegador, pagina } = await abrirApp(); await abrirAlarma(pagina);
    await pagina.check('#alarmaActiva');
    for (const n of ['1', '2', '3', '4', '5']) await pagina.click(`#grupoAlarmaDias button[data-dia="${n}"]`);
    const antes = (await db(pagina)).oled_remota.version;
    await pagina.click('#botonGuardarAlarma'); await pagina.waitForTimeout(500);
    const d = await db(pagina); const estado = await txt(pagina, '#estadoTexto');
    await navegador.close();
    return informe('sin días: "Elige al menos un día…", nada se escribe y no se manda orden', /Elige al menos un día/.test(estado) && !d.alarma && d.oled_remota.version === antes, JSON.stringify({ estado, alarma: d.alarma, v0: antes, v1: d.oled_remota.version }));
  },
  async 'sin hora: avisa y no guarda'() {
    const { navegador, pagina } = await abrirApp(); await abrirAlarma(pagina);
    await pagina.fill('#alarmaHora', '');
    await pagina.click('#botonGuardarAlarma'); await pagina.waitForTimeout(400);
    const d = await db(pagina); const estado = await txt(pagina, '#estadoTexto');
    await navegador.close();
    return informe('hora vacía: "Pon la hora de la alarma." y nada se escribe', /Pon la hora/.test(estado) && !d.alarma, JSON.stringify({ estado }));
  },
  async 'doble toque en Guardar manda una sola orden'() {
    const { navegador, pagina } = await abrirApp(); await abrirAlarma(pagina);
    await pagina.check('#alarmaActiva');
    const antes = (await db(pagina)).oled_remota.version;
    await pagina.evaluate(() => { const b = document.getElementById('botonGuardarAlarma'); b.click(); b.click(); b.click(); });
    await pagina.waitForTimeout(900);
    const d = await db(pagina);
    await navegador.close();
    return informe('tres toques seguidos en Guardar: una sola versión nueva', d.oled_remota.version === antes + 1, JSON.stringify({ antes, ahora: d.oled_remota.version }));
  },
  async 'tras guardar, recargar abre normal (como Texto)'() {
    const { navegador, pagina } = await abrirApp(); await abrirAlarma(pagina);
    await pagina.check('#alarmaActiva'); await pagina.click('#botonGuardarAlarma'); await pagina.waitForTimeout(800);
    const errores = []; pagina.on('pageerror', (e) => errores.push(e.message));
    await pagina.reload(); await pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });
    await pagina.waitForTimeout(400);
    const texto = await vis(pagina, '#seccionTexto'), estado = await txt(pagina, '#estadoTexto');
    await navegador.close();
    return informe('recargar tras guardar la alarma: abre en Texto, sin errores', texto && errores.length === 0 && !/error|No se pudo/i.test(estado), JSON.stringify({ texto, errores, estado }));
  },
  async 'si falla guardar: mensaje claro y el botón sigue sirviendo'() {
    const { navegador, pagina } = await abrirApp(); await abrirAlarma(pagina);
    await pagina.check('#alarmaActiva');
    await pagina.evaluate(() => { globalThis.__fakeDb.fallar['dispositivos/tv1/alarma'] = true; });
    await pagina.click('#botonGuardarAlarma'); await pagina.waitForTimeout(700);
    const estado = await txt(pagina, '#estadoTexto'); const habilitado = await pagina.evaluate(() => !document.getElementById('botonGuardarAlarma').disabled);
    await navegador.close();
    return informe('error al guardar: "No se pudo enviar…" y el botón vuelve a servir', /No se pudo enviar/.test(estado) && habilitado, JSON.stringify({ estado, habilitado }));
  },
  async 'Atrás de Android dentro de Alarma vuelve al menú'() {
    const { navegador, pagina } = await abrirApp({ app: true }); await abrirAlarma(pagina);
    await pagina.evaluate(() => globalThis.__atras()); await pagina.waitForTimeout(200);
    const menu = await vis(pagina, '#seccionMasSelector'), alarma = await vis(pagina, '#seccionAlarma'), salio = await pagina.evaluate(() => globalThis.__salio || 0);
    await navegador.close();
    return informe('APK: Atrás en Alarma vuelve al menú sin salir de la app', menu && !alarma && salio === 0, JSON.stringify({ menu, alarma, salio }));
  }
};
const pedidos = process.argv.slice(2); let bien = 0, total = 0;
for (const [n, fn] of Object.entries(escenarios)) {
  if (pedidos.length && !pedidos.includes(n)) continue;
  total++;
  try { if (await fn()) bien++; } catch (e) { console.log('FALLA', n, '—', e.message.slice(0, 260)); }
}
cerrarServidor();
console.log(`${total} escenarios: ${bien} bien, ${total - bien} con problemas`);
