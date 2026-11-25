// Más > Config: lista de apartados, Mi cuenta, Ajustes de la TV, Ayuda y Legal. Firebase falso.
import { abrir, cerrarServidor, informe } from './banco.mjs';
const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } };
const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };
const semilla = (extra = {}) => ({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 5, contadorVersion: 5, pantalla: pant }, ...extra } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } }
});
async function abrirApp({ app = false, extra = {} } = {}) {
  const r = await abrir(semilla(extra), { ruta: '/index.html', esperar: false, antes: async (p) => {
    await p.addInitScript((s) => {
      globalThis.__semillaAuth = s.auth; globalThis.__persistirDb = true;
      if (s.app) globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { App: { addListener: (ev, cb) => { globalThis.__atras = cb; return Promise.resolve({}); }, exitApp: () => { globalThis.__salio = (globalThis.__salio || 0) + 1; } } } };
    }, { auth: { usuarios: USUARIOS, actual: 'ana@correo.com' }, app });
  } });
  r.pagina.on('dialog', (d) => d.accept());
  await r.pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });
  return r;
}
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'; }, sel);
const txt = (p, sel) => p.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);
const abrirConfig = async (p) => { await p.click('#grupoTipo button[data-valor="galeria"]'); await p.waitForTimeout(200); await p.click('#grupoMas button[data-mas="config"]'); await p.waitForTimeout(250); };
const apartado = async (p, a) => { await p.click(`#grupoConfig button[data-config="${a}"]`); await p.waitForTimeout(400); };
const marcado = (p, grupo) => p.evaluate((g) => (document.querySelector(`#${g} button[aria-pressed="true"]`) || {}).dataset?.valor, grupo);
const db = (p) => p.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1);

