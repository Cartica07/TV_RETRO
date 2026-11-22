// Almacenamiento de la app Lite EN EL CELULAR (IndexedDB): la Galería (imágenes y GIF), el último contenido
// enviado y los ajustes que la app recuerda. No hay nube: si se desinstala la app, se borran sus datos o se
// cambia de celular, esto se pierde (los Términos y condiciones lo avisan).
//
// IndexedDB y no localStorage porque un GIF con sus cuadros supera los límites de localStorage.
// Si IndexedDB no está disponible (navegadores muy restringidos) se usa memoria: la app sigue funcionando
// durante la sesión, pero no recuerda nada al cerrarse.

const NOMBRE_BD = 'tvretro-lite';
const VERSION_BD = 1;
const TABLAS = ['imagenes', 'animaciones', 'meta'];

let promesaBD = null;
const memoria = Object.fromEntries(TABLAS.map((t) => [t, new Map()]));

function abrir() {
  if (promesaBD) return promesaBD;
  promesaBD = new Promise((resolver) => {
    try {
      if (typeof indexedDB === 'undefined') { resolver(null); return; }
      const pedido = indexedDB.open(NOMBRE_BD, VERSION_BD);
      pedido.onupgradeneeded = () => {
        const bd = pedido.result;
        for (const t of TABLAS) if (!bd.objectStoreNames.contains(t)) bd.createObjectStore(t);
      };
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => resolver(null);
      pedido.onblocked = () => resolver(null);
    } catch (e) {
      resolver(null);
    }
  });
  return promesaBD;
}

function pedir(tabla, modo, hacer) {
  return abrir().then((bd) => {
    if (!bd) return null;
    return new Promise((resolver, rechazar) => {
      try {
        const tx = bd.transaction(tabla, modo);
        const r = hacer(tx.objectStore(tabla));
        tx.oncomplete = () => resolver(r && 'result' in r ? r.result : undefined);
        tx.onerror = () => rechazar(tx.error);
        tx.onabort = () => rechazar(tx.error);
      } catch (e) {
        rechazar(e);
      }
    });
  });
}

/** Valor guardado (undefined si no hay). */
export async function leer(tabla, clave) {
  const bd = await abrir();
  if (!bd) return memoria[tabla].get(clave);
  const v = await pedir(tabla, 'readonly', (s) => s.get(clave));
  return v === null ? undefined : v;
}

/** Guarda (o reemplaza) un valor. */
export async function guardar(tabla, clave, valor) {
  const bd = await abrir();
  if (!bd) { memoria[tabla].set(clave, valor); return; }
  await pedir(tabla, 'readwrite', (s) => s.put(valor, clave));
}

export async function borrar(tabla, clave) {
  const bd = await abrir();
  if (!bd) { memoria[tabla].delete(clave); return; }
  await pedir(tabla, 'readwrite', (s) => s.delete(clave));
}

/** Todas las entradas de una tabla como [[clave, valor], …]. */
export async function todo(tabla) {
  const bd = await abrir();
  if (!bd) return [...memoria[tabla].entries()];
  const [claves, valores] = await Promise.all([
    pedir(tabla, 'readonly', (s) => s.getAllKeys()),
    pedir(tabla, 'readonly', (s) => s.getAll()),
  ]);
  return (claves || []).map((k, i) => [k, valores[i]]);
}

export async function contar(tabla) {
  const bd = await abrir();
  if (!bd) return memoria[tabla].size;
  return (await pedir(tabla, 'readonly', (s) => s.count())) || 0;
}
