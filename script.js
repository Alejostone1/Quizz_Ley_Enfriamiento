(() => {
  'use strict';

  const { METALS, FLUIDS, PRESETS, LANE_COLORS } = window.THERMO_DATA;
  const $ = (id) => document.getElementById(id);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const LANE_IDS = ['A', 'B', 'C'];
  const ABS_ZERO = -273.15;
  const DRAPER = 525;

  // ===================== UTILIDADES =====================
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
  const rgb = (c) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const minus = (s) => String(s).replace(/^-/, '−');

  function scale(stops, x) {
    if (x <= stops[0][0]) return stops[0][1];
    for (let i = 0; i < stops.length - 1; i++) {
      const [a, ca] = stops[i], [b, cb] = stops[i + 1];
      if (x <= b) return mix(ca, cb, (x - a) / (b - a));
    }
    return stops[stops.length - 1][1];
  }

  // Color de incandescencia del metal (radiación de cuerpo negro aproximada).
  const INCAND = [
    [400, [60, 18, 12]], [500, [105, 22, 15]], [600, [155, 30, 18]], [700, [205, 50, 18]],
    [800, [232, 90, 16]], [900, [245, 140, 28]], [1000, [255, 185, 50]], [1100, [255, 220, 120]], [1300, [255, 246, 220]],
  ];
  // Paleta "ironbow" de cámara térmica.
  const IRONBOW = [
    [0, [0, 0, 4]], [0.15, [30, 8, 95]], [0.3, [110, 10, 140]], [0.45, [185, 25, 95]],
    [0.6, [232, 70, 30]], [0.75, [249, 140, 10]], [0.9, [253, 213, 60]], [1, [255, 255, 225]],
  ];

  const SUPS = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const supStr = (n) => String(n).split('').map((ch) => SUPS[ch] ?? ch).join('');

  function fmtSig(x, s = 3) {
    if (!isFinite(x)) return '—';
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) {
      let e = Math.floor(Math.log10(a));
      let mant = Number((a / Math.pow(10, e)).toPrecision(s));
      if (mant >= 10) { mant /= 10; e += 1; }
      return `${x < 0 ? '−' : ''}${mant}×10${supStr(e)}`;
    }
    return minus(String(Number(x.toPrecision(s))));
  }
  function fmtTime(sec) {
    if (!isFinite(sec)) return '—';
    if (sec < 60) return `${fmtSig(sec, 3)} s`;
    if (sec < 3600) return `${(sec / 60).toFixed(1)} min`;
    return `${(sec / 3600).toFixed(2)} h`;
  }
  const fmtPower = (w) => { const a = Math.abs(w); return a >= 1000 ? `${(a / 1000).toFixed(a >= 1e4 ? 1 : 2)} kW` : `${a.toFixed(a >= 100 ? 0 : 1)} W`; };
  const fmtEnergy = (j) => { const a = Math.abs(j); return a >= 1e6 ? `${(a / 1e6).toFixed(2)} MJ` : a >= 1000 ? `${(a / 1000).toFixed(2)} kJ` : `${a.toFixed(1)} J`; };
  const fmtTemp = (T) => `${minus(T.toFixed(Math.abs(T) >= 100 ? 0 : 1))} °C`;
  const fmtNum = (x) => minus(String(Number(x.toPrecision(6))));

  function niceRound(x) {
    if (!(x > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    const n = x / p;
    return (n < 1.5 ? 1 : n < 2.25 ? 2 : n < 3.5 ? 2.5 : n < 7.5 ? 5 : 10) * p;
  }
  function niceStep(range, count) {
    const raw = Math.max(range, 1e-12) / Math.max(1, count);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
  }
  function tickList(min, max, step) {
    const out = [];
    for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-6; v += step) out.push(Number(v.toPrecision(12)));
    return out;
  }
  const fmtTick = (v) => { const r = Number(v.toPrecision(6)); return minus(Math.abs(r) >= 1e5 ? r.toExponential(0) : String(r)); };
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ===================== FUNCIONES DE BESSEL (perfil radial del cilindro) =====================
  function besselJ0(x) {
    const q = (x / 2) * (x / 2);
    let term = 1, s = 1;
    for (let m = 1; m < 30; m++) { term *= -q / (m * m); s += term; }
    return s;
  }
  function besselJ1(x) {
    const q = (x / 2) * (x / 2);
    let term = x / 2, s = term;
    for (let m = 1; m < 30; m++) { term *= -q / (m * (m + 1)); s += term; }
    return s;
  }
  // Primera raíz de ζ·J1(ζ)/J0(ζ) = Bi (solución de un término, cilindro infinito).
  function zeta1(Bi) {
    if (!(Bi > 0)) return 0;
    let lo = 1e-9, hi = 2.404825557695773 - 1e-9;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (mid * besselJ1(mid) / besselJ0(mid) > Bi) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  // ===================== ESTADO =====================
  const state = {
    geom: { D: 10, L: 100 },
    lanes: LANE_IDS.map((id) => ({
      id, color: LANE_COLORS[id], metal: 'acero1010', fluid: 'agua', T0: 900, Tm: 20, h: 3000,
      custom: { rho: METALS.custom.rho, c: METALS.custom.c, k: METALS.custom.k, tMelt: METALS.custom.tMelt },
      d: null, hist: [], dims: null, now: null, phase: null, arrowDir: null, arrowNorm: -1,
    })),
    running: false, finished: false, simTime: 0, lastTs: null, raf: 0,
    speedMode: 'auto', speedExp: 1, auto: { s0: 1, r: 0 }, tTotal: 0,
    lab: false, thermal: false, logTime: false, focus: 'A', seed: 1, version: 0,
    tStar: null, dtComp: null, dtAna: null, qRef: 1, gMin: 0, gMax: 100,
    lastReadout: 0, lastSlow: 0, sig: {},
  };

  // ===================== MODELO FÍSICO =====================
  const metalOf = (l) => (l.metal === 'custom' ? { ...METALS.custom, ...l.custom } : METALS[l.metal]);
  const kindOf = (l) => (l.fluid === 'custom' ? (l.h < 200 ? 'gas' : 'liquid') : FLUIDS[l.fluid].kind);
  const active = () => state.lanes.filter((l) => l.d && !l.d.error);
  const focusLane = () => state.lanes.find((l) => l.id === state.focus);
  const Tat = (l, t) => l.Tm + l.d.dT0 * Math.exp(-l.d.k * t);

  function geometry() {
    const D = state.geom.D / 1000, L = state.geom.L / 1000, R = D / 2;
    const A = Math.PI * D * L + 2 * Math.PI * R * R;
    const V = Math.PI * R * R * L;
    return { D, L, R, A, V, Lc: V / A };
  }

  function derive(l) {
    const metal = metalOf(l), fluid = FLUIDS[l.fluid];
    const g = geometry();
    const m = metal.rho * g.V;
    const C = m * metal.c;
    const k = (l.h * g.A) / C;
    const Bi = (l.h * g.Lc) / metal.k;
    const BiR = (l.h * g.R) / metal.k;
    const z = zeta1(BiR);
    const coreRatio = z > 1e-6 ? z / (2 * besselJ1(z)) : 1;
    const surfRatio = coreRatio * besselJ0(z);
    const dT0 = l.T0 - l.Tm;
    const eq = Math.max(0.5, 0.002 * Math.abs(dT0));
    const tEnd = Math.abs(dT0) > eq ? Math.log(Math.abs(dT0) / eq) / k : 0;
    const d = { metal, fluid, ...g, m, C, k, tau: 1 / k, Bi, BiR, z, coreRatio, surfRatio, dT0, eq, tEnd, error: null };
    d.error = validate(l, d);
    return d;
  }

  function validate(l, d) {
    const mt = d.metal;
    if (!(state.geom.D > 0 && state.geom.L > 0)) return 'El diámetro y el largo de la pieza deben ser mayores que 0.';
    if (!(mt.rho > 0 && mt.c > 0 && mt.k > 0)) return 'Las propiedades del metal (ρ, c y k) deben ser mayores que 0.';
    if (!(l.h > 0)) return 'El coeficiente de convección h debe ser mayor que 0.';
    if (!isFinite(l.T0) || !isFinite(l.Tm)) return 'Digita temperaturas válidas.';
    if (l.T0 < ABS_ZERO || l.Tm < ABS_ZERO) return 'Ninguna temperatura puede estar por debajo del cero absoluto (−273.15 °C).';
    if (l.T0 >= mt.tMelt) return `${mt.short} se funde a ${mt.tMelt} °C: con T₀ = ${l.T0} °C la pieza sería líquida, no un sólido que se enfría. Baja T₀ o elige otro metal.`;
    if (l.Tm >= mt.tMelt) return `El medio está a ${l.Tm} °C y ${mt.short} se funde a ${mt.tMelt} °C: la pieza terminaría derretida. Baja la temperatura del medio o elige otro metal.`;
    return null;
  }

  // Ruido de sensor tipo termopar K: ±(0.3 °C + 0.5 % de la lectura).
  function noiseAmp(T) { return state.lab ? 0.3 + 0.005 * Math.abs(T) : 0; }
  function hash01(n) { const x = Math.sin(n * 12.9898 + state.seed * 78.233) * 43758.5453; return x - Math.floor(x); }
  function measured(l, t, i, salt) {
    const base = Tat(l, t);
    if (!state.lab) return base;
    const li = LANE_IDS.indexOf(l.id);
    const u = hash01(i * 7.13 + li * 101.7 + salt * 13.1) + hash01(i * 3.71 + li * 55.3 + salt * 2.9) - 1;
    return base + u * noiseAmp(base);
  }
  function tStarValid(l, v) {
    if (!l.d || !l.d.dT0 || v == null || !isFinite(v)) return false;
    const r = (v - l.Tm) / l.d.dT0;
    return r > 0 && r < 1;
  }

  // ===================== VELOCIDAD (time-lapse) =====================
  function computeAuto() {
    const mv = active().filter((l) => l.d.tEnd > 0);
    state.tTotal = mv.length ? Math.max(...mv.map((l) => l.d.tEnd)) : 0;
    if (!mv.length) { state.auto = { s0: 1, r: 0 }; return; }
    const tauMin = Math.min(...mv.map((l) => l.d.tau));
    const s0 = Math.max(1e-4, 0.75 * tauMin);
    const Treal = 30;
    let r = 0;
    if (s0 * Treal < state.tTotal) {
      let lo = 1e-12, hi = 10;
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if ((s0 / mid) * Math.expm1(Treal * mid) > state.tTotal) hi = mid; else lo = mid;
      }
      r = (lo + hi) / 2;
    }
    state.auto = { s0, r };
  }
  const currentSpeed = () => (state.speedMode === 'manual' ? Math.pow(10, state.speedExp) : state.auto.s0 + state.auto.r * state.simTime);

  // ===================== COLORES DE LA ESCENA =====================
  function realColor(metal, T) {
    if (T < 0) return mix(metal.base, [175, 210, 245], 0.45 * smooth(0, -196, T));
    return mix(metal.base, scale(INCAND, T), smooth(480, 760, T));
  }
  const thermalColor = (T) => scale(IRONBOW, clamp((T - state.gMin) / (state.gMax - state.gMin), 0, 1));

  function computeThermalRange() {
    const act = active();
    if (!act.length) { state.gMin = 0; state.gMax = 100; return; }
    state.gMin = Math.min(...act.map((l) => Math.min(l.T0, l.Tm)));
    state.gMax = Math.max(...act.map((l) => Math.max(l.T0, l.Tm)));
    if (state.gMax - state.gMin < 10) { state.gMin -= 5; state.gMax += 5; }
  }

  // ===================== TARJETAS DE EXPERIMENTO =====================
  function metalOptions() {
    return Object.entries(METALS).map(([k, m]) => `<option value="${k}">${esc(m.name)}</option>`).join('');
  }
  function fluidOptions() {
    const groups = {};
    Object.entries(FLUIDS).forEach(([k, f]) => { (groups[f.group] = groups[f.group] || []).push(`<option value="${k}">${esc(f.name)}</option>`); });
    return Object.entries(groups).map(([g, opts]) => `<optgroup label="${esc(g)}">${opts.join('')}</optgroup>`).join('');
  }

  function laneHTML(l) {
    const id = l.id;
    return `
    <article class="lane" id="lane-${id}" style="--lane:${l.color}">
      <div class="lane-head">
        <span class="lane-tag">${id}</span>
        <div class="lane-title"><strong id="${id}-title"></strong><small id="${id}-sub"></small></div>
        <button class="btn tiny" id="${id}-focus" title="Ver su matemática paso a paso">🔍 Analizar</button>
      </div>
      <div class="lane-config">
        <label class="wide">Metal<select id="${id}-metal">${metalOptions()}</select></label>
        <div class="custom-metal" id="${id}-custom" hidden>
          <label>ρ (kg/m³)<input type="number" id="${id}-c-rho" step="any" min="1"></label>
          <label>c (J/kg·K)<input type="number" id="${id}-c-c" step="any" min="1"></label>
          <label>k (W/m·K)<input type="number" id="${id}-c-k" step="any" min="0.01"></label>
          <label>T fusión (°C)<input type="number" id="${id}-c-tMelt" step="any"></label>
        </div>
        <label class="wide">Medio<select id="${id}-fluid">${fluidOptions()}</select></label>
        <label>T₀ de la pieza (°C)<input type="number" id="${id}-T0" step="any"></label>
        <label>T del medio (°C)<input type="number" id="${id}-Tm" step="any"></label>
        <label class="wide">h (W/m²·K) <small class="hint" id="${id}-hint"></small><input type="number" id="${id}-h" step="any" min="0.01"></label>
      </div>
      <div class="lane-error" id="${id}-err" hidden></div>
      <div class="stage" id="${id}-stage"></div>
      <div class="phase" id="${id}-phase"></div>
      <div class="readouts">
        <div class="big-temp" title="Temperatura media de la pieza en este instante: T(t) = Tₘ + (T₀ − Tₘ)·e^(−kt)."><b id="${id}-T">—</b><span>°C · temperatura media de la pieza</span></div>
        <div class="ro" title="Temperatura estimada en el centro (núcleo) y en la superficie de la pieza. Si Biot < 0.1 son prácticamente iguales y se muestra un solo valor (uniforme)."><label>Núcleo / superficie</label><b id="${id}-cs">—</b></div>
        <div class="ro" title="Calor por segundo que cruza la superficie: q = h·A·(T − Tₘ). ↗ sale = la pieza pierde calor; ↙ entra = la pieza gana calor."><label>Potencia térmica</label><b id="${id}-q">—</b></div>
        <div class="ro" title="Energía total cedida o absorbida desde t = 0: Q = m·c·(T₀ − T). Es el área bajo la curva de potencia (sección 4)."><label>Energía transferida</label><b id="${id}-Q">—</b></div>
        <div class="ro" title="Cuántos grados por segundo cambia la temperatura en este instante: dT/dt = −k·(T − Tₘ). Negativo = se enfría; positivo = se calienta."><label>Rapidez dT/dt</label><b id="${id}-rate">—</b></div>
        <div class="ro" title="k es la constante de la Ley de Newton, calculada con k = h·A/(ρ·c·V). τ = 1/k es la constante de tiempo: en τ segundos la diferencia con el medio cae al 37 %."><label>k · τ = 1/k</label><b id="${id}-k">—</b></div>
        <div class="ro" title="Bi = h·Lc/k_metal. Si es menor que 0.1, la temperatura dentro de la pieza es uniforme y la Ley de Newton es válida (✓). Si no, el núcleo queda más caliente que la superficie (⚠)."><label>Número de Biot</label><b id="${id}-bi">—</b></div>
        <div class="ro" title="Masa de la pieza, m = ρ·V, y área de su superficie A (cilindro con sus dos tapas)."><label>Masa · área</label><b id="${id}-m">—</b></div>
        <div class="ro" title="Tiempo real que tarda la pieza en quedar a menos de 0.2 % (mínimo 0.5 °C) de la temperatura del medio."><label>Llega al equilibrio en</label><b id="${id}-teq">—</b></div>
        <div class="energy" title="Porcentaje de la diferencia inicial de temperatura con el medio que aún falta por cerrar. Llega a 0 % en el equilibrio."><div class="fill" id="${id}-ebar"></div><span id="${id}-etext"></span></div>
      </div>
    </article>`;
  }

  function bindLane(l) {
    const id = l.id;
    const on = (sfx, fn) => $(`${id}-${sfx}`).addEventListener('change', fn);
    const manual = () => { state.preset = null; document.querySelectorAll('.preset').forEach((b) => b.classList.remove('active')); };
    on('metal', (e) => { l.metal = e.target.value; manual(); syncLaneInputs(l); paramsChanged(); });
    on('fluid', (e) => {
      l.fluid = e.target.value;
      const f = FLUIDS[l.fluid];
      l.Tm = f.tBath; l.h = f.h;
      manual(); syncLaneInputs(l); paramsChanged();
    });
    ['T0', 'Tm', 'h'].forEach((key) => on(key, (e) => {
      const v = parseFloat(e.target.value);
      if (isFinite(v)) l[key] = v;
      manual(); syncLaneInputs(l); paramsChanged();
    }));
    ['rho', 'c', 'k', 'tMelt'].forEach((key) => on(`c-${key}`, (e) => {
      const v = parseFloat(e.target.value);
      if (isFinite(v)) l.custom[key] = v;
      manual(); paramsChanged();
    }));
    $(`${id}-focus`).addEventListener('click', () => { setFocus(id); $('sec-math').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }

  function syncLaneInputs(l) {
    const id = l.id;
    $(`${id}-metal`).value = l.metal;
    $(`${id}-fluid`).value = l.fluid;
    $(`${id}-T0`).value = l.T0;
    $(`${id}-Tm`).value = l.Tm;
    $(`${id}-h`).value = l.h;
    const custom = l.metal === 'custom';
    $(`${id}-custom`).hidden = !custom;
    if (custom) ['rho', 'c', 'k', 'tMelt'].forEach((k) => { $(`${id}-c-${k}`).value = l.custom[k]; });
    $(`${id}-hint`).textContent = `· típico: ${FLUIDS[l.fluid].hRange}`;
  }

  function refreshLaneMeta(l) {
    const d = l.d;
    $(`${l.id}-title`).textContent = `${d.metal.short} → ${d.fluid.short}`;
    const heating = d.dT0 < 0;
    $(`${l.id}-sub`).textContent = `${fmtTemp(l.T0)} en un medio a ${fmtTemp(l.Tm)} · ${d.dT0 === 0 ? 'sin diferencia' : heating ? 'la pieza GANA calor' : 'la pieza PIERDE calor'}`;
  }

  // ===================== ESCENA SVG =====================
  function barDims() {
    const r = state.geom.D / state.geom.L;
    if (r <= 0.6) return { w: clamp(116 * r, 7, 70), h: 116 };
    return { w: 70, h: clamp(70 / r, 8, 116) };
  }

  function wavePath() {
    let p = 'M33,40 q8.5,-2.6 17,0';
    for (let i = 0; i < 10; i++) p += ' t17,0';
    return p;
  }

  const tongsSVG = (x, y, w) => `
    <g class="tongs">
      <path d="M${x + 1.5},${y + 9} L${x - 16},-4"/>
      <path d="M${x + w - 1.5},${y + 9} L${x + w + 16},-4"/>
      <rect x="${x - 3}" y="${y - 3}" width="4.5" height="13" rx="1.5"/>
      <rect x="${x + w - 1.5}" y="${y - 3}" width="4.5" height="13" rx="1.5"/>
    </g>`;

  function fanSVG() {
    const blade = (a) => `<path transform="rotate(${a})" d="M0,-2 C6,-4 11,-10 3,-15 C-1,-11 -2,-6 0,-2 Z"/>`;
    const streams = [70, 92, 112, 132, 154]
      .map((yy, i) => `<path class="stream" style="animation-delay:-${(i * 0.13).toFixed(2)}s" d="M42,${yy} C90,${yy - 4} 150,${yy + 4} 238,${yy}"/>`)
      .join('');
    return `<g class="streams">${streams}</g>
      <g transform="translate(22,112)">
        <circle class="fan-ring" r="17"/>
        <g class="fan-blades" style="transform-box:fill-box;transform-origin:center">${[0, 90, 180, 270].map(blade).join('')}</g>
        <circle class="fan-hub" r="3.5"/>
      </g>`;
  }

  function furnaceSVG(id) {
    const top = []; for (let xx = 44, i = 0; xx <= 196; xx += 8, i++) top.push(`${xx},${40 + (i % 2 ? 6 : 0)}`);
    const side = (x0) => { const pts = []; for (let yy = 56, i = 0; yy <= 164; yy += 8, i++) pts.push(`${x0 + (i % 2 ? 6 : 0)},${yy}`); return `<polyline class="coil" points="${pts.join(' ')}"/>`; };
    return `
      <rect class="brick" x="18" y="14" width="204" height="182" rx="8" fill="url(#bricks-${id})"/>
      <rect class="cavity" x="36" y="32" width="168" height="146" rx="6"/>
      <polyline class="coil" points="${top.join(' ')}"/>${side(42)}${side(192)}
      <rect class="hearth" x="36" y="174" width="168" height="4"/>`;
  }

  function buildStage(l) {
    const id = l.id, kind = kindOf(l), f = FLUIDS[l.fluid];
    const { w, h } = barDims();
    const x = 120 - w / 2, y = 112 - h / 2, rx = Math.min(w, h) * 0.3;
    const fc = f.color || [150, 160, 185];
    let env = '', front = '', holder = '';
    if (kind === 'gas') {
      env = '<rect class="floor" x="0" y="190" width="240" height="10"/>';
      if (f.forced) env += fanSVG();
      holder = tongsSVG(x, y, w);
    } else if (kind === 'liquid' || kind === 'cryo') {
      env = `<rect class="tank-back" x="44" y="30" width="152" height="164" rx="10"/>
        <rect class="liquid" x="50" y="40" width="140" height="148" rx="6"/>
        <g clip-path="url(#clip-${id})"><path class="surface" d="${wavePath()}"/></g>`;
      front = `<rect class="liquid-front" x="50" y="40" width="140" height="148" rx="6" fill="${rgb(fc)}" opacity="${f.front ?? 0.15}"/>
        <rect class="tank-rim" x="44" y="30" width="152" height="164" rx="10"/>`;
      holder = tongsSVG(x, y, w);
    } else {
      env = furnaceSVG(id);
      holder = `<rect class="support" x="${x - 6}" y="${y + h}" width="${w + 12}" height="${Math.max(2, 174 - (y + h))}"/>`;
    }
    const lTop = rgb(mix(fc, [255, 255, 255], 0.35)), lBot = rgb(mix(fc, [0, 0, 0], 0.3));
    const stage = $(`${id}-stage`);
    stage.className = `stage fluid-${l.fluid}`;
    stage.innerHTML = `
      <svg viewBox="0 0 240 200" role="img" aria-label="Pieza de ${esc(metalOf(l).short)} en ${esc(f.short)}">
        <defs>
          <linearGradient id="bar-${id}" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" class="sS1"/><stop offset="0.5" class="sC"/><stop offset="1" class="sS2"/>
          </linearGradient>
          <radialGradient id="glow-${id}"><stop offset="0" class="gS" stop-opacity="0.9"/><stop offset="1" class="gS2" stop-opacity="0"/></radialGradient>
          <linearGradient id="liq-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lTop}"/><stop offset="1" stop-color="${lBot}"/></linearGradient>
          <radialGradient id="puff-${id}"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
          <radialGradient id="smoke-${id}"><stop offset="0" stop-color="#8b8b8b" stop-opacity=".65"/><stop offset="1" stop-color="#8b8b8b" stop-opacity="0"/></radialGradient>
          <radialGradient id="hot-${id}"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".6"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
          <radialGradient id="cold-${id}"><stop offset="0" stop-color="#4aa3ff" stop-opacity=".6"/><stop offset="1" stop-color="#4aa3ff" stop-opacity="0"/></radialGradient>
          <pattern id="bricks-${id}" width="24" height="12" patternUnits="userSpaceOnUse">
            <rect width="24" height="12" fill="#b4533a"/>
            <path d="M0,0.5H24M0,6.5H24M12,0V6M0,6V12M24,6V12" stroke="#e7d2c0" stroke-width="1"/>
          </pattern>
          <clipPath id="clip-${id}"><rect x="50" y="30" width="140" height="158"/></clipPath>
        </defs>
        <rect class="bg" x="0" y="0" width="240" height="200"/>
        ${env}
        <circle class="glow" cx="120" cy="112" r="${(Math.max(w, h) * 0.55 + 34).toFixed(1)}" fill="url(#glow-${id})" opacity="0"/>
        <rect class="film" x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 10}" rx="${rx + 5}"/>
        <rect class="bar" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#bar-${id})"/>
        <rect class="shine" x="${x + w * 0.18}" y="${y + 3}" width="${Math.max(1.5, w * 0.12)}" height="${h - 6}" rx="1"/>
        ${kind === 'gas' ? `<rect class="frost" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" opacity="0"/>` : ''}
        ${holder}
        <g class="arrows"></g>
        ${front}
        <g class="parts"></g>
      </svg>`;
    const svg = stage.querySelector('svg');
    const q = (sel) => svg.querySelector(sel);
    l.dims = {
      x, y, w, h, kind,
      bg: q('.bg'), sS1: q('.sS1'), sC: q('.sC'), sS2: q('.sS2'), gS: q('.gS'), gS2: q('.gS2'),
      glow: q('.glow'), film: q('.film'), frost: q('.frost'), arrows: q('.arrows'), parts: q('.parts'),
      liquid: q('.liquid'), cavity: q('.cavity'),
    };
    l.arrowDir = null; l.arrowNorm = -1;
    applyStageMode(l);
  }

  function applyStageMode(l) {
    const s = l.dims; if (!s) return;
    const f = FLUIDS[l.fluid];
    $(`${l.id}-stage`).classList.toggle('thermal', state.thermal);
    if (state.thermal) {
      const cm = rgb(thermalColor(l.Tm));
      s.bg.style.fill = s.kind === 'gas' ? cm : '#050507';
      if (s.liquid) { s.liquid.style.fill = cm; s.liquid.style.opacity = '0.95'; }
      if (s.cavity) s.cavity.style.fill = cm;
    } else {
      s.bg.style.fill = s.kind === 'furnace' ? '#efe7df' : '#eef3fa';
      if (s.liquid) { s.liquid.style.fill = `url(#liq-${l.id})`; s.liquid.style.opacity = String(f.opacity ?? 0.6); }
      if (s.cavity) s.cavity.style.fill = rgb(mix([70, 45, 38], scale(INCAND, l.Tm), smooth(420, 900, l.Tm)));
    }
    if (l.d && !l.d.error) updateStage(l, l.now ? l.now.T : l.T0, 0);
  }

  function phaseOf(l, T, Ts) {
    const f = FLUIDS[l.fluid], kind = kindOf(l);
    if (Math.abs(T - l.Tm) <= l.d.eq) return { key: 'eq', label: '✓ Equilibrio térmico con el medio' };
    if (kind === 'liquid' || kind === 'cryo') {
      if (f.tBoil != null && Ts > f.tBoil) {
        if (f.tLeid != null && Ts > f.tLeid) return { key: 'film', label: '💨 Capa de vapor (Leidenfrost): el vapor envuelve y aísla la pieza' };
        return { key: 'nucleate', label: '💥 Ebullición nucleada: las burbujas arrancan el calor muy rápido' };
      }
      return T > l.Tm
        ? { key: 'conv', label: '🌊 Convección: el líquido calentado junto a la pieza sube' }
        : { key: 'convCold', label: '🌊 Convección: el líquido enfriado junto a la pieza baja' };
    }
    if (kind === 'furnace') {
      return T < l.Tm
        ? { key: 'heat', label: '♨️ La pieza absorbe calor del aire caliente y de las paredes del horno' }
        : { key: 'conv', label: '🔥 La pieza cede calor dentro del horno' };
    }
    if (T > l.Tm) return { key: 'conv', label: f.forced ? '🌀 Convección forzada: el ventilador arrastra el calor' : '🌬️ Convección natural: el aire caliente sube' };
    return { key: 'convCold', label: f.forced ? '🌀 Convección forzada: el aire le entrega calor' : '🌬️ El aire le entrega calor; el aire que se enfría baja' };
  }

  function updateStage(l, T, dt) {
    const s = l.dims; if (!s) return;
    const d = l.d, th = T - l.Tm;
    const Tc = l.Tm + th * d.coreRatio, Ts = l.Tm + th * d.surfRatio;
    l.now = { T, Tc, Ts };
    const cS = state.thermal ? thermalColor(Ts) : realColor(d.metal, Ts);
    const cC = state.thermal ? thermalColor(Tc) : realColor(d.metal, Tc);
    s.sS1.setAttribute('stop-color', rgb(cS));
    s.sS2.setAttribute('stop-color', rgb(cS));
    s.sC.setAttribute('stop-color', rgb(cC));
    if (!state.thermal) {
      const gc = rgb(scale(INCAND, Math.max(T, 450)));
      s.gS.setAttribute('stop-color', gc);
      s.gS2.setAttribute('stop-color', gc);
      s.glow.setAttribute('opacity', (smooth(480, 1100, T) * 0.9).toFixed(3));
      if (s.frost) s.frost.setAttribute('opacity', clamp(-Ts / 110, 0, 0.8).toFixed(3));
    }
    const ph = phaseOf(l, T, Ts);
    l.phase = ph;
    s.film.classList.toggle('on', ph.key === 'film');
    updateArrows(l, T);
    if (dt > 0) spawnParticles(l, T, Ts, ph, dt);
  }

  // ---------- flechas de flujo de calor ----------
  function buildArrows(l, dir) {
    const g = l.dims.arrows;
    g.classList.toggle('in', dir < 0);
    if (dir === 0) { g.innerHTML = ''; return; }
    const { x, y, w, h } = l.dims;
    const out = dir > 0;
    const shape = '<path d="M0,0 q4,-4 8,0 t8,0"/><path d="M16,0 l-5,-4 M16,0 l-5,4"/>';
    const fys = h > 40 ? [0.14, 0.38, 0.62, 0.86] : [0.5];
    let html = '';
    fys.forEach((fy, i) => {
      const yy = (y + h * fy).toFixed(1);
      const dl = ((i * 0.37) % 1).toFixed(2), dr = ((i * 0.37 + 0.5) % 1).toFixed(2);
      const rX = out ? x + w + 4 : x + w + 38, lX = out ? x - 4 : x - 38;
      html += `<g transform="translate(${rX.toFixed(1)},${yy}) scale(${out ? 1 : -1},1)"><g class="arrow" style="animation-delay:-${dr}s">${shape}</g></g>`;
      html += `<g transform="translate(${lX.toFixed(1)},${yy}) scale(${out ? -1 : 1},1)"><g class="arrow" style="animation-delay:-${dl}s">${shape}</g></g>`;
    });
    if (l.dims.kind !== 'furnace') {
      const bY = out ? y + h + 4 : y + h + 38;
      html += `<g transform="translate(120,${bY.toFixed(1)}) rotate(${out ? 90 : -90})"><g class="arrow" style="animation-delay:-0.2s">${shape}</g></g>`;
    }
    g.innerHTML = html;
  }

  function updateArrows(l, T) {
    const s = l.dims, d = l.d;
    const q = l.h * d.A * (T - l.Tm);
    const dir = Math.abs(T - l.Tm) <= d.eq ? 0 : q > 0 ? 1 : -1;
    if (dir !== l.arrowDir) { buildArrows(l, dir); l.arrowDir = dir; l.arrowNorm = -1; }
    if (dir === 0) { l.arrowNorm = 0; return; }
    const norm = clamp(Math.log10(1 + Math.abs(q)) / Math.log10(1 + state.qRef), 0.06, 1);
    if (Math.abs(norm - l.arrowNorm) > 0.03) {
      l.arrowNorm = norm;
      s.arrows.style.opacity = (0.3 + 0.7 * norm).toFixed(2);
      s.arrows.style.setProperty('--adur', `${(2.4 - 1.8 * norm).toFixed(2)}s`);
      s.arrows.style.setProperty('--aw', (1.2 + 2.4 * norm).toFixed(2));
    }
  }

  // ---------- partículas: burbujas, vapor, humo, convección, niebla, chispas ----------
  function part(s, cls, cx, cy, r, dx, dy, dur, fill) {
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('class', `p ${cls}`);
    c.setAttribute('cx', cx.toFixed(1));
    c.setAttribute('cy', cy.toFixed(1));
    c.setAttribute('r', r.toFixed(2));
    if (fill) c.setAttribute('fill', fill);
    c.style.setProperty('--dx', `${dx.toFixed(1)}px`);
    c.style.setProperty('--dy', `${dy.toFixed(1)}px`);
    c.style.animationDuration = `${dur.toFixed(2)}s`;
    c.addEventListener('animationend', () => c.remove(), { once: true });
    s.parts.appendChild(c);
  }

  function spawnParticles(l, T, Ts, ph, dt) {
    const s = l.dims;
    if (!s || s.parts.childElementCount > 90) return;
    const f = FLUIDS[l.fluid], id = l.id, R = Math.random;
    const { x, y, w, h, kind } = s;
    const emit = (rate, fn) => { let n = rate * dt; while (n > 0) { if (R() < Math.min(1, n)) fn(); n -= 1; } };
    const norm = Math.max(0, l.arrowNorm);
    const surf = 40;
    const puff = `url(#puff-${id})`, hot = `url(#hot-${id})`, cold = `url(#cold-${id})`;
    const aboveSurface = () => {
      const oil = l.fluid === 'aceite';
      part(s, oil ? 'smoke' : 'steam', 95 + R() * 50, surf - 1, 4 + R() * 5, (R() - 0.5) * 36, -(surf + 12), 1.1 + R() * 0.9, oil ? `url(#smoke-${id})` : puff);
    };

    if (kind === 'liquid' || kind === 'cryo') {
      if (ph.key === 'film') {
        emit(16, () => {
          const cy = y + R() * h, cx = R() < 0.5 ? x - 3 : x + w + 3;
          part(s, 'vapor', cx, cy, 2.2 + R() * 2.8, (R() - 0.5) * 12, surf - cy, 0.55 + R() * 0.5, puff);
        });
        emit(7, aboveSurface);
      } else if (ph.key === 'nucleate') {
        const sat = f.tLeid != null ? clamp((Ts - f.tBoil) / (f.tLeid - f.tBoil), 0, 1) : clamp((Ts - f.tBoil) / 250, 0, 1);
        emit(35 + 90 * sat, () => {
          const cy = y + R() * h, cx = (R() < 0.5 ? x - 1 : x + w + 1) + (R() - 0.5) * 3;
          part(s, 'bubble', cx, cy, 0.7 + R() * 1.3, (R() - 0.5) * 8, surf - cy + 1, 0.45 + R() * 0.6);
        });
        emit(3 + 12 * sat, aboveSurface);
      } else if (ph.key === 'conv' || ph.key === 'convCold') {
        const up = ph.key === 'conv';
        emit(1 + 7 * norm, () => {
          const cx = x + R() * w, cy = up ? y + 4 : y + h - 4;
          part(s, 'plume', cx, cy, 5 + R() * 5, (R() - 0.5) * 20, up ? surf - cy + 6 : 184 - cy, 1.4 + R() * 1.2, up ? hot : cold);
        });
      }
      if (kind === 'cryo') emit(6, () => part(s, 'fog', 50 + R() * 140, surf - 2, 7 + R() * 8, (R() - 0.5) * 70, -20 - R() * 25, 1.6 + R() * 1.2, puff));
    } else if (kind === 'gas') {
      const drift = f.forced ? 70 : 0;
      if (ph.key === 'conv') emit(2 + 10 * norm, () => {
        const cx = x + R() * w, cy = y + R() * h * 0.5;
        part(s, 'plume', cx, cy, 5 + R() * 6, (R() - 0.5) * 18 + drift, -cy - 10, 1.3 + R(), hot);
      });
      if (ph.key === 'convCold') emit(2 + 8 * norm, () => {
        const cx = x + R() * w, cy = y + h * (0.5 + R() * 0.5);
        part(s, 'plume', cx, cy, 5 + R() * 6, (R() - 0.5) * 18 + drift, 192 - cy, 1.4 + R(), cold);
      });
      const embers = smooth(650, 1050, T);
      if (embers > 0) emit(4 * embers, () => part(s, 'ember', x + R() * w, y + R() * h, 0.8 + R() * 0.8, (R() - 0.5) * 30 + drift * 0.5, 30 + R() * 50, 0.7 + R() * 0.6));
    } else if (ph.key !== 'eq') {
      emit(5, () => part(s, 'plume', 40 + R() * 160, 170, 6 + R() * 6, (R() - 0.5) * 16, -110 - R() * 20, 1.8 + R(), hot));
    }
  }

  // ===================== LECTURAS DE CADA TARJETA =====================
  function updateReadouts(l) {
    const id = l.id, d = l.d;
    $(`lane-${id}`).classList.toggle('invalid', !!d.error);
    const err = $(`${id}-err`);
    if (d.error) {
      err.hidden = false;
      err.textContent = `⚠ ${d.error}`;
      ['T', 'cs', 'q', 'Q', 'rate', 'k', 'bi', 'm', 'teq'].forEach((k) => { $(`${id}-${k}`).textContent = '—'; });
      $(`${id}-phase`).textContent = 'Experimento desactivado hasta corregir los datos.';
      $(`${id}-ebar`).style.width = '0%';
      $(`${id}-etext`).textContent = '';
      return;
    }
    err.hidden = true;
    const now = l.now || { T: l.T0, Tc: l.T0, Ts: l.T0 };
    const T = now.T, th = T - l.Tm, atEq = Math.abs(th) <= d.eq;
    $(`${id}-T`).textContent = minus(T.toFixed(Math.abs(T) >= 100 ? 0 : 1));
    $(`${id}-cs`).textContent = d.Bi < 0.1 ? `${fmtTemp(now.Tc)} (uniforme)` : `${minus(now.Tc.toFixed(0))} / ${minus(now.Ts.toFixed(0))} °C`;
    const q = l.h * d.A * th;
    const qEl = $(`${id}-q`);
    qEl.textContent = atEq ? '≈ 0 (equilibrio)' : `${q > 0 ? '↗ sale' : '↙ entra'} ${fmtPower(q)}`;
    qEl.className = atEq ? '' : q > 0 ? 'out' : 'in';
    const Q = d.C * (l.T0 - T);
    $(`${id}-Q`).textContent = Math.abs(Q) < 1e-6 ? '0 J' : `${Q > 0 ? 'cedió' : 'absorbió'} ${fmtEnergy(Q)}`;
    $(`${id}-rate`).textContent = `${fmtSig(-d.k * th, 3)} °C/s`;
    $(`${id}-k`).textContent = `${fmtSig(d.k, 3)} s⁻¹ · ${fmtTime(d.tau)}`;
    const bi = $(`${id}-bi`);
    bi.textContent = `${fmtSig(d.Bi, 3)} ${d.Bi < 0.1 ? '✓ válido' : '⚠ > 0.1'}`;
    bi.className = d.Bi < 0.1 ? 'ok' : 'warn';
    $(`${id}-m`).textContent = `${fmtSig(d.m * 1000, 3)} g · ${fmtSig(d.A * 1e4, 3)} cm²`;
    $(`${id}-teq`).textContent = d.tEnd > 0 ? fmtTime(d.tEnd) : 'ya está en equilibrio';
    const frac = d.dT0 !== 0 ? clamp(Math.abs(th) / Math.abs(d.dT0), 0, 1) : 0;
    $(`${id}-ebar`).style.width = `${(frac * 100).toFixed(1)}%`;
    $(`${id}-etext`).textContent = `Energía que aún falta transferir: ${(frac * 100).toFixed(0)} %`;
    let label = l.phase ? l.phase.label : '';
    if (!state.thermal && T >= DRAPER) label += ' · ✨ incandescente (> 525 °C, punto de Draper)';
    if (kindOf(l) === 'gas' && now.Ts < 0) label += ' · ❄ se forma escarcha';
    $(`${id}-phase`).textContent = label;
  }

  // ===================== ESTADO GLOBAL / BOTONES =====================
  function updateStatus() {
    const pill = $('status-pill');
    let cls = '', txt = 'Listo para iniciar';
    if (!active().length) { cls = 'error'; txt = 'Corrige los datos de los experimentos'; }
    else if (state.running) { cls = 'running'; txt = 'Simulando…'; }
    else if (state.finished) { cls = 'done'; txt = 'Equilibrio térmico alcanzado en todos los experimentos ✓'; }
    else if (state.simTime > 0) txt = 'Pausado';
    pill.className = `status-pill ${cls}`;
    pill.innerHTML = `<span class="dot"></span> ${txt}`;
    $('sim-time').textContent = fmtTime(state.simTime);
    $('speed-now').textContent = `×${fmtSig(currentSpeed(), 3)}`;
    $('t-total').textContent = state.tTotal > 0 ? fmtTime(state.tTotal) : '—';
  }

  function updateButtons() {
    const can = active().length > 0;
    $('btn-start').disabled = !can || state.running || state.finished;
    $('btn-start').textContent = state.simTime > 0 && !state.finished ? '▶ Continuar' : '▶ Iniciar';
    $('btn-pause').disabled = !state.running;
    $('lanes').classList.toggle('paused', !state.running && state.simTime > 0 && !state.finished);
  }

  // ===================== BUCLE =====================
  function stop() {
    state.running = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
  }
  function start() {
    if (state.running || state.finished || !active().length) return;
    state.running = true;
    state.lastTs = null;
    updateButtons(); updateStatus();
    state.raf = requestAnimationFrame(frame);
  }
  function pause() { stop(); updateButtons(); updateStatus(); renderSlow(); }
  function finish() {
    stop();
    state.finished = true;
    state.lanes.forEach(updateReadouts);
    updateButtons(); updateStatus(); renderSlow();
  }

  function frame(ts) {
    if (!state.running) return;
    if (state.lastTs == null) state.lastTs = ts;
    const dtReal = Math.min(0.1, (ts - state.lastTs) / 1000);
    state.lastTs = ts;
    state.simTime = Math.min(state.tTotal, state.simTime + dtReal * currentSpeed());
    active().forEach((l) => {
      const T = Tat(l, state.simTime);
      l.hist.push([state.simTime, T]);
      updateStage(l, T, dtReal);
    });
    drawTChart();
    drawQChart();
    if (ts - state.lastReadout > 100) { state.lastReadout = ts; state.lanes.forEach(updateReadouts); updateStatus(); }
    if (ts - state.lastSlow > 320) { state.lastSlow = ts; renderSlow(); }
    if (state.simTime >= state.tTotal) { finish(); return; }
    state.raf = requestAnimationFrame(frame);
  }

  function reset() {
    stop();
    state.finished = false;
    state.simTime = 0;
    state.seed = 1 + Math.floor(Math.random() * 100000);
    state.version++;
    state.lanes.forEach((l) => { l.d = derive(l); l.hist = []; l.now = null; l.phase = null; });
    const act = active();
    state.qRef = Math.max(1, ...act.map((l) => Math.abs(l.h * l.d.A * l.d.dT0)));
    computeThermalRange();
    computeAuto();
    applyDefaults();
    const g = geometry();
    $('geo-info').textContent = `A = ${fmtSig(g.A * 1e4, 4)} cm² · V = ${fmtSig(g.V * 1e6, 4)} cm³ · Lc = V/A = ${fmtSig(g.Lc * 1000, 3)} mm`;
    state.lanes.forEach((l) => {
      refreshLaneMeta(l);
      buildStage(l);
      if (!l.d.error) { l.hist.push([0, l.T0]); updateStage(l, l.T0, 0); }
      updateReadouts(l);
    });
    updateThermalLegend();
    renderLegend();
    updateButtons();
    updateStatus();
    renderFocus();
    renderAll();
  }

  function paramsChanged() {
    state.dtComp = null; state.dtAna = null; state.tStar = null;
    reset();
    renderRefTables();
  }

  function applyDefaults() {
    if (state.dtComp == null) state.dtComp = niceRound(Math.max(state.tTotal, 1e-3) / 20);
    const f = focusLane();
    if (state.dtAna == null) state.dtAna = f && !f.d.error && f.d.tEnd > 0 ? niceRound(f.d.tEnd / 15) : 1;
    if (state.tStar == null && f && !f.d.error) {
      const guess = Math.round(f.Tm + 0.2 * f.d.dT0);
      state.tStar = tStarValid(f, guess) ? guess : null;
    }
    $('dt-comp').value = Number(state.dtComp.toPrecision(6));
    $('dt-ana').value = Number(state.dtAna.toPrecision(6));
    $('t-star').value = state.tStar ?? '';
  }

  // ===================== FOCO =====================
  function buildFocus() {
    $('focus-seg').innerHTML = state.lanes.map((l) => `<button data-id="${l.id}" style="--c:${l.color}">${l.id}</button>`).join('');
    $('focus-seg').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setFocus(b.dataset.id)));
  }
  function setFocus(id) {
    state.focus = id;
    state.dtAna = null; state.tStar = null;
    applyDefaults();
    renderFocus();
    renderAll();
  }
  function renderFocus() {
    const l = focusLane();
    $('focus-seg').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.id === state.focus));
    state.lanes.forEach((x) => $(`lane-${x.id}`).classList.toggle('focused', x.id === state.focus));
    $('focus-desc').textContent = l.d ? `${l.d.metal.short} en ${l.d.fluid.short} · T₀ = ${fmtTemp(l.T0)} · Tₘ = ${fmtTemp(l.Tm)} · h = ${l.h} W/m²·K` : '';
  }

  // ===================== LEYENDAS =====================
  function renderLegend() {
    const items = state.lanes.map((l) => {
      if (l.d.error) return `<span class="legend-item"><i style="background:#cbd5e1"></i> ${l.id}: datos inválidos</span>`;
      return `<span class="legend-item"><i style="background:${l.color}"></i> ${l.id}: ${esc(l.d.metal.short)} en ${esc(l.d.fluid.short)} (línea punteada = Tₘ ${fmtTemp(l.Tm)})</span>`;
    });
    items.push('<span class="legend-item">○ mediciones de la tabla comparativa</span>');
    $('legendT').innerHTML = items.join('');
  }
  function updateThermalLegend() {
    $('thermal-legend').hidden = !state.thermal;
    $('tl-min').textContent = fmtTemp(state.gMin);
    $('tl-max').textContent = fmtTemp(state.gMax);
  }

  // ===================== GRÁFICAS =====================
  function prepCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px Segoe UI, sans-serif';
    return { ctx, W, H };
  }
  const line = (ctx, x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  function emptyMsg(ctx, W, H, msg) {
    ctx.fillStyle = '#5b6b8c'; ctx.textAlign = 'center'; ctx.font = '14px Segoe UI, sans-serif';
    ctx.fillText(msg, W / 2, H / 2);
  }
  function gridY(ctx, P, W, ticks, yf, fmt) {
    ctx.lineWidth = 1;
    ticks.forEach((v) => {
      const y = yf(v);
      ctx.strokeStyle = 'rgba(91,107,140,.14)'; line(ctx, P.l, y, W - P.r, y);
      ctx.fillStyle = '#5b6b8c'; ctx.textAlign = 'right'; ctx.fillText(fmt(v), P.l - 8, y + 4);
    });
  }
  function gridX(ctx, P, H, ticks, xf, fmt) {
    ctx.lineWidth = 1;
    ticks.forEach((v) => {
      const x = xf(v);
      ctx.strokeStyle = 'rgba(91,107,140,.14)'; line(ctx, x, P.t, x, H - P.b);
      ctx.fillStyle = '#5b6b8c'; ctx.textAlign = 'center'; ctx.fillText(fmt(v), x, H - P.b + 16);
    });
  }
  function axisLabels(ctx, P, W, H, xl, yl) {
    ctx.fillStyle = '#5b6b8c'; ctx.textAlign = 'center';
    ctx.fillText(xl, P.l + (W - P.l - P.r) / 2, H - 8);
    ctx.save(); ctx.translate(14, P.t + (H - P.t - P.b) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yl, 0, 0); ctx.restore();
  }

  function drawTChart() {
    const { ctx, W, H } = prepCanvas($('chartT'));
    const act = active();
    if (!act.length) { emptyMsg(ctx, W, H, 'Sin experimentos válidos'); return; }
    const P = { l: 62, r: 18, t: 18, b: 44 };
    const pw = W - P.l - P.r, ph = H - P.t - P.b;

    let lo = Math.min(...act.map((l) => Math.min(l.T0, l.Tm)));
    let hi = Math.max(...act.map((l) => Math.max(l.T0, l.Tm)));
    if (hi - lo < 2) { lo -= 5; hi += 5; }
    const ys = niceStep(hi - lo, 7);
    let yMin = Math.floor((lo - (hi - lo) * 0.03) / ys) * ys;
    if (lo >= 0 && yMin < 0) yMin = 0;
    const yMax = Math.ceil((hi + (hi - lo) * 0.03) / ys) * ys;
    const yf = (T) => P.t + (1 - (T - yMin) / (yMax - yMin)) * ph;

    const tauMin = Math.min(...act.map((l) => l.d.tau));
    let xf, xt;
    if (state.logTime) {
      const tLo = Math.pow(10, Math.floor(Math.log10(tauMin / 30)));
      const tHi = Math.max(state.simTime * 1.3, tLo * 1000);
      const L0 = Math.log10(tLo), L1 = Math.log10(tHi);
      xf = (t) => P.l + ((Math.log10(Math.max(t, tLo)) - L0) / (L1 - L0)) * pw;
      xt = []; for (let e = Math.ceil(L0); e <= Math.floor(L1); e++) xt.push(Math.pow(10, e));
    } else {
      const span = Math.max(state.simTime * 1.08, tauMin * 1.5);
      const st = niceStep(span, 8);
      const xmax = Math.ceil(span / st) * st;
      xf = (t) => P.l + (t / xmax) * pw;
      xt = tickList(0, xmax, st);
    }

    gridY(ctx, P, W, tickList(yMin, yMax, ys), yf, (v) => `${fmtTick(v)}°`);
    gridX(ctx, P, H, xt, xf, fmtTick);
    axisLabels(ctx, P, W, H, state.logTime ? 't (s) — escala logarítmica' : 't (s)', 'T (°C)');

    const ref = (T, label, color) => {
      if (T <= yMin || T >= yMax) return;
      const y = yf(T);
      ctx.strokeStyle = color; ctx.setLineDash([2, 4]); ctx.lineWidth = 1.3;
      line(ctx, P.l, y, W - P.r, y); ctx.setLineDash([]);
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(251,252,255,.92)'; ctx.fillRect(W - P.r - tw - 12, y - 17, tw + 8, 15);
      ctx.fillStyle = color; ctx.textAlign = 'right'; ctx.fillText(label, W - P.r - 8, y - 5);
    };
    ref(DRAPER, '525 °C · punto de Draper: el metal empieza a brillar', '#d97706');
    if (yMin < 0) ref(0, '0 °C', '#0284c7');

    act.forEach((l) => {
      ctx.strokeStyle = hexA(l.color, 0.5); ctx.setLineDash([7, 5]); ctx.lineWidth = 1.3;
      line(ctx, P.l, yf(l.Tm), W - P.r, yf(l.Tm)); ctx.setLineDash([]);
    });

    act.forEach((l) => {
      if (l.hist.length < 2) return;
      ctx.strokeStyle = l.color; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
      ctx.beginPath();
      l.hist.forEach(([t, T], i) => { const X = xf(t), Y = yf(T); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
      ctx.stroke();
    });

    const dt = state.dtComp;
    if (dt > 0) {
      const n = Math.min(300, Math.floor(state.simTime / dt + 1e-9));
      act.forEach((l) => {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = l.color; ctx.lineWidth = 1.5;
        for (let i = 0; i <= n; i++) {
          const t = i * dt;
          if (state.logTime && t === 0) continue;
          ctx.beginPath(); ctx.arc(xf(t), yf(measured(l, t, i, 1)), 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      });
    }

    act.forEach((l) => {
      const last = l.hist[l.hist.length - 1];
      if (!last) return;
      const X = xf(last[0]), Y = yf(last[1]);
      ctx.fillStyle = l.color; ctx.beginPath(); ctx.arc(X, Y, 5, 0, Math.PI * 2); ctx.fill();
      const right = X > W - 120;
      ctx.fillStyle = '#16213e'; ctx.font = 'bold 12px Segoe UI, sans-serif'; ctx.textAlign = right ? 'right' : 'left';
      ctx.fillText(`${l.id}: ${fmtTemp(last[1])}`, X + (right ? -9 : 9), Y - 8);
      ctx.font = '11px Segoe UI, sans-serif';
    });
  }

  function drawQChart() {
    const { ctx, W, H } = prepCanvas($('chartQ'));
    const l = focusLane();
    if (!l || !l.d || l.d.error) { emptyMsg(ctx, W, H, 'El experimento en foco tiene datos inválidos'); return; }
    const d = l.d, hA = l.h * d.A, q0 = Math.abs(hA * d.dT0);
    if (d.tEnd <= 0 || q0 === 0) { emptyMsg(ctx, W, H, 'La pieza ya está a la temperatura del medio: no hay flujo de calor'); return; }
    const P = { l: 66, r: 18, t: 20, b: 44 };
    const pw = W - P.l - P.r, ph = H - P.t - P.b;
    const kW = q0 >= 2000, u = kW ? 1000 : 1;
    const xs = niceStep(d.tEnd, 8), xMax = Math.ceil(d.tEnd / xs) * xs;
    const ys = niceStep(q0 / u, 5), yMax = Math.ceil(q0 / u / ys) * ys;
    const xf = (t) => P.l + (t / xMax) * pw;
    const yf = (qv) => P.t + (1 - qv / u / yMax) * ph;
    const qa = (t) => Math.abs(hA * d.dT0 * Math.exp(-d.k * t));

    gridY(ctx, P, W, tickList(0, yMax, ys), (v) => P.t + (1 - v / yMax) * ph, fmtTick);
    gridX(ctx, P, H, tickList(0, xMax, xs), xf, fmtTick);
    axisLabels(ctx, P, W, H, 't (s)', kW ? '|q| (kW)' : '|q| (W)');

    ctx.setLineDash([5, 5]); ctx.strokeStyle = hexA(l.color, 0.45); ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const t = (xMax * i) / 200; if (i) ctx.lineTo(xf(t), yf(qa(t))); else ctx.moveTo(xf(t), yf(qa(t))); }
    ctx.stroke(); ctx.setLineDash([]);

    const tc = Math.min(state.simTime, xMax);
    if (tc > 0) {
      ctx.beginPath(); ctx.moveTo(xf(0), yf(0));
      for (let i = 0; i <= 200; i++) { const t = (tc * i) / 200; ctx.lineTo(xf(t), yf(qa(t))); }
      ctx.lineTo(xf(tc), yf(0)); ctx.closePath();
      const grad = ctx.createLinearGradient(0, P.t, 0, P.t + ph);
      grad.addColorStop(0, hexA(l.color, 0.5)); grad.addColorStop(1, hexA(l.color, 0.12));
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = l.color; ctx.lineWidth = 2.6; ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const t = (tc * i) / 200; if (i) ctx.lineTo(xf(t), yf(qa(t))); else ctx.moveTo(xf(t), yf(qa(t))); }
      ctx.stroke();
      ctx.strokeStyle = '#16213e'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; line(ctx, xf(tc), P.t, xf(tc), P.t + ph); ctx.setLineDash([]);
      ctx.fillStyle = l.color; ctx.beginPath(); ctx.arc(xf(tc), yf(qa(tc)), 5, 0, Math.PI * 2); ctx.fill();
    }

    const Q = d.C * (l.T0 - Tat(l, state.simTime));
    const lines = [
      `Q = ∫ q dt = ${fmtEnergy(Q)} ${d.dT0 > 0 ? 'cedidos' : 'absorbidos'}`,
      `q ahora = ${fmtPower(qa(state.simTime))}   ·   Q total posible = ${fmtEnergy(d.C * d.dT0)}`,
    ];
    ctx.font = 'bold 13px Segoe UI, sans-serif';
    const bw = Math.max(...lines.map((s) => ctx.measureText(s).width)) + 20;
    const bx = W - P.r - bw - 6, by = P.t + 8;
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.strokeStyle = hexA(l.color, 0.6); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, 48, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#16213e'; ctx.textAlign = 'left';
    ctx.fillText(lines[0], bx + 10, by + 20);
    ctx.font = '12px Segoe UI, sans-serif'; ctx.fillStyle = '#5b6b8c';
    ctx.fillText(lines[1], bx + 10, by + 38);
  }

  function drawLnChart(A) {
    const { ctx, W, H } = prepCanvas($('chartLn'));
    if (!A || !A.reg) { emptyMsg(ctx, W, H, 'Se necesitan al menos 2 mediciones para la regresión'); return; }
    const { l, d, reg } = A;
    const pts = A.rows.filter((r) => r.ln != null).map((r) => [r.t, r.ln]);
    const P = { l: 52, r: 14, t: 16, b: 38 };
    const pw = W - P.l - P.r, ph = H - P.t - P.b;
    const tMax = Math.max(...pts.map((p) => p[0])) || 1;
    const xs = niceStep(tMax, 6), xMax = Math.ceil(tMax / xs) * xs;
    let lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1]));
    const pad = (hi - lo) * 0.12 || 0.5; lo -= pad; hi += pad;
    const ys = niceStep(hi - lo, 5), yMin = Math.floor(lo / ys) * ys, yMax = Math.ceil(hi / ys) * ys;
    const xf = (t) => P.l + (t / xMax) * pw, yf = (v) => P.t + (1 - (v - yMin) / (yMax - yMin)) * ph;
    gridY(ctx, P, W, tickList(yMin, yMax, ys), yf, fmtTick);
    gridX(ctx, P, H, tickList(0, xMax, xs), xf, fmtTick);
    axisLabels(ctx, P, W, H, 't (s)', 'ln|T − Tₘ|');
    const th0 = Math.log(Math.abs(d.dT0));
    ctx.strokeStyle = '#94a3b8'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5;
    line(ctx, xf(0), yf(th0), xf(xMax), yf(th0 - d.k * xMax)); ctx.setLineDash([]);
    ctx.strokeStyle = l.color; ctx.lineWidth = 2.4;
    line(ctx, xf(0), yf(reg.a), xf(xMax), yf(reg.a + reg.b * xMax));
    ctx.fillStyle = '#fff'; ctx.strokeStyle = l.color; ctx.lineWidth = 1.6;
    pts.forEach(([t, v]) => { ctx.beginPath(); ctx.arc(xf(t), yf(v), 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = '#16213e'; ctx.textAlign = 'right'; ctx.font = 'bold 12px Segoe UI, sans-serif';
    ctx.fillText(`ajuste: y = ${fmtSig(reg.a, 4)} ${reg.b < 0 ? '−' : '+'} ${fmtSig(Math.abs(reg.b), 4)}·t   (R² = ${reg.r2.toFixed(5)})`, W - P.r - 4, P.t + 12);
    ctx.font = '11px Segoe UI, sans-serif'; ctx.fillStyle = '#64748b';
    ctx.fillText('línea gris punteada = modelo teórico', W - P.r - 4, P.t + 28);
  }

  // ===================== MATHML =====================
  const mi = (s) => `<mi>${s}</mi>`;
  const mn = (s) => `<mn>${s}</mn>`;
  const mo = (s) => `<mo>${s}</mo>`;
  const mtext = (s) => `<mtext>${s}</mtext>`;
  const row = (...a) => `<mrow>${a.join('')}</mrow>`;
  const frac = (a, b) => `<mfrac>${a}${b}</mfrac>`;
  const sup = (a, b) => `<msup>${a}${b}</msup>`;
  const sub = (a, b) => `<msub>${a}${b}</msub>`;
  const subsup = (a, b, c) => `<msubsup>${a}${b}${c}</msubsup>`;
  const under = (a, b, c) => `<munderover>${a}${b}${c}</munderover>`;
  const over = (a, b) => `<mover>${a}${b}</mover>`;
  const par = (...x) => row(mo('('), ...x, mo(')'));
  const bars = (...x) => row(mo('|'), ...x, mo('|'));
  const sp = '<mspace width="0.6em"/>';
  const unit = (u) => row('<mspace width="0.25em"/>', mtext(u));
  // Elementos con explicación al hacer clic: símbolos/números (xi) y fórmulas completas (Mx).
  const xi = (key, content) => `<mrow class="x" data-x="${key}">${content}</mrow>`;
  const Mx = (key, ...a) => `<math display="block" class="xf" data-x="${key}">${row(...a)}</math>`;
  const Mxbox = (key, ...a) => `<div class="eq-box">${Mx(key, ...a)}</div>`;

  function num(x, s = 4) {
    if (!isFinite(x)) return mtext('—');
    const a = Math.abs(x);
    let body;
    if (a !== 0 && (a >= 1e5 || a < 1e-3)) {
      let e = Math.floor(Math.log10(a));
      let mant = Number((a / Math.pow(10, e)).toPrecision(s));
      if (mant >= 10) { mant /= 10; e += 1; }
      body = row(mn(String(mant)), mo('×'), sup(mn('10'), e < 0 ? row(mo('−'), mn(String(-e))) : mn(String(e))));
    } else {
      body = mn(String(Number(a.toPrecision(s))));
    }
    return x < 0 ? row(mo('−'), body) : body;
  }
  const pnum = (x, s) => par(num(x, s));
  const xn = (key, x, s) => xi(key, num(x, s));
  const xp = (key, x, s) => xi(key, pnum(x, s));

  const S = {
    T: xi('T', mi('T')), t: xi('t', mi('t')), k: xi('k', mi('k')), h: xi('h', mi('h')), A: xi('A', mi('A')),
    V: xi('V', mi('V')), m: xi('m', mi('m')), c: xi('c', mi('c')), q: xi('q', mi('q')), Q: xi('Q', mi('Q')),
    e: xi('e', mi('e')), dd: mi('d'), pi: xi('pi', mi('π')), rho: xi('rho', mi('ρ')), ln: xi('ln', mi('ln')),
    tau: xi('tau', mi('τ')), D: xi('D', mi('D')), L: xi('L', mi('L')), R: xi('R', mi('R')),
    n: xi('n', mi('n')), i: xi('i', mi('i')),
    T0: xi('T0', sub(mi('T'), mn('0'))), Tm: xi('Tm', sub(mi('T'), mi('m'))), Lc: xi('Lc', sub(mi('L'), mi('c'))),
    kmet: xi('kmet', sub(mi('k'), mtext('metal'))),
    Ti: xi('Ti', sub(mi('T'), mi('i'))), Tim1: xi('Tim1', sub(mi('T'), row(mi('i'), mo('−'), mn('1')))),
    Tp: xi('Tp', sup(mi('T'), mo('′'))), tp: xi('tp', sup(mi('t'), mo('′'))),
    Dt: xi('Dt', row(mi('Δ'), mi('t'))), DT: xi('DT', row(mi('Δ'), mi('T'))),
    y: xi('y', mi('y')), a: xi('a', mi('a')), b: xi('b', mi('b')),
    ti: xi('ti', sub(mi('t'), mi('i'))), yi: xi('yi', sub(mi('y'), mi('i'))),
    tbar: xi('tbar', over(mi('t'), mo('¯'))), ybar: xi('ybar', over(mi('y'), mo('¯'))),
    Bi: xi('Bi', mi('Bi')), z1: xi('z1', sub(mi('ζ'), mn('1'))), J0: xi('J0', sub(mi('J'), mn('0'))), J1: xi('J1', sub(mi('J'), mn('1'))),
    tstar: xi('tstar', sup(mi('t'), mo('*'))), Tstar: xi('Tstar', sup(mi('T'), mo('*'))), thalf: xi('thalf', sub(mi('t'), mn('½'))),
    k1: xi('r-k1', sub(mi('k'), mn('1'))), k2: xi('r-k2', sub(mi('k'), mn('2'))), k3: xi('r-k3', sub(mi('k'), mn('3'))),
    EQ: mo('='), MINUS: mo('−'), PLUS: mo('+'),
  };
  S.IMP = row(sp, mo('⇒'), sp);
  S.dTdt = xi('dTdt', frac(row(S.dd, S.T), row(S.dd, S.t)));
  S.mkt = row(S.MINUS, S.k, S.t);
  S.sum = xi('sum', under(mo('∑'), row(mi('i'), mo('='), mn('1')), mi('n')));
  const ex = (arg) => sup(S.e, arg);
  const integ = (lo, hi) => xi('int', subsup(mo('∫'), lo, hi));

  function renderMath() {
    const box = $('math-steps');
    const l = focusLane();
    if (!l || !l.d) return;
    if (l.d.error) { box.innerHTML = `<div class="alert">⚠ ${esc(l.d.error)}</div>`; return; }
    const d = l.d, mt = d.metal;
    const t = state.simTime, E = Math.exp(-d.k * t), Tn = l.Tm + d.dT0 * E, th = Tn - l.Tm;
    const cooling = d.dT0 > 0;
    const steps = [];
    const step = (title, text, eqs, extra = '') => steps.push(
      `<article class="step"><div class="step-n">${steps.length + 1}</div><div class="step-body"><h4>${title}</h4>${text ? `<p>${text}</p>` : ''}${eqs.join('')}${extra}</div></article>`);

    step('Modelo físico: Ley de Enfriamiento de Newton',
      `La rapidez con que cambia la temperatura de la pieza es proporcional a su diferencia con el medio (${esc(d.fluid.short)} a ${fmtTemp(l.Tm)}). Tomamos k &gt; 0 y escribimos el signo menos: es la misma ley del informe, dT/dt = k(T − Tₘ), pero con k negativa.`,
      [Mx('f-newton', S.dTdt, S.EQ, S.MINUS, S.k, par(S.T, S.MINUS, S.Tm))]);

    step('¿De dónde sale k? Balance de energía',
      `El calor que la pieza pierde por segundo, m·c·dT/dt, es el que sale por convección a través de su superficie, h·A·(T − Tₘ). Comparando con el paso 1 despejamos k con las propiedades reales del material, ${esc(mt.name)} (ρ = ${mt.rho} kg/m³, c = ${mt.c} J/kg·K) y del medio (h = ${l.h} W/m²·K). La pieza es un cilindro de D = ${state.geom.D} mm y L = ${state.geom.L} mm.`,
      [
        Mx('f-balance', S.m, S.c, S.dTdt, S.EQ, S.MINUS, S.h, S.A, par(S.T, S.MINUS, S.Tm), S.IMP, S.k, S.EQ, frac(row(S.h, S.A), row(S.m, S.c)), S.EQ, frac(row(S.h, S.A), row(S.rho, S.c, S.V)), S.EQ, frac(S.h, row(S.rho, S.c, S.Lc))),
        Mx('f-area', S.A, S.EQ, S.pi, S.D, S.L, S.PLUS, mn('2'), S.pi, sup(par(frac(S.D, mn('2'))), mn('2')), S.EQ, S.pi, xp('D', d.D), xp('L', d.L), S.PLUS, mn('2'), S.pi, sup(xp('R', d.R), mn('2')), S.EQ, xn('A', d.A), unit('m²')),
        Mx('f-vol', S.V, S.EQ, S.pi, sup(par(frac(S.D, mn('2'))), mn('2')), S.L, S.EQ, S.pi, sup(xp('R', d.R), mn('2')), xp('L', d.L), S.EQ, xn('V', d.V), unit('m³')),
        Mx('f-lc', S.Lc, S.EQ, frac(S.V, S.A), S.EQ, xn('Lc', d.Lc), unit('m'), sp, mtext(';'), sp, S.m, S.EQ, S.rho, S.V, S.EQ, xp('rho', mt.rho), xp('V', d.V), S.EQ, xn('m', d.m), unit('kg')),
        Mxbox('f-k', S.k, S.EQ, frac(S.h, row(S.rho, S.c, S.Lc)), S.EQ, frac(xn('h', l.h), row(xp('rho', mt.rho), xp('c', mt.c), xp('Lc', d.Lc))), S.EQ, xn('k', d.k), unit('s⁻¹'), sp, mtext(';'), sp, S.tau, S.EQ, frac(mn('1'), S.k), S.EQ, xn('tau', d.tau), unit('s')),
      ],
      `<p class="note">Dato clave: la conductividad del metal <strong>no aparece</strong> en k. En este modelo sólo importan h y la capacidad térmica por volumen, ρ·c = ${fmtSig((mt.rho * mt.c) / 1e6, 3)} MJ/m³·K. Por eso en el “duelo de metales” el aluminio (ρ·c bajo) cambia de temperatura más rápido que el cobre, aunque el cobre conduzca mejor el calor.</p>`);

    step('Separación de variables',
      'Dejamos todo lo que depende de T a la izquierda y lo que depende de t a la derecha.',
      [Mx('f-sep', frac(row(S.dd, S.T), row(S.T, S.MINUS, S.Tm)), S.EQ, S.MINUS, S.k, S.dd, S.t)]);

    step('Integración definida',
      'Integramos desde el instante inicial (t = 0, T = T₀) hasta un instante cualquiera t. La antiderivada de 1/u es ln|u|.',
      [
        Mx('f-int', integ(S.T0, S.T), frac(row(S.dd, S.Tp), row(S.Tp, S.MINUS, S.Tm)), S.EQ, S.MINUS, S.k, integ(mn('0'), S.t), S.dd, S.tp),
        Mx('f-barrow', subsup(row(mo('['), S.ln, bars(S.Tp, S.MINUS, S.Tm), mo(']')), S.T0, S.T), S.EQ, S.MINUS, S.k, S.t),
        Mx('f-lnres', S.ln, bars(S.T, S.MINUS, S.Tm), S.MINUS, S.ln, bars(S.T0, S.MINUS, S.Tm), S.EQ, S.MINUS, S.k, S.t),
      ]);

    step('Despeje de T(t): la solución',
      'Usamos ln a − ln b = ln(a/b). Como T − Tₘ y T₀ − Tₘ tienen el mismo signo, el cociente es positivo y podemos quitar el valor absoluto. Aplicamos la exponencial y despejamos: esta es la curva de la sección 3.',
      [
        Mx('f-exp', S.ln, par(frac(row(S.T, S.MINUS, S.Tm), row(S.T0, S.MINUS, S.Tm))), S.EQ, S.MINUS, S.k, S.t, S.IMP, frac(row(S.T, S.MINUS, S.Tm), row(S.T0, S.MINUS, S.Tm)), S.EQ, ex(S.mkt)),
        Mxbox('f-sol', S.T, par(S.t), S.EQ, S.Tm, S.PLUS, par(S.T0, S.MINUS, S.Tm), ex(S.mkt)),
        Mx('f-solnum', S.T, par(S.t), S.EQ, xn('Tm', l.Tm), S.PLUS, xp('dT0', d.dT0), ex(row(S.MINUS, xn('k', d.k), S.t))),
      ]);

    step(`Evaluación en el instante actual: t = ${fmtTime(t)}`,
      'Sustituimos el tiempo de la simulación. Estos números se recalculan en vivo mientras corre.',
      [
        Mx('f-eval', S.MINUS, S.k, S.t, S.EQ, S.MINUS, xp('k', d.k), xp('t', t), S.EQ, xn('mkt', -d.k * t)),
        Mx('f-eval', ex(xn('mkt', -d.k * t)), S.EQ, xn('E', E)),
        Mxbox('f-eval', S.T, par(xn('t', t)), S.EQ, xn('Tm', l.Tm), S.PLUS, xp('dT0', d.dT0), xp('E', E), S.EQ, xn('T', Tn, 5), unit('°C')),
      ]);

    const rate = -d.k * th, rate0 = -d.k * d.dT0, acc = d.k * d.k * th;
    step('Derivadas: rapidez y concavidad',
      cooling
        ? 'La primera derivada es la rapidez de enfriamiento: negativa (la temperatura baja) y con valor absoluto máximo al inicio, cuando la diferencia con el medio es mayor. La segunda derivada es positiva: la curva es cóncava hacia arriba y se aplana al acercarse a Tₘ.'
        : 'Aquí la pieza se calienta: la primera derivada es positiva y máxima al inicio. La segunda derivada es negativa: la curva es cóncava hacia abajo y se aplana al acercarse a Tₘ.',
      [
        Mx('f-deriv', S.dTdt, S.EQ, frac(S.dd, row(S.dd, S.t)), mo('['), S.Tm, S.PLUS, par(S.T0, S.MINUS, S.Tm), ex(S.mkt), mo(']'), S.EQ, S.MINUS, S.k, par(S.T0, S.MINUS, S.Tm), ex(S.mkt), S.EQ, S.MINUS, S.k, par(S.T, S.MINUS, S.Tm)),
        Mx('f-derivnum', sub(par(S.dTdt), row(S.t, S.EQ, xn('t', t))), S.EQ, S.MINUS, xp('k', d.k), xp('th', th), S.EQ, xn('dTdt', rate), unit('°C/s')),
        Mx('f-derivnum', sub(par(S.dTdt), row(S.t, S.EQ, mn('0'))), S.EQ, S.MINUS, S.k, par(S.T0, S.MINUS, S.Tm), S.EQ, xn('dTdt0', rate0), unit('°C/s')),
        Mx('f-deriv2', frac(row(sup(S.dd, mn('2')), S.T), row(S.dd, sup(S.t, mn('2')))), S.EQ, sup(S.k, mn('2')), par(S.T0, S.MINUS, S.Tm), ex(S.mkt), S.EQ, xn('d2T', acc), unit('°C/s²')),
      ],
      '<p class="good">Verificación: la derivada de la solución da −k(T − Tₘ), exactamente la ecuación del paso 1. ✓</p>');

    const qn = l.h * d.A * th, Qn = d.C * d.dT0 * (1 - E), Qinf = d.C * d.dT0;
    step('Potencia térmica y energía: una integral',
      'La potencia q es el calor por segundo que cruza la superficie. Integrándola en el tiempo obtenemos la energía transferida: es el área sombreada de la sección 4. Q &gt; 0 significa calor cedido por la pieza y Q &lt; 0, calor absorbido.',
      [
        Mx('f-q', S.q, par(S.t), S.EQ, S.h, S.A, par(S.T, S.MINUS, S.Tm), S.EQ, xp('h', l.h), xp('A', d.A), xp('th', th), S.EQ, xn('q', qn), unit('W')),
        Mx('f-Qint', S.Q, par(S.t), S.EQ, integ(mn('0'), S.t), S.q, par(S.tp), S.dd, S.tp, S.EQ, S.h, S.A, par(S.T0, S.MINUS, S.Tm), integ(mn('0'), S.t), ex(row(S.MINUS, S.k, S.tp)), S.dd, S.tp),
        Mx('f-Qanti', S.EQ, S.h, S.A, par(S.T0, S.MINUS, S.Tm), subsup(row(mo('['), S.MINUS, frac(ex(row(S.MINUS, S.k, S.tp)), S.k), mo(']')), mn('0'), S.t), S.EQ, frac(row(S.h, S.A), S.k), par(S.T0, S.MINUS, S.Tm), par(mn('1'), S.MINUS, ex(S.mkt))),
        Mxbox('f-Q', mtext('como '), frac(row(S.h, S.A), S.k), S.EQ, S.m, S.c, mtext(':'), sp, S.Q, par(S.t), S.EQ, S.m, S.c, par(S.T0, S.MINUS, S.Tm), par(mn('1'), S.MINUS, ex(S.mkt)), S.EQ, xp('m', d.m), xp('c', mt.c), xp('dT0', d.dT0), xp('oneMinusE', 1 - E), S.EQ, xn('Q', Qn), unit('J')),
        Mx('f-Qcheck', mtext('Comprobación: '), S.m, S.c, par(S.T0, S.MINUS, S.T), S.EQ, xp('m', d.m), xp('c', mt.c), xp('T0mT', l.T0 - Tn), S.EQ, xn('Q', d.C * (l.T0 - Tn)), unit('J'), sp, mtext('✓')),
        Mx('f-Qinf', sub(S.Q, mi('∞')), S.EQ, S.m, S.c, par(S.T0, S.MINUS, S.Tm), S.EQ, xn('Qinf', Qinf), unit('J')),
      ]);

    const ts = state.tStar;
    if (tStarValid(l, ts)) {
      const tS = Math.log(d.dT0 / (ts - l.Tm)) / d.k;
      step(`¿Cuándo llega a T* = ${fmtTemp(ts)}?`,
        `Despejamos t de la solución del paso 5. Resultado: ≈ ${fmtTime(tS)}. La vida media t½ es el tiempo en que la diferencia con el medio se reduce a la mitad; no depende de la temperatura inicial.`,
        [
          Mxbox('f-tstar', S.tstar, S.EQ, frac(mn('1'), S.k), S.ln, par(frac(row(S.T0, S.MINUS, S.Tm), row(S.Tstar, S.MINUS, S.Tm))), S.EQ, frac(mn('1'), xn('k', d.k)), S.ln, par(frac(xn('dT0', d.dT0), xn('TsmTm', ts - l.Tm))), S.EQ, xn('tstar', tS), unit('s')),
          Mx('f-thalf', S.thalf, S.EQ, frac(row(S.ln, mn('2')), S.k), S.EQ, xn('thalf', Math.LN2 / d.k), unit('s')),
        ]);
    } else {
      step('¿Cuándo llega a una temperatura objetivo T*?',
        `Digita arriba una T* estrictamente entre T₀ = ${fmtTemp(l.T0)} y Tₘ = ${fmtTemp(l.Tm)} para calcular el tiempo exacto.`,
        [Mx('f-tstar', S.tstar, S.EQ, frac(mn('1'), S.k), S.ln, par(frac(row(S.T0, S.MINUS, S.Tm), row(S.Tstar, S.MINUS, S.Tm))))]);
    }

    const biEqs = [Mx('f-bi', S.Bi, S.EQ, frac(row(S.h, S.Lc), S.kmet), S.EQ, frac(row(xp('h', l.h), xp('Lc', d.Lc)), xn('kmet', mt.k)), S.EQ, xn('Bi', d.Bi, 3))];
    let biExtra;
    if (d.Bi < 0.1) {
      biExtra = '<p class="good">Bi &lt; 0.1 ✓ — la temperatura dentro de la pieza es prácticamente uniforme: el modelo de Newton (capacidad concentrada) es válido para este experimento.</p>';
    } else {
      biEqs.push(Mx('f-zeta', frac(row(S.z1, S.J1, par(S.z1)), row(S.J0, par(S.z1))), S.EQ, frac(row(S.h, S.R), S.kmet), S.EQ, xn('BiR', d.BiR, 3), S.IMP, S.z1, S.EQ, xn('z1', d.z, 4)));
      biExtra = `<p class="bad">Bi ≥ 0.1 ⚠ — el interior cambia de temperatura más lento que la superficie y el modelo de Newton pierde precisión. Con la solución de un término del cilindro (Incropera), en este instante el núcleo estaría a ≈ ${fmtTemp(l.Tm + th * d.coreRatio)} y la superficie a ≈ ${fmtTemp(l.Tm + th * d.surfRatio)}. La tarjeta del experimento dibuja ese gradiente dentro de la pieza.</p>`;
    }
    step('¿Es válido el modelo? Número de Biot',
      'Biot compara la resistencia al paso del calor dentro del metal con la resistencia en la superficie.',
      biEqs, biExtra);

    box.innerHTML = steps.join('');
  }

  // ===================== TABLA COMPARATIVA =====================
  function compRows() {
    const act = active(), dt = state.dtComp;
    if (!(dt > 0) || !act.length) return { act, rows: [], capped: false };
    const nAll = Math.floor(state.simTime / dt + 1e-9);
    const n = Math.min(nAll, 400);
    const rows = [];
    for (let i = 0; i <= n; i++) {
      const t = i * dt;
      rows.push({ i, t, T: act.map((l) => measured(l, t, i, 1)), real: act.map((l) => Tat(l, t)) });
    }
    return { act, rows, capped: nAll > 400 };
  }

  function labNote(where) {
    return `<div class="lab-note"><strong>🔬 Modo laboratorio activo.</strong> Cada medición es la temperatura real <em>más</em> el ruido de un sensor tipo termopar K, de ±(0.3 °C + 0.5 % de la lectura). La temperatura real (en gris) <strong>siempre baja</strong> de forma exponencial, pero cerca del equilibrio cambia menos que el ruido y por eso las mediciones ${where} suben y bajan. Es lo mismo que pasa con un termómetro real. Apaga el modo laboratorio para ver los valores exactos del modelo.</div>`;
  }

  function renderComparative() {
    const { act, rows, capped } = compRows();
    const sig = `${state.version}|${state.dtComp}|${state.lab}|${rows.length}`;
    if (sig === state.sig.comp) return;
    state.sig.comp = sig;
    $('comp-lab').innerHTML = state.lab ? labNote('de esta tabla') : '';
    const head = `<thead><tr><th data-x="c-i">#</th><th data-x="c-t">t (s)</th>${act.map((l) => `<th data-x="c-T"><span class="chip" style="background:${l.color}">${l.id}</span> T (°C)<br><small>${esc(l.d.metal.short)} · ${esc(l.d.fluid.short)}</small></th>`).join('')}</tr></thead>`;
    const body = rows.length
      ? rows.map((r) => `<tr><td>${r.i}</td><td>${fmtNum(r.t)}</td>${r.T.map((v, j) => `<td data-lane="${act[j].id}" data-i="${r.i}">${minus(v.toFixed(2))}${state.lab ? `<small class="real">real ${minus(r.real[j].toFixed(2))}</small>` : ''}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${2 + act.length}" class="dim">Inicia la simulación para registrar mediciones.</td></tr>`;
    $('tbl-comp').innerHTML = head + `<tbody>${body}</tbody>`;
    $('comp-note').textContent = !rows.length ? '' : capped
      ? 'Se muestran las primeras 400 filas; aumenta Δt para cubrir todo el experimento.'
      : `${rows.length} mediciones ${state.lab ? 'con ruido de sensor (modo laboratorio)' : 'exactas del modelo'}. También aparecen como círculos en la gráfica de la sección 3. Haz clic en cualquier valor para ver cómo se obtuvo.`;
  }

  // ===================== ANÁLISIS TIPO INFORME =====================
  function anaData() {
    const l = focusLane();
    if (!l || !l.d || l.d.error) return null;
    const d = l.d, dt = state.dtAna;
    const rows = [];
    const thr = Math.max(0.5, 4 * noiseAmp(l.Tm));
    if (dt > 0 && d.tEnd > 0) {
      const n = Math.min(400, Math.floor(Math.min(state.simTime, d.tEnd) / dt + 1e-9));
      for (let i = 0; i <= n; i++) {
        const t = i * dt, T = measured(l, t, i, 2), th = T - l.Tm;
        const ok = Math.abs(th) > thr;
        const r = { i, t, T, real: Tat(l, t), th, ok, ln: ok ? Math.log(Math.abs(th)) : null, rate: null, ratio: null, kLog: null };
        if (i > 0) {
          const p = rows[i - 1];
          r.rate = (T - p.T) / dt;
          if (ok) r.ratio = r.rate / th;
          if (ok && Math.abs(p.th) > thr && Math.sign(th) === Math.sign(p.th)) r.kLog = Math.log(p.th / th) / dt;
        }
        rows.push(r);
      }
    }
    const ratios = rows.filter((r) => r.ratio != null).map((r) => r.ratio);
    const kls = rows.filter((r) => r.kLog != null).map((r) => r.kLog);
    const pts = rows.filter((r) => r.ln != null).map((r) => [r.t, r.ln]);
    let reg = null;
    if (pts.length >= 2) {
      const tb = mean(pts.map((p) => p[0])), yb = mean(pts.map((p) => p[1]));
      let sxx = 0, sxy = 0, syy = 0;
      pts.forEach(([x, y]) => { sxx += (x - tb) ** 2; sxy += (x - tb) * (y - yb); syy += (y - yb) ** 2; });
      const b = sxy / sxx, a = yb - b * tb;
      reg = { a, b, r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 1, n: pts.length, tb, yb };
    }
    return {
      l, d, dt, rows, reg, thr,
      k1: ratios.length ? -mean(ratios) : null, n1: ratios.length,
      k2: kls.length ? mean(kls) : null, n2: kls.length,
      bias: Math.expm1(d.k * dt) / dt,
    };
  }

  function renderAnalysis() {
    const A = anaData();
    state.lastAna = A;
    const sig = A ? `${state.version}|${state.focus}|${state.dtAna}|${state.lab}|${A.rows.length}` : `none|${state.version}|${state.focus}`;
    if (sig === state.sig.ana) return;
    state.sig.ana = sig;
    const tbl = $('tbl-ana'), res = $('ana-results');
    $('ana-lab').innerHTML = A && state.lab ? labNote('de la columna T') : '';
    if (!A) {
      tbl.innerHTML = '';
      res.innerHTML = '<div class="alert">El experimento en foco tiene datos inválidos.</div>';
      drawLnChart(null);
      return;
    }
    const { l, d, rows, reg } = A;
    const head = '<thead><tr><th data-x="c-i">i</th><th data-x="c-t">t (s)</th><th data-x="c-T">T (°C)</th><th data-x="c-rate">ΔT/Δt (°C/s)</th><th data-x="c-th">T − Tₘ</th><th data-x="c-ratio">(ΔT/Δt)/(T − Tₘ)</th><th data-x="c-ln">ln|T − Tₘ|</th></tr></thead>';
    const body = rows.length
      ? rows.map((r) => `<tr data-row="${r.i}" title="Clic para ver cómo se calculó esta fila"><td>${r.i}</td><td>${fmtNum(r.t)}</td><td>${minus(r.T.toFixed(2))}${state.lab ? `<small class="real">real ${minus(r.real.toFixed(2))}</small>` : ''}</td><td>${r.rate == null ? '—' : minus(r.rate.toFixed(3))}</td><td>${minus(r.th.toFixed(2))}</td><td class="${r.ratio == null ? 'dim' : ''}">${r.ratio == null ? (r.i ? 'n/d' : '—') : minus(r.ratio.toFixed(5))}</td><td class="${r.ln == null ? 'dim' : ''}">${r.ln == null ? 'n/d' : minus(r.ln.toFixed(4))}</td></tr>`).join('')
      : '<tr><td colspan="7" class="dim">Inicia la simulación para registrar mediciones.</td></tr>';
    tbl.innerHTML = head + `<tbody>${body}</tbody>`;

    const kT = d.k;
    const errTxt = (k) => `${((k - kT) / kT) * 100 >= 0 ? '+' : '−'}${Math.abs(((k - kT) / kT) * 100).toFixed(2)} % frente a la teórica`;
    const val = (key, k, n) => (k == null ? '<p class="val">Faltan mediciones…</p>' : `<p class="val"><span data-x="${key}">${fmtSig(k, 4)} s⁻¹</span> <small>(${errTxt(k)}, n = ${n})</small></p>`);
    res.innerHTML = `
      <div class="method">
        <h4>k teórica (propiedades físicas)</h4>
        ${Mx('f-kT', S.k, S.EQ, frac(row(S.h, S.A), row(S.rho, S.c, S.V)), S.EQ, xn('r-kT', kT), unit('s⁻¹'))}
      </div>
      <div class="method">
        <h4>① Promedio de razones (método del informe)</h4>
        ${Mx('f-k1', S.k1, S.EQ, S.MINUS, frac(mn('1'), S.n), S.sum, frac(row(S.DT, mo('/'), S.Dt), row(S.Ti, S.MINUS, S.Tm)))}
        ${val('r-k1', A.k1, A.n1)}
        <p>Tiene un sesgo que se puede predecir, porque usa diferencias finitas: sin ruido daría (e<sup>kΔt</sup> − 1)/Δt = <strong><span data-x="r-bias">${fmtSig(A.bias, 4)} s⁻¹</span></strong>. Con un Δt más pequeño, k₁ se acerca a la teórica.</p>
      </div>
      <div class="method">
        <h4>② Logaritmo por intervalo (exacto, sin sesgo)</h4>
        ${Mx('f-k2', S.k2, S.EQ, frac(mn('1'), S.n), S.sum, frac(mn('1'), S.Dt), S.ln, par(frac(row(S.Tim1, S.MINUS, S.Tm), row(S.Ti, S.MINUS, S.Tm))))}
        ${val('r-k2', A.k2, A.n2)}
      </div>
      <div class="method">
        <h4>③ Regresión lineal de ln|T − Tₘ| contra t</h4>
        ${Mx('f-k3', S.y, S.EQ, S.ln, bars(S.T, S.MINUS, S.Tm), S.EQ, S.a, S.PLUS, S.b, S.t, sp, mtext(';'), sp, S.b, S.EQ, frac(row(S.sum, par(S.ti, S.MINUS, S.tbar), par(S.yi, S.MINUS, S.ybar)), row(S.sum, sup(par(S.ti, S.MINUS, S.tbar), mn('2')))), sp, mtext(';'), sp, S.k3, S.EQ, S.MINUS, S.b)}
        ${reg ? `${val('r-k3', -reg.b, reg.n)}
          <p><span data-x="r-R2">R² = ${reg.r2.toFixed(6)}</span> · <span data-x="r-T0est">T₀ estimada = Tₘ ${d.dT0 >= 0 ? '+' : '−'} e<sup>a</sup> = ${fmtTemp(l.Tm + Math.sign(d.dT0 || 1) * Math.exp(reg.a))}</span> (real: ${fmtTemp(l.T0)})</p>` : '<p class="val">Faltan mediciones…</p>'}
      </div>`;
    drawLnChart(A);
  }

  // ===================== EXPLICACIONES AL HACER CLIC =====================
  const f4 = (x) => fmtSig(x, 4);
  function ctx() {
    const l = focusLane();
    if (!l || !l.d || l.d.error) return null;
    const t = state.simTime, T = Tat(l, t);
    return { l, d: l.d, mt: l.d.metal, t, T, th: T - l.Tm, E: Math.exp(-l.d.k * t) };
  }

  // k: tipo · t: título · d: descripción · v: valor en el experimento en foco (opcional)
  const EXPLAIN = {
    // ---- símbolos ----
    T: { k: 'Símbolo', t: 'T — temperatura de la pieza', d: 'Temperatura media de la pieza en el instante t, en °C. Es la cantidad que describe la Ley de Newton.', v: (c) => `En t = ${fmtTime(c.t)}: T = ${fmtTemp(c.T)}` },
    t: { k: 'Símbolo', t: 't — tiempo', d: 'Tiempo transcurrido desde que la pieza entra al medio, en segundos. Es tiempo físico real, no el tiempo de la animación.', v: (c) => `Ahora: t = ${fmtTime(c.t)}` },
    k: { k: 'Símbolo', t: 'k — constante de la Ley de Newton', d: 'Mide qué tan rápido la pieza se acerca a la temperatura del medio. Unidades: 1/s. Mientras mayor es k, más rápido cambia la temperatura. Aquí se calcula con propiedades reales: k = hA/(ρcV).', v: (c) => `k = ${f4(c.d.k)} s⁻¹` },
    Tm: { k: 'Símbolo', t: 'Tₘ — temperatura del medio', d: 'Temperatura del aire, del líquido o del horno que rodea la pieza. Es el valor al que tiende T con el tiempo (la asíntota de la curva).', v: (c) => `Tₘ = ${fmtTemp(c.l.Tm)} (${c.d.fluid.short})` },
    T0: { k: 'Símbolo', t: 'T₀ — temperatura inicial', d: 'Temperatura de la pieza en t = 0, justo al entrar al medio.', v: (c) => `T₀ = ${fmtTemp(c.l.T0)}` },
    h: { k: 'Símbolo', t: 'h — coeficiente de convección', d: 'Qué tan bien el medio intercambia calor con la superficie, en W/m²·K. Aire quieto ≈ 10, aceite ≈ 800, agua ≈ 3000.', v: (c) => `h = ${c.l.h} W/m²·K (${c.d.fluid.short})` },
    A: { k: 'Símbolo', t: 'A — área de la superficie', d: 'Superficie por donde entra o sale el calor: la cara lateral del cilindro más sus dos tapas, A = πDL + 2π(D/2)².', v: (c) => `A = ${f4(c.d.A)} m² = ${fmtSig(c.d.A * 1e4, 4)} cm²` },
    V: { k: 'Símbolo', t: 'V — volumen', d: 'Volumen de la pieza cilíndrica: V = π(D/2)²·L.', v: (c) => `V = ${f4(c.d.V)} m³ = ${fmtSig(c.d.V * 1e6, 4)} cm³` },
    m: { k: 'Símbolo', t: 'm — masa', d: 'Masa de la pieza: m = ρ·V.', v: (c) => `m = ${f4(c.d.m)} kg = ${fmtSig(c.d.m * 1000, 4)} g` },
    c: { k: 'Símbolo', t: 'c — calor específico', d: 'Energía necesaria para subir 1 °C la temperatura de 1 kg del metal, en J/kg·K. Un c alto hace que el metal cambie de temperatura más lento.', v: (c) => `c = ${c.mt.c} J/kg·K (${c.mt.short})` },
    rho: { k: 'Símbolo', t: 'ρ — densidad', d: 'Masa por unidad de volumen del metal, en kg/m³ (tabla de Incropera).', v: (c) => `ρ = ${c.mt.rho} kg/m³ (${c.mt.short})` },
    Lc: { k: 'Símbolo', t: 'L꜀ — longitud característica', d: 'L꜀ = V/A. Resume la geometría: una pieza gruesa tiene L꜀ grande, más volumen por cada unidad de área, y se enfría más lento.', v: (c) => `L꜀ = ${f4(c.d.Lc)} m = ${fmtSig(c.d.Lc * 1000, 3)} mm` },
    D: { k: 'Símbolo', t: 'D — diámetro', d: 'Diámetro del cilindro. En la fórmula va en metros.', v: () => `D = ${state.geom.D} mm = ${state.geom.D / 1000} m` },
    L: { k: 'Símbolo', t: 'L — largo', d: 'Largo del cilindro. En la fórmula va en metros.', v: () => `L = ${state.geom.L} mm = ${state.geom.L / 1000} m` },
    R: { k: 'Símbolo', t: 'R — radio', d: 'Radio del cilindro, R = D/2.', v: (c) => `R = ${f4(c.d.R)} m` },
    pi: { k: 'Símbolo', t: 'π — pi', d: 'Constante ≈ 3.14159, la razón entre la circunferencia y su diámetro.' },
    e: { k: 'Símbolo', t: 'e — número de Euler', d: 'Constante ≈ 2.71828, base de la función exponencial. e^(−kt) es la fracción de la diferencia inicial con el medio que todavía queda en el instante t.' },
    ln: { k: 'Símbolo', t: 'ln — logaritmo natural', d: 'Función inversa de la exponencial: ln(eˣ) = x. Convierte la curva exponencial en una recta; por eso aparece en la integración y en la regresión.' },
    tau: { k: 'Símbolo', t: 'τ — constante de tiempo', d: 'τ = 1/k. En τ segundos la diferencia con el medio cae al 37 % (e⁻¹); en 5τ queda menos del 1 %.', v: (c) => `τ = ${fmtTime(c.d.tau)}` },
    q: { k: 'Símbolo', t: 'q — potencia térmica', d: 'Calor por segundo que cruza la superficie, en W = J/s: q = hA(T − Tₘ). Positiva = la pieza cede calor; negativa = lo absorbe.', v: (c) => `q = ${fmtPower(c.l.h * c.d.A * c.th)} ${c.th >= 0 ? 'saliendo' : 'entrando'}` },
    Q: { k: 'Símbolo', t: 'Q — energía transferida', d: 'Energía total que la pieza ha cedido (o absorbido) desde t = 0, en joules. Es la integral de la potencia: el área bajo la curva de la sección 4.', v: (c) => `Q = ${fmtEnergy(c.d.C * (c.l.T0 - c.T))}` },
    dTdt: { k: 'Símbolo', t: 'dT/dt — derivada de la temperatura', d: 'Rapidez con que cambia la temperatura, en °C/s. Negativa = se enfría; positiva = se calienta. La Ley de Newton dice que vale −k(T − Tₘ).', v: (c) => `Ahora: dT/dt = ${fmtSig(-c.d.k * c.th, 4)} °C/s` },
    int: { k: 'Símbolo', t: '∫ — integral definida', d: 'Suma continua de infinitos pedacitos. Los números abajo y arriba son los límites: desde dónde y hasta dónde se integra. Aquí “deshace” la derivada para encontrar T(t).' },
    Tp: { k: 'Símbolo', t: 'T′ — variable de integración', d: 'Letra auxiliar que recorre los valores entre T₀ y T. Se usa para no confundirla con el límite superior T.' },
    tp: { k: 'Símbolo', t: 't′ — variable de integración', d: 'Letra auxiliar que recorre los tiempos entre 0 y t, para no confundirla con el límite superior t.' },
    kmet: { k: 'Símbolo', t: 'k_metal — conductividad térmica', d: 'Qué tan fácil viaja el calor dentro del metal, en W/m·K. No interviene en k de Newton, pero sí en el número de Biot.', v: (c) => `k_metal = ${c.mt.k} W/m·K (${c.mt.short})` },
    Bi: { k: 'Símbolo', t: 'Bi — número de Biot', d: 'Bi = hL꜀/k_metal compara la dificultad del calor para moverse dentro del metal con la facilidad para salir por la superficie. Si Bi < 0.1, la pieza tiene temperatura casi uniforme y la Ley de Newton es válida.', v: (c) => `Bi = ${fmtSig(c.d.Bi, 3)} ${c.d.Bi < 0.1 ? '✓ válido' : '⚠ mayor que 0.1'}` },
    BiR: { k: 'Resultado', t: 'hR/k_metal — Biot radial', d: 'Número de Biot calculado con el radio. Es el dato de entrada para hallar ζ₁ en la solución de un término del cilindro.', v: (c) => `hR/k_metal = ${fmtSig(c.d.BiR, 4)}` },
    z1: { k: 'Símbolo', t: 'ζ₁ — primera raíz característica', d: 'Número que resuelve ζ·J₁(ζ)/J₀(ζ) = hR/k_metal. Con él se estima cuánto más caliente está el núcleo que la superficie.', v: (c) => `ζ₁ = ${fmtSig(c.d.z, 5)}` },
    J0: { k: 'Símbolo', t: 'J₀ — función de Bessel de orden 0', d: 'Función especial que aparece al resolver la conducción de calor en un cilindro. J₀(ζ₁) da la relación entre la temperatura de la superficie y la del centro.' },
    J1: { k: 'Símbolo', t: 'J₁ — función de Bessel de orden 1', d: 'Otra función especial del cilindro; J₁ es la derivada de −J₀.' },
    tstar: { k: 'Resultado', t: 't* — tiempo para llegar a T*', d: 'Tiempo que tarda la pieza en llegar a la temperatura objetivo T* que digitaste. Se obtiene despejando t de la solución.', v: (c) => (tStarValid(c.l, state.tStar) ? `t* = ${fmtTime(Math.log(c.d.dT0 / (state.tStar - c.l.Tm)) / c.d.k)}` : 'Digita una T* válida arriba.') },
    Tstar: { k: 'Símbolo', t: 'T* — temperatura objetivo', d: 'La temperatura a la que quieres saber cuándo llega la pieza. Se digita en la casilla de arriba y debe estar entre T₀ y Tₘ.', v: () => (state.tStar != null ? `T* = ${fmtTemp(state.tStar)}` : '') },
    TsmTm: { k: 'Resultado', t: 'T* − Tₘ', d: 'Diferencia que debe quedar entre la pieza y el medio al llegar a la temperatura objetivo.', v: (c) => (state.tStar != null ? `T* − Tₘ = ${fmtSig(state.tStar - c.l.Tm, 4)} °C` : '') },
    thalf: { k: 'Resultado', t: 't½ — vida media térmica', d: 't½ = ln 2 / k. Cada t½ la diferencia con el medio se reduce a la mitad, sin importar la temperatura inicial.', v: (c) => `t½ = ${fmtTime(Math.LN2 / c.d.k)}` },
    // ---- números intermedios ----
    dT0: { k: 'Resultado', t: 'T₀ − Tₘ — diferencia inicial', d: 'Cuánto más caliente (o más fría, si es negativa) empieza la pieza que el medio. Es la “distancia” que la temperatura tiene que recorrer.', v: (c) => `T₀ − Tₘ = ${fmtSig(c.d.dT0, 4)} °C` },
    th: { k: 'Resultado', t: 'T − Tₘ — diferencia actual', d: 'Cuánto le falta a la pieza para igualar la temperatura del medio en este instante. Es lo que “empuja” el flujo de calor.', v: (c) => `T − Tₘ = ${fmtSig(c.th, 4)} °C` },
    T0mT: { k: 'Resultado', t: 'T₀ − T — lo que ya bajó (o subió)', d: 'Cambio de temperatura acumulado desde el inicio. Multiplicado por m·c da la energía transferida.', v: (c) => `T₀ − T = ${fmtSig(c.l.T0 - c.T, 4)} °C` },
    mkt: { k: 'Resultado', t: '−k·t — exponente', d: 'Producto de la constante k por el tiempo, con signo menos. Mientras más negativo, más cerca está la pieza del equilibrio.', v: (c) => `−kt = ${fmtSig(-c.d.k * c.t, 4)}` },
    E: { k: 'Resultado', t: 'e^(−kt) — fracción que falta', d: 'Qué fracción de la diferencia inicial todavía queda. Empieza en 1 (100 %) y tiende a 0 en el equilibrio.', v: (c) => `e^(−kt) = ${fmtSig(c.E, 4)} → queda el ${(c.E * 100).toFixed(1)} % de la diferencia inicial` },
    oneMinusE: { k: 'Resultado', t: '1 − e^(−kt) — fracción ya transferida', d: 'Fracción de la energía total posible que ya se transfirió.', v: (c) => `1 − e^(−kt) = ${fmtSig(1 - c.E, 4)} → ${((1 - c.E) * 100).toFixed(1)} % transferido` },
    dTdt0: { k: 'Resultado', t: 'Rapidez inicial', d: 'La derivada en t = 0: la máxima rapidez de cambio, porque al inicio la diferencia con el medio es la mayor.', v: (c) => `dT/dt(0) = ${fmtSig(-c.d.k * c.d.dT0, 4)} °C/s` },
    d2T: { k: 'Resultado', t: 'd²T/dt² — segunda derivada', d: 'Indica la concavidad. Positiva: la curva es cóncava hacia arriba (se enfría y se va frenando). Negativa: cóncava hacia abajo (se calienta y se frena).', v: (c) => `d²T/dt² = ${fmtSig(c.d.k * c.d.k * c.th, 4)} °C/s²` },
    Qinf: { k: 'Resultado', t: 'Q∞ — energía total posible', d: 'Energía que se habrá transferido cuando la pieza llegue al equilibrio: m·c·(T₀ − Tₘ).', v: (c) => `Q∞ = ${fmtEnergy(c.d.C * c.d.dT0)}` },
    // ---- análisis (sección 7) ----
    n: { k: 'Símbolo', t: 'n — cantidad de datos', d: 'Número de filas de la tabla que entran en el cálculo. Las filas marcadas “n/d” no cuentan porque la pieza ya está demasiado cerca de Tₘ.', v: () => { const A = state.lastAna; return A ? `Método ①: n = ${A.n1} · Método ②: n = ${A.n2} · Regresión: n = ${A.reg ? A.reg.n : 0}` : ''; } },
    i: { k: 'Símbolo', t: 'i — número de fila', d: 'Recorre las filas de la tabla: i = 0 es la primera medición (t = 0), i = 1 la siguiente, etc.' },
    sum: { k: 'Símbolo', t: 'Σ — sumatoria', d: 'Suma la expresión de la derecha para cada fila, desde i = 1 hasta i = n. Dividirla entre n da el promedio.' },
    Ti: { k: 'Símbolo', t: 'Tᵢ — temperatura de la fila i', d: 'La temperatura medida en la fila i de la tabla (columna T).' },
    Tim1: { k: 'Símbolo', t: 'Tᵢ₋₁ — temperatura de la fila anterior', d: 'La temperatura medida en la fila de arriba. Comparándola con Tᵢ se obtiene cuánto bajó en un intervalo Δt.' },
    DT: { k: 'Símbolo', t: 'ΔT — cambio de temperatura', d: 'Diferencia entre dos mediciones seguidas: ΔT = Tᵢ − Tᵢ₋₁. Negativa si la pieza se enfría.' },
    Dt: { k: 'Símbolo', t: 'Δt — intervalo de muestreo', d: 'Tiempo entre dos mediciones seguidas. Se cambia en la casilla de arriba. Un Δt pequeño reduce el sesgo del método ①.', v: () => `Δt = ${fmtSig(state.dtAna, 4)} s` },
    y: { k: 'Símbolo', t: 'y — variable linealizada', d: 'y = ln|T − Tₘ|. Si la Ley de Newton se cumple, y contra t es una línea recta de pendiente −k.' },
    a: { k: 'Símbolo', t: 'a — intercepto de la recta', d: 'Valor de y cuando t = 0. Como y(0) = ln|T₀ − Tₘ|, de a se puede estimar la temperatura inicial.', v: () => (state.lastAna && state.lastAna.reg ? `a = ${fmtSig(state.lastAna.reg.a, 5)}` : '') },
    b: { k: 'Símbolo', t: 'b — pendiente de la recta', d: 'Cuánto baja y por cada segundo. En la Ley de Newton la pendiente es −k, por eso k₃ = −b.', v: () => (state.lastAna && state.lastAna.reg ? `b = ${fmtSig(state.lastAna.reg.b, 5)} s⁻¹` : '') },
    ti: { k: 'Símbolo', t: 'tᵢ — tiempo de la fila i', d: 'El tiempo de cada medición (columna t de la tabla).' },
    yi: { k: 'Símbolo', t: 'yᵢ — valor linealizado de la fila i', d: 'yᵢ = ln|Tᵢ − Tₘ|, la última columna de la tabla.' },
    tbar: { k: 'Símbolo', t: 't̄ — promedio de los tiempos', d: 'Media de los tᵢ usados en la regresión.', v: () => (state.lastAna && state.lastAna.reg ? `t̄ = ${fmtSig(state.lastAna.reg.tb, 5)} s` : '') },
    ybar: { k: 'Símbolo', t: 'ȳ — promedio de los yᵢ', d: 'Media de los valores ln|Tᵢ − Tₘ| usados en la regresión.', v: () => (state.lastAna && state.lastAna.reg ? `ȳ = ${fmtSig(state.lastAna.reg.yb, 5)}` : '') },
    // ---- resultados de la sección 7 ----
    'r-kT': { k: 'Resultado', t: 'k teórica', d: 'La k “verdadera” del modelo, calculada con las propiedades del metal y del medio. Es la referencia contra la que se comparan los tres métodos experimentales.', v: (c) => `k = ${f4(c.d.k)} s⁻¹` },
    'r-k1': { k: 'Resultado', t: 'k₁ — promedio de razones', d: 'Se calcula la razón (ΔT/Δt)/(T − Tₘ) en cada fila, se promedian y se cambia el signo. Es el método del informe del profesor. Da un valor algo mayor que el teórico porque ΔT/Δt es una aproximación de la derivada (diferencia finita), no la derivada exacta.', v: () => { const A = state.lastAna; return A && A.k1 != null ? `k₁ = ${f4(A.k1)} s⁻¹ con n = ${A.n1} razones · esperado sin ruido: ${f4(A.bias)} s⁻¹` : ''; } },
    'r-k2': { k: 'Resultado', t: 'k₂ — logaritmo por intervalo', d: 'En cada intervalo calcula ln((Tᵢ₋₁ − Tₘ)/(Tᵢ − Tₘ))/Δt. Para una exponencial esta fórmula es exacta, así que sin ruido da justo la k teórica.', v: () => { const A = state.lastAna; return A && A.k2 != null ? `k₂ = ${f4(A.k2)} s⁻¹ con n = ${A.n2} intervalos` : ''; } },
    'r-k3': { k: 'Resultado', t: 'k₃ — regresión lineal', d: 'Ajusta por mínimos cuadrados la mejor recta a los puntos (t, ln|T − Tₘ|) de la gráfica de la derecha. k₃ es menos la pendiente. Usa todos los datos a la vez, por eso es el método más robusto frente al ruido.', v: () => { const A = state.lastAna; return A && A.reg ? `k₃ = ${f4(-A.reg.b)} s⁻¹ con n = ${A.reg.n} puntos` : ''; } },
    'r-bias': { k: 'Resultado', t: 'Sesgo esperado del método ①', d: 'Si no hubiera ruido, cada razón valdría exactamente (1 − e^(kΔt))/Δt, así que k₁ daría (e^(kΔt) − 1)/Δt en lugar de k. La diferencia crece con Δt: por eso conviene medir seguido.', v: (c) => `(e^(kΔt) − 1)/Δt = ${f4(Math.expm1(c.d.k * state.dtAna) / state.dtAna)} s⁻¹ frente a k = ${f4(c.d.k)} s⁻¹` },
    'r-R2': { k: 'Resultado', t: 'R² — coeficiente de determinación', d: 'Qué tan bien los puntos se ajustan a una recta: 1 = recta perfecta. Un R² muy cercano a 1 confirma que el enfriamiento es exponencial, como dice la Ley de Newton.', v: () => (state.lastAna && state.lastAna.reg ? `R² = ${state.lastAna.reg.r2.toFixed(6)}` : '') },
    'r-T0est': { k: 'Resultado', t: 'T₀ estimada', d: 'A partir del intercepto a de la recta: T₀ ≈ Tₘ ± eᵃ. Si se parece a la T₀ real, las mediciones son coherentes con el modelo.', v: (c) => (state.lastAna && state.lastAna.reg ? `T₀ estimada = ${fmtTemp(c.l.Tm + Math.sign(c.d.dT0 || 1) * Math.exp(state.lastAna.reg.a))} · real = ${fmtTemp(c.l.T0)}` : '') },
    // ---- columnas de las tablas ----
    'c-i': { k: 'Columna', t: 'Número de medición', d: 'Orden de la medición: 0 es el instante inicial.' },
    'c-t': { k: 'Columna', t: 't — tiempo de la medición', d: 'Segundos desde el inicio. Las mediciones se toman cada Δt.' },
    'c-T': { k: 'Columna', t: 'T — temperatura medida', d: 'Temperatura de la pieza en ese instante. Sin modo laboratorio es el valor exacto del modelo; con modo laboratorio incluye ruido de sensor y debajo, en gris, aparece la temperatura real.' },
    'c-rate': { k: 'Columna', t: 'ΔT/Δt — rapidez medida', d: '(Tᵢ − Tᵢ₋₁)/Δt: cuánto cambió la temperatura por segundo entre esta fila y la anterior. Es la versión “de laboratorio” de la derivada dT/dt.' },
    'c-th': { k: 'Columna', t: 'T − Tₘ — diferencia con el medio', d: 'Cuánto le falta a la pieza para alcanzar la temperatura del medio. Tiende a 0.' },
    'c-ratio': { k: 'Columna', t: '(ΔT/Δt)/(T − Tₘ) — la razón del informe', d: 'Según la Ley de Newton, dT/dt = −k(T − Tₘ), así que esta razón debería valer aproximadamente −k en todas las filas. “n/d” significa que T ya está tan cerca de Tₘ que el cálculo no es confiable.' },
    'c-ln': { k: 'Columna', t: 'ln|T − Tₘ| — linealización', d: 'Aplicar logaritmo convierte la exponencial en una recta: ln|T − Tₘ| = ln|T₀ − Tₘ| − k·t. Estos son los puntos de la gráfica de la derecha.' },
    // ---- fórmulas completas ----
    'f-newton': { k: 'Fórmula', t: 'Ley de Enfriamiento de Newton', d: 'Ecuación diferencial: la rapidez de cambio de T es proporcional a la diferencia con el medio. El signo menos hace que T se acerque a Tₘ: si la pieza está más caliente, baja; si está más fría, sube.' },
    'f-balance': { k: 'Fórmula', t: 'Balance de energía', d: 'Energía que pierde la pieza por segundo (m·c·dT/dt) = calor que sale por convección (h·A·(T − Tₘ)). Comparando con la Ley de Newton se identifica k = hA/(mc).' },
    'f-area': { k: 'Fórmula', t: 'Área del cilindro', d: 'Cara lateral (π·D·L) más las dos tapas circulares (2·π·(D/2)²). Las medidas se pasan de mm a m.' },
    'f-vol': { k: 'Fórmula', t: 'Volumen del cilindro', d: 'Área de la base π(D/2)² por el largo L.' },
    'f-lc': { k: 'Fórmula', t: 'Longitud característica y masa', d: 'L꜀ = V/A resume la forma de la pieza; la masa es densidad por volumen.' },
    'f-k': { k: 'Fórmula', t: 'Cálculo de k', d: 'Se reemplazan h, ρ, c y L꜀ por sus valores. τ = 1/k es la constante de tiempo.' },
    'f-sep': { k: 'Fórmula', t: 'Separación de variables', d: 'Se divide entre (T − Tₘ) y se multiplica por dt para que cada lado dependa de una sola variable. Así se puede integrar cada lado por separado.' },
    'f-int': { k: 'Fórmula', t: 'Integración de ambos lados', d: 'El lado izquierdo suma los cambios de temperatura desde T₀ hasta T; el derecho suma el tiempo desde 0 hasta t.' },
    'f-barrow': { k: 'Fórmula', t: 'Regla de Barrow', d: 'La antiderivada de 1/(T′ − Tₘ) es ln|T′ − Tₘ|; se evalúa en el límite de arriba menos el de abajo.' },
    'f-lnres': { k: 'Fórmula', t: 'Resultado de la integral', d: 'Diferencia de logaritmos igual a −k·t.' },
    'f-exp': { k: 'Fórmula', t: 'Propiedad del logaritmo y exponencial', d: 'ln a − ln b = ln(a/b). Luego se aplica e a ambos lados para quitar el logaritmo.' },
    'f-sol': { k: 'Fórmula', t: 'Solución general T(t)', d: 'La temperatura parte de T₀ y se acerca a Tₘ de forma exponencial. Es la fórmula que dibuja la gráfica de la sección 3.' },
    'f-solnum': { k: 'Fórmula', t: 'Solución con los números del experimento', d: 'La misma solución, reemplazando Tₘ, T₀ − Tₘ y k por sus valores. Sirve para calcular T en cualquier instante.' },
    'f-eval': { k: 'Fórmula', t: 'Evaluación paso a paso', d: 'Primero el exponente −kt, luego e elevado a ese exponente y al final la temperatura. Todo con el tiempo actual de la simulación.' },
    'f-deriv': { k: 'Fórmula', t: 'Derivada de la solución', d: 'Derivar e^(−kt) da −k·e^(−kt) (regla de la cadena). El resultado vuelve a ser −k(T − Tₘ), lo que comprueba que la solución cumple la ecuación.' },
    'f-derivnum': { k: 'Fórmula', t: 'Rapidez con números', d: 'La derivada evaluada en un instante concreto.' },
    'f-deriv2': { k: 'Fórmula', t: 'Segunda derivada', d: 'Derivar otra vez multiplica por −k de nuevo: queda k²(T₀ − Tₘ)e^(−kt). Su signo indica la concavidad de la curva.' },
    'f-q': { k: 'Fórmula', t: 'Potencia térmica', d: 'Calor por segundo = h·A·(T − Tₘ), con los valores de este instante.' },
    'f-Qint': { k: 'Fórmula', t: 'Energía como integral de la potencia', d: 'La energía es la suma (integral) de la potencia en el tiempo. Se reemplaza T − Tₘ por (T₀ − Tₘ)e^(−kt′).' },
    'f-Qanti': { k: 'Fórmula', t: 'Antiderivada de la exponencial', d: 'La antiderivada de e^(−kt′) es −e^(−kt′)/k. Evaluando entre 0 y t queda (1 − e^(−kt))/k.' },
    'f-Q': { k: 'Fórmula', t: 'Energía transferida', d: 'Como hA/k = mc, la energía queda Q = mc(T₀ − Tₘ)(1 − e^(−kt)).' },
    'f-Qcheck': { k: 'Fórmula', t: 'Comprobación', d: 'La energía también es m·c por el cambio de temperatura. Si coincide con la integral, el cálculo es correcto.' },
    'f-Qinf': { k: 'Fórmula', t: 'Energía total', d: 'Cuando t → ∞, e^(−kt) → 0 y la energía tiende a m·c·(T₀ − Tₘ).' },
    'f-tstar': { k: 'Fórmula', t: 'Tiempo para llegar a T*', d: 'Se despeja t de la solución: t* = (1/k)·ln((T₀ − Tₘ)/(T* − Tₘ)).' },
    'f-thalf': { k: 'Fórmula', t: 'Vida media', d: 'Caso particular de t* cuando T* − Tₘ es la mitad de T₀ − Tₘ: t½ = ln 2 / k.' },
    'f-bi': { k: 'Fórmula', t: 'Número de Biot', d: 'Bi = h·L꜀/k_metal. Si es menor que 0.1, el modelo de Newton (temperatura uniforme) es válido.' },
    'f-zeta': { k: 'Fórmula', t: 'Ecuación característica del cilindro', d: 'Se resuelve numéricamente para hallar ζ₁, que permite estimar el perfil de temperatura dentro de la pieza.' },
    'f-kT': { k: 'Fórmula', t: 'k teórica', d: 'k = hA/(ρcV) con las propiedades reales del metal, el h del medio y la geometría.' },
    'f-k1': { k: 'Fórmula', t: 'Método ①: promedio de razones', d: 'Para cada fila se divide la rapidez medida ΔT/Δt entre la diferencia Tᵢ − Tₘ. Se suman las n razones, se dividen entre n (promedio) y se cambia el signo.' },
    'f-k2': { k: 'Fórmula', t: 'Método ②: logaritmo por intervalo', d: 'En cada intervalo, la diferencia con el medio se divide por e^(kΔt). Por eso ln del cociente entre Δt da k exacta. Se promedian los n intervalos.' },
    'f-k3': { k: 'Fórmula', t: 'Método ③: regresión lineal', d: 'y = a + b·t es la recta que mejor se ajusta a los puntos. La pendiente b se calcula con la fórmula de mínimos cuadrados y k₃ = −b.' },
  };

  function explainKey(key) {
    const e = EXPLAIN[key];
    if (!e) return null;
    const c = ctx();
    let v = '';
    if (e.v && c) { try { v = e.v(c) || ''; } catch { v = ''; } }
    return { kind: e.k, title: e.t, body: `<p>${e.d}</p>`, value: v };
  }

  function noiseLine(meas, real) {
    const noise = meas - real;
    return `<p class="xp-calc">Temperatura real (modelo) = <b>${minus(real.toFixed(2))} °C</b><br>Ruido del sensor = <b>${noise >= 0 ? '+' : '−'}${Math.abs(noise).toFixed(2)} °C</b><br>Medición = ${minus(real.toFixed(2))} ${noise >= 0 ? '+' : '−'} ${Math.abs(noise).toFixed(2)} = <b>${minus(meas.toFixed(2))} °C</b></p>`;
  }

  function explainRow(i) {
    const A = state.lastAna;
    if (!A || !A.rows[i]) return null;
    const r = A.rows[i], p = i > 0 ? A.rows[i - 1] : null, l = A.l, dt = A.dt;
    const T = (x) => minus(x.toFixed(2));
    let h = `<p>Medición tomada en <b>t = ${fmtNum(r.t)} s</b>${state.lab ? ' con ruido de sensor' : ' (valor exacto del modelo)'}.</p>`;
    if (state.lab) h += noiseLine(r.T, r.real);
    if (p) {
      h += `<p class="xp-calc"><b>ΔT/Δt</b> = (Tᵢ − Tᵢ₋₁)/Δt = (${T(r.T)} − ${T(p.T)}) / ${fmtNum(dt)} = <b>${minus(r.rate.toFixed(4))} °C/s</b></p>`;
    }
    h += `<p class="xp-calc"><b>T − Tₘ</b> = ${T(r.T)} − ${T(l.Tm)} = <b>${T(r.th)} °C</b></p>`;
    if (r.ratio != null) h += `<p class="xp-calc"><b>Razón</b> = ${minus(r.rate.toFixed(4))} / ${T(r.th)} = <b>${minus(r.ratio.toFixed(5))}</b> ≈ −k (teórica −${f4(l.d.k)})</p>`;
    else if (p) h += `<p class="xp-calc"><b>Razón: n/d</b> — |T − Tₘ| = ${Math.abs(r.th).toFixed(2)} °C es menor que ${A.thr.toFixed(2)} °C, así que el ruido o el redondeo pesarían más que la señal.</p>`;
    if (r.ln != null) h += `<p class="xp-calc"><b>ln|T − Tₘ|</b> = ln(${Math.abs(r.th).toFixed(2)}) = <b>${minus(r.ln.toFixed(4))}</b></p>`;
    if (r.kLog != null) h += `<p class="xp-calc"><b>k del intervalo (método ②)</b> = ln(${T(p.th)} / ${T(r.th)}) / ${fmtNum(dt)} = <b>${f4(r.kLog)} s⁻¹</b></p>`;
    if (p && state.lab && Math.sign(r.T - p.T) !== Math.sign(-l.d.dT0) && Math.abs(r.T - p.T) > 1e-9) {
      h += `<p class="xp-warn">⚠ Aquí la medición ${l.d.dT0 > 0 ? 'subió' : 'bajó'} aunque la pieza ${l.d.dT0 > 0 ? 'se está enfriando' : 'se está calentando'}. La temperatura real cambió solo ${Math.abs(r.real - p.real).toFixed(2)} °C en este intervalo, menos que el ruido del sensor. No es un error del cálculo: así se ven las mediciones reales cerca del equilibrio.</p>`;
    }
    return { kind: 'Fila de la tabla', title: `Fila i = ${i}`, body: h, value: '' };
  }

  function explainCell(laneId, i) {
    const l = state.lanes.find((x) => x.id === laneId);
    if (!l || !l.d || l.d.error) return null;
    const dt = state.dtComp, t = i * dt;
    const meas = measured(l, t, i, 1), real = Tat(l, t);
    let h = `<p>Experimento <b>${l.id}</b> (${esc(l.d.metal.short)} en ${esc(l.d.fluid.short)}), medición <b>#${i}</b> en <b>t = ${fmtNum(t)} s</b>.</p>`;
    h += `<p class="xp-calc">T(t) = Tₘ + (T₀ − Tₘ)·e^(−kt) = ${minus(String(l.Tm))} + (${fmtSig(l.d.dT0, 4)})·e^(−${f4(l.d.k)}·${fmtNum(t)}) = <b>${minus(real.toFixed(2))} °C</b></p>`;
    if (state.lab) {
      h += noiseLine(meas, real);
      if (i > 0) {
        const pm = measured(l, t - dt, i - 1, 1), pr = Tat(l, t - dt);
        if (Math.sign(meas - pm) !== Math.sign(-l.d.dT0) && Math.abs(meas - pm) > 1e-9) {
          h += `<p class="xp-warn">⚠ Esta medición ${l.d.dT0 > 0 ? 'es mayor' : 'es menor'} que la anterior (${minus(pm.toFixed(2))} °C), pero la temperatura real sí ${l.d.dT0 > 0 ? 'bajó' : 'subió'}: de ${minus(pr.toFixed(2))} a ${minus(real.toFixed(2))} °C. El cambio real (${Math.abs(real - pr).toFixed(2)} °C) es menor que el ruido del sensor.</p>`;
        }
      }
    }
    return { kind: 'Medición', title: `Medición de ${l.id} en t = ${fmtNum(t)} s`, body: h, value: '' };
  }

  let pop = null;
  function hidePop() { if (pop) pop.hidden = true; document.querySelectorAll('.x-active').forEach((el) => el.classList.remove('x-active')); }
  function showPop(info, x, y, target) {
    if (!pop) {
      pop = document.createElement('div');
      pop.className = 'xpop';
      pop.setAttribute('role', 'dialog');
      document.body.appendChild(pop);
    }
    hidePop();
    target.classList.add('x-active');
    pop.innerHTML = `<button class="xpop-close" aria-label="Cerrar">✕</button>
      <div class="xpop-kind">${info.kind}</div><h5>${info.title}</h5>${info.body}
      ${info.value ? `<div class="xpop-val">📍 En este experimento: <b>${info.value}</b></div>` : ''}`;
    pop.hidden = false;
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(380, vw - 20);
    pop.style.width = `${w}px`;
    const h = pop.offsetHeight;
    pop.style.left = `${Math.min(Math.max(10, x + 12), vw - w - 10)}px`;
    pop.style.top = `${y + 16 + h < vh ? y + 16 : Math.max(10, y - h - 12)}px`;
  }

  function setupExplain() {
    document.addEventListener('click', (e) => {
      if (pop && pop.contains(e.target)) { if (e.target.closest('.xpop-close')) hidePop(); return; }
      const xEl = e.target.closest('[data-x]');
      const rowEl = e.target.closest('#tbl-ana tbody tr[data-row]');
      const cellEl = e.target.closest('#tbl-comp td[data-lane]');
      let info = null, target = null;
      if (xEl) { info = explainKey(xEl.dataset.x); target = xEl; }
      else if (rowEl) { info = explainRow(Number(rowEl.dataset.row)); target = rowEl; }
      else if (cellEl) { info = explainCell(cellEl.dataset.lane, Number(cellEl.dataset.i)); target = cellEl; }
      if (info) showPop(info, e.clientX, e.clientY, target); else hidePop();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePop(); });
    window.addEventListener('scroll', hidePop, { passive: true });
  }

  // ===================== TABLAS DE PROPIEDADES =====================
  function renderRefTables() {
    const usedM = {}, usedF = {};
    state.lanes.forEach((l) => { (usedM[l.metal] = usedM[l.metal] || []).push(l); (usedF[l.fluid] = usedF[l.fluid] || []).push(l); });
    const chips = (arr) => (arr || []).map((l) => `<span class="chip" style="background:${l.color}">${l.id}</span>`).join('');
    const mRows = Object.entries(METALS).map(([key, m0]) => {
      const lane = usedM[key] && usedM[key][0];
      const m = key === 'custom' && lane ? metalOf(lane) : m0;
      const alpha = (m.k / (m.rho * m.c)) * 1e6;
      return `<tr class="${usedM[key] ? 'used' : ''}"><td class="left">${esc(m0.name)}</td><td>${m.rho}</td><td>${m.c}</td><td>${m.k}</td><td>${alpha.toFixed(2)}</td><td>${((m.rho * m.c) / 1e6).toFixed(2)}</td><td>${m.tMelt}</td><td>${chips(usedM[key])}</td></tr>`;
    }).join('');
    $('tbl-metals').innerHTML = `<thead><tr><th class="left">Metal</th><th>ρ (kg/m³)</th><th>c (J/kg·K)</th><th>k (W/m·K)</th><th>α = k/ρc (mm²/s)</th><th>ρc (MJ/m³·K)</th><th>T fusión (°C)</th><th>En uso</th></tr></thead><tbody>${mRows}</tbody>`;
    const show = (v) => (v == null ? '—' : `${minus(String(v))} °C`);
    const fRows = Object.entries(FLUIDS).map(([key, f]) => `<tr class="${usedF[key] ? 'used' : ''}"><td class="left">${esc(f.name)}</td><td>${f.h}</td><td>${esc(f.hRange)}</td><td>${show(f.tBath)}</td><td>${show(f.tBoil)}</td><td>${show(f.tLeid)}</td><td class="note-cell">${esc(f.note)}</td><td>${chips(usedF[key])}</td></tr>`).join('');
    $('tbl-fluids').innerHTML = `<thead><tr><th class="left">Medio</th><th>h típico (W/m²·K)</th><th>Rango de h</th><th>T del medio</th><th>Ebullición</th><th>Capa de vapor hasta</th><th class="left">Notas</th><th>En uso</th></tr></thead><tbody>${fRows}</tbody>`;
  }

  // ===================== RENDER GENERAL =====================
  function renderSlow() { renderMath(); renderComparative(); renderAnalysis(); }
  function renderAll() {
    state.sig = {};
    drawTChart();
    drawQChart();
    renderSlow();
  }

  // ===================== EXPORTACIÓN =====================
  function download(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  const csvBlob = (lines) => new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });

  // ===================== EVENTOS GLOBALES =====================
  function bindGlobal() {
    const geo = (key) => (e) => {
      const v = parseFloat(e.target.value);
      if (isFinite(v) && v > 0) state.geom[key] = v; else e.target.value = state.geom[key];
      state.preset = null;
      document.querySelectorAll('.preset').forEach((b) => b.classList.remove('active'));
      paramsChanged();
    };
    $('geo-D').addEventListener('change', geo('D'));
    $('geo-L').addEventListener('change', geo('L'));

    $('speed-mode').addEventListener('change', (e) => {
      state.speedMode = e.target.value;
      $('speed-exp').disabled = state.speedMode !== 'manual';
      updateStatus();
    });
    $('speed-exp').addEventListener('input', (e) => {
      state.speedExp = Number(e.target.value);
      $('speed-out').textContent = `×${fmtSig(Math.pow(10, state.speedExp), 2)}`;
      updateStatus();
    });

    $('opt-thermal').addEventListener('change', (e) => {
      state.thermal = e.target.checked;
      state.lanes.forEach((l) => { if (l.dims) applyStageMode(l); updateReadouts(l); });
      updateThermalLegend();
    });
    $('opt-log').addEventListener('change', (e) => { state.logTime = e.target.checked; drawTChart(); });
    $('opt-lab').addEventListener('change', (e) => { state.lab = e.target.checked; state.dtAna = null; applyDefaults(); renderAll(); });

    $('btn-start').addEventListener('click', start);
    $('btn-pause').addEventListener('click', pause);
    $('btn-reset').addEventListener('click', reset);

    $('dt-comp').addEventListener('change', (e) => {
      const v = parseFloat(e.target.value);
      if (v > 0) state.dtComp = v; else e.target.value = state.dtComp;
      renderAll();
    });
    $('dt-ana').addEventListener('change', (e) => {
      const v = parseFloat(e.target.value);
      if (v > 0) state.dtAna = v; else e.target.value = state.dtAna;
      state.sig.ana = null; renderAnalysis();
    });
    $('t-star').addEventListener('change', (e) => {
      const v = parseFloat(e.target.value);
      state.tStar = isFinite(v) ? v : null;
      renderMath();
    });

    $('btn-png').addEventListener('click', () => $('chartT').toBlob((b) => download('temperatura_vs_tiempo.png', b), 'image/png'));
    $('btn-csv-comp').addEventListener('click', () => {
      const { act, rows } = compRows();
      const lines = [['#', 't (s)', ...act.map((l) => `T ${l.id} ${l.d.metal.short} en ${l.d.fluid.short} (°C)`)].join(',')];
      rows.forEach((r) => lines.push([r.i, r.t, ...r.T.map((v) => v.toFixed(3))].join(',')));
      download('tabla_comparativa.csv', csvBlob(lines));
    });
    $('btn-csv-ana').addEventListener('click', () => {
      const A = anaData(); if (!A) return;
      const lines = ['i,t (s),T (°C),dT/dt (°C/s),T-Tm,(dT/dt)/(T-Tm),ln|T-Tm|'];
      A.rows.forEach((r) => lines.push([r.i, r.t, r.T.toFixed(4), r.rate ?? '', r.th.toFixed(4), r.ratio ?? '', r.ln ?? ''].join(',')));
      download(`analisis_${A.l.id}.csv`, csvBlob(lines));
    });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { drawTChart(); drawQChart(); drawLnChart(anaData()); }, 120);
    });
  }

  // ===================== ESCENARIOS =====================
  function buildPresets() {
    $('presets').innerHTML = PRESETS.map((p) => `<button class="preset" data-key="${p.key}"><strong>${p.label}</strong><span>${esc(p.desc)}</span></button>`).join('');
    $('presets').querySelectorAll('.preset').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.key)));
  }
  function applyPreset(key) {
    const p = PRESETS.find((x) => x.key === key);
    state.geom.D = p.D; state.geom.L = p.L;
    $('geo-D').value = p.D; $('geo-L').value = p.L;
    p.lanes.forEach((cfg, i) => {
      const l = state.lanes[i], f = FLUIDS[cfg.fluid];
      l.metal = cfg.metal; l.fluid = cfg.fluid; l.T0 = cfg.T0; l.Tm = f.tBath; l.h = f.h;
    });
    state.preset = key;
    document.querySelectorAll('.preset').forEach((b) => b.classList.toggle('active', b.dataset.key === key));
    state.lanes.forEach(syncLaneInputs);
    paramsChanged();
  }

  // ===================== INICIO =====================
  buildPresets();
  $('lanes').innerHTML = state.lanes.map(laneHTML).join('');
  state.lanes.forEach(bindLane);
  buildFocus();
  bindGlobal();
  setupExplain();
  applyPreset('clasico');
})();
