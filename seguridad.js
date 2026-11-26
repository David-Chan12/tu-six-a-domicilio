// =====================================================================
//  seguridad.js — Guardia de sesión para todas las páginas protegidas
//  Jurisdicción Sanitaria No. 2 · Control de Equipos
//
//  Qué hace:
//   1. Si no hay sesión iniciada → manda al login.
//   2. Si el usuario no está activo o su rol no tiene permiso → lo saca.
//   3. Cierra la sesión sola después de un tiempo sin actividad
//      (avisa 1 minuto antes).
//   4. Si el usuario regresa con el botón "Atrás" a una página guardada
//      en caché, vuelve a revisar la sesión antes de mostrarla.
//
//  Uso en cada página (dentro de <head>):
//    <style id="guardia-sesion">body{visibility:hidden}</style>
//    <script type="module">
//      import { protegerPagina } from "./seguridad.js";
//      protegerPagina(["ADMINISTRADOR", "TECNICO"]);
//    </script>
// =====================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Cierra sesión y manda al login sin dejar la página en el historial
export async function cerrarSesionSegura(motivo = "manual") {
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

function registrarActividad() {
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
    window.addEventListener(ev, registrarActividad, { passive: true })
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
 * @param {string[]} rolesPermitidos  Ej. ["ADMINISTRADOR","TECNICO"]. Vacío = cualquier rol activo.
 * @param {(info:{user:any, datos:any, rol:string})=>void} [alAutorizar]  Se ejecuta cuando el acceso es válido.
 */
export function protegerPagina(rolesPermitidos = [], alAutorizar) {
  const permitidos = rolesPermitidos.map(normalizarRol);
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

    try {
      const snap = await getDoc(doc(db, "usuarios", user.uid));
      const datos = snap.exists() ? snap.data() : null;

      if (!datos || datos.activo !== true) {
        await avisar("Acceso denegado", "Tu cuenta no está activa o está pendiente de aprobación.", "error");
        return cerrarSesionSegura("inactivo");
      }

      const rol = normalizarRol(datos.rol || "CONSULTA");
      if (permitidos.length && !permitidos.includes(rol)) {
        mostrarPagina();
        await avisar("Acceso restringido", `Tu rol (${rol}) no tiene permiso para entrar a este módulo.`, "warning");
        window.location.replace("index.html");
        return;
      }

      guardarActividad();
      iniciarControlInactividad();
      mostrarPagina();
      if (typeof alAutorizar === "function") alAutorizar({ user, datos, rol });
    } catch (error) {
      console.error("Error verificando la sesión:", error);
      await avisar("Error de verificación", "No se pudo comprobar tu sesión. Inicia sesión de nuevo.", "error");
      cerrarSesionSegura("error");
    }
  });
}

// Disponible para los botones "Cerrar sesión" de cualquier página
window.cerrarSesionSegura = cerrarSesionSegura;
