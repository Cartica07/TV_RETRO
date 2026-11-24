// Arma app-unificada/www/: la app TV RETRO con TV Pro (Wi-Fi, nube) y TV Lite (Bluetooth) en una sola.
//
// Parte de la app Pro COPIADA (index.html, js/, css/, fonts/: SIN editarlos en el repo) y le cambia, solo en la copia:
//   - js/firebase.js  -> el ENRUTADOR (src/backend-unificado.js); el original queda como js/firebase-pro.js
//   - js/gif.js       -> src/gif-unificado.js (avisos de peso por tipo de TV); el original queda como js/gif-pro.js
//   - js/lite-tv.js   -> la parte Bluetooth (src/lite-tv.js + ble.js de app-lite), empaquetada con esbuild
//   - js/anadir-lite.js, css/unificada.css, el botón "Tengo una TV Lite" y la pantalla "Conecta tu TV" (index.html)
// Con --apk además deja la copia lista para Capacitor (igual que app-android/copiar-web.mjs: SDK de Firebase dentro de la app,
// sin la política de seguridad de la web y sin viewport-fit=cover).
// Después: `npx cap sync android` lleva www-apk/ a la APK.
import { createRequire } from 'node:module';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = dirname(fileURLToPath(import.meta.url));
const panel = join(aqui, '..'); // raíz del repo (la app Pro: SOLO se lee)
const lite = join(aqui, '..', 'app-lite');
const { build } = require(join(lite, 'node_modules', 'esbuild'));
const paraApk = process.argv.includes('--apk');
// --sin-pepito: la copia con los textos de la Pro tal cual (sin el nombre "Pepito"). Solo para correr-pruebas-pro.mjs: las pruebas
// ORIGINALES de la Pro buscan sus propios textos, y así siguen probando que la lógica es la misma.
const sinPepito = !paraApk && process.argv.includes('--sin-pepito');
// La web (pruebas) y la APK van en carpetas distintas: así armar una no pisa a la otra mientras se prueba.
const www = join(aqui, paraApk ? 'www-apk' : sinPepito ? 'www-sin-pepito' : 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(join(www, 'js'), { recursive: true });
mkdirSync(join(www, 'css'), { recursive: true });

// ---- js/ de la Pro, copiado; firebase.js y gif.js se reemplazan y los originales se conservan con otro nombre ----
const proJs = join(panel, 'js');
for (const f of readdirSync(proJs)) {
  if (!f.endsWith('.js')) continue;
  const destino = f === 'firebase.js' ? 'firebase-pro.js' : f === 'gif.js' ? 'gif-pro.js' : f;
  copyFileSync(join(proJs, f), join(www, 'js', destino));
}

// El enrutador tiene que tener TODO lo que exporta el firebase.js de la Pro (y nada que no empiece con "unificada").
const nombresExportados = (texto) => {
  const nombres = new Set();
  for (const m of texto.matchAll(/^export (?:async )?(?:function|const|class|let) (\w+)/gm)) nombres.add(m[1]);
  for (const m of texto.matchAll(/^export\s*\{([^}]*)\}/gm)) m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop()).filter(Boolean).forEach((x) => nombres.add(x));
  return nombres;
};
const fuenteRouter = readFileSync(join(aqui, 'src', 'backend-unificado.js'), 'utf8');
const delPro = nombresExportados(readFileSync(join(proJs, 'firebase.js'), 'utf8'));
const delRouter = nombresExportados(fuenteRouter);
const faltan = [...delPro].filter((n) => !delRouter.has(n));
const sobran = [...delRouter].filter((n) => !delPro.has(n) && !n.startsWith('unificada'));
if (faltan.length || sobran.length) {
  throw new Error(`El enrutador (src/backend-unificado.js) no coincide con js/firebase.js de la Pro. Faltan: ${faltan.join(', ') || '-'}. Sobran: ${sobran.join(', ') || '-'}.`);
}
// La dirección del SDK de autenticación que usa firebase-pro.js (en la web, gstatic; en la APK, la copia de vendor/): el enrutador la
// necesita para entrar sin cuenta (sesión anónima) con la MISMA copia del SDK.
const urlAuth = (readFileSync(join(proJs, 'firebase.js'), 'utf8').match(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-auth\.js/) || [])[0];
if (!urlAuth) throw new Error('js/firebase.js de la Pro ya no importa el SDK de autenticación desde gstatic: revisa app-unificada/construir.mjs');
// Lo mismo con el SDK de base de datos (para leer la actualización de una TV Lite, firmware/lite/…).
const urlDb = (readFileSync(join(proJs, 'firebase.js'), 'utf8').match(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-database\.js/) || [])[0];
if (!urlDb) throw new Error('js/firebase.js de la Pro ya no importa el SDK de base de datos desde gstatic: revisa app-unificada/construir.mjs');
const conAuth = fuenteRouter.replace("'__SDK_AUTH__'", JSON.stringify(paraApk ? './vendor/firebase.js' : urlAuth));
const routerFinal = conAuth.replace("'__SDK_DB__'", JSON.stringify(paraApk ? './vendor/firebase.js' : urlDb));
if (conAuth === fuenteRouter || routerFinal === conAuth || /__SDK_(AUTH|DB)__/.test(routerFinal)) throw new Error('No se pudo poner la dirección del SDK en el enrutador (falta __SDK_AUTH__ o __SDK_DB__)');
writeFileSync(join(www, 'js', 'firebase.js'), routerFinal);
copyFileSync(join(aqui, 'src', 'gif-unificado.js'), join(www, 'js', 'gif.js'));
copyFileSync(join(aqui, 'src', 'anadir-lite.js'), join(www, 'js', 'anadir-lite.js'));
copyFileSync(join(aqui, 'src', 'registro-lite.js'), join(www, 'js', 'registro-lite.js'));
copyFileSync(join(aqui, 'src', 'teclado.js'), join(www, 'js', 'teclado.js'));
for (const f of ['atras.js', 'buscar-canciones.js', 'barra-actualizar.js', 'cara.js', 'cara-datos.js', 'caras.js']) copyFileSync(join(aqui, 'src', f), join(www, 'js', f));

