// Arma app-lite/www/: la app Lite = la app Pro (js/, css/, index.html, SIN editarlos) con otro "backend".
//
//  1. Empaqueta js/main.js de la Pro con esbuild. Un plugin cambia `./firebase.js` (el único módulo de la Pro
//     que habla con Firebase) por src/backend-lite.js: mismos nombres, pero Bluetooth + almacenamiento del celular.
//  2. Toma index.html de la Pro y le hace los cambios mínimos para la APK (mismos que app-android/copiar-web.mjs:
//     sin política de seguridad de contenido de la web y sin viewport-fit=cover) más los propios de la Lite
//     (modo sin cuentas, lite.css, script empaquetado). Lo que la Lite no usa se oculta con lite.css; nunca se
//     borran elementos del HTML (un ID que falta rompe la app).
//  3. Copia sin cambios css/ (tokens, style, fuentes) y fonts/ de la Pro, y suma lo propio: src/lite.css,
//     canciones/ (el catálogo dentro de la app) y predeterminadas/ (la biblioteca de imágenes y GIF).
// Después: `npx cap sync android` lleva www/ a la APK.
import { build } from 'esbuild';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const panel = join(aqui, '..'); // raíz del repo del panel (la app Pro: SOLO se lee)
const proJs = join(panel, 'js') + sep;
const backendLite = join(aqui, 'src', 'backend-lite.js');
const www = join(aqui, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(join(www, 'css'), { recursive: true });

const cambiarFirebase = {
  name: 'lite-backend',
  setup(b) {
    b.onResolve({ filter: /^\.\/firebase\.js$/ }, (args) => (args.importer.startsWith(proJs) ? { path: backendLite } : undefined));
  },
};

await build({
  entryPoints: [join(proJs, 'main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: join(www, 'app.js'),
  plugins: [cambiarFirebase],
  logLevel: 'info',
});

// ---- index.html de la Pro, con los cambios mínimos ----
let html = readFileSync(join(panel, 'index.html'), 'utf8');
const original = html;
const cambiar = (patron, por, que) => {
  const nuevo = html.replace(patron, por);
  if (nuevo === html) throw new Error(`index.html de la Pro ya no tiene ${que}: revisa app-lite/construir.mjs`);
  html = nuevo;
};
cambiar(/[ \t]*<!-- H-21: política de seguridad[\s\S]*?-->\r?\n/, '', 'el comentario de la política de seguridad');
cambiar(/[ \t]*<meta http-equiv="Content-Security-Policy"[^>]*>\r?\n/, '', 'la política de seguridad (meta)');
cambiar(/, *viewport-fit=cover/, '', 'viewport-fit=cover');
cambiar(/<title>[^<]*<\/title>/, '<title>TV RETRO Lite</title>', 'el título');
cambiar(/(<link rel="stylesheet" href="css\/style\.css" \/>)/, '$1\n  <link rel="stylesheet" href="css/lite.css" />', 'el enlace a style.css');
// Modo sin cuentas (el modo que la Pro ya trae para pruebas): se fija antes de cargar la app.
cambiar(/<script type="module" src="js\/main\.js"><\/script>/,
  '<script>if (!/[?&]sincuentas/.test(location.search)) history.replaceState(null, "", "?sincuentas=1");</script>\n<script src="app.js"></script>',
  'el script js/main.js');
// Ayuda y Legal: las páginas de la Pro hablan de cuentas, Firebase y Wi-Fi. La Lite abre las suyas (lite/ del panel).
cambiar(/https:\/\/cartica07\.github\.io\/TV_RETRO\/(ayuda|privacidad|terminos)\.html/g, 'https://cartica07.github.io/TV_RETRO/lite/$1.html', 'los enlaces de Ayuda y Legal');
// Aviso de dónde se guardan las imágenes (la Lite no tiene nube): arriba de Legal. Texto PROPUESTO: lo aprueba el dueño.
cambiar(/(<div id="configLegal" class="config-apartado" style="display: none;">)/,
  '$1\n      <div class="campo"><p class="dato-cuenta" id="avisoGuardadoEnCelular">Tus imágenes y GIF se guardan en este celular, no en internet. Si borras la app o cambias de celular, se pierden.</p></div>',
  'el apartado Legal');
if (html === original) throw new Error('el HTML no cambió');
writeFileSync(join(www, 'index.html'), html);

// ---- diseño de la Pro (sin cambios) y lo propio de la Lite ----
for (const css of ['tokens.css', 'style.css', 'fuentes.css']) copyFileSync(join(panel, 'css', css), join(www, 'css', css));
cpSync(join(panel, 'fonts'), join(www, 'fonts'), { recursive: true });
copyFileSync(join(aqui, 'src', 'lite.css'), join(www, 'css', 'lite.css'));
for (const carpeta of ['canciones', 'predeterminadas']) {
  if (existsSync(join(aqui, carpeta))) cpSync(join(aqui, carpeta), join(www, carpeta), { recursive: true });
}
console.log('app-lite/www listo');
