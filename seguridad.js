// =====================================================================
//  seguridad.js — Guardia de sesión para todas las páginas protegidas
//  Jurisdicción Sanitaria No. 2 · Control de Equipos
//
//  Qué hace:
//   1. Si no hay sesión iniciada → manda al login.
//   2. Si el correo no está en la lista de acceso (acceso.js) → lo saca.
//      Las cuentas autorizadas tienen acceso completo (ya no hay roles).
//   3. Cierra la sesión sola después de un tiempo sin actividad
//      (avisa 1 minuto antes).
//   4. Si el usuario regresa con el botón "Atrás" a una página guardada
//      en caché, vuelve a revisar la sesión antes de mostrarla.
//   5. Bitácora: guarda en Firestore (colección "actividad_usuarios")
//      cada página visitada, los cierres de sesión y las acciones
//      importantes. Se consulta en gestion_usuarios.html.
//
//  Uso en cada página (dentro de <head>):
//    <style id="guardia-sesion">body{visibility:hidden}</style>
//    <script type="module">
//      import { protegerPagina } from "./seguridad.js";
//      protegerPagina();
//    </script>
//  Para registrar una acción desde cualquier página:
//    window.registrarActividad?.("ALTA", "Alta del equipo EQ-001");
// =====================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { esCorreoAutorizado } from "./acceso.js";

// ---------------- CONFIGURACIÓN ----------------
export const MINUTOS_INACTIVIDAD = 15;   // tiempo sin actividad antes de cerrar sesión
const SEGUNDOS_AVISO = 60;               // aviso previo antes del cierre
// ----------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyD_y1EWlyWL054e1k8T3mkB8ROUoMD3tWs",
  authDomain: "control-de-equipos-762c4.firebaseapp.com",
  projectId: "control-de-equipos-762c4",
  storageBucket: "control-de-equipos-762c4.firebasestorage.app",
  messagingSenderId: "711982599026",
  appId: "1:711982599026:web:ba92c737011b38f882abeb",
  measurementId: "G-X1M2R00M55"
};

// Reutiliza la app de Firebase si la página ya la inicializó
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CLAVE_ACTIVIDAD = "js2_ultimaActividad";
const CLAVE_MOTIVO = "js2_motivoSalida";
const LIMITE_MS = MINUTOS_INACTIVIDAD * 60 * 1000;

// Quita acentos y unifica alias: "TÉCNICO" = "TECNICO", "ADMIN" = "ADMINISTRADOR"
export function normalizarRol(rol) {
  const r = String(rol || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return r === "ADMIN" ? "ADMINISTRADOR" : r;
}

function mostrarPagina() {
  const estilo = document.getElementById("guardia-sesion");
  if (estilo) estilo.remove();
  document.body && (document.body.style.visibility = "visible");
}

function leerActividad() {
  try { return parseInt(localStorage.getItem(CLAVE_ACTIVIDAD) || "0", 10); } catch { return 0; }
}
function guardarActividad() {
  try { localStorage.setItem(CLAVE_ACTIVIDAD, String(Date.now())); } catch {}
}

// ---------------- BITÁCORA DE ACTIVIDAD ----------------
const PAGINAS = {
  "index.html": "Menú principal", "": "Menú principal",
  "alta.html": "Registro de equipos", "escaner.html": "Escáner QR",
  "inventario.html": "Inventario y ubicación", "mantenimientos.html": "Mantenimiento y servicios",
  "bajas.html": "Bajas de equipos", "reportes_equipos.html": "Reportes de equipos",
  "reportes_accesos.html": "Auditoría de accesos", "gestion_usuarios.html": "Bitácora de cuentas"
};
const archivoActual = (location.pathname.split("/").pop() || "").toLowerCase();
export const usuarioActual = { uid: "", email: "", nombre: "" };

/**
 * Guarda un movimiento en la bitácora (colección "actividad_usuarios").
 * tipo: INICIO_SESION, VISITA, CIERRE_SESION, INACTIVIDAD, ALTA, EDICION, BAJA, MANTENIMIENTO…
 */
export async function registrarActividad(tipo, detalle = "") {
  const u = auth.currentUser;
  if (!u) return;
  try {
    await addDoc(collection(db, "actividad_usuarios"), {
      uid: u.uid,
      email: (u.email || "").toLowerCase(),
      nombre: usuarioActual.nombre || u.displayName || u.email,
      tipo: String(tipo).toUpperCase(),
      detalle: String(detalle || ""),
      pagina: PAGINAS[archivoActual] || archivoActual,
      fecha: serverTimestamp(),
      dispositivo: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "Celular / tableta" : "Computadora"
    });
  } catch (e) {
    console.warn("No se pudo guardar la actividad:", e);
  }
}
window.registrarActividad = registrarActividad;

// Cierra sesión y manda al login sin dejar la página en el historial
export async function cerrarSesionSegura(motivo = "manual") {
  const tipos = { manual: "CIERRE_SESION", inactividad: "INACTIVIDAD" };
  if (tipos[motivo]) {
    await Promise.race([
      registrarActividad(tipos[motivo], motivo === "inactividad" ? "Sesión cerrada automáticamente por inactividad" : "Cerró sesión"),
      new Promise((r) => setTimeout(r, 1500))
    ]);
  }
  try { sessionStorage.setItem(CLAVE_MOTIVO, motivo); } catch {}
  try { localStorage.removeItem(CLAVE_ACTIVIDAD); } catch {}
  try { await signOut(auth); } catch (e) { console.error("Error al cerrar sesión:", e); }
  window.location.replace("login.html");
}

function avisar(titulo, texto, icono) {
  if (window.Swal) {
    return Swal.fire({ title: titulo, text: texto, icon: icono, confirmButtonColor: "#8A1538", allowOutsideClick: false });
  }
  alert(`${titulo}\n\n${texto}`);
  return Promise.resolve();
}

// ---------------- INACTIVIDAD ----------------
let avisoAbierto = false;
let ultimaEscritura = 0;

function marcarActividad() {
  if (avisoAbierto) return;                 // mientras está el aviso, solo cuenta el botón
  const ahora = Date.now();
  if (ahora - ultimaEscritura > 5000) {     // escribe máximo cada 5 s
    ultimaEscritura = ahora;
    guardarActividad();
  }
}

function mostrarAvisoInactividad() {
  if (avisoAbierto) return;
  avisoAbierto = true;

  if (!window.Swal) {
    // Sin SweetAlert: confirm() bloquea; si tarda demasiado en responder, igual se cierra
    const inicio = Date.now();
    const seguir = confirm("Tu sesión se cerrará por inactividad. ¿Deseas seguir conectado?");
    avisoAbierto = false;
    if (seguir && Date.now() - inicio < SEGUNDOS_AVISO * 1000) guardarActividad();
    else cerrarSesionSegura("inactividad");
    return;
  }

  let restantes = SEGUNDOS_AVISO;
  Swal.fire({
    title: "¿Sigues ahí?",
    html: `Por seguridad, tu sesión se cerrará en <b id="cuentaRegresiva">${restantes}</b> segundos por inactividad.`,
    icon: "warning",
    confirmButtonText: "Seguir conectado",
    confirmButtonColor: "#8A1538",
    allowOutsideClick: false,
    allowEscapeKey: false,
    timer: SEGUNDOS_AVISO * 1000,
    timerProgressBar: true,
    didOpen: () => {
      const intervalo = setInterval(() => {
        restantes--;
        const el = document.getElementById("cuentaRegresiva");
        if (el) el.textContent = Math.max(restantes, 0);
        if (restantes <= 0) clearInterval(intervalo);
      }, 1000);
    }
  }).then((r) => {
    avisoAbierto = false;
    if (r.isConfirmed) guardarActividad();
    else cerrarSesionSegura("inactividad");
  });
}

function revisarInactividad() {
  const transcurrido = Date.now() - leerActividad();
  if (transcurrido >= LIMITE_MS) {
    if (window.Swal && avisoAbierto) Swal.close();
    cerrarSesionSegura("inactividad");
  } else if (transcurrido >= LIMITE_MS - SEGUNDOS_AVISO * 1000) {
    mostrarAvisoInactividad();
  } else if (avisoAbierto && window.Swal) {
    // Hubo actividad en otra pestaña: se cierra el aviso aquí
    avisoAbierto = false;
    Swal.close();
  }
}

function iniciarControlInactividad() {
  ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"].forEach((ev) =>
    window.addEventListener(ev, marcarActividad, { passive: true })
  );
  setInterval(revisarInactividad, 10000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") revisarInactividad();
  });
}

