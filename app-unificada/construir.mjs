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
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = dirname(fileURLToPath(import.meta.url));
const panel = join(aqui, '..'); // raíz del repo (la app Pro: SOLO se lee)
const lite = join(aqui, '..', 'app-lite');
const { build } = require(join(lite, 'node_modules', 'esbuild'));
const paraApk = process.argv.includes('--apk');
// La web (pruebas) y la APK van en carpetas distintas: así armar una no pisa a la otra mientras se prueba.
const www = join(aqui, paraApk ? 'www-apk' : 'www');

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
writeFileSync(join(www, 'js', 'firebase.js'), fuenteRouter);
copyFileSync(join(aqui, 'src', 'gif-unificado.js'), join(www, 'js', 'gif.js'));
copyFileSync(join(aqui, 'src', 'anadir-lite.js'), join(www, 'js', 'anadir-lite.js'));
copyFileSync(join(aqui, 'src', 'registro-lite.js'), join(www, 'js', 'registro-lite.js'));

// La parte Bluetooth (ble.js de la app Lite, el plugin de Capacitor y lite-tv.js) en un solo archivo ESM.
await build({
  entryPoints: [join(aqui, 'src', 'lite-tv.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  outfile: join(www, 'js', 'lite-tv.js'),
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
  EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, deleteUser } from 'firebase/auth';
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
  '$1\n      <button type="button" id="botonTVLite" class="boton-secundario">Tengo una TV Lite</button>',
  'el botón Vincular');
// Pantalla "Conecta tu TV": hijo directo de <body>, después de Mi TV (para quedar encima) y como el tutorial, sin heredar el `inert` del panel.
const pantallaConexion = `<div class="pantalla-login" id="pantallaConexion" hidden>
  <div class="login-tarjeta">
    <div class="login-marca">
      <span class="login-logo" aria-hidden="true">
        <svg class="icono" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
      </span>
      <h1 class="login-titulo">Conecta tu TV</h1>
    </div>
    <ol class="pasos-conexion">
      <li>Enciende la TV. Verás un PIN en su pantalla.</li>
      <li>Toca "Abrir Bluetooth", elige "TV RETRO Lite" y escribe el PIN.</li>
      <li>Vuelve a esta app. Se conecta sola.</li>
    </ol>
    <button type="button" id="botonAbrirBluetooth" class="boton-primario">Abrir Bluetooth</button>
    <button type="button" id="botonConexionVolver" class="boton-secundario">Volver</button>
  </div>
</div>
`;
cambiar(/(<!-- Tutorial guiado \(docs\/plan-tutorial\.md\))/, `${pantallaConexion}\n$1`, 'el comentario del tutorial');
// "¿Qué TV tienes?" (solo la primera vez, cuando la cuenta aún no tiene ninguna TV): dentro de la tarjeta "Añade tu TV", con TV Pro
// marcada por defecto (el código de siempre) y TV Lite (abre "Conecta tu TV"). Textos PROPUESTOS: los aprueba el dueño.
cambiar(/(<form class="login-form" id="formTV")/,
  `<div class="campo" id="elegirTipoTV">
      <span class="rotulo">¿Qué TV tienes?</span>
      <div class="segmento" role="group" aria-label="Tipo de TV">
        <button type="button" data-tipo-tv="pro" class="activo">TV Pro</button>
        <button type="button" data-tipo-tv="lite">TV Lite</button>
      </div>
    </div>

    $1`,
  'el formulario de Mi TV');
cambiar(/(<script type="module" src="js\/main\.js"><\/script>)/, '$1\n<script type="module" src="js/anadir-lite.js"></script>', 'el script js/main.js');

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

console.log(`app-unificada/${paraApk ? 'www-apk' : 'www'} listo`);
