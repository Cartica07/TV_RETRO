import { abrir, cerrar } from './banco-lite.mjs';
const { pagina, navegador } = await abrir({ ruta: '/index.html?sincuentas=1&inicio=1', antes: (p) => p.addInitScript(() => { window.__vinculadosPrueba = () => []; }), esperar: false });
await pagina.waitForSelector('#pantallaConexion:not([hidden])');
await pagina.waitForTimeout(600);
await pagina.screenshot({ path: process.argv[2] });
await navegador.close();
cerrar();