// Más > Caras de reloj (2026-11-24): mas.js y main.js de la Pro no conocen la pantalla nueva. En la COPIA se agrega "caras" a las
// pantallas de Más (mas.js avisa a js/caras.js al abrirla) y main.js la muestra con su título. Si esas líneas de la Pro cambian,
// la compilación falla (no queda a medias).
{
  const parchar = (archivo, cambios) => {
    const ruta = join(www, 'js', archivo);
    let fuente = readFileSync(ruta, 'utf8');
    for (const [viejo, nuevo] of cambios) {
      const veces = fuente.split(viejo).length - 1;
      if (veces !== 1) throw new Error(`Caras de reloj: en js/${archivo} "${viejo.slice(0, 60)}" aparece ${veces} veces (se esperaba 1). La Pro cambió: revisa app-unificada/construir.mjs`);
      fuente = fuente.replace(viejo, () => nuevo);
    }
    writeFileSync(ruta, fuente);
  };
  parchar('mas.js', [
    ["['juegos', 'galeria', 'alarma', 'config'].includes(vista)", "['juegos', 'galeria', 'alarma', 'config', 'caras'].includes(vista)"],
    ["    if (masVista === 'alarma') abrirAlarma();", "    if (masVista === 'alarma') abrirAlarma();\n    if (masVista === 'caras') window.dispatchEvent(new CustomEvent('pepito-abrir-caras'));"],
  ]);
  parchar('main.js', [
    ["  const enGaleria = enMas && obtenerMasVista() === 'galeria';", "  const enGaleria = enMas && obtenerMasVista() === 'galeria';\n  const enCaras = enMas && obtenerMasVista() === 'caras';"],
    ["  if (elementos.seccionAlarma) elementos.seccionAlarma.style.display = enAlarma ? 'block' : 'none';", "  if (elementos.seccionAlarma) elementos.seccionAlarma.style.display = enAlarma ? 'block' : 'none';\n  { const sc = document.getElementById('seccionCaras'); if (sc) sc.style.display = enCaras ? 'block' : 'none'; }"],
    ["enAlarma ? 'Alarma' :", "enAlarma ? 'Alarma' : enCaras ? 'Caras de reloj' :"],
  ]);
}

