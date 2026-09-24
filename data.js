// Datos físicos de referencia del simulador.
// Metales: Incropera, DeWitt, Bergman & Lavine, "Fundamentals of Heat and Mass Transfer", Tabla A.1 (propiedades a 300 K).
// Medios: rangos de h de Incropera Tabla 1.1 y valores efectivos típicos de la literatura de tratamiento térmico (ASM Handbook Vol. 4).
window.THERMO_DATA = (() => {
  const METALS = {
    acero1010: { name: 'Acero al carbono AISI 1010', short: 'Acero 1010', rho: 7832, c: 434, k: 63.9, tMelt: 1500, base: [112, 117, 124] },
    inox304:   { name: 'Acero inoxidable AISI 304',  short: 'Inox 304',   rho: 7900, c: 477, k: 14.9, tMelt: 1400, base: [178, 185, 193] },
    hierro:    { name: 'Hierro puro',                short: 'Hierro',     rho: 7870, c: 447, k: 80.2, tMelt: 1538, base: [92, 96, 101] },
    cobre:     { name: 'Cobre puro',                 short: 'Cobre',      rho: 8933, c: 385, k: 401,  tMelt: 1085, base: [190, 112, 60] },
    aluminio:  { name: 'Aluminio puro',              short: 'Aluminio',   rho: 2702, c: 903, k: 237,  tMelt: 660,  base: [205, 210, 216] },
    laton:     { name: 'Latón 70Cu–30Zn',            short: 'Latón',      rho: 8530, c: 380, k: 110,  tMelt: 915,  base: [205, 168, 78] },
    titanio:   { name: 'Titanio',                    short: 'Titanio',    rho: 4500, c: 522, k: 21.9, tMelt: 1668, base: [140, 146, 158] },
    niquel:    { name: 'Níquel puro',                short: 'Níquel',     rho: 8900, c: 444, k: 90.7, tMelt: 1455, base: [170, 166, 156] },
    plata:     { name: 'Plata pura',                 short: 'Plata',      rho: 10500, c: 235, k: 429, tMelt: 962,  base: [218, 221, 225] },
    oro:       { name: 'Oro puro',                   short: 'Oro',        rho: 19300, c: 129, k: 317, tMelt: 1064, base: [214, 178, 58] },
    tungsteno: { name: 'Tungsteno',                  short: 'Tungsteno',  rho: 19300, c: 132, k: 174, tMelt: 3422, base: [125, 129, 135] },
    custom:    { name: 'Metal personalizado (digita sus propiedades)', short: 'Metal propio', rho: 7800, c: 450, k: 50, tMelt: 1400, base: [140, 142, 152], custom: true },
  };

  // kind: gas | liquid | cryo | furnace. tBoil / tLeid: umbrales aproximados de ebullición y de capa de vapor (Leidenfrost).
  const FLUIDS = {
    aireQuieto: {
      group: 'Gases', name: 'Aire quieto (convección natural)', short: 'Aire quieto', kind: 'gas',
      h: 10, hRange: '2 – 25', tBath: 25, tBoil: null, tLeid: null,
      note: 'Sobre ~500 °C la radiación aporta más que la convección (≈ 100 W/m²·K a 900 °C); este modelo no la incluye.',
    },
    aireForzado: {
      group: 'Gases', name: 'Aire forzado (ventilador)', short: 'Aire forzado', kind: 'gas', forced: true,
      h: 100, hRange: '25 – 250', tBath: 25, tBoil: null, tLeid: null,
      note: 'El ventilador renueva el aire junto a la pieza y multiplica h.',
    },
    aceite: {
      group: 'Líquidos de temple', name: 'Aceite de temple', short: 'Aceite', kind: 'liquid',
      h: 800, hRange: '500 – 1500', tBath: 60, tBoil: 300, tLeid: 550, color: [150, 95, 35], opacity: 0.92, front: 0.45,
      note: 'Aceite mineral; el baño se mantiene tibio (40–80 °C). Temple moderado, menos grietas.',
    },
    polimero: {
      group: 'Líquidos de temple', name: 'Polímero PAG (solución acuosa)', short: 'Polímero', kind: 'liquid',
      h: 1800, hRange: '1000 – 3500', tBath: 40, tBoil: 100, tLeid: 450, color: [120, 190, 165], opacity: 0.75, front: 0.2,
      note: 'Polialquilenglicol en agua: su severidad se ajusta con la concentración, entre aceite y agua.',
    },
    agua: {
      group: 'Líquidos de temple', name: 'Agua', short: 'Agua', kind: 'liquid',
      h: 3000, hRange: '2000 – 5000', tBath: 20, tBoil: 100, tLeid: 400, color: [70, 150, 205], opacity: 0.6, front: 0.12,
      note: 'Temple severo: máxima dureza, pero mayor riesgo de grietas y distorsión.',
    },
    salmuera: {
      group: 'Líquidos de temple', name: 'Salmuera (NaCl 10 %)', short: 'Salmuera', kind: 'liquid',
      h: 6000, hRange: '4000 – 10000', tBath: 20, tBoil: 102, tLeid: null, color: [105, 160, 200], opacity: 0.62, front: 0.15,
      note: 'La sal rompe la capa de vapor: no hay etapa Leidenfrost estable, por eso enfría más rápido que el agua.',
    },
    sales: {
      group: 'Líquidos de temple', name: 'Baño de sales fundidas', short: 'Sales fundidas', kind: 'liquid',
      h: 1200, hRange: '800 – 2000', tBath: 300, tBoil: null, tLeid: null, color: [228, 205, 150], opacity: 0.92, front: 0.35,
      note: 'Nitratos fundidos (austempering): la pieza solo baja hasta la temperatura del baño, no hasta el ambiente.',
    },
    nitrogeno: {
      group: 'Especiales', name: 'Nitrógeno líquido', short: 'N₂ líquido', kind: 'cryo',
      h: 150, hRange: '100 – 250 (ebullición en película)', tBath: -196, tBoil: -196, tLeid: -150, color: [195, 228, 248], opacity: 0.45, front: 0.1,
      note: 'Hierve a −196 °C. Una película de vapor aísla la pieza casi todo el tiempo: por eso h es sorprendentemente bajo.',
    },
    horno: {
      group: 'Especiales', name: 'Horno (aire caliente)', short: 'Horno', kind: 'furnace',
      h: 50, hRange: '20 – 100', tBath: 850, tBoil: null, tLeid: null,
      note: 'Aire caliente y radiación de las paredes: una pieza fría GANA calor.',
    },
    custom: {
      group: 'Otro', name: 'Medio personalizado (digita h y T)', short: 'Medio propio', kind: 'liquid',
      h: 500, hRange: 'libre', tBath: 25, tBoil: null, tLeid: null, color: [150, 160, 185], opacity: 0.6, front: 0.15,
      note: 'Con h < 200 W/m²·K se dibuja como gas; con h mayor, como líquido.',
    },
  };

  const PRESETS = [
    {
      key: 'clasico', label: '🔥 Temple clásico', desc: 'Acero a 900 °C en aire, aceite y agua',
      D: 10, L: 100,
      lanes: [
        { metal: 'acero1010', fluid: 'aireQuieto', T0: 900 },
        { metal: 'acero1010', fluid: 'aceite', T0: 900 },
        { metal: 'acero1010', fluid: 'agua', T0: 900 },
      ],
    },
    {
      key: 'metales', label: '⚔️ Duelo de metales', desc: 'Cobre, acero y aluminio a 500 °C en agua',
      D: 10, L: 100,
      lanes: [
        { metal: 'cobre', fluid: 'agua', T0: 500 },
        { metal: 'acero1010', fluid: 'agua', T0: 500 },
        { metal: 'aluminio', fluid: 'agua', T0: 500 },
      ],
    },
    {
      key: 'medios', label: '🧪 Polímero vs agua vs salmuera', desc: 'Acero a 850 °C en tres medios severos',
      D: 10, L: 100,
      lanes: [
        { metal: 'acero1010', fluid: 'polimero', T0: 850 },
        { metal: 'acero1010', fluid: 'agua', T0: 850 },
        { metal: 'acero1010', fluid: 'salmuera', T0: 850 },
      ],
    },
    {
      key: 'horno', label: '♨️ Ganar calor', desc: 'Piezas a 25 °C dentro de un horno a 850 °C',
      D: 10, L: 100,
      lanes: [
        { metal: 'acero1010', fluid: 'horno', T0: 25 },
        { metal: 'inox304', fluid: 'horno', T0: 25 },
        { metal: 'titanio', fluid: 'horno', T0: 25 },
      ],
    },
    {
      key: 'cryo', label: '🧊 Criogenia', desc: 'Nitrógeno líquido, y una pieza helada que se calienta al aire',
      D: 10, L: 100,
      lanes: [
        { metal: 'cobre', fluid: 'nitrogeno', T0: 25 },
        { metal: 'acero1010', fluid: 'nitrogeno', T0: 25 },
        { metal: 'aluminio', fluid: 'aireQuieto', T0: -196 },
      ],
    },
  ];

  const LANE_COLORS = { A: '#ea580c', B: '#7c3aed', C: '#0284c7' };

  return { METALS, FLUIDS, PRESETS, LANE_COLORS };
})();
