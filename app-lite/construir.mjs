// Arma app-lite/www/ a partir de src/: empaqueta main.js con esbuild (el plugin de Bluetooth viene de
// npm) y copia el HTML. Después hay que correr "npx cap sync android" para llevarlo a la APK.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const www = join(aqui, 'www');
mkdirSync(www, { recursive: true });

await build({
  entryPoints: [join(aqui, 'src', 'main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: join(www, 'app.js'),
  logLevel: 'info',
});
copyFileSync(join(aqui, 'src', 'index.html'), join(www, 'index.html'));
console.log('app-lite/www listo');
