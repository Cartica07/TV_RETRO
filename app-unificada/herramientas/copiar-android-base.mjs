// Arma app-unificada/android/ a partir del proyecto Android de la app Lite (que ya trae los permisos de Bluetooth, los diálogos
// en español y el plugin del portapapeles de imagen) y lo adapta a la unificada:
//   - paquete com.tvretro.lite -> PAQUETE (distinto del de la Pro y de la Lite, para no reemplazar ninguna de las dos en el celular);
//     com.pepito.app: decidido por el dueño el 2026-11-23 (no se puede cambiar después de publicar en Play).
//   - nombre visible "Pepito" (decisión del dueño, 2026-11-23; docs/nombre-pepito.md);
//   - permisos de internet (la unificada usa la nube para la cuenta y el catálogo).
// Sin los archivos generados (build, .gradle, assets/public): `npx cap sync android` los vuelve a crear.
// Se corre UNA vez (con --forzar se rehace y se pierde lo editado a mano en android/).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PAQUETE = 'com.pepito.app';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const origen = path.resolve(aqui, '..', '..', 'app-lite', 'android');
const destino = path.resolve(aqui, '..', 'android');
if (fs.existsSync(destino) && !process.argv.includes('--forzar')) throw new Error('app-unificada/android ya existe (usa --forzar para rehacerla: se pierden sus cambios)');

const excluir = (p) => {
  const r = path.relative(origen, p).split(path.sep).join('/');
  return /(^|\/)(build|\.gradle|\.idea)(\/|$)/.test(r) || /replay_pid|hs_err_pid|local\.properties$/.test(r) ||
    /^app\/src\/main\/assets\/(public|capacitor)/.test(r);
};
fs.rmSync(destino, { recursive: true, force: true });
fs.cpSync(origen, destino, { recursive: true, filter: (s) => !excluir(s) });

// Paquete de Java: carpeta nueva y "package"/referencias cambiadas.
const javaViejo = path.join(destino, 'app', 'src', 'main', 'java', 'com', 'tvretro', 'lite');
const javaNuevo = path.join(destino, 'app', 'src', 'main', 'java', 'com', 'pepito', 'app');
fs.mkdirSync(path.dirname(javaNuevo), { recursive: true });
fs.renameSync(javaViejo, javaNuevo);
fs.rmSync(path.dirname(javaViejo), { recursive: true, force: true }); // com/tvretro quedó vacía

const reemplazar = (archivo, de, a) => {
  const t = fs.readFileSync(archivo, 'utf8');
  if (!t.includes(de)) throw new Error(`No encontré "${de}" en ${path.relative(destino, archivo)}`);
  fs.writeFileSync(archivo, t.split(de).join(a));
};
for (const f of fs.readdirSync(javaNuevo)) reemplazar(path.join(javaNuevo, f), 'com.tvretro.lite', PAQUETE);
reemplazar(path.join(destino, 'app', 'build.gradle'), 'com.tvretro.lite', PAQUETE);
const strings = path.join(destino, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
reemplazar(strings, 'com.tvretro.lite', PAQUETE);
reemplazar(strings, 'TV RETRO Lite', 'Pepito');

// Internet: la cuenta (Firebase Auth) y el catálogo (Firebase) lo necesitan.
const manifiesto = path.join(destino, 'app', 'src', 'main', 'AndroidManifest.xml');
reemplazar(manifiesto, '<!-- Permisos: solo Bluetooth. La app Lite no usa internet ni nube. -->',
  '<!-- Permisos: internet (cuenta y catálogo en la nube) y Bluetooth (TV Lite). -->\n    <uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />');
console.log(`app-unificada/android listo (paquete ${PAQUETE})`);
