// Corre las pruebas ORIGINALES de la Pro (pruebas/ del repo, sin tocarlas) contra la app unificada (app-unificada/www) en lugar
// de contra la app Pro. Es la prueba de que una TV Pro sigue funcionando EXACTAMENTE igual: si pasa lo mismo que contra la Pro,
// la unificada no rompió nada de la Pro.
// Cómo: arma una copia temporal (app-unificada/.pruebas-pro/, ignorada por git) de pruebas/ y js/ de la Pro y le cambia UNA línea
// al banco de la copia (dónde está la app). Uso: node pruebas/correr-pruebas-pro.mjs [suite…]   (sin argumentos: la lista de abajo)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..', '..');           // repo (la Pro: SOLO se lee)
const www = path.resolve(aqui, '..', 'www');
const tmp = path.resolve(aqui, '..', '.pruebas-pro');

const SUITES = ['pruebas-panel', 'tv', 'login', 'login-google', 'compartir', 'cuotas', 'verificacion', 'mas', 'alarma', 'config', 'atras',
  'sistema', 'baja-cuenta', 'baja-ui', 'tutorial', 'bobos', 'auditoria-b', 'etapa1-sin-firebase', 'etapa1-topes', 'etapa1-admin-canciones'];
const pedidas = process.argv.slice(2);
const lista = pedidas.length ? pedidas : SUITES;

if (!fs.existsSync(path.join(www, 'index.html'))) throw new Error('Falta app-unificada/www: corre antes node construir.mjs');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(path.join(tmp, 'pruebas'), { recursive: true });
// La raíz de la copia es la app UNIFICADA (js, css, fonts, index.html), no la Pro: así las pruebas que leen archivos del repo leen lo que se arma.
for (const x of ['js', 'css', 'fonts', 'index.html']) fs.cpSync(path.join(www, x), path.join(tmp, x), { recursive: true });
// Las otras páginas de la Pro (carga-masiva, ayuda, términos…) no van en la unificada, pero algunas pruebas las leen: se copian tal cual.
for (const f of fs.readdirSync(raiz)) if (f.endsWith('.html') && f !== 'index.html') fs.copyFileSync(path.join(raiz, f), path.join(tmp, f));
for (const f of fs.readdirSync(path.join(raiz, 'pruebas'))) {
  const origen = path.join(raiz, 'pruebas', f);
  if (f === 'node_modules') continue;
  if (fs.statSync(origen).isDirectory()) fs.cpSync(origen, path.join(tmp, 'pruebas', f), { recursive: true });
  else if (/\.(mjs|cjs|json|js)$/.test(f)) fs.copyFileSync(origen, path.join(tmp, 'pruebas', f));
}
fs.symlinkSync(path.join(raiz, 'pruebas', 'node_modules'), path.join(tmp, 'pruebas', 'node_modules'), 'junction');

// Lo único que cambia: dónde está la app (la unificada en vez de la raíz del repo).
const banco = path.join(tmp, 'pruebas', 'banco.mjs');
const linea = "export const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));";
let texto = fs.readFileSync(banco, 'utf8');
if (!texto.includes(linea)) throw new Error('pruebas/banco.mjs de la Pro cambió: revisa correr-pruebas-pro.mjs');
texto = texto.replace(linea, `export const REPO = ${JSON.stringify(www)};`);
fs.writeFileSync(banco, texto);

let fallas = 0;
for (const s of lista) {
  const r = spawnSync(process.execPath, [`${s}.mjs`], { cwd: path.join(tmp, 'pruebas'), encoding: 'utf8', timeout: 600000 });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  const ok = (salida.match(/^OK/gm) || []).length;
  const mal = (salida.match(/^(FALLA|FALLÓ|PROBLEMA)/gm) || []).length;
  console.log(`== ${s}: ${ok} OK, ${mal} FALLA${r.status ? ` (salió con código ${r.status})` : ''}`);
  if (mal || ok === 0 || r.status) {
    fallas++;
    for (const l of salida.split('\n').filter((x) => /^(FALLA|FALLÓ|PROBLEMA)/.test(x)).slice(0, 4)) console.log('   ' + l.slice(0, 220));
    if (ok === 0) console.log('   (sin resultados) ' + salida.split('\n').slice(-3).join(' | ').slice(0, 250));
  }
}
console.log(fallas ? `\n${fallas} suite(s) con diferencias` : '\nTodas las suites de la Pro pasan igual contra la app unificada');
process.exit(fallas ? 1 : 0);
