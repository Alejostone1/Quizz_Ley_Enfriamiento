// Ayuda integrada: recorrido guiado paso a paso, instructivo en ventana y bienvenida.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DOC = 'docs/instructivo.html';
  const SEEN_KEY = 'fyt-welcome-seen';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: no pasa nada */ } },
  };

  // ===================== INSTRUCTIVO EN VENTANA =====================
  const dlg = $('guide-dialog');
  const frame = $('guide-frame');

  function openGuide(anchor) {
    const src = anchor ? `${DOC}#${anchor}` : DOC;
    if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
    if (!dlg.open) dlg.showModal();
  }

  $('btn-guide').addEventListener('click', () => openGuide());
  $('help-fab').addEventListener('click', () => openGuide());
  $('gd-close').addEventListener('click', () => dlg.close());
  $('gd-tour').addEventListener('click', () => { dlg.close(); startTour(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.querySelectorAll('[data-guide]').forEach((b) => b.addEventListener('click', () => openGuide(b.dataset.guide)));

  // ===================== RECORRIDO GUIADO =====================
  const STEPS = [
    {
      sel: '.hero-inner', title: '👋 Bienvenido a Forja & Temple',
      text: 'Este simulador muestra cómo una pieza de metal <strong>pierde o gana calor</strong> según la Ley de Enfriamiento de Newton. En este recorrido verás qué hace cada parte. Usa las flechas del teclado o los botones para avanzar.',
    },
    {
      sel: '#presets', title: '1 · Escenarios listos',
      text: 'Cada botón carga un experimento completo con datos reales. <strong>Temple clásico</strong> compara acero al rojo vivo en aire, aceite y agua. Los demás muestran metales distintos, un horno donde la pieza <em>gana</em> calor y nitrógeno líquido.',
    },
    {
      sel: '#sec-controls .control-grid .group:nth-child(1)', title: 'Geometría de la pieza',
      text: 'La pieza es un cilindro. Digita su <strong>diámetro</strong> y su <strong>largo</strong> en milímetros; debajo aparecen el área A, el volumen V y la longitud característica Lc = V/A que usa la física.',
    },
    {
      sel: '#sec-controls .control-grid .group:nth-child(2)', title: 'Velocidad de la simulación',
      text: 'El tiempo es real (segundos). En modo <strong>automático</strong> la simulación arranca lenta para que veas los medios rápidos, como el agua, y acelera para los lentos, como el aire. En <strong>manual</strong> eliges un multiplicador fijo, de ×0.1 a ×1000.',
    },
    {
      sel: '#sec-controls .control-grid .group:nth-child(3)', title: 'Visualización',
      text: '<strong>Cámara térmica</strong>: pinta todo con la paleta de una cámara infrarroja. <strong>Escala logarítmica</strong>: permite comparar en la gráfica medios muy rápidos y muy lentos. <strong>Modo laboratorio</strong>: agrega ruido de sensor a las mediciones, como en un experimento real.',
    },
    {
      sel: '#sec-controls .button-row', title: 'Iniciar, pausar y reiniciar',
      text: '<strong>Iniciar</strong> arranca la simulación, que se detiene sola cuando los tres experimentos llegan al equilibrio. <strong>Pausar</strong> congela todo para explicar con calma. <strong>Reiniciar</strong> vuelve a t = 0.',
      action: { label: '▶ Iniciar ahora', run: () => { const b = $('btn-start'); if (!b.disabled) b.click(); } },
    },
    {
      sel: '.status-bar', title: 'Barra de estado',
      text: 'Muestra si la simulación corre, el <strong>tiempo físico</strong> transcurrido, la velocidad actual y cuánto tardará el experimento más lento en llegar al equilibrio.',
    },
    {
      sel: '#lane-A .lane-config', title: '2 · Configura cada experimento',
      text: 'Cada tarjeta (A, B y C) es un experimento independiente. Elige el <strong>metal</strong> y el <strong>medio</strong>: al cambiar el medio se rellenan su temperatura y su coeficiente h típicos, que puedes modificar. Cualquier cambio reinicia la simulación.',
    },
    {
      sel: '#A-stage', title: 'La escena animada',
      text: 'El color del metal es el <strong>color real de incandescencia</strong>: el metal brilla desde 525 °C. <span style="color:#e11d48;font-weight:700">Flechas rojas</span>: calor saliendo. <span style="color:#d97706;font-weight:700">Flechas doradas</span>: calor entrando. Su grosor y su rapidez indican la potencia. También verás burbujas, vapor, humo, niebla o escarcha según el medio.',
    },
    {
      sel: '#A-phase', title: 'Etapa física actual',
      text: 'Describe lo que está pasando: <em>capa de vapor (Leidenfrost)</em>, <em>ebullición nucleada</em>, <em>convección</em> o <em>equilibrio</em>. Así se entiende por qué el enfriamiento cambia en cada momento.',
    },
    {
      sel: '#lane-A .readouts', title: 'Lecturas en vivo',
      text: 'Temperatura media, núcleo y superficie, potencia (W), energía transferida (J), rapidez dT/dt, la constante k con τ = 1/k, el número de Biot, la masa y el tiempo al equilibrio. <strong>Pasa el mouse sobre cada lectura</strong> para ver qué significa.',
    },
    {
      sel: '#chartT', title: '3 · Gráfica temperatura vs tiempo',
      text: 'Una curva por experimento; la línea punteada del mismo color es la temperatura del medio (Tₘ). Los círculos son las mediciones de la tabla. La línea naranja marca 525 °C, el punto de Draper, donde el metal empieza a brillar.',
    },
    {
      sel: '.focus-bar', title: 'Experimento en foco',
      text: 'Elige A, B o C. Las secciones 4 a 7 (potencia, matemática, tablas y análisis) se calculan con ese experimento. También puedes usar el botón <strong>🔍 Analizar</strong> de cada tarjeta.',
    },
    {
      sel: '#chartQ', title: '4 · La integral se ve',
      text: 'La curva es la potencia q(t) = hA(T − Tₘ). El <strong>área sombreada</strong> es la energía total transferida, Q = ∫ q dt, y crece en vivo. La línea tenue muestra cómo seguirá la curva.',
    },
    {
      sel: '#math-steps', title: '5 · Matemática paso a paso',
      text: 'Diez pasos con los números del experimento en foco: de dónde sale k, separación de variables, integral, despeje de T(t), derivadas, la integral de la energía, el tiempo para llegar a una temperatura objetivo T* y la validez del modelo. <strong>Todo se recalcula en vivo.</strong>',
    },
    {
      sel: '#sec-comp .table-wrap', title: '6 · Tabla comparativa',
      text: 'Las mediciones de los tres experimentos cada Δt segundos; puedes cambiar ese intervalo. Se exporta a CSV para Excel.',
    },
    {
      sel: '#ana-results', title: '7 · Análisis tipo informe',
      text: 'Calcula k a partir de las mediciones de tres formas: el <strong>promedio de razones</strong> del informe del profesor, el <strong>logaritmo por intervalo</strong> y la <strong>regresión lineal</strong> de ln|T − Tₘ|. Las compara con la k teórica y explica el sesgo del método de razones.',
    },
    {
      sel: '#tbl-metals', title: '8 · Tablas científicas',
      text: 'Propiedades de 11 metales (Incropera, Tabla A.1) y de 10 medios. Las filas resaltadas son las que usan tus experimentos.',
    },
    {
      sel: '#sec-notes', title: '9 · Límites del modelo',
      text: 'Explica hasta dónde vale la Ley de Newton (número de Biot, radiación, etapas de ebullición…). Ideal para responder preguntas del profesor.',
    },
    {
      sel: '#help-fab', title: '¿Te perdiste? Aquí está la ayuda',
      text: 'Este botón abre el <strong>instructivo completo</strong>, que también se puede descargar en PDF. Cada sección tiene además un botón <strong>?</strong> que abre justo su parte del instructivo. ¡Listo, ya sabes usar el simulador!',
    },
  ];

  let idx = -1, spot, card, raf = 0;

  function buildTourUI() {
    spot = document.createElement('div');
    spot.className = 'tour-spot';
    card = document.createElement('div');
    card.className = 'tour-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-live', 'polite');
    document.body.append(spot, card);
    card.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'next') go(idx + 1);
      else if (act === 'prev') go(idx - 1);
      else if (act === 'end') endTour();
      else if (act === 'run') { const s = STEPS[idx]; if (s.action) s.action.run(); }
      else if (act === 'guide') { endTour(); openGuide(); }
    });
  }

  function place() {
    if (idx < 0) return;
    const el = document.querySelector(STEPS[idx].sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, pad = 8;
    const top = Math.max(r.top - pad, 6), bottom = Math.min(r.bottom + pad, vh - 6);
    const left = Math.max(r.left - pad, 6), right = Math.min(r.right + pad, vw - 6);
    Object.assign(spot.style, {
      top: `${top}px`, left: `${left}px`,
      width: `${Math.max(0, right - left)}px`, height: `${Math.max(0, bottom - top)}px`,
    });
    const cw = Math.min(390, vw - 24);
    card.style.width = `${cw}px`;
    const ch = card.offsetHeight;
    let cy;
    if (vh - bottom >= ch + 16) cy = bottom + 12;
    else if (top >= ch + 16) cy = top - ch - 12;
    else cy = vh - ch - 14;
    const cx = Math.min(Math.max(left + (right - left) / 2 - cw / 2, 12), vw - cw - 12);
    card.style.top = `${Math.max(12, cy)}px`;
    card.style.left = `${cx}px`;
  }

  function follow(ms) {
    cancelAnimationFrame(raf);
    const until = performance.now() + ms;
    const loop = (now) => { place(); if (now < until) raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }

  function go(i) {
    if (i < 0) return;
    if (i >= STEPS.length) { endTour(); return; }
    idx = i;
    const s = STEPS[i];
    const el = document.querySelector(s.sel);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: el.offsetHeight > window.innerHeight * 0.65 ? 'start' : 'center' });
    const last = i === STEPS.length - 1;
    card.innerHTML = `
      <div class="tc-top"><span class="tc-count">Paso ${i + 1} de ${STEPS.length}</span><button class="tc-x" data-act="end" aria-label="Salir del recorrido">✕</button></div>
      <div class="tc-bar"><div style="width:${((i + 1) / STEPS.length) * 100}%"></div></div>
      <h4>${s.title}</h4>
      <p>${s.text}</p>
      ${s.action ? `<button class="btn primary tiny tc-action" data-act="run">${s.action.label}</button>` : ''}
      <div class="tc-nav">
        <button class="btn tiny" data-act="prev" ${i === 0 ? 'disabled' : ''}>← Anterior</button>
        ${last ? '<button class="btn tiny" data-act="guide">📘 Ver instructivo</button><button class="btn primary tiny" data-act="end">Terminar ✓</button>'
               : '<button class="btn primary tiny" data-act="next">Siguiente →</button>'}
      </div>`;
    follow(900);
  }

  function onKey(e) {
    if (idx < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); go(idx + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    else if (e.key === 'Escape') endTour();
  }
  const onMove = () => place();

  function startTour() {
    hideWelcome();
    if (!spot) buildTourUI();
    document.body.classList.add('touring');
    spot.hidden = false; card.hidden = false;
    window.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
    document.addEventListener('keydown', onKey);
    go(0);
  }

  function endTour() {
    idx = -1;
    cancelAnimationFrame(raf);
    if (spot) { spot.hidden = true; card.hidden = true; }
    document.body.classList.remove('touring');
    window.removeEventListener('scroll', onMove);
    window.removeEventListener('resize', onMove);
    document.removeEventListener('keydown', onKey);
  }

  $('btn-tour').addEventListener('click', startTour);

  // ===================== BIENVENIDA =====================
  const welcome = $('welcome');
  function hideWelcome() { welcome.hidden = true; store.set(SEEN_KEY, '1'); }
  if (!store.get(SEEN_KEY)) setTimeout(() => { welcome.hidden = false; }, 900);
  $('wl-tour').addEventListener('click', startTour);
  $('wl-guide').addEventListener('click', () => { hideWelcome(); openGuide('inicio-rapido'); });
  $('wl-close').addEventListener('click', hideWelcome);
})();
