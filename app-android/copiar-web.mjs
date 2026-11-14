// Copia el panel web (index.html, css/, js/) a app-android/www, que es la
// carpeta que Capacitor empaqueta dentro de la APK. No modifica el panel: todo lo
// que cambia para la APK se hace sobre la COPIA (www/), nunca sobre el repo.
// Uso: npm run copiar-web   (antes de cada "npx cap sync")
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..');
const destino = path.join(aqui, 'www');

fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });

for (const nombre of ['index.html', 'css', 'js']) {
  fs.cpSync(path.join(raiz, nombre), path.join(destino, nombre), { recursive: true });
}

// En la APK el panel NO debe declarar viewport-fit=cover: así Capacitor deja el
// WebView dentro de las barras del sistema con márgenes nativos. Con "cover"
// pasa los márgenes a la página (env(safe-area-inset-*)) y, tras girar la
// pantalla (Expandir/Contraer del Dibujo), el WebView los pierde y queda
// debajo de los botones de Inicio/Recientes. El index.html del repo no se toca
// (en el navegador y el iPhone sí lleva "cover"); solo esta copia.
const copiaIndex = path.join(destino, 'index.html');
const html = fs.readFileSync(copiaIndex, 'utf8');
const sinCover = html.replace(/, *viewport-fit=cover/, '');
if (sinCover === html) throw new Error('index.html ya no declara viewport-fit=cover: revisa copiar-web.mjs');
fs.writeFileSync(copiaIndex, sinCover);

// La APK tiene que abrir también SIN internet: el SDK de Firebase y las fuentes no se
// bajan de gstatic / Google Fonts, van dentro de la app.
//
// 1) SDK: se empaqueta (esbuild) SOLO lo que usa js/firebase.js (app, database y auth) en un
//    único archivo, y en la copia de firebase.js las tres direcciones de gstatic apuntan a él.
//    La versión del SDK es la de package.json (fija, igual a la del navegador). Si js/firebase.js
//    pasa a usar otra función del SDK, hay que añadirla a ENTRADA_SDK (el copiado avisa si falta).
const ENTRADA_SDK = `
export { initializeApp } from 'firebase/app';
export { getDatabase, ref, get, set, update, remove, onValue, runTransaction } from 'firebase/database';
export { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  sendPasswordResetEmail, sendEmailVerification, GoogleAuthProvider, signInWithPopup, signInWithCredential } from 'firebase/auth';
`;
fs.mkdirSync(path.join(destino, 'js', 'vendor'), { recursive: true });
await build({
  stdin: { contents: ENTRADA_SDK, resolveDir: aqui, sourcefile: 'entrada-sdk.js' },
  outfile: path.join(destino, 'js', 'vendor', 'firebase.js'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020', minify: true, legalComments: 'none', logLevel: 'warning'
});

const copiaFirebase = path.join(destino, 'js', 'firebase.js');
const fuenteFirebase = fs.readFileSync(copiaFirebase, 'utf8');
const patronSdk = /https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-(?:app|database|auth)\.js/g;
const sinCdn = fuenteFirebase.replace(patronSdk, './vendor/firebase.js');
if (sinCdn === fuenteFirebase || /gstatic\.com\/firebasejs/.test(sinCdn)) {
  throw new Error('js/firebase.js ya no importa el SDK desde gstatic: revisa copiar-web.mjs');
}
fs.writeFileSync(copiaFirebase, sinCdn);

// Todo lo que importa js/firebase.js del SDK tiene que estar en el paquete.
const importado = new Set();
for (const m of sinCdn.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/vendor\/firebase\.js'/g)) {
  m[1].split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => importado.add(x));
}
const paquete = fs.readFileSync(path.join(destino, 'js', 'vendor', 'firebase.js'), 'utf8');
const exportado = new Set();
for (const m of paquete.matchAll(/export\s*\{([^}]*)\}/g)) {
  m[1].split(',').forEach((x) => exportado.add(x.split(/\s+as\s+/).pop().trim()));
}
const faltan = [...importado].filter((x) => !exportado.has(x));
if (importado.size === 0 || faltan.length) throw new Error('El paquete del SDK no exporta: ' + (faltan.join(', ') || '(no se encontraron importaciones)'));

// 2) Fuentes (Space Grotesk y JetBrains Mono, solo el subconjunto latino, que sirve para el español).
const FUENTES = [
  ['Space Grotesk', 'space-grotesk', [400, 500, 600, 700]],
  ['JetBrains Mono', 'jetbrains-mono', [400, 500, 700]]
];
fs.mkdirSync(path.join(destino, 'fonts'), { recursive: true });
let cssFuentes = '/* Generado por copiar-web.mjs: fuentes locales para la APK (sin internet). */\n';
for (const [familia, nombrePaquete, pesos] of FUENTES) {
  for (const peso of pesos) {
    const archivo = `${nombrePaquete}-latin-${peso}-normal.woff2`;
    fs.copyFileSync(path.join(aqui, 'node_modules', '@fontsource', nombrePaquete, 'files', archivo), path.join(destino, 'fonts', archivo));
    cssFuentes += `@font-face { font-family: '${familia}'; font-style: normal; font-weight: ${peso}; font-display: swap; src: url('../fonts/${archivo}') format('woff2'); }\n`;
  }
}
fs.writeFileSync(path.join(destino, 'css', 'fuentes.css'), cssFuentes);

const htmlConGoogleFonts = fs.readFileSync(copiaIndex, 'utf8');
const sinGoogleFonts = htmlConGoogleFonts
  .replace(/[ \t]*<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>\r?\n/g, '')
  .replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/, '<link rel="stylesheet" href="css/fuentes.css" />');
if (/fonts\.(?:googleapis|gstatic)\.com/.test(sinGoogleFonts)) throw new Error('index.html todavía enlaza a Google Fonts: revisa copiar-web.mjs');
fs.writeFileSync(copiaIndex, sinGoogleFonts);

const contar = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? contar(path.join(dir, e.name)) : 1), 0);
console.log(`Panel copiado a www/: ${contar(destino)} archivos`);
