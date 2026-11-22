// Arma app-lite/www/ a partir de src/:
//  - empaqueta src/main.js con esbuild (el plugin de Bluetooth viene de npm);
//  - copia el HTML y el catálogo de canciones (canciones/);
//  - COPIA (sin modificar) el diseño de la app Pro: css/tokens.css, css/style.css, css/fuentes.css y fonts/,
//    así la Lite se ve igual y el CSS de la Pro sigue siendo la única fuente. Lo propio de la Lite va en src/lite.css.
// Después hay que correr "npx cap sync android" para llevarlo a la APK.
import { build } from 'esbuild';
import { copyFileSync, cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const panel = join(aqui, '..'); // raíz del repo del panel (la app Pro: SOLO se lee)
const www = join(aqui, 'www');
rmSync(www, { recursive: true, force: true });
mkdirSync(join(www, 'css'), { recursive: true });

await build({
  entryPoints: [join(aqui, 'src', 'main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: join(www, 'app.js'),
  logLevel: 'info',
});

copyFileSync(join(aqui, 'src', 'index.html'), join(www, 'index.html'));
copyFileSync(join(aqui, 'src', 'lite.css'), join(www, 'css', 'lite.css'));
for (const css of ['tokens.css', 'style.css', 'fuentes.css']) copyFileSync(join(panel, 'css', css), join(www, 'css', css));
cpSync(join(panel, 'fonts'), join(www, 'fonts'), { recursive: true });
if (existsSync(join(aqui, 'canciones'))) cpSync(join(aqui, 'canciones'), join(www, 'canciones'), { recursive: true });
console.log('app-lite/www listo');
