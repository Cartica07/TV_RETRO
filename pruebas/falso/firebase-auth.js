// Firebase Auth falso, en memoria, para probar el panel sin tocar nada real.
// Se controla desde las pruebas con globalThis.__fakeAuth:
//   usuarios   { "correo": { password, uid, verificado } }
//   actual     correo con sesión iniciada, o null
//   correos    registro de correos "enviados" ({ tipo: 'reset' | 'verificacion', email })
//   fallar     código de error (ej. 'auth/network-request-failed'): la siguiente operación falla con ese código
//   retraso    ms que tarda cada operación
//   retrasoInicial  ms que tarda en avisar el estado de sesión al arrancar
// La semilla viene de globalThis.__semillaAuth ({ usuarios, actual }).

const semilla = globalThis.__semillaAuth || {};
const f = globalThis.__fakeAuth = {
  usuarios: JSON.parse(JSON.stringify(semilla.usuarios || {})),
  actual: semilla.actual || null,
  correos: [],
  fallar: null,
  retraso: 0,
  retrasoInicial: semilla.retrasoInicial || 0,
  llamadas: [],
  oyentes: []
};

// Las cuentas borradas (deleteUser) siguen borradas después de recargar la página.
try { for (const c of JSON.parse(sessionStorage.getItem('__fakeAuthBorrados') || '[]')) delete f.usuarios[c]; } catch (e) { /* sin almacenamiento */ }
// La sesión sobrevive a una recarga de la página (como en Firebase real).
try { const g = sessionStorage.getItem('__fakeAuthActual'); if (g !== null) f.actual = g || null; } catch (e) { /* sin almacenamiento */ }
const guardar = () => { try { sessionStorage.setItem('__fakeAuthActual', f.actual || ''); } catch (e) { /* nada */ } };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const error = (code) => { const e = new Error(`Firebase: Error (${code}).`); e.code = code; return e; };
// Un solo objeto por sesión (como currentUser real): emailVerified y la "marca" del token
// (claims.email_verified, lo que leen las reglas) solo se actualizan con reload() y getIdToken(true).
const estados = {};
function usuarioActual() {
  if (!f.actual) return null;
  const email = f.actual, real = f.usuarios[email];
  if (!estados[email]) estados[email] = { emailVerified: !!real.verificado, claim: !!real.verificado };
  const st = estados[email];
  return {
    uid: real.uid, email,
    providerData: [{ providerId: real.password ? 'password' : 'google.com' }],
    get emailVerified() { return st.emailVerified; },
    async getIdTokenResult() { return { claims: { email_verified: st.claim } }; },
    async reload() { st.emailVerified = !!real.verificado; },
    async getIdToken(forzar) { if (forzar) st.claim = st.emailVerified; return 'token-falso'; }
  };
}
const avisar = () => { guardar(); const u = usuarioActual(); f.oyentes.forEach((cb) => setTimeout(() => cb(u), 0)); };
const correoValido = (c) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(c || ''));
async function operacion(nombre, args) {
  f.llamadas.push({ nombre, args });
  await esperar(f.retraso);
  if (f.fallar) { const c = f.fallar; f.fallar = null; throw error(c); }
  if (f.fallarEn && f.fallarEn.operacion === nombre) { const c = f.fallarEn.codigo; f.fallarEn = null; throw error(c); } // falla solo esa operación, una vez
}

export function getAuth(app) {
  return { app, get currentUser() { return usuarioActual(); } };
}

export function onAuthStateChanged(auth, cb) {
  f.oyentes.push(cb);
  setTimeout(() => cb(usuarioActual()), f.retrasoInicial);
  return () => { f.oyentes = f.oyentes.filter((x) => x !== cb); };
}

export async function signInWithEmailAndPassword(auth, email, password) {
  await operacion('signIn', { email });
  if (!correoValido(email)) throw error('auth/invalid-email');
  if (!password) throw error('auth/missing-password');
  const u = f.usuarios[email];
  if (!u || u.password !== password) throw error('auth/invalid-credential');
  f.actual = email; avisar();
  return { user: usuarioActual() };
}

export async function createUserWithEmailAndPassword(auth, email, password) {
  await operacion('crear', { email });
  if (!correoValido(email)) throw error('auth/invalid-email');
  if (!password || password.length < 6) throw error('auth/weak-password');
  if (f.usuarios[email]) throw error('auth/email-already-in-use');
  f.usuarios[email] = { password, uid: 'uid-' + email, verificado: false };
  f.actual = email; avisar();
  return { user: usuarioActual() };
}

export async function signOut(auth) {
  await operacion('signOut', {});
  f.actual = null; avisar();
}

export async function sendPasswordResetEmail(auth, email) {
  await operacion('reset', { email });
  if (!correoValido(email)) throw error('auth/invalid-email');
  f.correos.push({ tipo: 'reset', email });
}

export async function sendEmailVerification(user) {
  await operacion('verificacion', {});
  f.correos.push({ tipo: 'verificacion', email: user && user.email });
}

// ---- Google (ventana emergente) ----
// La prueba define globalThis.__fakeAuth.google = { email, uid } (la cuenta que elige la persona);
// con null la persona cierra la ventana. fallar sirve igual que en las demás operaciones.
export class GoogleAuthProvider {
  setCustomParameters(p) { this.parametros = p; }
  static credential(idToken) { return { proveedor: 'google.com', idToken }; }
}
export async function signInWithCredential(auth, credencial) {
  await operacion('credencial', { idToken: credencial && credencial.idToken });
  const g = f.google;
  if (!g || !credencial || !credencial.idToken) throw error('auth/invalid-credential');
  if (!f.usuarios[g.email]) f.usuarios[g.email] = { password: null, uid: g.uid || 'uid-' + g.email, verificado: true };
  f.actual = g.email; avisar();
  return { user: usuarioActual() };
}
export async function signInWithPopup(auth, proveedor) {
  await operacion('google', { parametros: proveedor && proveedor.parametros });
  const g = f.google;
  if (!g) throw error('auth/popup-closed-by-user');
  if (!f.usuarios[g.email]) f.usuarios[g.email] = { password: null, uid: g.uid || 'uid-' + g.email, verificado: true };
  f.actual = g.email; avisar();
  return { user: usuarioActual() };
}

// ---- Baja de cuenta: confirmar la identidad y borrar la cuenta ----
export class EmailAuthProvider {
  static credential(email, password) { return { proveedor: 'password', email, password }; }
}
export async function reauthenticateWithCredential(user, credencial) {
  await operacion('reauth', { proveedor: credencial && credencial.proveedor });
  const real = f.usuarios[f.actual];
  if (credencial && credencial.proveedor === 'password') {
    if (!real || real.password !== credencial.password) throw error('auth/invalid-credential');
  } else if (!credencial || !credencial.idToken) {
    throw error('auth/invalid-credential');
  }
  return { user: usuarioActual() };
}
export async function reauthenticateWithPopup(user, proveedor) {
  await operacion('reauthPopup', {});
  if (!f.google) throw error('auth/popup-closed-by-user');
  return { user: usuarioActual() };
}
export async function deleteUser(user) {
  await operacion('deleteUser', {});
  try { const b = JSON.parse(sessionStorage.getItem('__fakeAuthBorrados') || '[]'); b.push(f.actual); sessionStorage.setItem('__fakeAuthBorrados', JSON.stringify(b)); } catch (e) { /* nada */ }
  delete f.usuarios[f.actual];
  delete estados[f.actual];
  f.actual = null; avisar();
}
