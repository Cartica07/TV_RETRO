/**cuentas
 * Cuentas: inicio de sesión, Mi TV (vincular, elegir, desvincular), Compartir una TV y Eliminar mi cuenta. Salió de
 * main.js (auditoría 2026-11-15, H-13, paso 3). Se crea con crearCuentas({ ... }): lo que viene de main.js entra por
 * funciones que se leen al usarse, nunca al crear el módulo (varias de esas variables se declaran más abajo en main.js).
 */

import {
  escucharSesion,
  iniciarSesion,
  crearCuenta,
  cerrarSesion,
  recuperarContrasena,
  iniciarSesionConGoogle,
  iniciarSesionConGoogleNativo,
  eliminarMiCuenta,
  proveedorDeLaCuenta,
  listarMisDispositivos,
  desvincularDispositivo,
  usarCodigoTV,
  rolEnTV,
  quitarTVDeMiLista,
  listarMiembros,
  crearInvitacion,
  quitarMiembro,
  borrarInvitacion,
  salirDeTV,
  esAdministrador
} from './firebase.js';
import { enApp, pluginNativo, sinRepetir } from './utilidades.js';

/**
 * leerElementos()                  mapa de IDs del DOM (se asigna al arrancar; null antes de inicializar()).
 * liberarPanelDespuesDeLogin()     programa (ESPERA_ARRANQUE_MS después) liberar el panel si un fallo inesperado ocurrió con el
 *                                  login a la vista (H-27); la lógica del panel bloqueado sigue en main.js.
 */