// Sin internet, cuentas.js de la Pro corta el arranque con "Sin conexión…" ANTES de pedir la lista de TV. En la unificada esa
// decisión la toma el enrutador (listarMisDispositivos, con el mismo texto): con una TV Lite ya añadida se sigue, porque va por
// Bluetooth. Se cambia solo la COPIA (la Pro no se toca) y, si esa línea de la Pro cambia, la compilación falla.
{
  const ruta = join(www, 'js', 'cuentas.js');
  const fuente = readFileSync(ruta, 'utf8');
  const patron = /const r = navigator\.onLine === false\r?\n\s*\? \{ exito: false, error: 'Sin conexión a internet\. Conéctate y pulsa Reintentar\.' \}\r?\n\s*: await listarMisDispositivos\(sesion\.uid\);/g;
  const veces = (fuente.match(patron) || []).length;
  if (veces !== 1) throw new Error('js/cuentas.js de la Pro ya no tiene el aviso "sin internet" de resolverDispositivo: revisa app-unificada/construir.mjs');
  writeFileSync(ruta, fuente.replace(patron, 'const r = await listarMisDispositivos(sesion.uid); // unificada: el aviso "sin internet" lo da el enrutador'));
}

// Apagado automático de la pantalla (2026-11-23): normalizarAjustes de la Pro deja SOLO brillo, volumen y zona, así que al
// guardar (y al leer) los ajustes de un Pepito Pro se perdería "apagado". En la COPIA se le agrega ese campo cuando viene (la
// Pro no se toca; si esa función de la Pro cambia, la compilación falla). Con --sin-pepito queda como la Pro.
if (!sinPepito) {
  const ruta = join(www, 'js', 'firebase-pro.js');
  const fuente = readFileSync(ruta, 'utf8');
  const patron = /(    zona: entero\(d\.zona, -720, 840, AJUSTES_DEFECTO\.zona\))(\r?\n  \};)/g;
  const veces = (fuente.match(patron) || []).length;
  if (veces !== 1) throw new Error('js/firebase.js de la Pro ya no tiene normalizarAjustes como se esperaba: revisa app-unificada/construir.mjs');
  writeFileSync(ruta, fuente.replace(patron, '$1,\n    // unificada: apagado automático de la pantalla (0 = nunca, 5, 10, 20 minutos), solo si viene\n    ...(d.apagado !== undefined ? { apagado: [0, 5, 10, 20].includes(Number(d.apagado)) ? Number(d.apagado) : 5 } : {})$2'));
}

