// =====================================================================
//  menu_tambor.js — Mecánica del menú "tambor" 3D del index
//  · Física de resorte (las cartas se acomodan solas con rebote suave)
//  · Rueda del mouse, arrastre (mouse o dedo), flechas del teclado,
//    píldoras 01–08 y botones anterior/siguiente
//  · Inclinación 3D + brillo en la carta activa
//  · Textos de la izquierda cambian con efecto de máscara
//  · Respeta los permisos por rol: el script de index marca las cartas
//    con "modulo-deshabilitado" y aquí se pueden ver, pero no abrir.
// =====================================================================
(function () {
  const raiz = document.getElementById("menuTambor");
  const escenario = document.getElementById("tamborEscenario");
  if (!raiz || !escenario) return;

  const cartas = Array.from(escenario.querySelectorAll(".carta-tambor"));
  const TOTAL = cartas.length;
  const $ = (id) => document.getElementById(id);
  const el = {
    indice: $("tamborIndice"), progreso: $("tamborProgreso"), titulo: $("tamborTitulo"),
    sub: $("tamborSub"), estado: $("tamborEstado"), abrir: $("tamborAbrir"),
    manifiesto: $("tamborManifiesto"), pildoras: $("tamborPildoras"),
    dockIndice: $("tamborDockIndice"), dockTitulo: $("tamborDockTitulo"), dockAbrir: $("tamborDockAbrir")
  };

  const datos = cartas.map((c) => ({
    num: String(cartas.indexOf(c) + 1).padStart(2, "0"),
    titulo: (c.dataset.titulo || "").split("|"),
    sub: (c.dataset.sub || "").split("|"),
    manifiesto: (c.dataset.manifiesto || "").split("|"),
    nombre: c.querySelector(".ct-nombre")?.textContent.trim() || "",
    href: c.getAttribute("href")
  }));

  const fisica = {
    actual: 0, objetivo: 0, velocidad: 0,
    rigidez: 0.085, amortiguacion: 0.78,
    activa: -1,
    arrastrando: false, inicioY: 0, inicioPos: 0, ultimoY: 0, ultimoT: 0, velArrastre: 0, movido: 0,
    inclinacion: { x: 0, y: 0 }, inclinacionObj: { x: 0, y: 0 }
  };

  const bloqueada = (i) => cartas[i].classList.contains("modulo-deshabilitado");
  const desfase = (d) => { d = ((d % TOTAL) + TOTAL) % TOTAL; return d > TOTAL / 2 ? d - TOTAL : d; };
  const indiceDe = (pos) => ((Math.round(pos) % TOTAL) + TOTAL) % TOTAL;

  // ---------- Píldoras ----------
  datos.forEach((d, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = d.num;
    b.setAttribute("aria-label", `Ir al módulo ${d.num}: ${d.nombre}`);
    b.addEventListener("click", () => irA(i));
    el.pildoras.appendChild(b);
  });

  // ---------- Textos con máscara ----------
  const lineas = (arr, entrando) =>
    arr.map((t) => `<span class="mask-line"><span class="mask-inner${entrando ? " entrando" : ""}">${t}</span></span>`).join("");

  function pintarTextos(i, inmediato) {
    const d = datos[i];
    el.progreso.style.width = `${((i + 1) / TOTAL) * 100}%`;
    const aplicar = (entrando) => {
      el.indice.innerHTML = lineas([d.num], entrando);
      el.titulo.innerHTML = lineas(d.titulo, entrando);
      el.sub.innerHTML = lineas(d.sub, entrando);
      el.manifiesto.innerHTML = lineas(d.manifiesto, entrando);
      el.dockIndice.innerHTML = lineas([d.num], entrando);
      el.dockTitulo.innerHTML = lineas([d.nombre], entrando);
      if (entrando) requestAnimationFrame(() => requestAnimationFrame(() =>
        raiz.querySelectorAll(".mask-inner.entrando").forEach((n) => n.classList.remove("entrando"))));
    };
    if (inmediato) return aplicar(false);
    raiz.querySelectorAll(".tambor-izq .mask-inner, .tambor-der .mask-inner, .tambor-dock .mask-inner")
      .forEach((n) => n.classList.add("saliendo"));
    setTimeout(() => aplicar(true), 190);
  }

  function pintarEstado() {
    const i = fisica.activa;
    if (i < 0) return;
    const bloq = bloqueada(i);
    if (el.estado) {                       // indicador opcional (ya no se usa en el index)
      el.estado.textContent = bloq ? "Bloqueado" : "Disponible";
      el.estado.classList.toggle("bloqueado", bloq);
    }
    [el.abrir, el.dockAbrir].forEach((b) => { b.disabled = bloq; });
    el.pildoras.querySelectorAll("button").forEach((b, k) => {
      b.classList.toggle("activa", k === i);
      b.classList.toggle("bloqueada", bloqueada(k));
    });
  }

  // El script de roles cambia las clases después de leer Firebase: se actualiza el estado
  new MutationObserver(pintarEstado).observe(escenario, { subtree: true, attributes: true, attributeFilter: ["class"] });

  // ---------- Navegación ----------
  function irA(i) {
    const diff = desfase(i - indiceDe(fisica.objetivo));
    fisica.objetivo = Math.round(fisica.objetivo) + diff;
    fisica.inclinacionObj = { x: 0, y: 0 };
  }
  function paso(delta) {
    fisica.objetivo = Math.round(fisica.objetivo) + delta;
    fisica.inclinacionObj = { x: 0, y: 0 };
  }
  function abrir(i) {
    if (bloqueada(i)) {
      const c = cartas[i];
      c.classList.remove("sacudir"); void c.offsetWidth; c.classList.add("sacudir");
      if (window.Swal) Swal.fire({ title: "Módulo bloqueado", text: "Tu rol no tiene permiso para entrar a este módulo.", icon: "warning", confirmButtonText: "Entendido" });
      return;
    }
    window.location.href = datos[i].href;
  }

  cartas.forEach((c, i) => {
    c.setAttribute("draggable", "false");
    c.addEventListener("click", (e) => {
      e.preventDefault();
      if (fisica.movido > 6) return;               // fue un arrastre, no un clic
      if (i === fisica.activa) abrir(i); else irA(i);
    });
    c.addEventListener("mousemove", (e) => {
      if (i !== fisica.activa || fisica.arrastrando) return;
      const r = c.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      fisica.inclinacionObj = { x: nx * 9, y: -ny * 9 };
      c.style.setProperty("--brillo-x", `${((nx + 0.5) * 100).toFixed(1)}%`);
      c.style.setProperty("--brillo-y", `${((ny + 0.5) * 100).toFixed(1)}%`);
    });
    c.addEventListener("mouseleave", () => { if (i === fisica.activa) fisica.inclinacionObj = { x: 0, y: 0 }; });
  });

  [el.abrir, el.dockAbrir].forEach((b) => b.addEventListener("click", () => abrir(fisica.activa)));
  $("tamborAnterior").addEventListener("click", () => paso(-1));
  $("tamborSiguiente").addEventListener("click", () => paso(1));

  // Rueda del mouse (solo sobre el menú, para no bloquear el scroll de la página)
  let ultimaRueda = 0;
  raiz.addEventListener("wheel", (e) => {
    if (document.querySelector(".swal2-container")) return;
    e.preventDefault();
    const ahora = performance.now();
    if (ahora - ultimaRueda < 220 || Math.abs(e.deltaY) < 12) return;
    ultimaRueda = ahora;
    paso(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // Arrastre con mouse o dedo, con inercia
  escenario.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    fisica.arrastrando = true;
    fisica.inicioY = fisica.ultimoY = e.clientY;
    fisica.ultimoT = performance.now();
    fisica.inicioPos = fisica.actual;
    fisica.velArrastre = 0;
    fisica.velocidad = 0;
    fisica.movido = 0;
    escenario.classList.add("arrastrando");
  });
  window.addEventListener("pointermove", (e) => {
    if (!fisica.arrastrando) return;
    const ahora = performance.now();
    const dt = Math.max(1, ahora - fisica.ultimoT);
    const sensibilidad = window.innerWidth < 768 ? 165 : 230;
    fisica.movido = Math.max(fisica.movido, Math.abs(e.clientY - fisica.inicioY));
    fisica.actual = fisica.inicioPos + (fisica.inicioY - e.clientY) / sensibilidad;
    fisica.objetivo = fisica.actual;
    fisica.velArrastre = ((fisica.ultimoY - e.clientY) / sensibilidad) / (dt / 16.67);
    fisica.ultimoY = e.clientY;
    fisica.ultimoT = ahora;
  });
  const soltar = () => {
    if (!fisica.arrastrando) return;
    fisica.arrastrando = false;
    escenario.classList.remove("arrastrando");
    fisica.objetivo = Math.round(fisica.actual + fisica.velArrastre * 2.4);
    fisica.velocidad = fisica.velArrastre * 0.45;
    setTimeout(() => { fisica.movido = 0; }, 0);
  };
  window.addEventListener("pointerup", soltar);
  window.addEventListener("pointercancel", soltar);

  // Teclado
  window.addEventListener("keydown", (e) => {
    if (document.querySelector(".swal2-container")) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
    if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); paso(1); }
    else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); paso(-1); }
    else if (e.key === "Enter" && (document.activeElement === escenario || document.activeElement === document.body)) abrir(fisica.activa);
  });

  // ---------- Bucle de animación (60 fps) ----------
  function tick() {
    if (!fisica.arrastrando) {
      const desplaz = fisica.objetivo - fisica.actual;
      fisica.velocidad = (fisica.velocidad + desplaz * fisica.rigidez) * fisica.amortiguacion;
      fisica.actual += fisica.velocidad;
      if (Math.abs(desplaz) < 0.0004 && Math.abs(fisica.velocidad) < 0.0004) {
        fisica.actual = fisica.objetivo;
        fisica.velocidad = 0;
      }
    }
    fisica.inclinacion.x += (fisica.inclinacionObj.x - fisica.inclinacion.x) * 0.14;
    fisica.inclinacion.y += (fisica.inclinacionObj.y - fisica.inclinacion.y) * 0.14;

    const cercana = indiceDe(fisica.actual);
    if (cercana !== fisica.activa) {
      const primera = fisica.activa < 0;
      fisica.activa = cercana;
      pintarTextos(cercana, primera);
      pintarEstado();
    }

    const ancho = window.innerWidth;
    const movil = ancho < 768;
    const separacion = movil ? 112 : ancho <= 1024 ? 170 : 196;

    cartas.forEach((c, i) => {
      const o = desfase(i - fisica.actual);
      const a = Math.abs(o);
      const ty = Math.sign(o) * Math.pow(a, 0.86) * separacion;
      const tz = -Math.pow(a, 1.35) * (movil ? 75 : 105);
      const rx = -o * (movil ? 22 : 26);
      const escala = Math.max(0.48, 1 - a * 0.215);
      const opacidad = Math.max(0, 1 - Math.pow(a / 2.65, 2.2));
      const desenfoque = Math.min(4.2, Math.max(0, (a - 0.12) * 1.65));
      const brillo = Math.max(0.55, 1 - a * 0.18);
      const peso = Math.max(0, 1 - a * 2.2);

      c.classList.toggle("activa", a < 0.35);
      c.tabIndex = a < 0.35 ? 0 : -1;
      c.style.zIndex = Math.round(100 - a * 25);
      c.style.opacity = opacidad.toFixed(3);
      c.style.visibility = opacidad < 0.01 ? "hidden" : "visible";
      c.style.filter = `blur(${desenfoque.toFixed(2)}px) brightness(${brillo.toFixed(2)})`;
      c.style.boxShadow = a < 0.35
        ? "0 34px 75px -16px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(var(--cian-rgb), 0.35)"
        : "0 16px 36px -10px rgba(0, 0, 0, 0.45)";
      c.style.transform =
        `translate3d(-50%, calc(-50% + ${ty.toFixed(2)}px), ${tz.toFixed(2)}px) ` +
        `rotateX(${(rx + fisica.inclinacion.y * peso).toFixed(2)}deg) ` +
        `rotateY(${(fisica.inclinacion.x * peso).toFixed(2)}deg) scale(${escala.toFixed(4)})`;
      const sombra = c.querySelector(".ct-sombra");
      if (sombra) sombra.style.opacity = Math.min(0.6, a * 0.3).toFixed(2);
      const abajo = c.querySelector(".ct-abajo");
      if (abajo) abajo.style.opacity = Math.max(0, 1 - a * 1.45).toFixed(2);
    });

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(() => raiz.classList.add("listo"));
  requestAnimationFrame(tick);
})();
