// Aceptación de los Términos y la Política de Privacidad (2026-11-25). Se muestra UNA vez por cuenta (y otra vez si cambia la versión
// de los textos): casilla + "Continuar". Solo dibuja la pantalla; saber si ya aceptó y guardar la respuesta lo hace el enrutador
// (src/backend-unificado.js), que es el único que habla con Firebase.
// Textos PROPUESTOS por Claude (el dueño los aprueba): "Antes de entrar", la frase de la casilla, "Continuar" y "Salir".

const URL_TERMINOS = 'https://cartica07.github.io/TV_RETRO/pepito/terminos.html';
const URL_PRIVACIDAD = 'https://cartica07.github.io/TV_RETRO/pepito/privacidad.html';

/**
 * Muestra la pantalla y espera la respuesta: devuelve true cuando la persona acepta y toca "Continuar", o false si toca "Salir".
 * Si ya hay una abierta, espera la misma respuesta.
 */
let abierta = null;
export function pedirAceptacion() {
  if (abierta) return abierta;
  abierta = new Promise((resolver) => {
    const pantalla = document.createElement('div');
    pantalla.className = 'pantalla-login pantalla-aceptacion';
    pantalla.id = 'pantallaAceptacion';
    pantalla.setAttribute('role', 'dialog');
    pantalla.setAttribute('aria-modal', 'true');
    pantalla.setAttribute('aria-labelledby', 'aceptacionTitulo');

    const tarjeta = document.createElement('div');
    tarjeta.className = 'login-tarjeta';

    const marca = document.createElement('div');
    marca.className = 'login-marca';
    const titulo = document.createElement('h1');
    titulo.className = 'login-titulo';
    titulo.id = 'aceptacionTitulo';
    titulo.textContent = 'Antes de entrar';
    marca.append(titulo);

    const fila = document.createElement('label');
    fila.className = 'aceptacion-fila';
    const casilla = document.createElement('input');
    casilla.type = 'checkbox';
    casilla.id = 'aceptacionCasilla';
    const frase = document.createElement('span');
    const enlace = (texto, url) => {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = texto;
      return a;
    };
    frase.append('Acepto los ', enlace('Términos y Condiciones', URL_TERMINOS), ' y la ', enlace('Política de Privacidad', URL_PRIVACIDAD), '.');
    fila.append(casilla, frase);

    const continuar = document.createElement('button');
    continuar.type = 'button';
    continuar.id = 'botonAceptacionContinuar';
    continuar.className = 'boton-primario';
    continuar.textContent = 'Continuar';
    continuar.disabled = true;

    const salir = document.createElement('button');
    salir.type = 'button';
    salir.id = 'botonAceptacionSalir';
    salir.className = 'boton-secundario';
    salir.textContent = 'Salir';

    casilla.addEventListener('change', () => { continuar.disabled = !casilla.checked; });
    const cerrar = (valor) => {
      pantalla.remove();
      abierta = null;
      resolver(valor);
    };
    continuar.addEventListener('click', () => { if (casilla.checked) cerrar(true); });
    salir.addEventListener('click', () => cerrar(false));

    tarjeta.append(marca, fila, continuar, salir);
    pantalla.append(tarjeta);
    document.body.append(pantalla);
    try { casilla.focus(); } catch (e) { /* nada */ }
  });
  return abierta;
}
