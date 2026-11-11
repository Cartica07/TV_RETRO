// Copia el panel web (index.html, css/, js/) a app-android/www, que es la
// carpeta que Capacitor empaqueta dentro de la APK. No modifica el panel.
// Uso: npm run copiar-web   (antes de cada "npx cap sync")
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const contar = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? contar(path.join(dir, e.name)) : 1), 0);
console.log(`Panel copiado a www/: ${contar(destino)} archivos`);
