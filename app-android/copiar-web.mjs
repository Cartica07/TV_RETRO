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

const contar = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? contar(path.join(dir, e.name)) : 1), 0);
console.log(`Panel copiado a www/: ${contar(destino)} archivos`);
