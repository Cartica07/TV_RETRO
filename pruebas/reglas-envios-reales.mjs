// Reproduce en el emulador los envíos REALES capturados del panel (envios-capturados.json).
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, set, update } from 'firebase/database';
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO, 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-envios', database: { rules: REGLAS, host, port: Number(puerto) } });
await env.withSecurityRulesDisabled(async (c) => {
  await set(ref(c.database(), '/'), { dispositivos: { T: { dueno: 'D', miembros: { M: 'ABCDEF' }, oled_remota: { version: 5 } } } });
});
const capturas = JSON.parse(fs.readFileSync(new URL('./envios-capturados.json', import.meta.url), 'utf8'));
let fallas = 0;
for (const quien of ['D', 'M']) {
  const db = env.authenticatedContext(quien).database();
  for (const [nombre, valor] of Object.entries(capturas)) {
    let ok = true, motivo = '';
    try { await update(ref(db, 'dispositivos/T/oled_remota'), valor); } catch (e) { ok = false; motivo = e.message; }
    if (!ok) fallas++;
    const pant = valor && valor.pantalla ? valor.pantalla.tipo : '?';
    console.log(`${ok ? 'OK   ' : 'FALLA'} ${quien === 'D' ? 'dueño' : 'miembro'} envía "${nombre}" (tipo ${pant})${ok ? '' : ' — ' + motivo}`);
  }
}
await env.cleanup();
console.log(fallas ? fallas + ' FALLAS' : 'todo bien');
process.exit(fallas ? 1 : 0);