export function crearCuentas({ leerElementos, liberarPanelDespuesDeLogin }) {
  const E = () => leerElementos();

  // H-27: un fallo inesperado con el login a la vista no libera el panel; se anota y se libera tras entrar.
  let falloMientrasLogin = false;
  // Cuenta administradora (sin límite; puede borrar las predeterminadas). Se lee una vez al entrar.
  let esAdminValor = false;

  let modoLogin = 'entrar'; // 'entrar' | 'crear'
  let avisoPostLogin = '';  // se muestra en la línea de estado al terminar de arrancar

  function mostrarErrorLogin(texto) {
    E().loginError.textContent = texto;
    E().loginError.hidden = !texto;
    if (texto) E().loginAviso.hidden = true;
  }

  function mostrarAvisoLogin(texto) {
    E().loginAviso.textContent = texto;
    E().loginAviso.hidden = !texto;
    if (texto) E().loginError.hidden = true;
  }

  function cambiarModoLogin(modo) {
    modoLogin = modo;
    const crear = modo === 'crear';
    E().loginSubtitulo.textContent = crear ? 'Crea tu cuenta para controlar tu pantalla.' : 'Inicia sesión para controlar tu pantalla.';
    E().botonLogin.textContent = crear ? 'Crear cuenta' : 'Entrar';
    E().botonLoginModo.textContent = crear ? 'Ya tengo una cuenta' : 'Crear cuenta';
    E().campoLoginConfirmar.hidden = !crear;
    E().botonLoginOlvide.hidden = crear;
    E().loginPassword.autocomplete = crear ? 'new-password' : 'current-password';
    E().loginPassword2.value = '';
    mostrarErrorLogin('');
    mostrarAvisoLogin('');
  }

  async function enviarFormularioLogin(e) {
    e.preventDefault();
    await sinRepetir('login', E().botonLogin, async () => {
      mostrarErrorLogin('');
      mostrarAvisoLogin('');
      const email = E().loginEmail.value.trim();
      const clave = E().loginPassword.value;
      if (!email) return mostrarErrorLogin('Escribe tu correo.');
      if (!clave) return mostrarErrorLogin('Escribe tu contraseña.');
      if (modoLogin === 'crear') {
        if (clave.length < 6) return mostrarErrorLogin('La contraseña debe tener al menos 6 caracteres.');
        if (clave !== E().loginPassword2.value) return mostrarErrorLogin('Las contraseñas no coinciden.');
        const r = await crearCuenta(email, clave);
        if (!r.exito) return mostrarErrorLogin(r.error);
        avisoPostLogin = r.correoEnviado ? 'Te enviamos un correo para confirmar tu cuenta.' : '';
      } else {
        const r = await iniciarSesion(email, clave);
        if (!r.exito) return mostrarErrorLogin(r.error);
      }
      // Si salió bien, escucharSesion (requerirSesion) oculta esta pantalla.
      E().loginPassword.value = '';
      E().loginPassword2.value = '';
    });
  }

  // Entrar con Google (ventana emergente). Si la persona la cierra no se muestra ningún error.
  async function manejarEntrarConGoogle() {
    await sinRepetir('google', E().botonLoginGoogle, async () => {
      mostrarErrorLogin('');
      mostrarAvisoLogin('');
      // En la APK la ventana emergente no sirve: se usa el selector de cuentas nativo.
      const nativo = pluginNativo('FirebaseAuthentication');
      const r = nativo ? await iniciarSesionConGoogleNativo(nativo) : await iniciarSesionConGoogle();
      if (r.cancelado) return;
      if (!r.exito) mostrarErrorLogin(r.error);
      // Si salió bien, escucharSesion (requerirSesion) oculta esta pantalla.
    });
  }

  async function manejarOlvideContrasena() {
    await sinRepetir('olvide', E().botonLoginOlvide, async () => {
      mostrarErrorLogin('');
      mostrarAvisoLogin('');
      const email = E().loginEmail.value.trim();
      if (!email) return mostrarErrorLogin('Escribe tu correo arriba y vuelve a tocar "¿Olvidaste tu contraseña?".');
      const r = await recuperarContrasena(email);
      if (!r.exito) return mostrarErrorLogin(r.error);
      mostrarAvisoLogin('Si ese correo tiene una cuenta, te enviamos un enlace para cambiar la contraseña.');
    });
  }

  // ---- Mi TV: vincular una TV con su código, elegir cuál usar, desvincular ----
  // Una cuenta puede tener varias TV (el panel usa una a la vez; la elegida se
  // recuerda en este equipo). Para cambiar de TV o desvincular se recarga: así
  // no queda en memoria nada de la TV anterior.
  let sesionActual = null;             // { uid, email, emailVerified }
  let esAdmin = false;                 // la cuenta es administradora (sin límite; puede borrar las predeterminadas)
  let misTV = [];                      // ids de las TV de la cuenta
  let rolesTV = {};                    // id -> 'dueno' | 'miembro' (los miembros solo envían: no comparten ni desvinculan)
  let tvEnUso = null;                  // id de la TV que usa el panel
  let alVincularPrimera = null;        // resolver de la espera de la primera TV
  const claveTVGuardada = (uid) => 'tvretro.dispositivo.' + uid;

  function leerTVGuardada(uid) {
    try { return localStorage.getItem(claveTVGuardada(uid)); } catch (e) { return null; }
  }

  function guardarTVElegida(uid, id) {
    try { localStorage.setItem(claveTVGuardada(uid), id); } catch (e) { /* sin almacenamiento: se usará la primera */ }
  }

  function mostrarErrorTV(texto) {
    E().tvError.textContent = texto;
    E().tvError.hidden = !texto;
    if (texto) E().tvAviso.hidden = true;
  }

  function dibujarListaTV() {
    const lista = E().listaTV;
    lista.textContent = '';
    lista.hidden = misTV.length === 0;
    misTV.forEach((id, i) => {
      const fila = document.createElement('div');
      fila.className = 'fila-tv' + (id === tvEnUso ? ' en-uso' : '');
      const nombre = document.createElement('span');
      nombre.className = 'nombre-tv';
      nombre.textContent = 'TV ' + (i + 1);
      fila.appendChild(nombre);
      if (id === tvEnUso) {
        const marca = document.createElement('span');
        marca.className = 'marca-en-uso';
        marca.textContent = 'En uso';
        fila.appendChild(marca);
      } else {
        const usar = document.createElement('button');
        usar.type = 'button';
        usar.className = 'boton-enlace';
        usar.textContent = 'Usar';
        usar.addEventListener('click', () => {
          guardarTVElegida(sesionActual.uid, id);
          location.reload();
        });
        fila.appendChild(usar);
      }
      if (rolesTV[id] === 'miembro') {
        const etiqueta = document.createElement('span');
        etiqueta.className = 'tag-persona';
        etiqueta.textContent = 'Compartida contigo';
        nombre.after(etiqueta);
        const salir = document.createElement('button');
        salir.type = 'button';
        salir.className = 'boton-enlace peligro';
        salir.textContent = 'Salir';
        salir.addEventListener('click', () => manejarSalirDeTV(id, i + 1));
        fila.appendChild(salir);
      } else {
        const compartir = document.createElement('button');
        compartir.type = 'button';
        compartir.className = 'boton-enlace';
        compartir.textContent = 'Compartir';
        compartir.addEventListener('click', () => abrirCompartir(id, i + 1));
        fila.appendChild(compartir);
        const desvincular = document.createElement('button');
        desvincular.type = 'button';
        desvincular.className = 'boton-enlace peligro';
        desvincular.textContent = 'Desvincular';
        desvincular.addEventListener('click', () => manejarDesvincularTV(id, i + 1));
        fila.appendChild(desvincular);
      }
      lista.appendChild(fila);
    });
  }

  // modo: 'primera' (la cuenta no tiene TV), 'gestionar' (abierta con el botón Mi TV)
  // o 'error' (no se pudo leer la lista de TV: solo se puede reintentar).
  let modoTVActual = 'gestionar'; // para volver desde "Eliminar mi cuenta"
  function mostrarPantallaTV(modo, error = '') {
    const el = E();
    detenerRelojCompartir();
    compartirVista = null;
    modoTVActual = modo;
    el.compartirTV.hidden = true;
    el.eliminarCuenta.hidden = true;
    el.eliminarPassword.value = '';
    // "Eliminar mi cuenta" también vale para quien aún no vinculó ninguna TV; en el error de lista no.
    el.botonEliminarCuenta.hidden = modo === 'error';
    el.pantallaTV.hidden = false;
    el.tvAviso.hidden = true;
    mostrarErrorTV(modo === 'error' ? '' : error);
    el.codigoTV.value = '';
    if (modo === 'error') {
      el.tvTitulo.textContent = 'No se pudo cargar tus TV';
      el.tvSubtitulo.textContent = error;
      el.listaTV.hidden = true;
      el.formTV.hidden = true;
      el.botonTVVolver.textContent = 'Reintentar';
      el.botonTVVolver.hidden = false;
      return;
    }
    el.formTV.hidden = false;
    if (modo === 'primera') {
      el.tvTitulo.textContent = 'Añade tu TV';
      el.tvSubtitulo.textContent = 'Escribe el código que muestra la pantalla de tu TV.';
      el.botonTVVolver.hidden = true;
    } else {
      el.tvTitulo.textContent = 'Mis TV';
      el.tvSubtitulo.textContent = 'Elige cuál usar o añade otra con su código.';
      el.botonTVVolver.textContent = 'Volver';
      el.botonTVVolver.hidden = false;
    }
    dibujarListaTV();
  }

  async function enviarFormularioTV(e) {
    e.preventDefault();
    await sinRepetir('vincular', E().botonVincularTV, async () => {
      mostrarErrorTV('');
      const r = await usarCodigoTV(sesionActual.uid, E().codigoTV.value);
      if (!r.exito) return mostrarErrorTV(r.error);
      guardarTVElegida(sesionActual.uid, r.id);
      if (alVincularPrimera) {
        // Primer arranque: sigue el arranque con esta TV (no hace falta recargar).
        const seguir = alVincularPrimera;
        alVincularPrimera = null;
        E().pantallaTV.hidden = true;
        seguir(r.id);
      } else {
        location.reload();
      }
    });
  }

  async function manejarDesvincularTV(id, numero) {
    if (!window.confirm('¿Desvincular la TV ' + numero + '? Dejará de ser tuya, se quitará el acceso a quienes la comparten contigo y mostrará un código nuevo.')) return;
    await sinRepetir('desvincular', null, async () => {
      mostrarErrorTV('');
      const r = await desvincularDispositivo(sesionActual.uid, id);
      if (!r.exito) return mostrarErrorTV(r.error);
      location.reload();
    });
  }

  async function manejarSalirDeTV(id, numero) {
    if (!window.confirm('¿Salir de la TV ' + numero + '? Dejarás de poder enviarle contenido; sigue siendo de su dueño.')) return;
    await sinRepetir('salir-tv', null, async () => {
      mostrarErrorTV('');
      const r = await salirDeTV(sesionActual.uid, id);
      if (!r.exito) return mostrarErrorTV(r.error);
      location.reload();
    });
  }

  // ---- Compartir una TV: código de invitación (10 min, un solo uso) y personas con acceso ----
  let compartirVista = null;           // { id, codigo, venceEn } mientras se ve la pantalla de compartir
  let relojCompartir = null;

  // H-24: las invitaciones vencidas que nadie usó quedaban en la base para siempre. El panel anota la
  // última que creó y, al abrir Compartir o crear otra, borra la anterior si ya venció (no se borra una
  // vigente: el dueño puede haberle pasado el código a alguien que entra más tarde).
  const CLAVE_ULTIMA_INVITACION = 'tvretro.ultimaInvitacion';

  function limpiarInvitacionVencida() {
    try {
      const anotada = JSON.parse(localStorage.getItem(CLAVE_ULTIMA_INVITACION) || 'null');
      if (anotada && anotada.codigo && anotada.venceEn <= Date.now()) {
        localStorage.removeItem(CLAVE_ULTIMA_INVITACION);
        borrarInvitacion(anotada.codigo); // sin esperar: es limpieza
      }
    } catch (e) { /* sin almacenamiento: no se limpia */ }
  }

  function anotarInvitacion(codigo, venceEn) {
    try { localStorage.setItem(CLAVE_ULTIMA_INVITACION, JSON.stringify({ codigo, venceEn })); } catch (e) { /* nada */ }
  }

  function detenerRelojCompartir() {
    if (relojCompartir) {
      clearInterval(relojCompartir);
      relojCompartir = null;
    }
  }

  function mostrarErrorCompartir(texto) {
    E().compartirError.textContent = texto;
    E().compartirError.hidden = !texto;
  }

  function pintarVenceCompartir() {
    const v = compartirVista;
    if (!v || !v.codigo) return;
    const resto = v.venceEn - Date.now();
    if (resto <= 0) {
      E().compartirCodigo.textContent = '······';
      E().compartirVence.textContent = 'El código venció.';
      E().botonCompartirCopiar.textContent = 'Crear otro código';
      return;
    }
    const seg = Math.ceil(resto / 1000);
    E().compartirVence.textContent = 'Vence en ' + Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0');
  }

  async function generarCodigoCompartir() {
    const v = compartirVista;
    mostrarErrorCompartir('');
    limpiarInvitacionVencida();
    const r = await crearInvitacion(v.id);
    if (compartirVista !== v) return false; // ya se fue de esta pantalla
    if (!r.exito) {
      mostrarErrorCompartir(r.error);
      return false;
    }
    v.codigo = r.codigo;
    v.venceEn = r.venceEn;
    anotarInvitacion(r.codigo, r.venceEn);
    E().compartirCodigo.textContent = r.codigo;
    E().botonCompartirCopiar.textContent = 'Copiar código';
    pintarVenceCompartir();
    return true;
  }

  async function pintarMiembros(id) {
    const r = await listarMiembros(id);
    if (!compartirVista || compartirVista.id !== id) return;
    const lista = E().listaMiembros;
    lista.textContent = '';
    if (!r.exito) return mostrarErrorCompartir(r.error);
    if (r.miembros.length === 0) {
      const vacio = document.createElement('div');
      vacio.className = 'fila-tv';
      const texto = document.createElement('span');
      texto.className = 'tag-persona';
      texto.textContent = 'Nadie más por ahora';
      vacio.appendChild(texto);
      lista.appendChild(vacio);
      return;
    }
    r.miembros.forEach((uidMiembro, i) => {
      const fila = document.createElement('div');
      fila.className = 'fila-tv';
      const nombre = document.createElement('span');
      nombre.className = 'nombre-tv';
      nombre.textContent = 'Persona ' + (i + 1);
      fila.appendChild(nombre);
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'boton-enlace peligro';
      quitar.textContent = 'Quitar';
      quitar.addEventListener('click', () => manejarQuitarMiembro(id, uidMiembro));
      fila.appendChild(quitar);
      lista.appendChild(fila);
    });
  }

  async function manejarQuitarMiembro(id, uidMiembro) {
    if (!window.confirm('¿Quitar el acceso a esta persona? Dejará de poder enviarle contenido a tu TV.')) return;
    await sinRepetir('quitar-miembro', null, async () => {
      mostrarErrorCompartir('');
      const r = await quitarMiembro(id, uidMiembro);
      if (!r.exito) return mostrarErrorCompartir(r.error);
      await pintarMiembros(id);
    });
  }

  // ---- Eliminar mi cuenta (baja desde la app) ----
  const CLAVE_CUENTA_ELIMINADA = 'tvretro.cuentaEliminada';

  function mostrarErrorEliminar(texto) {
    E().eliminarError.textContent = texto;
    E().eliminarError.hidden = !texto;
  }

  function abrirEliminarCuenta() {
    const el = E();
    const conGoogle = proveedorDeLaCuenta() === 'google.com';
    mostrarErrorTV('');
    mostrarErrorEliminar('');
    detenerRelojCompartir();
    compartirVista = null;
    el.listaTV.hidden = true;
    el.formTV.hidden = true;
    el.compartirTV.hidden = true;
    el.botonEliminarCuenta.hidden = true;
    el.eliminarCuenta.hidden = false;
    el.campoEliminarPassword.hidden = conGoogle;
    el.eliminarGoogleNota.hidden = !conGoogle;
    el.eliminarPassword.value = '';
    el.tvTitulo.textContent = 'Eliminar mi cuenta';
    el.tvSubtitulo.textContent = 'Confirma que eres tú.';
    el.botonTVVolver.textContent = 'Cancelar';
    el.botonTVVolver.hidden = false;
    if (!conGoogle) el.eliminarPassword.focus();
  }

  async function manejarEliminarCuenta() {
    if (!window.confirm('¿Eliminar tu cuenta y todo lo que guardaste? Esto no se puede deshacer.')) return;
    await sinRepetir('eliminar-cuenta', E().botonEliminarConfirmar, async () => {
      mostrarErrorEliminar('');
      // Al borrarse la cuenta la página se recarga sola (vuelve al login): la marca deja avisar allí.
      try { sessionStorage.setItem(CLAVE_CUENTA_ELIMINADA, '1'); } catch (e) { /* sin almacenamiento: no hay aviso */ }
      const r = await eliminarMiCuenta({ password: E().eliminarPassword.value, plugin: pluginNativo('FirebaseAuthentication') });
      if (r.exito) return; // la recarga la hace requerirSesion al quedar sin sesión
      try { sessionStorage.removeItem(CLAVE_CUENTA_ELIMINADA); } catch (e) { /* nada */ }
      if (r.cancelado) return;
      mostrarErrorEliminar(r.error || 'No se pudo eliminar la cuenta. Vuelve a intentarlo.');
    });
  }

  async function abrirCompartir(id, numero) {
    limpiarInvitacionVencida();
    const el = E();
    detenerRelojCompartir();
    const vista = { id, codigo: '', venceEn: 0 };
    compartirVista = vista;
    mostrarErrorTV('');
    mostrarErrorCompartir('');
    el.listaTV.hidden = true;
    el.formTV.hidden = true;
    el.botonEliminarCuenta.hidden = true;
    el.compartirTV.hidden = false;
    el.tvTitulo.textContent = 'Compartir TV ' + numero;
    el.tvSubtitulo.textContent = 'La otra persona escribe este código en Mi TV.';
    el.botonTVVolver.textContent = 'Listo';
    el.botonTVVolver.hidden = false;
    el.compartirCodigo.textContent = '······';
    el.compartirVence.textContent = '';
    el.botonCompartirCopiar.textContent = 'Copiar código';
    el.listaMiembros.textContent = '';
    relojCompartir = setInterval(pintarVenceCompartir, 1000);
    await sinRepetir('compartir', el.botonCompartirCopiar, async () => {
      await generarCodigoCompartir();
      if (compartirVista === vista) await pintarMiembros(id);
    });
  }

  async function manejarCopiarCodigoCompartir() {
    const v = compartirVista;
    if (!v) return;
    const boton = E().botonCompartirCopiar;
    if (!v.codigo || v.venceEn <= Date.now()) {
      await sinRepetir('compartir', boton, () => generarCodigoCompartir());
      return;
    }
    try {
      await navigator.clipboard.writeText(v.codigo);
      boton.textContent = 'Copiado';
      setTimeout(() => { if (compartirVista === v && v.venceEn > Date.now()) boton.textContent = 'Copiar código'; }, 1500);
    } catch (e) {
      mostrarErrorCompartir('No se pudo copiar. Escribe el código a mano.');
    }
  }

  // Lee las TV de la cuenta y devuelve la que usará el panel. Si la cuenta no
  // tiene ninguna, muestra "Añade tu TV" y espera a que se vincule una.
  async function resolverDispositivo(sesion) {
    for (;;) {
      // Sin internet no se espera a Firebase (el panel quedaría bloqueado sin decir nada): se avisa ya.
      const r = navigator.onLine === false
        ? { exito: false, error: 'Sin conexión a internet. Conéctate y pulsa Reintentar.' }
        : await listarMisDispositivos(sesion.uid);
      if (r.exito) {
        misTV = r.dispositivos;
        E().pantallaTV.hidden = true;
        break;
      }
      // Sin lista no se puede seguir: se muestra el error y se espera "Reintentar" o que vuelva la conexión.
      mostrarPantallaTV('error', r.error);
      await new Promise((resolver) => {
        const seguir = () => {
          window.removeEventListener('online', seguir);
          E().botonTVVolver.removeEventListener('click', seguir);
          resolver();
        };
        E().botonTVVolver.addEventListener('click', seguir);
        window.addEventListener('online', seguir);
      });
    }
    // Qué es la cuenta en cada TV. Las que ya no dejan entrar (la desvincularon o la
    // quitaron de las personas con acceso) se sacan de la lista.
    rolesTV = {};
    const roles = await Promise.all(misTV.map(async (id) => ({ id, r: await rolEnTV(sesion.uid, id) })));
    misTV = [];
    for (const { id, r } of roles) {
      if (r.exito && r.rol === null) {
        quitarTVDeMiLista(sesion.uid, id);
        continue;
      }
      rolesTV[id] = r.exito ? r.rol : 'miembro';
      misTV.push(id);
    }
    if (misTV.length === 0) {
      mostrarPantallaTV('primera');
      tvEnUso = await new Promise((resolver) => { alVincularPrimera = resolver; });
      misTV = [tvEnUso];
      const rolNueva = await rolEnTV(sesion.uid, tvEnUso);
      rolesTV[tvEnUso] = rolNueva.exito && rolNueva.rol ? rolNueva.rol : 'miembro';
      return tvEnUso;
    }
    const guardada = leerTVGuardada(sesion.uid);
    tvEnUso = misTV.includes(guardada) ? guardada : misTV[0];
    return tvEnUso;
  }

  function configurarLogin() {
    try {
      if (sessionStorage.getItem(CLAVE_CUENTA_ELIMINADA)) {
        sessionStorage.removeItem(CLAVE_CUENTA_ELIMINADA);
        mostrarAvisoLogin('Tu cuenta y tus datos se eliminaron.');
      }
    } catch (e) { /* sin almacenamiento */ }
    E().formLogin.addEventListener('submit', enviarFormularioLogin);
    E().botonLoginOlvide.addEventListener('click', manejarOlvideContrasena);
    // Entrar con Google: en la web con la ventana emergente; en la APK con el plugin nativo
    // (FirebaseAuthentication). Si la APK no lo trae, el botón no se muestra.
    if (E().loginGoogle && E().botonLoginGoogle) {
      E().loginGoogle.hidden = enApp() && !pluginNativo('FirebaseAuthentication');
      E().botonLoginGoogle.addEventListener('click', manejarEntrarConGoogle);
    }
    E().botonLoginModo.addEventListener('click', () => cambiarModoLogin(modoLogin === 'entrar' ? 'crear' : 'entrar'));
    const salir = (boton) => () => sinRepetir('salir', boton, () => cerrarSesion());
    E().botonCerrarSesion.addEventListener('click', salir(E().botonCerrarSesion));
    E().botonTVSalir.addEventListener('click', salir(E().botonTVSalir));
    E().formTV.addEventListener('submit', enviarFormularioTV);
    E().botonMiTV.addEventListener('click', () => mostrarPantallaTV('gestionar'));
    E().botonCompartirCopiar.addEventListener('click', manejarCopiarCodigoCompartir);
    E().botonEliminarCuenta.addEventListener('click', abrirEliminarCuenta);
    E().botonEliminarConfirmar.addEventListener('click', manejarEliminarCuenta);
    E().eliminarPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); manejarEliminarCuenta(); }
    });
    E().botonTVVolver.addEventListener('click', () => {
      if (!E().eliminarCuenta.hidden) {
        mostrarPantallaTV(modoTVActual); // cancelar la baja: vuelve a Mi TV (o a "Añade tu TV")
        return;
      }
      if (!E().compartirTV.hidden) {
        mostrarPantallaTV('gestionar'); // de compartir vuelve a la lista
        return;
      }
      if (E().formTV.hidden) return; // en modo "error" lo maneja resolverDispositivo
      E().pantallaTV.hidden = true;
    });
  }

  // Espera a que haya una sesión iniciada. Mientras no la haya muestra la pantalla
  // de login (el panel, que nace inert, queda debajo). Si la sesión se cierra
  // después (botón de cerrar sesión), recarga: así no queda en memoria nada del
  // usuario anterior.
  function requerirSesion() {
    return new Promise((resolver) => {
      let entro = false;
      escucharSesion((usuario) => {
        if (usuario) {
          E().pantallaLogin.hidden = true;
          E().botonCerrarSesion.hidden = false;
          if (falloMientrasLogin) {
            falloMientrasLogin = false;
            liberarPanelDespuesDeLogin();
          }
          if (!entro) {
            entro = true;
            resolver(usuario);
          }
          return;
        }
        if (entro) {
          location.reload();
          return;
        }
        E().pantallaLogin.hidden = false;
      });
    });
  }

  // ---- Lo que main.js usa de acá ----
  const obtenerSesion = () => sesionActual;
  const obtenerEsAdmin = () => esAdminValor;
  async function cargarEsAdmin() {
    esAdminValor = await esAdministrador();
  }

  // sesionActual se asigna UNA vez, al entrar (antes de resolverDispositivo); los avisos posteriores de la sesión
  // (renovar el token, etc.) no la cambian: igual que cuando vivía en main.js.
  async function entrar() {
    sesionActual = await requerirSesion();
    return sesionActual;
  }

  function tomarAvisoPostLogin() {
    const texto = avisoPostLogin;
    avisoPostLogin = '';
    return texto;
  }

  // La red de seguridad de main.js puede dispararse antes de que inicializar() asigne los elementos.
  function hayLoginVisible() {
    const el = E();
    return !!(el && el.pantallaLogin && !el.pantallaLogin.hidden);
  }

  function marcarFalloMientrasLogin() {
    falloMientrasLogin = true;
  }

  // Botones de Config > Mi cuenta (la lista y las pantallas de Config viven en mas.js; estos abren Mi TV y la baja).
  function configurarEventosCuentaEnConfig() {
    if (E().botonConfigMisTV) {
      E().botonConfigMisTV.addEventListener('click', () => { if (sesionActual) mostrarPantallaTV('gestionar'); });
    }
    if (E().botonConfigCerrarSesion) {
      E().botonConfigCerrarSesion.addEventListener('click', () => {
        if (sesionActual) sinRepetir('salir', E().botonConfigCerrarSesion, () => cerrarSesion());
      });
    }
    if (E().botonConfigEliminarCuenta) {
      E().botonConfigEliminarCuenta.addEventListener('click', () => {
        if (!sesionActual) return;
        mostrarPantallaTV('gestionar'); // la baja vive en Mi TV (Cancelar vuelve a Mis TV)
        abrirEliminarCuenta();
      });
    }
  }

  // Atrás de Android: cierra Eliminar cuenta, Compartir o Mi TV. Devuelve true si cerró algo.
  function cerrarCapaCuentas() {
    const el = E();
    if (!el.pantallaLogin.hidden || el.pantallaTV.hidden) return false;
    if (!el.eliminarCuenta.hidden) {
      mostrarPantallaTV(modoTVActual); // cancela la baja
      return true;
    }
    if (!el.compartirTV.hidden) {
      mostrarPantallaTV('gestionar'); // de Compartir vuelve a la lista
      return true;
    }
    // "Añade tu TV" (primera vez) y el error de lista no se cierran: ahí Atrás sale de la app.
    if (el.formTV.hidden || el.botonTVVolver.hidden) return false;
    el.pantallaTV.hidden = true;
    return true;
  }

  return {
    obtenerSesion, obtenerEsAdmin, cargarEsAdmin, entrar, resolverDispositivo, configurarLogin,
    tomarAvisoPostLogin, hayLoginVisible, marcarFalloMientrasLogin, configurarEventosCuentaEnConfig, cerrarCapaCuentas
  };
}