// La parte Bluetooth (ble.js de la app Lite, el plugin de Capacitor y lite-tv.js) en un solo archivo ESM.
await build({
  entryPoints: [join(aqui, 'src', 'lite-tv.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  outfile: join(www, 'js', 'lite-tv.js'),
  charset: 'utf8', // los textos quedan legibles (con tildes, no \xE9): así se les puede aplicar el nombre "Pepito"
  logLevel: 'info',
});

// Para la APK: el SDK de Firebase no se baja de gstatic, va DENTRO de la app (igual que app-android/copiar-web.mjs: solo lo que
// usa js/firebase.js, en un único archivo, y las tres direcciones de gstatic de firebase-pro.js apuntan a él).
if (paraApk) {
  const ENTRADA_SDK = `
export { initializeApp } from 'firebase/app';
export { getDatabase, ref, get, set, update, remove, onValue, runTransaction } from 'firebase/database';
export { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  sendPasswordResetEmail, sendEmailVerification, GoogleAuthProvider, signInWithPopup, signInWithCredential,
  EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, deleteUser, signInAnonymously } from 'firebase/auth';
`;
  mkdirSync(join(www, 'js', 'vendor'), { recursive: true });
  await build({
    stdin: { contents: ENTRADA_SDK, resolveDir: aqui, sourcefile: 'entrada-sdk.js' },
    outfile: join(www, 'js', 'vendor', 'firebase.js'),
    bundle: true, format: 'esm', platform: 'browser', target: 'es2020', minify: true, legalComments: 'none', logLevel: 'warning',
  });
  const rutaPro = join(www, 'js', 'firebase-pro.js');
  const fuentePro = readFileSync(rutaPro, 'utf8');
  const sinCdn = fuentePro.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-(?:app|database|auth)\.js/g, './vendor/firebase.js');
  if (sinCdn === fuentePro || /gstatic\.com\/firebasejs/.test(sinCdn)) throw new Error('js/firebase.js de la Pro ya no importa el SDK desde gstatic: revisa app-unificada/construir.mjs');
  writeFileSync(rutaPro, sinCdn);
  // Todo lo que importa firebase-pro.js del SDK tiene que estar en el paquete.
  const importado = new Set();
  for (const m of sinCdn.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/vendor\/firebase\.js'/g)) m[1].split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => importado.add(x));
  const paquete = readFileSync(join(www, 'js', 'vendor', 'firebase.js'), 'utf8');
  const exportado = new Set();
  for (const m of paquete.matchAll(/export\s*\{([^}]*)\}/g)) m[1].split(',').forEach((x) => exportado.add(x.split(/\s+as\s+/).pop().trim()));
  const faltanSdk = [...importado].filter((x) => !exportado.has(x));
  if (importado.size === 0 || faltanSdk.length) throw new Error('El paquete del SDK no exporta: ' + (faltanSdk.join(', ') || '(no se encontraron importaciones)'));
  // Y lo que usa el enrutador para entrar sin cuenta.
  for (const n of ['getAuth', 'signInAnonymously']) if (!exportado.has(n)) throw new Error('El paquete del SDK no exporta ' + n);
}

// ---- index.html de la Pro, con los cambios mínimos ----
let html = readFileSync(join(panel, 'index.html'), 'utf8');
const original = html;
const cambiar = (patron, por, que) => {
  const nuevo = html.replace(patron, por);
  if (nuevo === html) throw new Error(`index.html de la Pro ya no tiene ${que}: revisa app-unificada/construir.mjs`);
  html = nuevo;
};
cambiar(/(<link rel="stylesheet" href="css\/style\.css" \/>)/, '$1\n  <link rel="stylesheet" href="css/unificada.css" />', 'el enlace a style.css');
// Botón para una TV Lite en "Añade tu TV" / "Mis TV" (dentro del formulario, debajo de "Vincular"). Texto PROPUESTO: lo aprueba el dueño.
cambiar(/(<button type="submit" id="botonVincularTV" class="boton-primario">Vincular<\/button>)/,
  '$1\n      <button type="button" id="botonTVLite" class="boton-secundario">Tengo un Pepito Lite</button>',
  'el botón Vincular');
// Pantalla "Conecta tu TV": hijo directo de <body>, después de Mi TV (para quedar encima) y como el tutorial, sin heredar el `inert` del panel.
const pantallaConexion = `<div class="pantalla-login" id="pantallaConexion" hidden>
  <div class="login-tarjeta">
    <div class="login-marca">
      <span class="login-logo" aria-hidden="true">
        <svg class="icono" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
      </span>
      <h1 class="login-titulo">Conecta a Pepito</h1>
    </div>
    <ol class="pasos-conexion">
      <li>Enciende a Pepito. Verás un PIN en su pantalla.</li>
      <li>Toca "Abrir Bluetooth", elige "Pepito Lite" y escribe el PIN.</li>
      <li>Regresa a la app y ya Pepito estará listo para ser usado.</li>
    </ol>
    <button type="button" id="botonAbrirBluetooth" class="boton-primario">Abrir Bluetooth</button>
    <button type="button" id="botonConexionVolver" class="boton-secundario">Volver</button>
  </div>
</div>
`;
// Primera pantalla "¿Qué TV tienes?" (la maneja js/anadir-lite.js): encima del inicio de sesión de la Pro. Nace oculta; la muestra el
// script solo si el celular todavía no tiene la respuesta. Textos PROPUESTOS: los aprueba el dueño.
const pantallaInicioTipo = `<div class="pantalla-login" id="pantallaInicioTipo" hidden>
  <div class="login-tarjeta">
    <div class="login-marca">
      <span class="login-logo" aria-hidden="true">
        <svg class="icono" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
      </span>
      <h1 class="login-titulo">Pepito</h1>
      <p class="login-subtitulo">¿Qué Pepito tienes?</p>
    </div>
    <button type="button" id="botonInicioPro" class="boton-primario">Pepito Pro</button>
    <button type="button" id="botonInicioLite" class="boton-primario">Pepito Lite</button>
    <div id="inicioTipoError" class="aviso error" role="alert" hidden></div>
  </div>
</div>
`;
// Buscar canción (pedido del dueño, 2026-11-23; la maneja js/buscar-canciones.js): una lupa junto a la lista de canciones y junto al
// tono de la alarma, y una ventana con un campo de búsqueda y la lista filtrada. Textos PROPUESTOS (lite-textos-propuestos.md 43 a 45).
const ICONO_LUPA = '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>';
const botonLupa = (id, para) => `<button type="button" id="${id}" class="boton-icono boton-buscar-cancion" data-buscar-en="${para}" aria-label="Buscar canción" title="Buscar canción">${ICONO_LUPA}</button>`;
cambiar(/(<select id="seleccionCancion"><\/select>\s*<svg[^>]*selector-flecha[^>]*>[\s\S]*?<\/svg>\s*<\/div>)/,
  `$1\n          ${botonLupa('botonBuscarCancion', 'seleccionCancion')}`, 'la lista de canciones');
cambiar(/<div class="selector">(\s*<select id="alarmaTono"><\/select>\s*<svg[^>]*selector-flecha[^>]*>[\s\S]*?<\/svg>\s*)<\/div>/,
  `<div class="fila-cancion"><div class="selector">$1</div>\n          ${botonLupa('botonBuscarTono', 'alarmaTono')}</div>`, 'el tono de la alarma');
// Una sola ventana: con buscador ocupa toda la pantalla (canciones); sin buscador (listas cortas) es una tarjeta centrada del tamaño
// de sus opciones, sobre el fondo oscurecido (unificada.css, clase sin-busqueda).
const buscadorCanciones = `<div class="buscador-canciones" id="buscadorCanciones" role="dialog" aria-modal="true" aria-label="Buscar canción" hidden>
  <div class="buscador-tarjeta">
    <div class="buscador-cabecera">
      <span class="buscador-titulo" id="buscadorTitulo" hidden></span>
      <span class="buscador-lupa">${ICONO_LUPA}</span>
      <input type="text" id="buscadorTexto" placeholder="Buscar canción" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Buscar canción" />
      <button type="button" id="buscadorCerrar" class="boton-icono" aria-label="Cerrar" title="Cerrar"><svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
    </div>
    <ul class="buscador-lista" id="buscadorLista"></ul>
    <p class="buscador-vacio" id="buscadorVacio" hidden>No hay canciones con ese nombre.</p>
  </div>
</div>
`;
cambiar(/(<!-- Tutorial guiado \(docs\/plan-tutorial\.md\))/, `${pantallaConexion}\n${pantallaInicioTipo}\n${buscadorCanciones}\n$1`, 'el comentario del tutorial');
// Más > Config > Ajustes: "Apagar pantalla" debajo de la zona horaria (textos dictados por el dueño, 2026-11-23). La lee y la
// guarda el enrutador (src/backend-unificado.js); se abre en la ventanita de listas cortas (js/buscar-canciones.js).
if (!sinPepito) {
  cambiar(/(<select id="ajusteZona">[\s\S]*?<\/select>\s*<svg[^>]*selector-flecha[^>]*>[\s\S]*?<\/svg>\s*<\/div>\s*<\/div>)/, `$1
      <div class="campo">
        <label class="rotulo" for="ajusteApagado">Apagar pantalla</label>
        <div class="selector">
          <select id="ajusteApagado">
            <option value="5">A los 5 min</option>
            <option value="10">A los 10 min</option>
            <option value="20">A los 20 min</option>
            <option value="0" data-nota="La pantalla quedará siempre encendida: gasta mucha más batería.">Nunca</option>
          </select>
          <svg class="icono selector-flecha" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>`, 'la zona horaria de los ajustes');
// (El aviso de "Nunca" no va como renglón aparte: la pantalla de Ajustes dejaría de entrar sin scroll en 360x740. Se ve debajo
// de "Nunca" en la ventanita de opciones (data-nota) y, al elegirla, en la línea de estado de arriba.)
}
// Ayuda y Legal: las páginas de Pepito (pepito/ del repo: cubren Pepito Pro y Pepito Lite), no las de la app vieja.
// (Con --sin-pepito quedan los de la Pro, como el resto de sus textos.)
if (!sinPepito) cambiar(/https:\/\/cartica07\.github\.io\/TV_RETRO\/(ayuda|privacidad|terminos|licencias)\.html/g, 'https://cartica07.github.io/TV_RETRO/pepito/$1.html', 'los enlaces de Ayuda y Legal');
// Más > Caras de reloj (2026-11-24, docs/plan-caras-de-reloj.md; la maneja js/caras.js): un botón en el menú Más (después de
// Alarma) y su pantalla: la vista previa de la cara (dibujada por js/cara.js, igual que la TV), la lista de caras (se abre en
// la ventanita de listas cortas) y "Enviar a Pepito". "Caras de reloj" y el aviso de la Pro vieja: textos aprobados.
// (Con --sin-pepito no se agrega: esa copia es la que usan las pruebas ORIGINALES de la Pro, que cuentan 4 opciones en Más.)
if (!sinPepito) {
cambiar(/(<button type="button" class="fila-mas" data-mas="config">)/,
  `<button type="button" class="fila-mas" data-mas="caras">
          <svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
          <span class="nombre-mas">Caras de reloj</span>
          <svg class="icono chevron" viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
        $1`, 'el botón Config del menú Más');
cambiar(/(<div id="seccionAlarma" style="display: none;">)/,
  `<div id="seccionCaras" style="display: none;">
      <div class="campo cara-previa">
        <canvas id="caraVista" width="256" height="128" aria-label="Vista previa de la cara del reloj"></canvas>
      </div>
      <div class="campo">
        <div class="selector">
          <select id="caraLista" aria-label="Caras de reloj"><option value="">Cara 1</option></select>
          <svg class="icono selector-flecha" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <p class="dato-cuenta" id="caraAviso" role="status" aria-live="polite" hidden></p>
      <button type="button" id="botonEnviarCara" class="boton-primario">Enviar a Pepito</button>
    </div>

    $1`, 'la sección de la Alarma');
}
// Más > Config > Sistema: barra de avance de "Actualizar" (pedido del dueño, 2026-11-23, Pepito Pro y Lite; la mueve
// js/barra-actualizar.js). Oculta hasta que empieza una actualización.
cambiar(/(<p class="dato-cuenta" id="sistemaEstadoActualizar"[^>]*><\/p>)/,
  '$1\n        <div class="barra-actualizar" id="barraActualizar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><div class="barra-actualizar-relleno" id="barraActualizarRelleno"></div></div>',
  'el estado de la actualización (Sistema)');
// atras.js va ANTES que main.js (envuelve el botón Atrás antes de que la Pro lo escuche); lo demás, después.
cambiar(/(<script type="module" src="js\/main\.js"><\/script>)/,
  '<script type="module" src="js/atras.js"></script>\n$1\n<script type="module" src="js/anadir-lite.js"></script>\n<script type="module" src="js/teclado.js"></script>\n<script type="module" src="js/buscar-canciones.js"></script>\n<script type="module" src="js/barra-actualizar.js"></script>\n<script type="module" src="js/caras.js"></script>',
  'el script js/main.js');

if (paraApk) {
  cambiar(/[ \t]*<!-- H-21: política de seguridad[\s\S]*?-->\r?\n/, '', 'el comentario de la política de seguridad');
  cambiar(/[ \t]*<meta http-equiv="Content-Security-Policy"[^>]*>\r?\n/, '', 'la política de seguridad (meta)');
  cambiar(/, *viewport-fit=cover/, '', 'viewport-fit=cover');
}
if (html === original) throw new Error('el HTML no cambió');
writeFileSync(join(www, 'index.html'), html);

// ---- diseño de la Pro (sin cambios) y lo propio de la unificada ----
for (const css of ['tokens.css', 'style.css', 'fuentes.css']) copyFileSync(join(panel, 'css', css), join(www, 'css', css));
cpSync(join(panel, 'fonts'), join(www, 'fonts'), { recursive: true });
copyFileSync(join(aqui, 'src', 'unificada.css'), join(www, 'css', 'unificada.css'));

// ---- Nombre "Pepito" (docs/nombre-pepito.md): textos de la COPIA, con revisión de que no quede "TV" a la vista ----
if (!sinPepito) {
  const { TEXTOS_PEPITO, TV_PERMITIDO } = await import(pathToFileURL(join(aqui, 'src', 'textos-pepito.mjs')).href);
  const contar = (texto, buscado) => texto.split(buscado).length - 1;
  const porArchivo = new Map();
  for (const [archivo, viejo, nuevo, veces] of TEXTOS_PEPITO) {
    const ruta = join(www, archivo);
    let texto = porArchivo.has(ruta) ? porArchivo.get(ruta) : readFileSync(ruta, 'utf8');
    const hay = contar(texto, viejo);
    if (veces === null ? hay < 1 : hay !== veces) {
      throw new Error(`Pepito: en ${archivo} "${viejo}" aparece ${hay} veces (se esperaban ${veces === null ? 'una o más' : veces}). La Pro cambió ese texto: revisa app-unificada/src/textos-pepito.mjs`);
    }
    texto = texto.split(viejo).join(nuevo);
    porArchivo.set(ruta, texto);
  }
  for (const [ruta, texto] of porArchivo) writeFileSync(ruta, texto);

  // Revisión: ningún "TV" a la vista. En el HTML, fuera de los comentarios (los IDs como codigoTV no cuentan: no es una palabra
  // suelta). En el JS, dentro de textos entre comillas, sin contar comentarios ni mensajes de consola.
  const quedan = [];
  const permitido = (s) => TV_PERMITIDO.some((p) => s.includes(p));
  const htmlFinal = readFileSync(join(www, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  for (const linea of htmlFinal.split(/\r?\n/)) if (/\bTV\b/.test(linea) && !permitido(linea)) quedan.push('index.html: ' + linea.trim());
  for (const f of readdirSync(join(www, 'js'))) {
    if (!f.endsWith('.js')) continue;
    for (const lineaCompleta of readFileSync(join(www, 'js', f), 'utf8').split(/\r?\n/)) {
      if (/^\s*(\/\/|\*|\/\*)/.test(lineaCompleta) || /console\.(log|info|warn|error)/.test(lineaCompleta)) continue;
      const linea = lineaCompleta.replace(/\s\/\/\s.*$/, ''); // comentario al final de la línea
      for (const m of linea.matchAll(/(['"`])((?:(?!\1).)*)\1/g)) {
        if (/\bTV\b/.test(m[2]) && !permitido(m[2])) quedan.push(`js/${f}: ${m[0].slice(0, 120)}`);
      }
    }
  }
  if (quedan.length) throw new Error('Pepito: todavía se ve "TV" en:\n  ' + quedan.join('\n  ') + '\nAgrégalo a app-unificada/src/textos-pepito.mjs (o a TV_PERMITIDO si no se ve).');
}

console.log(`app-unificada/${paraApk ? 'www-apk' : sinPepito ? 'www-sin-pepito' : 'www'} listo`);
