// =====================================================================
//  plano.js — Detalles del tema "plano técnico"
//  · Barra de hoja arriba del contenido:  04 │ ALTA DE EQUIPOS …… JS2-INV · HOJA 04 / 11
//  · Marca de registro ⊕ en la esquina de la hoja
//  · Pie de página como cajetín de plano (proyecto, dependencia, hoja, fecha, revisión)
//  · Colores de las gráficas (Chart.js) adaptados al fondo azul
//  No toca ninguna función de Firebase ni de la página.
// =====================================================================
(function () {
  const HOJAS = {
    "login.html":            ["01", "Acceso al sistema"],
    "registro.html":         ["02", "Registro de usuario"],
    "index.html":            ["03", "Menú principal"],
    "":                      ["03", "Menú principal"],
    "alta.html":             ["04", "Alta de equipos"],
    "escaner.html":          ["05", "Escáner de código QR"],
    "inventario.html":       ["06", "Inventario y ubicación"],
    "mantenimientos.html":   ["07", "Mantenimiento y servicios"],
    "bajas.html":            ["08", "Bajas de equipos"],
    "reportes_equipos.html": ["09", "Reportes de equipos"],
    "reportes_accesos.html": ["10", "Auditoría de accesos"],
    "gestion_usuarios.html": ["11", "Usuarios y roles"]
  };
  const TOTAL = "11";
  const archivo = (location.pathname.split("/").pop() || "").toLowerCase();
  const [num, titulo] = HOJAS[archivo] || ["--", document.title];

  // Gráficas: se configura antes de que la página las dibuje
  if (window.Chart && Chart.defaults) {
    Chart.defaults.color = "rgba(234, 244, 255, 0.74)";
    Chart.defaults.borderColor = "rgba(234, 244, 255, 0.12)";
    Chart.defaults.font.family = "'JetBrains Mono', Consolas, monospace";
  }

  function crearBarraHoja(contenedor) {
    const estilo = getComputedStyle(contenedor);
    const barra = document.createElement("div");
    barra.className = "hoja-barra";
    barra.setAttribute("aria-hidden", "true");
    barra.innerHTML =
      `<span class="hoja-barra__num">${num}</span>` +
      `<span class="hoja-barra__titulo">${titulo}</span>` +
      `<span class="hoja-barra__clave">JS2-INV · Hoja ${num} / ${TOTAL}</span>`;
    // La barra ocupa todo el ancho de la hoja aunque el contenedor tenga relleno
    barra.style.marginTop = `calc(-${estilo.paddingTop} - 1px)`;
    barra.style.marginLeft = `calc(-${estilo.paddingLeft} - 1px)`;
    barra.style.marginRight = `calc(-${estilo.paddingRight} - 1px)`;
    contenedor.prepend(barra);

    const marca = document.createElement("span");
    marca.className = "hoja-marca";
    if (estilo.position === "static") contenedor.style.position = "relative";
    contenedor.appendChild(marca);
  }

  function crearCajetin() {
    const pie = document.querySelector("footer");
    if (!pie || pie.dataset.cajetin) return;
    pie.dataset.cajetin = "1";
    const hoy = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
    const original = pie.textContent.trim();
    pie.innerHTML = `
      <div class="cajetin">
        <div class="cajetin__celda cajetin__celda--ancha"><small>Proyecto</small><b>Plataforma de Inventarios y Control de Equipos</b></div>
        <div class="cajetin__celda cajetin__celda--ancha"><small>Dependencia</small><b>Servicios de Salud de Yucatán · Jurisdicción Sanitaria No. 2</b></div>
        <div class="cajetin__celda"><small>Hoja</small><b>${num} / ${TOTAL}</b></div>
        <div class="cajetin__celda"><small>Fecha</small><b>${hoy}</b></div>
        <div class="cajetin__celda"><small>Rev.</small><b>A</b></div>
      </div>
      <div class="cajetin__copy">${original}</div>`;
  }

  // Encabezado institucional permanente: se adelgaza al bajar y la barra de
  // navegación se acomoda justo debajo de él (variable --alto-encabezado)
  function encabezadoPermanente() {
    const enc = document.querySelector(".header-institucional");
    if (!enc) return;
    const medir = () =>
      document.documentElement.style.setProperty("--alto-encabezado", enc.offsetHeight + "px");
    const alBajar = () => enc.classList.toggle("compacto", window.scrollY > 40);
    if (window.ResizeObserver) new ResizeObserver(medir).observe(enc);
    window.addEventListener("resize", medir);
    enc.addEventListener("transitionend", medir);
    enc.querySelectorAll("img").forEach((img) => {
      img.addEventListener("transitionend", medir);
      img.addEventListener("load", medir);
    });
    window.addEventListener("scroll", alBajar, { passive: true });
    medir();
    alBajar();
  }

  function aplicar() {
    encabezadoPermanente();
    const contenedor = document.querySelector(
      ".main-container, .portal-container, body > .container, .scanner-container, .register-card, .auth-column"
    );
    if (contenedor && !contenedor.querySelector(".hoja-barra")) {
      contenedor.classList.add("hoja");
      crearBarraHoja(contenedor);
    }
    crearCajetin();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", aplicar);
  else aplicar();
})();