const escenarios = {
  async 'Config: lista con los cuatro apartados'() {
    const { navegador, pagina } = await abrirApp(); await abrirConfig(pagina);
    const titulo = await txt(pagina, '#tituloMas'), lista = await vis(pagina, '#seccionConfig'), menu = await vis(pagina, '#seccionMasSelector'), enviar = await vis(pagina, '.barra-accion');
    const filas = await pagina.$$eval('#grupoConfig button', (bs) => bs.map((b) => b.textContent.trim()));
    await navegador.close();
    return informe('Config: título, lista Mi cuenta / Ajustes de la TV / Sistema / Ayuda y contacto / Legal, sin el menú ni Enviar', titulo === 'Config' && lista && !menu && !enviar && filas.join('|') === 'Mi cuenta|Ajustes de la TV|Sistema|Ayuda y contacto|Legal', JSON.stringify({ titulo, lista, menu, enviar, filas }));
  },
  async 'cada apartado con su título; volver lleva a la lista y de ahí al menú'() {
    const { navegador, pagina } = await abrirApp(); await abrirConfig(pagina);
    const titulos = [];
    for (const a of ['cuenta', 'tv', 'sistema', 'ayuda', 'legal']) {
      await apartado(pagina, a);
      titulos.push(await txt(pagina, '#tituloMas'));
      await pagina.click('#botonMasVolver'); await pagina.waitForTimeout(200);
    }
    const enLista = await vis(pagina, '#seccionConfig');
    await pagina.click('#botonMasVolver'); await pagina.waitForTimeout(200);
    const enMenu = await vis(pagina, '#seccionMasSelector');
    await navegador.close();
    return informe('títulos de los apartados; volver: apartado → lista → menú de Más', titulos.join('|') === 'Mi cuenta|Ajustes de la TV|Sistema|Ayuda y contacto|Legal' && enLista && enMenu, JSON.stringify({ titulos, enLista, enMenu }));
  },
  async 'Mi cuenta: muestra el correo y lleva a Mis TV y a Eliminar mi cuenta'() {
    const { navegador, pagina } = await abrirApp(); await abrirConfig(pagina); await apartado(pagina, 'cuenta');
    const correo = await txt(pagina, '#configCorreo');
    await pagina.click('#botonConfigMisTV'); await pagina.waitForTimeout(300);
    const misTV = (await vis(pagina, '#pantallaTV')) && (await txt(pagina, '#tvTitulo')) === 'Mis TV';
    await pagina.click('#botonTVVolver'); await pagina.waitForTimeout(200);
    await pagina.click('#botonConfigEliminarCuenta'); await pagina.waitForTimeout(300);
    const baja = (await vis(pagina, '#eliminarCuenta')) && (await txt(pagina, '#tvTitulo')) === 'Eliminar mi cuenta';
    await navegador.close();
    return informe('Mi cuenta: correo de la sesión; "Mis TV" abre la lista; "Eliminar mi cuenta" abre la baja', correo === 'ana@correo.com' && misTV && baja, JSON.stringify({ correo, misTV, baja }));
  },
  async 'Mi cuenta: cerrar sesión vuelve al login'() {
    const { navegador, pagina } = await abrirApp(); await abrirConfig(pagina); await apartado(pagina, 'cuenta');
    await pagina.click('#botonConfigCerrarSesion');
    await pagina.waitForFunction(() => !document.getElementById('pantallaLogin').hidden, null, { timeout: 10000 });
    await navegador.close();
    return informe('Cerrar sesión desde Config vuelve al login', true, '');
  },
  async 'Ajustes: valores por defecto si aún no hay nada guardado'() {
    const { navegador, pagina } = await abrirApp(); await abrirConfig(pagina); await apartado(pagina, 'tv');
    const brillo = await marcado(pagina, 'grupoBrillo'), volumen = await marcado(pagina, 'grupoVolumen'), zona = await pagina.inputValue('#ajusteZona');
    await navegador.close();
    return informe('por defecto: brillo Alto (3), volumen Alto (3), zona Colombia (-300)', brillo === '3' && volumen === '3' && zona === '-300', JSON.stringify({ brillo, volumen, zona }));
  },
  async 'Ajustes: guardar escribe los ajustes y manda la orden a la TV'() {
    const { navegador, pagina } = await abrirApp(); await abrirConfig(pagina); await apartado(pagina, 'tv');
    await pagina.click('#grupoBrillo button[data-valor="1"]');
    await pagina.click('#grupoVolumen button[data-valor="0"]');
    await pagina.selectOption('#ajusteZona', '-360');
    const antes = (await db(pagina)).oled_remota.version;
    await pagina.click('#botonGuardarAjustes'); await pagina.waitForTimeout(800);
    const d = await db(pagina), estado = await txt(pagina, '#estadoTexto');
    await navegador.close();
    return informe('Guardar: {brillo 1, volumen 0, zona -360}, orden tipo "ajustes", versión nueva y "Ajustes guardados"',
      d.ajustes && d.ajustes.brillo === 1 && d.ajustes.volumen === 0 && d.ajustes.zona === -360 && d.oled_remota.pantalla.tipo === 'ajustes' && d.oled_remota.version > antes && /Ajustes guardados/.test(estado),
      JSON.stringify({ ajustes: d.ajustes, tipo: d.oled_remota.pantalla.tipo, v0: antes, v1: d.oled_remota.version, estado }));
  },
  async 'Ajustes: guardar conserva el apagado y la ciudad que puso la app Pepito'() {
    const ciudad = { nombre: 'Armenia, Quindío, Colombia', lat: 4.5339, lon: -75.6811 };
    const { navegador, pagina } = await abrirApp({ extra: { ajustes: { brillo: 2, volumen: 1, zona: -300, apagado: 0, ciudad } } }); await abrirConfig(pagina); await apartado(pagina, 'tv');
    await pagina.click('#grupoBrillo button[data-valor="3"]');
    await pagina.click('#botonGuardarAjustes'); await pagina.waitForTimeout(800);
    const d = await db(pagina);
    await navegador.close();
    return informe('Guardar conserva apagado (Nunca) y ciudad (2026-11-24; antes se borraban)',
      d.ajustes && d.ajustes.brillo === 3 && d.ajustes.apagado === 0 && JSON.stringify(d.ajustes.ciudad) === JSON.stringify(ciudad), JSON.stringify(d.ajustes));
  },
  async 'Ajustes: guardar conserva los dúos que puso la app Pepito'() {
    const { navegador, pagina } = await abrirApp({ extra: { ajustes: { brillo: 2, volumen: 1, zona: -300, duos: false, duoFavorito: 'corazon' } } }); await abrirConfig(pagina); await apartado(pagina, 'tv');
    await pagina.click('#grupoBrillo button[data-valor="3"]');
    await pagina.click('#botonGuardarAjustes'); await pagina.waitForTimeout(800);
    const d = await db(pagina);
    await navegador.close();
    return informe('Guardar conserva duos (apagados) y duoFavorito (2026-11-24)',
      d.ajustes && d.ajustes.brillo === 3 && d.ajustes.duos === false && d.ajustes.duoFavorito === 'corazon', JSON.stringify(d.ajustes));
  },
  async 'Ajustes: guardar no pisa la ciudad ni el apagado que otro celular cambió mientras tanto'() {
    const vieja = { nombre: 'Armenia, Quindío, Colombia', lat: 4.5339, lon: -75.6811 };
    const nueva = { nombre: 'Bogotá, Colombia', lat: 4.6097, lon: -74.0817 };
    const { navegador, pagina } = await abrirApp({ extra: { ajustes: { brillo: 2, volumen: 1, zona: -300, apagado: 5, ciudad: vieja } } }); await abrirConfig(pagina); await apartado(pagina, 'tv');
    // Otro celular (un miembro, desde Pepito) cambia la ciudad y el apagado con esta pantalla abierta.
    await pagina.evaluate((c) => { const a = globalThis.__fakeDb.raiz.dispositivos.tv1.ajustes; a.ciudad = c; a.apagado = 20; }, nueva);
    await pagina.click('#grupoBrillo button[data-valor="3"]');
    await pagina.click('#botonGuardarAjustes'); await pagina.waitForTimeout(800);
    const d = await db(pagina);
    await navegador.close();
    return informe('Guardar conserva la ciudad y el apagado que otro celular puso después de abrir la pantalla (2026-11-24)',
      d.ajustes && d.ajustes.brillo === 3 && d.ajustes.apagado === 20 && JSON.stringify(d.ajustes.ciudad) === JSON.stringify(nueva), JSON.stringify(d.ajustes));
  },
  async 'Ajustes: lee los guardados (y una zona que no está en la lista)'() {
    const { navegador, pagina } = await abrirApp({ extra: { ajustes: { brillo: 2, volumen: 1, zona: 60 } } }); await abrirConfig(pagina); await apartado(pagina, 'tv');
    const brillo = await marcado(pagina, 'grupoBrillo'), volumen = await marcado(pagina, 'grupoVolumen'), zona = await pagina.inputValue('#ajusteZona');
    const textoZona = await pagina.evaluate(() => document.getElementById('ajusteZona').selectedOptions[0].textContent);
    await navegador.close();
    return informe('lee brillo Medio, volumen Bajo y una zona UTC+1 que no está en la lista', brillo === '2' && volumen === '1' && zona === '60' && textoZona === 'UTC+1', JSON.stringify({ brillo, volumen, zona, textoZona }));
  },
  async 'Ajustes: datos raros vuelven a los valores por defecto'() {
    const { navegador, pagina } = await abrirApp({ extra: { ajustes: { brillo: 9, volumen: -1, zona: 'x' } } }); await abrirConfig(pagina); await apartado(pagina, 'tv');
    const brillo = await marcado(pagina, 'grupoBrillo'), volumen = await marcado(pagina, 'grupoVolumen'), zona = await pagina.inputValue('#ajusteZona');
    await navegador.close();
    return informe('valores inválidos: brillo 3, volumen 3, zona -300', brillo === '3' && volumen === '3' && zona === '-300', JSON.stringify({ brillo, volumen, zona }));
  },
  async 'Ajustes: doble toque en Guardar manda una sola orden'() {
    const { navegador, pagina } = await abrirApp(); await abrirConfig(pagina); await apartado(pagina, 'tv');
    const antes = (await db(pagina)).oled_remota.version;
    await pagina.evaluate(() => { const b = document.getElementById('botonGuardarAjustes'); b.click(); b.click(); b.click(); });
    await pagina.waitForTimeout(900);
    const d = await db(pagina);
    await navegador.close();
    return informe('tres toques seguidos: una sola versión nueva', d.oled_remota.version === antes + 1, JSON.stringify({ antes, ahora: d.oled_remota.version }));
  },
  async 'Ayuda y Legal: enlaces correctos'() {
    const { navegador, pagina } = await abrirApp(); await abrirConfig(pagina); await apartado(pagina, 'ayuda');
    const ayuda = await pagina.$$eval('#configAyuda a', (as) => as.map((a) => a.getAttribute('href')));
    await pagina.click('#botonMasVolver'); await pagina.waitForTimeout(200); await apartado(pagina, 'legal');
    const legal = await pagina.$$eval('#configLegal a', (as) => as.map((a) => a.getAttribute('href').split('/').pop()));
    await navegador.close();
    return informe('Ayuda: preguntas frecuentes y correo; Legal: privacidad, términos y licencias', /ayuda\.html$/.test(ayuda[0]) && /^mailto:/.test(ayuda[1]) && legal.join('|') === 'privacidad.html|terminos.html|licencias.html', JSON.stringify({ ayuda, legal }));
  },
  async 'APK: Atrás en un apartado vuelve a la lista de Config, luego al menú'() {
    const { navegador, pagina } = await abrirApp({ app: true }); await abrirConfig(pagina); await apartado(pagina, 'tv');
    await pagina.evaluate(() => globalThis.__atras()); await pagina.waitForTimeout(200);
    const lista = await vis(pagina, '#seccionConfig');
    await pagina.evaluate(() => globalThis.__atras()); await pagina.waitForTimeout(200);
    const menu = await vis(pagina, '#seccionMasSelector'), salio = await pagina.evaluate(() => globalThis.__salio || 0);
    await navegador.close();
    return informe('APK: Atrás de Ajustes → lista de Config → menú de Más, sin salir', lista && menu && salio === 0, JSON.stringify({ lista, menu, salio }));
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
