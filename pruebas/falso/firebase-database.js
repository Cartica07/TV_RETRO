// Realtime Database falsa, en memoria, para probar el panel sin tocar
// la base real. Se controla desde las pruebas con globalThis.__fakeDb:
//   raiz        datos actuales (sembrados desde globalThis.__semilla)
//   retrasos    { ruta: ms }  demora de get() en esa ruta
//   fallar      { ruta: true } get()/update() en esa ruta fallan con PERMISSION_DENIED
//   conectado   valor de .info/connected
//   colgar      true: update() nunca termina (como sin red)
//   escrituras  registro de lo escrito

const fake = globalThis.__fakeDb = {
  raiz: JSON.parse(JSON.stringify(globalThis.__semilla || {})),
  retrasos: globalThis.__retrasosIniciales || {},
  fallar: globalThis.__fallarInicial || {},
  conectado: true,
  colgar: false,
  retrasoEscritura: 0, // ms que tarda el servidor en confirmar una escritura
  colgadas: [],
  escrituras: [],
  lecturas: [],
  oyentes: []
};

// Opción: que los datos sobrevivan a una recarga de la página (globalThis.__persistirDb = true),
// como en la base real. Se guardan en sessionStorage.
if (globalThis.__persistirDb) {
  try { const g = sessionStorage.getItem('__fakeDbRaiz'); if (g) fake.raiz = JSON.parse(g); } catch (e) { /* nada */ }
}
const persistir = () => { if (globalThis.__persistirDb) { try { sessionStorage.setItem('__fakeDbRaiz', JSON.stringify(fake.raiz)); } catch (e) { /* nada */ } } };

const partes = (p) => String(p || '').split('/').filter(Boolean);
const copia = (v) => (v === undefined || v === null) ? null : JSON.parse(JSON.stringify(v));

function leer(ruta) {
  if (ruta === '.info/connected') return fake.conectado;
  let n = fake.raiz;
  for (const k of partes(ruta)) {
    if (n === null || typeof n !== 'object') return null;
    n = n[k];
  }
  return n === undefined ? null : n;
}

function escribirEn(ruta, valor) {
  const ks = partes(ruta);
  let n = fake.raiz;
  for (let i = 0; i < ks.length - 1; i++) {
    if (n[ks[i]] === null || typeof n[ks[i]] !== 'object') n[ks[i]] = {};
    n = n[ks[i]];
  }
  const ultima = ks[ks.length - 1];
  if (valor === null || valor === undefined) delete n[ultima];
  else n[ultima] = copia(valor);
}

function instantanea(ruta) {
  const v = copia(leer(ruta));
  return { exists: () => v !== null, val: () => copia(v), key: partes(ruta).pop() || null };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function demora(ruta) {
  for (const [p, ms] of Object.entries(fake.retrasos)) if (ruta === p || ruta.startsWith(p + '/')) return ms;
  return 0;
}
function falla(ruta) {
  for (const p of Object.keys(fake.fallar)) if (fake.fallar[p] && (ruta === p || ruta.startsWith(p + '/') || p.startsWith(ruta + '/'))) return true;
  return false;
}
const errorPermiso = () => Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });

function notificar() {
  persistir();
  for (const o of fake.oyentes) o.cb(instantanea(o.ruta));
}

export function getDatabase(app) { return { app }; }
export function ref(db, ruta = '') { return { ruta: partes(ruta).join('/') || ruta }; }

export async function get(r) {
  fake.lecturas.push(r.ruta);
  await esperar(demora(r.ruta));
  if (falla(r.ruta)) throw errorPermiso();
  return instantanea(r.ruta);
}

export async function set(r, valor) {
  if (falla(r.ruta)) throw errorPermiso();
  if (fake.retrasoEscritura) await esperar(fake.retrasoEscritura);
  // Sin señal: queda esperando hasta que la prueba llame a __fakeDb.soltar() (como Firebase real).
  if (fake.colgar) await new Promise((res) => fake.colgadas.push(res));
  escribirEn(r.ruta, valor);
  fake.escrituras.push({ op: 'set', ruta: r.ruta, valor: copia(valor) });
  notificar();
}

export async function update(r, cambios) {
  if (falla(r.ruta)) throw errorPermiso();
  // update() multi-ruta desde la raíz: cada ruta se comprueba por separado (como las reglas).
  for (const k of Object.keys(cambios)) if (falla((r.ruta ? r.ruta + '/' : '') + k)) throw errorPermiso();
  if (fake.retrasoEscritura) await esperar(fake.retrasoEscritura);
  // Sin señal: queda esperando hasta que la prueba llame a __fakeDb.soltar().
  if (fake.colgar) await new Promise((res) => fake.colgadas.push(res));
  for (const [k, v] of Object.entries(cambios)) escribirEn(r.ruta + '/' + k, v);
  fake.escrituras.push({ op: 'update', ruta: r.ruta, valor: copia(cambios) });
  notificar();
}

// Transacción: en el servidor real es atómica; acá también (todo es síncrono
// entre la lectura y la escritura).
export async function runTransaction(r, fn) {
  await esperar(demora(r.ruta));
  if (falla(r.ruta)) throw errorPermiso();
  if (fake.colgar) await new Promise((res) => fake.colgadas.push(res));
  const nuevo = fn(copia(leer(r.ruta)));
  if (nuevo === undefined) return { committed: false, snapshot: instantanea(r.ruta) };
  escribirEn(r.ruta, nuevo);
  fake.escrituras.push({ op: "transaccion", ruta: r.ruta, valor: copia(nuevo) });
  notificar();
  return { committed: true, snapshot: instantanea(r.ruta) };
}

export async function remove(r) {
  if (falla(r.ruta)) throw errorPermiso();
  if (fake.retrasoEscritura) await esperar(fake.retrasoEscritura);
  if (fake.colgar) await new Promise((res) => fake.colgadas.push(res));
  escribirEn(r.ruta, null);
  fake.escrituras.push({ op: 'remove', ruta: r.ruta });
  notificar();
}

export function onValue(r, cb, errCb) {
  fake.lecturas.push("onValue:" + r.ruta);
  const o = { ruta: r.ruta, cb };
  fake.oyentes.push(o);
  setTimeout(() => {
    if (falla(r.ruta) && errCb) errCb(errorPermiso());
    else cb(instantanea(r.ruta));
  }, 0);
  return () => { fake.oyentes = fake.oyentes.filter((x) => x !== o); };
}

fake.soltar = () => { fake.colgar = false; fake.colgadas.splice(0).forEach((res) => res()); };

// Para simular cambios de conexión desde las pruebas.
fake.cambiarConexion = (v) => { fake.conectado = v; notificar(); };

// Para que las pruebas simulen un cambio hecho desde otro dispositivo.
fake.notificar = notificar;
