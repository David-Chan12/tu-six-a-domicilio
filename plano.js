// =====================================================================
//  plano.js — Detalles del tema "plano técnico"
//  · Barra de hoja arriba del contenido:  04 │ ALTA DE EQUIPOS …… JS2-INV · HOJA 04 / 11
//  · Marca de registro ⊕ en la esquina de la hoja
//  · Pie de página como cajetín de plano (proyecto, dependencia, hoja, fecha, revisión)
//  · Modos de color claro / medio / oscuro (interruptor del menú principal)
//  · Colores de las gráficas (Chart.js) adaptados al modo activo
//  No toca ninguna función de Firebase ni de la página.
// =====================================================================
(function () {
  const HOJAS = {
    "login.html":            ["01", "Acceso al sistema"],
    "registro.html":         ["--", "Registro deshabilitado"],
    "index.html":            ["02", "Menú principal"],
    "":                      ["02", "Menú principal"],
    "alta.html":             ["03", "Alta de equipos"],
    "escaner.html":          ["04", "Escáner de código QR"],
    "inventario.html":       ["05", "Inventario y ubicación"],
    "mantenimientos.html":   ["06", "Mantenimiento y servicios"],
    "bajas.html":            ["07", "Bajas de equipos"],
    "reportes_equipos.html": ["08", "Reportes de equipos"],
    "reportes_accesos.html": ["09", "Auditoría de accesos"],
    "gestion_usuarios.html": ["10", "Bitácora de cuentas"]
  };
  const TOTAL = "10";
  const archivo = (location.pathname.split("/").pop() || "").toLowerCase();
  const [num, titulo] = HOJAS[archivo] || ["--", document.title];

  // Gráficas: se configura antes de que la página las dibuje
  // ---------------- MODOS DE COLOR (claro · medio · oscuro) ----------------
  const CLAVE_TEMA = "js2_tema";
  const TEMAS = ["claro", "medio", "oscuro"];
  const raizHtml = document.documentElement;
  const temaGuardado = () => { try { return localStorage.getItem(CLAVE_TEMA); } catch { return null; } };
  if (!TEMAS.includes(raizHtml.dataset.tema)) raizHtml.dataset.tema = TEMAS.includes(temaGuardado()) ? temaGuardado() : "oscuro";

  // Gráficas: los textos y líneas toman el color de la tinta del modo activo
  function colorearGraficas() {
    if (!window.Chart || !Chart.defaults) return;
    const rgb = getComputedStyle(raizHtml).getPropertyValue("--tinta-rgb").trim() || "234, 244, 255";
    Chart.defaults.color = `rgba(${rgb}, 0.74)`;
    Chart.defaults.borderColor = `rgba(${rgb}, 0.12)`;
    Chart.defaults.font.family = "'JetBrains Mono', Consolas, monospace";
    Object.values(Chart.instances || {}).forEach((g) => {
      try {
        ["x", "y", "r"].forEach((eje) => {
          const e = g.options.scales && g.options.scales[eje];
          if (!e) return;
          if (e.ticks) e.ticks.color = Chart.defaults.color;
          if (e.grid) e.grid.color = Chart.defaults.borderColor;
          if (e.pointLabels) e.pointLabels.color = Chart.defaults.color;
        });
        const leyenda = g.options.plugins && g.options.plugins.legend;
        if (leyenda && leyenda.labels) leyenda.labels.color = Chart.defaults.color;
        g.update("none");
      } catch (e) { /* gráfica sin escalas */ }
    });
  }
  colorearGraficas();

  // Sonido corto y suave al cambiar de modo (Web Audio, sin archivos)
  let audio = null;
  function sonar(tema) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const notas = { claro: [880, 1320], medio: [660, 990], oscuro: [440, 660] }[tema];
      notas.forEach((f, i) => {
        const osc = audio.createOscillator(), vol = audio.createGain();
        const t = audio.currentTime + i * 0.07;
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, t);
        vol.gain.setValueAtTime(0.0001, t);
        vol.gain.exponentialRampToValueAtTime(0.05, t + 0.015);
        vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(vol).connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch (e) { /* navegador sin audio */ }
  }

  function aplicarTema(tema, conEfecto) {
    if (!TEMAS.includes(tema)) return;
    if (conEfecto) {
      raizHtml.classList.add("cambiando-tema");
      setTimeout(() => raizHtml.classList.remove("cambiando-tema"), 500);
    }
    raizHtml.dataset.tema = tema;
    try { localStorage.setItem(CLAVE_TEMA, tema); } catch {}
    document.querySelectorAll(".interruptor-tema").forEach((it) => {
      it.dataset.activo = tema;
      it.querySelectorAll("[data-tema]").forEach((b) => {
        const sel = b.dataset.tema === tema;
        b.setAttribute("aria-checked", sel ? "true" : "false");
        b.tabIndex = sel ? 0 : -1;
      });
    });
    colorearGraficas();
  }

  // Si el modo cambia en otra pestaña, esta también se actualiza
  window.addEventListener("storage", (e) => { if (e.key === CLAVE_TEMA && e.newValue) aplicarTema(e.newValue, true); });

  function prepararInterruptores() {
    document.querySelectorAll(".interruptor-tema").forEach((it) => {
      if (it.dataset.listo) return;
      it.dataset.listo = "1";
      it.addEventListener("click", (e) => {
        const b = e.target.closest("[data-tema]");
        if (!b || b.dataset.tema === raizHtml.dataset.tema) return;
        it.classList.remove("apretado"); void it.offsetWidth; it.classList.add("apretado");
        aplicarTema(b.dataset.tema, true);
        sonar(b.dataset.tema);
      });
      it.addEventListener("keydown", (e) => {
        const i = TEMAS.indexOf(raizHtml.dataset.tema);
        let n = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = TEMAS[Math.min(2, i + 1)];
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = TEMAS[Math.max(0, i - 1)];
        if (n && n !== raizHtml.dataset.tema) {
          e.preventDefault();
          e.stopPropagation();
          aplicarTema(n, true);
          sonar(n);
          it.querySelector(`[data-tema="${n}"]`).focus();
        }
      });
    });
    aplicarTema(raizHtml.dataset.tema, false);
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
    prepararInterruptores();
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