// ---------------- BOTÓN "ATRÁS" ----------------
// Si el navegador muestra la página desde su caché (al regresar),
// se recarga para que la guardia vuelva a revisar la sesión.
window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    document.body.style.visibility = "hidden";
    window.location.reload();
  }
});

// ---------------- GUARDIA PRINCIPAL ----------------
/**
 * Protege la página: solo entran los correos de acceso.js (acceso completo).
 * @param {any} [_sinUso]  Se conserva por compatibilidad (antes eran los roles).
 * @param {(info:{user:any, datos:any, nombre:string})=>void} [alAutorizar]
 */
export function protegerPagina(_sinUso, alAutorizar) {
  if (typeof _sinUso === "function") alAutorizar = _sinUso;
  let revisado = false;

  onAuthStateChanged(auth, async (user) => {
    // Sin sesión → login
    if (!user) {
      if (revisado) return cerrarSesionSegura("sesion");   // la sesión se cerró en otra pestaña
      window.location.replace("login.html");
      return;
    }

    // Sesión vieja (navegador cerrado y abierto mucho después)
    const ultima = leerActividad();
    if (!ultima || Date.now() - ultima >= LIMITE_MS) {
      return cerrarSesionSegura("inactividad");
    }

    if (revisado) return;
    revisado = true;

    if (!esCorreoAutorizado(user.email)) {
      await avisar("Acceso denegado", "Esta cuenta no tiene acceso al sistema.", "error");
      return cerrarSesionSegura("no_autorizado");
    }

    // Nombre para mostrar (si la cuenta tiene ficha en "usuarios" se usa su nombre)
    let datos = null;
    try {
      const snap = await getDoc(doc(db, "usuarios", user.uid));
      datos = snap.exists() ? snap.data() : null;
    } catch (e) { /* sin ficha: se usa el correo */ }
    usuarioActual.uid = user.uid;
    usuarioActual.email = user.email || "";
    usuarioActual.nombre = (datos && datos.nombre) || user.displayName || (user.email || "").split("@")[0];
    window.usuarioActual = usuarioActual;

    guardarActividad();
    iniciarControlInactividad();
    mostrarPagina();
    registrarActividad("VISITA", "Entró a " + (PAGINAS[archivoActual] || archivoActual));
    if (typeof alAutorizar === "function") alAutorizar({ user, datos, nombre: usuarioActual.nombre });
  });
}

// Disponible para los botones "Cerrar sesión" de cualquier página
window.cerrarSesionSegura = cerrarSesionSegura;
